const fs = require('fs-extra');
const AWS = require('aws-sdk');
const glob = require('glob');
const path = require('path');

const dir = {
  root: `${__dirname}/`,
  build: `${__dirname}/build/`,
  package: `${__dirname}/package/`,
};

const production = require(`${dir.build}helpers/production`);

const awsCreds = {
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

const s3 = new AWS.S3(awsCreds);
const cloudfront = new AWS.CloudFront(awsCreds);

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

async function listAllS3Objects() {
  const all = [];
  let ContinuationToken;
  do {
    // eslint-disable-next-line no-await-in-loop
    const page = await new Promise((resolve, reject) => {
      s3.listObjectsV2({
        Bucket: bucketName,
        ContinuationToken,
        MaxKeys: 1000,
      }, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
    all.push(...(page.Contents || []));
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return all;
}

function deleteS3Files(fileList) {
  const deletePromise = new Promise((resolve, reject) => {
    if (fileList.length === 0) {
      resolve([]);
    } else {
      s3.deleteObjects({
        Bucket: bucketName,
        Delete: {
          Objects: fileList,
          Quiet: false,
        },
      }, (err, data) => {
        if (err) reject(err);
        else resolve(data); // successful response
      });
    }
  });

  return deletePromise;
};

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
};

function uploadFile(fileName, index, fileList) {
  if (!(index % 10)) {
    console.log(`${index}/${fileList.length}: ${Math.floor((index / fileList.length) * 100)}%`);
  }

  const fileLocation = fileName.replace(dir.package, '');

  const uploadPromise = new Promise((resolve, reject) => {
    if (fs.lstatSync(fileName).isDirectory()) resolve(fileLocation);
    const fileData = fs.readFileSync(fileName);
    s3.upload({
      Bucket: bucketName,
      Key: fileLocation,
      Body: fileData,
      ContentType: getContentType(fileName),
      ACL: 'public-read',
      Expires: '2034-01-01T00:00:00Z',
      CacheControl: getCacheControl(fileName),
      MetadataDirective: 'REPLACE',
    }, (err, uploadData) => {
      if (err) reject(err);
      else {
        console.log(`File uploaded successfully at ${uploadData.Location}`);
        resolve(fileLocation);
      }
    });
  });

  return uploadPromise;
};

function uploadFiles(fileList, concurrency = 10) {
  fs.chmodSync(dir.package, '0755');

  return new Promise((resolve, reject) => {
    const total = fileList.length;
    const results = new Array(total);
    let inFlight = 0;
    let index = 0;

    function schedule() {
      if (index >= total && inFlight === 0) {
        resolve(results);
        return;
      }
      while (inFlight < concurrency && index < total) {
        const i = index++;
        inFlight++;
        uploadFile(fileList[i], i, fileList)
          .then((res) => {
            results[i] = res;
            inFlight--;
            schedule();
          })
          .catch(reject);
      }
    }

    schedule();
  });
}

function invalidateCloudFront(changedKeys = []) {
  console.log('Invalidate Cache');

  let items = Array.from(new Set(changedKeys
    .map((k) => (k.startsWith('/') ? k : `/${k}`))
    .map((k) => k.replace(/\/+/g, '/'))));

  // Fallback to wildcard if no keys provided
  if (items.length === 0) items = ['/*'];

  // CloudFront limit is 1000 paths per invalidation
  if (items.length > 1000) items = items.slice(0, 1000);

  const params = {
    DistributionId: process.env.CLOUDFRONT_ID,
    InvalidationBatch: {
      CallerReference: Date.now().toString(),
      Paths: {
        Quantity: items.length,
        Items: items,
      },
    },
  };

  cloudfront.createInvalidation(params, (err, data) => {
    if (err) console.log(err, err.stack);
    else console.log(data);
  });
}

const alwaysSwapFiles = (fileName) => [
  /\.html$/,
  /\.html\.gz$/,
  /\.xml$/,
  /\.xml\.gz$/,
  /\.json$/,
  /\.json\.gz$/,
  /\.txt$/,
  /\.ico$/
].filter((regex) => regex.test(fileName)).length;

listAllS3Objects().then((data) => {
  const s3FileList = data.map(({ Key }) => Key);

  const packageGlob = glob.sync(`${dir.package}**/*`);

  const s3DeleteList = s3FileList.filter((s3File) => !packageGlob.includes(dir.package + s3File)
      || alwaysSwapFiles(s3File));

  const toUploadList = packageGlob.filter((packageFile) => !fs.lstatSync(packageFile).isDirectory()
    && (
      !s3FileList.includes(packageFile.replace(dir.package, ''))
      || alwaysSwapFiles(packageFile)
    ));

  console.log(`${s3DeleteList.length + toUploadList.length} files to change`);

  const s3DeleteListTranslate = s3DeleteList.map((file) => ({ Key: file }));

  const changedUploadKeys = toUploadList.map((p) => p.replace(dir.package, ''));

  return deleteS3Files(s3DeleteListTranslate)
    .then(() => uploadFiles(toUploadList, 10))
    .then(() => ({ changedUploadKeys, s3DeleteList }));
}).then(({ changedUploadKeys, s3DeleteList }) => {
  console.log('Upload Complete');

  if (production) {
    const changedKeys = Array.from(new Set([...s3DeleteList, ...changedUploadKeys]));
    invalidateCloudFront(changedKeys);
  }

  console.log('Run `blc https://briananders.com -ro` to check for broken links');
});
