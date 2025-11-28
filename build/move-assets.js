const fs = require('fs-extra');
const glob = require('glob');
const path = require('path');
const pngToIco = require('png-to-ico');

const { log, error } = console;

function makeFaviconIco({
  dir, completionFlags,
}) {
  const timestamp = require(`${dir.build}helpers/timestamp`);
  log(`${timestamp.stamp()} makeFaviconIco()`);
  completionFlags.FAVICON_ICO = false;
  pngToIco(`${dir.src}images/favicon_base.png`)
    .then((buffer) => {
      fs.writeFileSync(`${dir.package}favicon.ico`, buffer);
      log(`${timestamp.stamp()} makeFaviconIco(): ${'MOVED'.bold.green}`);
    })
    .catch(error);
}

function deletePackageFile(srcPath, { dir }) {
  const destPath = srcPath.replace(dir.src, dir.package);
  fs.removeSync(destPath);
}

function moveOneImage(imagePath, configs, callback = () => {}) {
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

  fs.mkdirpSync(path.dirname(destination));
  if (debug) log(`${timestamp.stamp()} moveOneImage(${imagePath})`);

  if (extn === '.svg') {
    // move optimized svg
    optimizeSvg(imagePath, { dir });
    return callback();
  } if (webpCandidates.includes(extn.substring(1))) {
    // move file and move webp file
    if (debug) log(`${timestamp.stamp()} convertToWebp(${imagePath}): ${destination}`);
    convertToWebp(imagePath, { dir }).then(() => {
      fs.copyFile(imagePath, destination);
      return callback();
    });
  } else {
    // move file
    fs.copyFile(imagePath, destination);
    return callback();
  }
}

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

  const imagesGlob = glob.globSync(`${dir.src}images/**/*.{${images.join(',')}}`);
  let processed = 0;

  for (let i = 0; i < imagesGlob.length; i++) {
    const imagePath = imagesGlob[i];
    moveOneImage(imagePath, configs, () => {
      processed++;
      if (debug) log(`${timestamp.stamp()} ${processed}/${imagesGlob.length}: ${imagePath}`);
      checkDone(processed, imagesGlob.length);
    });
  }
}

function moveOneVideo(videoPath, configs, callback = () => {}) {
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

  const videoGlob = glob.globSync(`${dir.src}videos/**/*.{${videos.join(',')}}`);
  let processed = 0;

  for (let i = 0; i < videoGlob.length; i++) {
    const videoPath = videoGlob[i];
    moveOneImage(videoPath, configs, () => {
      processed++;
      if (debug) log(`${timestamp.stamp()} ${processed}/${videoGlob.length}: ${videoPath}`);
      checkDone(processed, videoGlob.length);
    });
  }
}

function moveOneTxtFile(filePath, configs, callback = () => {}) {
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

  const txtGlob = glob.globSync(`${dir.src}*.txt`);
  let processed = 0;

  for (let i = 0; i < txtGlob.length; i++) {
    const filePath = txtGlob[i];
    moveOneTxtFile(filePath, configs, () => {
      processed++;
      if (debug) log(`${timestamp.stamp()} ${processed}/${txtGlob.length}: ${filePath}`);
      checkDone(processed, txtGlob.length);
    });
  }
}

function moveJSONFiles(configs) {
  const {
    dir, debug,
  } = configs;

  const timestamp = require(`${dir.build}helpers/timestamp`);

  log(`${timestamp.stamp()} moveJSONFiles()`);

  function checkDone(processed, maximum) {
    if (processed >= maximum) {
      log(`${timestamp.stamp()} moveJSONFiles(): ${'DONE'.bold.green}`);
    }
  }

  const jsonGlob = glob.globSync(`${dir.src}data/**/*.json`);
  let processed = 0;

  for (let i = 0; i < jsonGlob.length; i++) {
    const filePath = jsonGlob[i];
    moveOneTxtFile(filePath, configs, () => {
      processed++;
      if (debug) log(`${timestamp.stamp()} ${processed}/${jsonGlob.length}: ${filePath}`);
      checkDone(processed, jsonGlob.length);
    });
  }
}

function moveOneDownload(filePath, configs, callback = () => {}) {
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

  const downloadsGlob = glob.globSync(`${dir.src}downloads/**`);
  let processed = 0;

  for (let i = 0; i < downloadsGlob.length; i++) {
    const filePath = downloadsGlob[i];
    moveOneDownload(filePath, configs, () => {
      processed++;
      if (debug) log(`${timestamp.stamp()} ${processed}/${downloadsGlob.length}: ${filePath}`);
      checkDone(processed, downloadsGlob.length);
    });
  }
}

module.exports = {
  moveAssets: (configs) => {
    moveAllImages(configs);
    moveAllVideos(configs);
    moveAllTxtFiles(configs);
    moveAllDownloads(configs);
    moveJSONFiles(configs);
  },

  moveOneDownload,
  moveOneImage,
  moveOneTxtFile,
  moveOneVideo,
};
