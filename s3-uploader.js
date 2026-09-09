/**
 * @fileoverview Deploys the briananders.com static site package to AWS S3.
 *
 * Syncs the local build output to S3, deleting stale files and uploading new or
 * changed ones. Dynamic files (HTML, XML, JSON, TXT, ICO) are always re-uploaded
 * to guarantee fresh content. Paths in s3-upload-allowlist.json are never deleted,
 * preserving external data managed by separate repositories.
 *
 * Source:      package/  (built static site, populated by `npm run build`)
 * Destination: www.briananders.com      (production, NODE_ENV=production)
 *              staging.briananders.com  (staging)
 *
 * Preserved S3 paths (s3-upload-allowlist.json — never deleted during sync):
 *   /band-news/        managed by music-news repo
 *   /last-fm-history/  managed by last-fm-scrobbles repo
 *   /data/             managed by briananders.com-data-files repo
 *   /movies/           managed by imdb-data-scraper repo
 *
 * CloudFront:  Invalidates /* after a production deploy via CLOUDFRONT_ID.
 *
 * Required environment variables:
 *   AWS_ACCESS_KEY        - AWS IAM access key ID
 *   AWS_SECRET_ACCESS_KEY - AWS IAM secret access key
 *   CLOUDFRONT_ID         - CloudFront distribution ID (production only)
 *
 * Optional environment variables:
 *   AWS_REGION            - AWS region (default: us-east-1)
 *   S3_UPLOAD_MAX_SOCKETS - Max concurrent HTTP sockets (default: 128)
 *   S3_UPLOAD_CONCURRENCY - Max concurrent file uploads (default: 50)
 *
 * Usage:
 *   npm run deploy   (NODE_ENV=production node s3-uploader.js)
 *   npm run stage    (node s3-uploader.js)
 */

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

/**
 * Resolves the MIME content type string based on the file extension.
 *
 * @param {string} fileName - File path or file name with extension.
 * @returns {string} Corresponding MIME type header value with charset if applicable.
 */
const getContentType = (fileName) => {
  const extn = path.extname(fileName);
  const xtn = extn.substring(1);

  switch (extn) {
    case '.json':
    case '.zip':
      return `application/${xtn}`;
    case '.png':
    case '.webp':
    case '.avif':
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

/**
 * Constructs the public S3 HTTPS URL for a given object key.
 *
 * @param {string} key - S3 object key path.
 * @returns {string} Fully qualified public HTTPS URL.
 */
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

/**
 * Deletes a list of S3 objects in batches of up to 1000 with concurrency pool.
 *
 * @param {Array<{Key: string}>} fileList - List of object key descriptors to delete.
 * @returns {Promise<void>}
 */
async function deleteS3Files(fileList) {
  if (fileList.length === 0) {
    return;
  }

  const batches = [];
  for (let i = 0; i < fileList.length; i += S3_DELETE_BATCH_SIZE) {
    batches.push(fileList.slice(i, i + S3_DELETE_BATCH_SIZE));
  }

  let batchIndex = 0;

  /**
   * Concurrently processes and deletes chunks of S3 objects.
   */
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

/**
 * Determines the HTTP Cache-Control header value for a given file based on extension.
 * Unwraps `.gz` so gzipped dynamic files receive `no-cache,no-store`.
 *
 * @param {string} fileName - The file name or path.
 * @returns {string} Cache-Control header directive value.
 */
function getCacheControl(fileName) {
  const extn = path.extname(fileName);
  // Unwrap double extensions (e.g. .html.gz → .html) so gzipped dynamic files
  // receive the same no-cache directive as their uncompressed counterparts.
  const effectiveExtn = extn === '.gz'
    ? path.extname(path.basename(fileName, extn))
    : extn;

  switch (effectiveExtn) {
    case '.html':
    case '.xml':
    case '.json':
    case '.txt':
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

/**
 * Uploads a list of local files to the target S3 bucket with concurrency pooling.
 *
 * @param {string[]} fileList - Array of absolute file paths to upload.
 * @returns {Promise<string[]>} Array of uploaded file paths.
 */
async function uploadFiles(fileList) {
  fs.chmodSync(dir.package, '0755');

  const total = fileList.length;
  let completed = 0;

  /**
   * Logs upload progress percentage at intervals or upon completion.
   */
  const logProgress = () => {
    if (completed % 10 === 0 || completed === total) {
      const pct = total ? Math.floor((completed / total) * 100) : 100;
      console.log(`${completed}/${total}: ${pct}%`);
    }
  };

  /**
   * Streams and uploads a single file to S3 with appropriate headers.
   *
   * @param {string} fileName - Absolute path of file to upload.
   * @returns {Promise<string>} S3 key location of the uploaded object.
   */
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

  /**
   * Worker pool task runner that uploads files until the queue is exhausted.
   */
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

/**
 * Creates a CloudFront cache invalidation for all paths ('/*') on the configured distribution.
 *
 * @returns {Promise<void>}
 */
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

/**
 * Checks whether a given filename matches any of the dynamic file types that must always be swapped/re-uploaded.
 *
 * @param {string} fileName - File name or path to test.
 * @returns {boolean} True if the file should always be re-uploaded.
 */
const alwaysSwapFiles = (fileName) => SWAP_FILES_REGEXES.some((regex) => regex.test(fileName));

/**
 * Main deployment entry point: scans S3 bucket and local package directory,
 * calculates diffs, deletes obsolete objects, uploads new/changed objects, and invalidates CloudFront.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const [s3FileList, packageGlob] = await Promise.all([
    listAllS3Keys(),
    glob(`${dir.package}**/*`)
  ]);

  const s3FileSet = new Set(s3FileList);
  const packageSet = new Set(packageGlob);

  /**
   * Helper to check if a given file path starts with an allowlisted path prefix.
   *
   * @param {string} filePath - S3 key or relative path.
   * @returns {boolean} True if path is preserved in allowlist.
   */
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

