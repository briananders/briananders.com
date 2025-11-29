const chokidar = require('chokidar');
const path = require('path');

const { log } = console;

function watchForPreviewReady({ buildEvents, completionFlags, dir }) {
  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);

  const eventsToWatch = {
    jsMoved: false,
    templatesMoved: false,
    stylesMoved: false,
    imagesMoved: false,
  };

  function check() {
    if (Object.keys(eventsToWatch)
      .map((key) => eventsToWatch[key])
      .filter((value) => !value).length === 0) {
      completionFlags.PREVIEW_READY = true;
      buildEvents.emit(BUILD_EVENTS.previewReady);
    }
  }

  buildEvents.on(BUILD_EVENTS.jsMoved, () => {
    eventsToWatch.jsMoved = true;
    check();
  });
  buildEvents.on(BUILD_EVENTS.templatesMoved, () => {
    eventsToWatch.templatesMoved = true;
    check();
  });
  buildEvents.on(BUILD_EVENTS.stylesMoved, () => {
    eventsToWatch.stylesMoved = true;
    check();
  });
  buildEvents.on(BUILD_EVENTS.imagesMoved, () => {
    eventsToWatch.imagesMoved = true;
    check();
  });
}

module.exports = (configs) => {
  const { dir } = configs;

  const timestamp = require(`${dir.build}helpers/timestamp`);
  const bundleJS = require(`${dir.build}bundlers/bundle-js`);
  const bundleSCSS = require(`${dir.build}bundlers/bundle-scss`);
  const compilePageMappingData = require(`${dir.build}page-mapping-data`);
  const {
    moveOneImage, moveOneVideo, moveOneTxtFile, moveOneDownload,
  } = require(`${dir.build}move-assets`);
  const generateBuildTxt = require(`${dir.build}helpers/generate-build-txt`);

  watchForPreviewReady(configs);

  function update(filePath) {
    if (filePath.includes('.DS_Store')) return;
    log(`${timestamp.stamp()} ${`File modified: ${filePath.split('briananders.com')[1]}`.yellow}`);

    const extn = path.extname(filePath);

    // Regenerate build.txt on any source file change
    if (filePath.startsWith(dir.src) && !filePath.includes('build.txt')) {
      generateBuildTxt(configs);
    }

    switch (true) {
      case filePath.includes('.DS_Store'):
        break;
      case filePath.includes(`${dir.src}js/`):
        bundleJS(configs);
        break;
      case filePath.includes(`${dir.src}styles/`):
        bundleSCSS(configs);
        compilePageMappingData(configs);
        break;
      case filePath.includes(`${dir.src}templates/`):
      case filePath.includes(`${dir.src}partials/`):
      case filePath.includes(`${dir.src}layout/`):
        compilePageMappingData(configs);
        break;
      case filePath.includes(`${dir.src}images/`):
        moveOneImage(filePath, configs);
        break;
      case filePath.includes(`${dir.src}videos/`):
        moveOneVideo(filePath, configs);
        break;
      case filePath.includes(`${dir.src}downloads/`):
        moveOneDownload(filePath, configs);
        break;
      case filePath.includes(`${dir.src}data/`):
      case extn === '.txt':
        moveOneTxtFile(filePath, configs);
        break;
      default:
    }
  }

  function buildChanged(filePath) {
    if (filePath.includes('.DS_Store')) return;
    log(`${timestamp.stamp()} ${`Build file modified: ${filePath.split('briananders.com')[1]}`.bold.red}`);
    process.exit();
  }

  const buildDirWatcher = chokidar.watch(dir.build);
  const indexWatcher = chokidar.watch(`${dir.root}index.js`);
  const sourceWatcher = chokidar.watch(dir.src);

  buildDirWatcher.on('ready', () => {
    buildDirWatcher
      .on('change', buildChanged)
      .on('add', buildChanged)
      .on('unlink', buildChanged)
      .on('addDir', buildChanged)
      .on('unlinkDir', buildChanged);
  });

  indexWatcher.on('change', buildChanged);

  sourceWatcher.on('ready', () => {
    sourceWatcher
      .on('change', update)
      .on('add', update)
      .on('unlink', update)
      .on('addDir', update)
      .on('unlinkDir', update);
  });
};
