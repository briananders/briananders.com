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
 *   npm run deploy   (NODE_ENV=production node s3-uploader.ts)
 *   npm run stage    (node s3-uploader.ts)
 */

import type { ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';
import type { BuildDirectories } from './build/types.ts';

const fs: typeof import('fs-extra') = require('fs-extra');
const http: typeof import('node:http') = require('http');
const https: typeof import('node:https') = require('https');
const { glob }: typeof import('glob') = require('glob');
const path: typeof import('node:path') = require('path');

const {
  CloudFrontClient,
  CreateInvalidationCommand,
}: typeof import('@aws-sdk/client-cloudfront') = require('@aws-sdk/client-cloudfront');
const {
  S3Client,
  DeleteObjectsCommand,
  ListObjectsV2Command,
}: typeof import('@aws-sdk/client-s3') = require('@aws-sdk/client-s3');
const { Upload }: typeof import('@aws-sdk/lib-storage') = require('@aws-sdk/lib-storage');
const { NodeHttpHandler }: typeof import('@smithy/node-http-handler') = require('@smithy/node-http-handler');

const getDirectories: (appRoot: string, isGoldenBuild?: boolean) => BuildDirectories = require(
  './build/constants/directories.ts',
);
const dir = getDirectories(__dirname);

const production: boolean = require(`${dir.build}helpers/production.ts`);

const deleteAllowlist: string[] = require('./s3-upload-allowlist.json');

const awsRegion = process.env.AWS_REGION || 'us-east-1';

const awsCredentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
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

let bucketName = 'staging.briananders.com';
if (production) {
  bucketName = 'www.briananders.com';
}

interface S3DeleteObject {
  Key: string;
}

/**
 * Resolves the MIME content type string based on the file extension.
 */
const getContentType = (fileName: string): string => {
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
 */
function objectPublicUrl(key: string): string {
  let host = `${bucketName}.s3.${awsRegion}.amazonaws.com`;
  if (awsRegion === 'us-east-1') {
    host = `${bucketName}.s3.amazonaws.com`;
  }
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `https://${host}/${encodedKey}`;
}

/**
 * Lists every object key in the bucket (paginated; required for correct sync decisions).
 */
async function listAllS3Keys(): Promise<string[]> {
  const keys: string[] = [];
  let ContinuationToken: string | undefined;

  do {
    const data: ListObjectsV2CommandOutput = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 1000,
      ContinuationToken,
    }));

    if (data.Contents) {
      for (let i = 0; i < data.Contents.length; i += 1) {
        const objectKey = data.Contents[i].Key;
        if (objectKey) {
          keys.push(objectKey);
        }
      }
    }

    if (data.IsTruncated) {
      ContinuationToken = data.NextContinuationToken;
    } else {
      ContinuationToken = undefined;
    }
  } while (ContinuationToken);

  return keys;
}

const S3_DELETE_BATCH_SIZE = 1000;
const DELETE_BATCH_CONCURRENCY = 8;

/**
 * Deletes a list of S3 objects in batches of up to 1000 with concurrency pool.
 */
async function deleteS3Files(fileList: S3DeleteObject[]): Promise<void> {
  if (fileList.length === 0) {
    return;
  }

  const batches: S3DeleteObject[][] = [];
  for (let i = 0; i < fileList.length; i += S3_DELETE_BATCH_SIZE) {
    batches.push(fileList.slice(i, i + S3_DELETE_BATCH_SIZE));
  }

  let batchIndex = 0;

  /**
   * Concurrently processes and deletes chunks of S3 objects.
   */
  const worker = async (): Promise<void> => {
    while (batchIndex < batches.length) {
      const sliceStart = batchIndex;
      batchIndex += 1;
      const chunk = batches[sliceStart];
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
 */
function getCacheControl(fileName: string): string {
  const extn = path.extname(fileName);
  // Unwrap double extensions (e.g. .html.gz → .html) so gzipped dynamic files
  // receive the same no-cache directive as their uncompressed counterparts.
  let effectiveExtn = extn;
  if (extn === '.gz') {
    effectiveExtn = path.extname(path.basename(fileName, extn));
  }

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
 */
async function uploadFiles(fileList: string[]): Promise<string[]> {
  fs.chmodSync(dir.package, '0755');

  const total = fileList.length;
  let completed = 0;

  /**
   * Logs upload progress percentage at intervals or upon completion.
   */
  const logProgress = (): void => {
    if (completed % 10 === 0 || completed === total) {
      let pct = 100;
      if (total) {
        pct = Math.floor((completed / total) * 100);
      }
      console.log(`${completed}/${total}: ${pct}%`);
    }
  };

  /**
   * Streams and uploads a single file to S3 with appropriate headers.
   */
  const uploadOne = async (fileName: string): Promise<string> => {
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
  const worker = async (): Promise<void> => {
    while (fileIndex < fileList.length) {
      const i = fileIndex;
      fileIndex += 1;
      await uploadOne(fileList[i]);
    }
  };

  const pool = Math.min(MAX_UPLOAD_CONCURRENCY, Math.max(1, fileList.length));
  await Promise.all(Array.from({ length: pool }, () => worker()));
  return fileList;
}

/**
 * Creates a CloudFront cache invalidation for all paths ('/*') on the configured distribution.
 */
async function invalidateCloudFront(): Promise<void> {
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

const SWAP_FILES_REGEXES: RegExp[] = [
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
 */
const alwaysSwapFiles = (fileName: string): boolean => SWAP_FILES_REGEXES.some((regex) => regex.test(fileName));

/**
 * Main deployment entry point: scans S3 bucket and local package directory,
 * calculates diffs, deletes obsolete objects, uploads new/changed objects, and invalidates CloudFront.
 */
async function main(): Promise<void> {
  const [s3FileList, packageGlob] = await Promise.all([
    listAllS3Keys(),
    glob(`${dir.package}**/*`)
  ]);

  const s3FileSet = new Set(s3FileList);
  const packageSet = new Set(packageGlob);

  /**
   * Helper to check if a given file path starts with an allowlisted path prefix.
   */
  const isAllowlisted = (filePath: string): boolean => deleteAllowlist.some(
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

  const s3DeleteListTranslate: S3DeleteObject[] = s3DeleteList.map((file) => ({ Key: file }));

  await deleteS3Files(s3DeleteListTranslate);
  await uploadFiles(toUploadList);

  console.log('Upload Complete');

  if (production) {
    await invalidateCloudFront();
  }

  console.log('Run `blc https://briananders.com -ro` to check for broken links');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

