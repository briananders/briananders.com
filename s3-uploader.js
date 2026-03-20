const fs = require('fs-extra');
const http = require('http');
const https = require('https');
const { glob } = require('glob');
const path = require('path');

const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const {
  S3Client,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { NodeHttpHandler } = require('@smithy/node-http-handler');

const dir = require('./build/constants/directories')(__dirname);

const production = require(`${dir.build}helpers/production`);

const deleteAllowlist = require('./s3-upload-allowlist.json');

const awsRegion = process.env.AWS_REGION || 'us-east-1';

const awsCredentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

const maxSockets = Math.max(128, Number(process.env.S3_UPLOAD_MAX_SOCKETS) || 128);
const requestHandler = new NodeHttpHandler({
  httpAgent: new http.Agent({ keepAlive: true, maxSockets }),
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets }),
});

const s3Client = new S3Client({
  region: awsRegion,
  credentials: awsCredentials,
  requestHandler,
});

const cloudfrontClient = new CloudFrontClient({
  region: 'us-east-1',
  credentials: awsCredentials,
  requestHandler,
});

const bucketName = (production) ? 'www.briananders.com' : 'staging.briananders.com';

const getContentType = (fileName) => {
  const extn = path.extname(fileName);
  const xtn = extn.substring(1);

  switch (extn) {
    case '.json':
    case '.zip':
      return `application/${xtn}`;
    case '.png':
    case '.webp':
    case '.gif':
      return `image/${xtn}`;
    case '.mpeg':
    case '.webm':
    case '.mp4':
      return `video/${xtn}`;
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.html':
    case '.htm':
      return 'text/html; charset=UTF-8';
    case '.txt':
      return 'text/plain; charset=UTF-8';
    case '.xml':
      return 'application/xml; charset=UTF-8';
    case '.css':
      return 'text/css; charset=UTF-8';
    case '.js':
      return 'text/javascript; charset=UTF-8';
    case '.svg':
      return 'image/svg+xml';
    case '.gz':
      return 'application/gzip';
    case '.ico':
      return 'image/vnd.microsoft.icon';
    case '.mp3':
      return 'audio/mpeg';
    default:
      return 'application/octet-stream';
  }
};

function objectPublicUrl(key) {
  const host = awsRegion === 'us-east-1'
    ? `${bucketName}.s3.amazonaws.com`
    : `${bucketName}.s3.${awsRegion}.amazonaws.com`;
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `https://${host}/${encodedKey}`;
}

/** Every object key in the bucket (paginated; required for correct sync decisions). */
async function listAllS3Keys() {
  const keys = [];
  let ContinuationToken;

  do {
    // eslint-disable-next-line no-await-in-loop
    const data = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 1000,
      ContinuationToken,
    }));

    if (data.Contents) {
      for (let i = 0; i < data.Contents.length; i += 1) {
        keys.push(data.Contents[i].Key);
      }
    }

    ContinuationToken = data.IsTruncated ? data.NextContinuationToken : undefined;
  } while (ContinuationToken);

  return keys;
}

const S3_DELETE_BATCH_SIZE = 1000;
const DELETE_BATCH_CONCURRENCY = 8;

async function deleteS3Files(fileList) {
  if (fileList.length === 0) {
    return;
  }

  const batches = [];
  for (let i = 0; i < fileList.length; i += S3_DELETE_BATCH_SIZE) {
    batches.push(fileList.slice(i, i + S3_DELETE_BATCH_SIZE));
  }

  let batchIndex = 0;

  const worker = async () => {
    while (batchIndex < batches.length) {
      const sliceStart = batchIndex;
      batchIndex += 1;
      const chunk = batches[sliceStart];
      // eslint-disable-next-line no-await-in-loop
      await s3Client.send(new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: chunk,
          Quiet: false,
        },
      }));
    }
  };

  const pool = Math.min(DELETE_BATCH_CONCURRENCY, batches.length);
  await Promise.all(Array.from({ length: pool }, () => worker()));
}

function getCacheControl(fileName) {
  const extn = path.extname(fileName);

  switch (extn) {
    case '.html':
    case '.html.gz':
    case '.xml':
    case '.xml.gz':
    case '.json':
    case '.json.gz':
    case '.txt':
    case '.txt.gz':
      return 'no-cache,no-store';
    default:
      return 'max-age=15552000,public';
  }
}

const MAX_UPLOAD_CONCURRENCY = Math.min(
  50,
  Math.max(1, Number(process.env.S3_UPLOAD_CONCURRENCY) || 50),
);

const expiresHeader = new Date('2034-01-01T00:00:00.000Z');

async function uploadFiles(fileList) {
  fs.chmodSync(dir.package, '0755');

  const total = fileList.length;
  let completed = 0;

  const logProgress = () => {
    if (completed % 10 === 0 || completed === total) {
      const pct = total ? Math.floor((completed / total) * 100) : 100;
      console.log(`${completed}/${total}: ${pct}%`);
    }
  };

  const uploadOne = async (fileName) => {
    const fileLocation = fileName.replace(dir.package, '');
    const fileStream = fs.createReadStream(fileName);

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucketName,
        Key: fileLocation,
        Body: fileStream,
        ContentType: getContentType(fileName),
        ACL: 'public-read',
        Expires: expiresHeader,
        CacheControl: getCacheControl(fileName),
      },
    });

    await upload.done();
    console.log(`File uploaded successfully at ${objectPublicUrl(fileLocation)}`);
    completed += 1;
    logProgress();
    return fileLocation;
  };

  let fileIndex = 0;

  const worker = async () => {
    while (fileIndex < fileList.length) {
      const i = fileIndex;
      fileIndex += 1;
      // eslint-disable-next-line no-await-in-loop
      await uploadOne(fileList[i]);
    }
  };

  const pool = Math.min(MAX_UPLOAD_CONCURRENCY, Math.max(1, fileList.length));
  await Promise.all(Array.from({ length: pool }, () => worker()));
  return fileList;
}

async function invalidateCloudFront() {
  console.log('Invalidate Cache');

  const data = await cloudfrontClient.send(new CreateInvalidationCommand({
    DistributionId: process.env.CLOUDFRONT_ID,
    InvalidationBatch: {
      CallerReference: Date.now().toString(),
      Paths: {
        Quantity: 1,
        Items: [
          '/*'
        ],
      },
    },
  }));

  console.log(data);
}

const SWAP_FILES_REGEXES = [
  /\.html$/,
  /\.html\.gz$/,
  /\.xml$/,
  /\.xml\.gz$/,
  /\.json$/,
  /\.json\.gz$/,
  /\.txt$/,
  /\.ico$/
];

const alwaysSwapFiles = (fileName) => SWAP_FILES_REGEXES.some((regex) => regex.test(fileName));

async function main() {
  const [s3FileList, packageGlob] = await Promise.all([
    listAllS3Keys(),
    glob(`${dir.package}**/*`)
  ]);

  const s3FileSet = new Set(s3FileList);
  const packageSet = new Set(packageGlob);

  const isAllowlisted = (filePath) => deleteAllowlist.some(
    (d) => filePath.startsWith(d) || filePath.startsWith(d.substring(1)),
  );

  const s3DeleteList = s3FileList.filter((s3File) => !isAllowlisted(s3File)
    && (!packageSet.has(dir.package + s3File)
    || alwaysSwapFiles(s3File)));

  const toUploadList = packageGlob.filter((packageFile) => !fs.lstatSync(packageFile).isDirectory()
    && (
      !s3FileSet.has(packageFile.replace(dir.package, ''))
      || alwaysSwapFiles(packageFile)
    ));

  console.log(`${s3DeleteList.length + toUploadList.length} files to change`);

  const s3DeleteListTranslate = s3DeleteList.map((file) => ({ Key: file }));

  await deleteS3Files(s3DeleteListTranslate);
  await uploadFiles(toUploadList);

  console.log('Upload Complete');

  if (production) {
    await invalidateCloudFront();
  }

  console.log('Run `blc https://briananders.com -ro` to check for broken links');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
