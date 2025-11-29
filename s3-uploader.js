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

function getS3Objects() {
  const uploadPromise = new Promise((resolve, reject) => {
    s3.listObjectsV2({
      Bucket: bucketName,
      MaxKeys: 1000,
    }, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  return uploadPromise;
};

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

function uploadFiles(fileList) {
  fs.chmodSync(dir.package, '0755');

  return Promise.all(fileList.map(uploadFile));
};

function invalidateCloudFront() {
  console.log('Invalidate Cache');

  const params = {
    DistributionId: process.env.CLOUDFRONT_ID,
    InvalidationBatch: { /* required */
      CallerReference: Date.now().toString(), /* required */
      Paths: { /* required */
        Quantity: '1', /* required */
        Items: [
          '/*'
        ],
      },
    },
  };

  cloudfront.createInvalidation(params, (err, data) => {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data); // successful response
  });
};

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

getS3Objects().then((data) => {
  const s3FileList = data.Contents.map(({ Key }) => Key);

  const packageGlob = glob.globSync(`${dir.package}**/*`);

  const s3DeleteList = s3FileList.filter((s3File) => !packageGlob.includes(dir.package + s3File)
      || alwaysSwapFiles(s3File));

  const toUploadList = packageGlob.filter((packageFile) => !fs.lstatSync(packageFile).isDirectory()
    && (
      !s3FileList.includes(packageFile.replace(dir.package, ''))
      || alwaysSwapFiles(packageFile)
    ));

  console.log(`${s3DeleteList.length + toUploadList.length} files to change`);

  const s3DeleteListTranslate = s3DeleteList.map((file) => ({ Key: file }));

  return deleteS3Files(s3DeleteListTranslate).then(() => uploadFiles(toUploadList));
}).then(() => {
  console.log('Upload Complete');

  if (production) {
    invalidateCloudFront();
  }

  console.log('Run `blc https://briananders.com -ro` to check for broken links');
});
