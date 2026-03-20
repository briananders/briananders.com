const fs = require('fs-extra');
const { globSync } = require('glob');
const path = require('path');
const pngToIco = require('png-to-ico');

const { log, error } = console;

/**
 * Converts `src/images/favicon_base.png` to `favicon.ico` and writes it to
 * the output directory root.
 *
 * Uses `png-to-ico` (which exports an async default function in v3+) to
 * perform the PNG → ICO conversion. The resulting buffer is written
 * synchronously once the promise resolves.
 *
 * @param {{ dir: object, completionFlags: object }} params
 */
function makeFaviconIco({
  dir, completionFlags,
}) {
  const timestamp = require(`${dir.build}helpers/timestamp`);
  log(`${timestamp.stamp()} makeFaviconIco()`);
  completionFlags.FAVICON_ICO = false;
  // png-to-ico v3 ships as ESM with a default export — call via `.default()`.
  pngToIco.default(`${dir.src}images/favicon_base.png`)
    .then((buffer) => {
      fs.writeFileSync(`${dir.package}favicon.ico`, buffer);
      log(`${timestamp.stamp()} makeFaviconIco(): ${'MOVED'.bold.green}`);
    })
    .catch(error);
}

/**
 * Removes the output-directory counterpart of a source file.
 *
 * Called when a source file no longer exists (e.g. deleted during a watch
 * session) so the stale artifact is cleaned up from the output directory.
 *
 * @param {string} srcPath - Absolute path to the (now-missing) source file.
 * @param {{ dir: { src: string, package: string } }} configs
 */
function deletePackageFile(srcPath, { dir }) {
  const destPath = srcPath.replace(dir.src, dir.package);
  fs.removeSync(destPath);
}

/**
 * Copies or optimizes a single image file to the output directory.
 *
 * Dispatch logic by file type:
 * - `.svg` → optimized via SVGO (`optimizeSvg`).
 * - `.jpg`/`.jpeg`/`.png` → converted to a sibling `.webp` AND copied as-is.
 * - All other image types → copied as-is.
 *
 * If the source file no longer exists the corresponding output file is
 * deleted and the callback is called immediately. Directories are skipped.
 *
 * @param {string} imagePath - Absolute path to the source image.
 * @param {object} configs - Build configuration object.
 * @param {Function} [callback] - Called once the image has been processed.
 */
function moveOneImage(imagePath, configs, callback = () => { }) {
  const {
    dir, debug,
  } = configs;

  const { webpCandidates } = require(`${dir.build}constants/file-formats`);
  const { optimizeSvg } = require(`${dir.build}optimize/optimize-svgs`);
  const convertToWebp = require(`${dir.build}optimize/convert-to-webp`);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  const extn = path.extname(imagePath);
  const destination = imagePath.replace(dir.src, dir.package);

  if (!fs.existsSync(imagePath)) {
    log(`${timestamp.stamp()} ${imagePath} does not exist`);
    deletePackageFile(destination, configs);
    return callback();
  } if (fs.lstatSync(imagePath).isDirectory()) {
    log(`${timestamp.stamp()} ${imagePath} is a directory 1`);
    return callback();
  }

  // Ensure the destination subdirectory exists before writing.
  fs.mkdirpSync(path.dirname(destination));
  if (debug) log(`${timestamp.stamp()} moveOneImage(${imagePath})`);

  if (extn === '.svg') {
    // SVGs are passed through SVGO for optimization before output.
    optimizeSvg(imagePath, { dir });
    return callback();
  } if (webpCandidates.includes(extn.substring(1))) {
    // Raster images: produce a .webp sibling AND keep the original format.
    if (debug) log(`${timestamp.stamp()} convertToWebp(${imagePath}): ${destination}`);
    convertToWebp(imagePath, { dir }).then(() => {
      fs.copyFile(imagePath, destination);
      return callback();
    });
  } else {
    // All other image types (e.g. .webp originals): copy as-is.
    fs.copyFile(imagePath, destination);
    return callback();
  }
}

/**
 * Processes all source images and copies/converts them to the output directory.
 *
 * Also triggers `makeFaviconIco` to generate `favicon.ico`. Globbing is
 * driven by the `images` extension list in `constants/file-formats`. When
 * every image has been processed, `IMAGES_ARE_MOVED` is set to `true` and
 * the `imagesMoved` event is emitted.
 *
 * @param {object} configs - Build configuration object.
 */
function moveAllImages(configs) {
  const {
    dir, completionFlags, buildEvents, debug,
  } = configs;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const { images } = require(`${dir.build}constants/file-formats`);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  completionFlags.IMAGES_ARE_MOVED = false;
  log(`${timestamp.stamp()} moveAllImages()`);

  function checkDone(processed, maximum) {
    if (processed >= maximum) {
      log(`${timestamp.stamp()} moveAllImages(): ${'DONE'.bold.green}`);
      completionFlags.IMAGES_ARE_MOVED = true;
      buildEvents.emit(BUILD_EVENTS.imagesMoved);
    }
  }

  fs.mkdirpSync(`${dir.package}images/`);

  makeFaviconIco({ dir, completionFlags, buildEvents });

  const imagesGlob = globSync(`${dir.src}images/**/*.{${images.join(',')}}`);
  const progress = { completed: 0 };

  for (let i = 0; i < imagesGlob.length; i++) {
    const imagePath = imagesGlob[i];
    moveOneImage(imagePath, configs, () => {
      progress.completed += 1;
      if (debug) log(`${timestamp.stamp()} ${progress.completed}/${imagesGlob.length}: ${imagePath}`);
      checkDone(progress.completed, imagesGlob.length);
    });
  }
}

/**
 * Copies a single video file to the output directory.
 *
 * If the source file is missing the output counterpart is deleted instead.
 * Directories are skipped.
 *
 * @param {string} videoPath - Absolute path to the source video.
 * @param {object} configs - Build configuration object.
 * @param {Function} [callback] - Called once the video has been processed.
 */
function moveOneVideo(videoPath, configs, callback = () => { }) {
  const {
    dir, debug,
  } = configs;

  const timestamp = require(`${dir.build}helpers/timestamp`);
  const destination = videoPath.replace(dir.src, dir.package);

  if (!fs.existsSync(videoPath)) {
    log(`${timestamp.stamp()} ${videoPath} does not exist`);
    deletePackageFile(destination, configs);
    return callback();
  } if (fs.lstatSync(videoPath).isDirectory()) {
    log(`${timestamp.stamp()} ${videoPath} is a directory 2`);
    return callback();
  }

  if (debug) log(`${timestamp.stamp()} moveOneVideo(${videoPath})`);

  fs.mkdirpSync(path.dirname(destination));
  fs.copyFile(videoPath, destination);

  return callback();
}

/**
 * Copies all source videos to the output directory.
 *
 * Globbing is driven by the `videos` extension list in `constants/file-formats`.
 * When every video has been processed, `VIDEOS_ARE_MOVED` is set to `true`
 * and the `videosMoved` event is emitted.
 *
 * @param {object} configs - Build configuration object.
 */
function moveAllVideos(configs) {
  const {
    dir, completionFlags, buildEvents, debug,
  } = configs;

  const timestamp = require(`${dir.build}helpers/timestamp`);
  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const { videos } = require(`${dir.build}constants/file-formats`);

  completionFlags.VIDEOS_ARE_MOVED = false;
  log(`${timestamp.stamp()} moveAllVideos()`);

  function checkDone(processed, maximum) {
    if (processed >= maximum) {
      log(`${timestamp.stamp()} moveAllVideos(): ${'DONE'.bold.green}`);
      completionFlags.VIDEOS_ARE_MOVED = true;
      buildEvents.emit(BUILD_EVENTS.videosMoved);
    }
  }

  fs.mkdirpSync(`${dir.package}videos/`);

  const videoGlob = globSync(`${dir.src}videos/**/*.{${videos.join(',')}}`);
  const progress = { completed: 0 };

  for (let i = 0; i < videoGlob.length; i++) {
    const videoPath = videoGlob[i];
    moveOneVideo(videoPath, configs, () => {
      progress.completed += 1;
      if (debug) log(`${timestamp.stamp()} ${progress.completed}/${videoGlob.length}: ${videoPath}`);
      checkDone(progress.completed, videoGlob.length);
    });
  }
}

/**
 * Copies a single `.txt` file from the source root to the output directory.
 *
 * Used for files like `robots.txt` and `humans.txt`. If the source file is
 * missing the output counterpart is deleted. Directories are skipped.
 *
 * @param {string} filePath - Absolute path to the source `.txt` file.
 * @param {object} configs - Build configuration object.
 * @param {Function} [callback] - Called once the file has been processed.
 */
function moveOneTxtFile(filePath, configs, callback = () => { }) {
  const {
    dir, debug,
  } = configs;

  const timestamp = require(`${dir.build}helpers/timestamp`);
  const destination = filePath.replace(dir.src, dir.package);

  if (!fs.existsSync(filePath)) {
    log(`${timestamp.stamp()} ${filePath} does not exist`);
    deletePackageFile(destination, configs);
    return callback();
  } if (fs.lstatSync(filePath).isDirectory()) {
    log(`${timestamp.stamp()} ${filePath} is a directory 3`);
    return callback();
  }

  if (debug) log(`${timestamp.stamp()} moveOneTxtFile(${filePath})`);

  fs.mkdirpSync(path.dirname(destination));
  fs.copyFile(filePath, destination);

  return callback();
}

/**
 * Copies all `.txt` files from the source root to the output directory.
 *
 * Handles `robots.txt`, `humans.txt`, and any other top-level text files in
 * `src/`. Does not emit a build event — txt files are not a dependency of
 * any downstream stage.
 *
 * @param {object} configs - Build configuration object.
 */
function moveAllTxtFiles(configs) {
  const {
    dir, debug,
  } = configs;

  const timestamp = require(`${dir.build}helpers/timestamp`);

  log(`${timestamp.stamp()} moveAllTxtFiles()`);

  function checkDone(processed, maximum) {
    if (processed >= maximum) {
      log(`${timestamp.stamp()} moveAllTxtFiles(): ${'DONE'.bold.green}`);
    }
  }

  const txtGlob = globSync(`${dir.src}*.txt`);
  const progress = { completed: 0 };

  for (let i = 0; i < txtGlob.length; i++) {
    const filePath = txtGlob[i];
    moveOneTxtFile(filePath, configs, () => {
      progress.completed += 1;
      if (debug) log(`${timestamp.stamp()} ${progress.completed}/${txtGlob.length}: ${filePath}`);
      checkDone(progress.completed, txtGlob.length);
    });
  }
}

/**
 * Copies a single file from `src/downloads/` to the output directory.
 *
 * Downloads are files exposed for direct browser download (PDFs, ZIPs, etc.).
 * If the source file is missing the output counterpart is deleted. Directories
 * are skipped.
 *
 * @param {string} filePath - Absolute path to the source download file.
 * @param {object} configs - Build configuration object.
 * @param {Function} [callback] - Called once the file has been processed.
 */
function moveOneDownload(filePath, configs, callback = () => { }) {
  const {
    dir, debug,
  } = configs;

  const timestamp = require(`${dir.build}helpers/timestamp`);
  const destination = filePath.replace(dir.src, dir.package);

  if (!fs.existsSync(filePath)) {
    log(`${timestamp.stamp()} ${filePath} does not exist`);
    deletePackageFile(destination, configs);
    return callback();
  } if (fs.lstatSync(filePath).isDirectory()) {
    log(`${timestamp.stamp()} ${filePath} is a directory 4`);
    return callback();
  }

  if (debug) log(`${timestamp.stamp()} moveOneDownload(${filePath})`);

  fs.mkdirpSync(path.dirname(destination));
  fs.copyFile(filePath, destination);

  return callback();
}

/**
 * Copies all files from `src/downloads/` to the output directory.
 *
 * Uses `{ nodir: true }` on the glob so that the `downloads/` directory
 * itself is never included in the results (only its contents). Does not emit
 * a build event — downloads are not a dependency of any downstream stage.
 *
 * @param {object} configs - Build configuration object.
 */
function moveAllDownloads(configs) {
  const {
    dir, debug,
  } = configs;

  const timestamp = require(`${dir.build}helpers/timestamp`);

  log(`${timestamp.stamp()} moveAllDownloads()`);

  function checkDone(processed, maximum) {
    if (processed >= maximum) {
      log(`${timestamp.stamp()} moveAllDownloads(): ${'DONE'.bold.green}`);
    }
  }

  fs.mkdirpSync(`${dir.package}downloads/`);

  // `nodir: true` prevents glob from returning the base `downloads/` directory
  // itself, which would trigger the "is a directory" guard in moveOneDownload.
  const downloadsGlob = globSync(`${dir.src}downloads/**`, { nodir: true });
  const progress = { completed: 0 };

  for (let i = 0; i < downloadsGlob.length; i++) {
    const filePath = downloadsGlob[i];
    moveOneDownload(filePath, configs, () => {
      progress.completed += 1;
      if (debug) log(`${timestamp.stamp()} ${progress.completed}/${downloadsGlob.length}: ${filePath}`);
      checkDone(progress.completed, downloadsGlob.length);
    });
  }
}

module.exports = {
  /**
   * Runs all four asset-move operations in parallel:
   * images (+ favicon), videos, txt files, and downloads.
   *
   * @param {object} configs - Build configuration object.
   */
  moveAssets: (configs) => {
    moveAllImages(configs);
    moveAllVideos(configs);
    moveAllTxtFiles(configs);
    moveAllDownloads(configs);
  },

  // Individual move functions exposed for incremental updates in watch mode.
  moveOneDownload,
  moveOneImage,
  moveOneTxtFile,
  moveOneVideo,
};
