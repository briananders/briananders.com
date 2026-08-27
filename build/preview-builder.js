const chokidar = require('chokidar');
const path = require('path');

const { log } = console;

/**
 * Watches for the four initial compile events and emits `previewReady`.
 *
 * The dev server is "ready" once JS, CSS, templates, and images have all
 * finished their first compile. This function sets up four one-shot listeners
 * (via an `eventsToWatch` state object) and emits the `previewReady` event
 * — and sets `completionFlags.PREVIEW_READY` — as soon as all four have fired.
 *
 * @param {{ buildEvents: EventEmitter, completionFlags: object, dir: object }} params
 */
function watchForPreviewReady({ buildEvents, completionFlags, dir }) {
  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);

  // Tracks which of the four initial stages have completed.
  const eventsToWatch = {
    jsMoved: false,
    templatesMoved: false,
    stylesMoved: false,
    imagesMoved: false,
  };

  /** Emits `previewReady` once all four watched events have fired. */
  function check() {
    // Every value in eventsToWatch must be true (no `false` values remain).
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

/**
 * Sets up file-system watchers for dev mode (`npm start`).
 *
 * Three chokidar watchers are created:
 *
 * 1. **Build directory watcher** (`build/` + `index.js`): any change to the
 *    build system itself calls `process.exit()` so the developer restarts
 *    manually. This prevents the live-reloading server from running on stale
 *    build logic.
 *
 * 2. **Source directory watcher** (`src/`): dispatches to the appropriate
 *    incremental rebuild function based on which file changed:
 *    - `src/js/**` → `bundleJS` (re-bundle all JS entry points)
 *    - `src/styles/**` → `bundleSCSS` + `compilePageMappingData` (re-compile
 *      styles and refresh template data so inlined SCSS stays current)
 *    - `src/templates/**`, `src/partials/**`, `src/layout/**` →
 *      `compilePageMappingData` (re-render all templates)
 *    - `src/images/**` → `moveOneImage` (copy/optimize the changed image)
 *    - `src/videos/**` → `moveOneVideo` (copy the changed video)
 *    - `src/downloads/**` → `moveOneDownload`
 *    - `src/data/**` or `.txt` files → `moveOneTxtFile`
 *
 * Watchers start in the `'ready'` state — events emitted before the initial
 * scan completes are ignored so the first build isn't double-triggered.
 *
 * @param {object} configs - Build configuration object.
 */
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

  // Start listening for previewReady before the first compile completes.
  watchForPreviewReady(configs);

  /**
   * Handles a source file change event.
   *
   * Ignores macOS `.DS_Store` noise, updates `build.txt` on any source
   * change, then dispatches to the appropriate incremental rebuild.
   *
   * @param {string} filePath - Absolute path to the changed file.
   */
  function update(filePath) {
    if (filePath.includes('.DS_Store')) return;
    log(`${timestamp.stamp()} ${`File modified: ${filePath.split('briananders.com')[1]}`.yellow}`);

    const extn = path.extname(filePath);

    // Refresh build.txt whenever a source file changes.
    if (filePath.startsWith(dir.src) && !filePath.includes('build.txt')) {
      generateBuildTxt(configs);
    }

    // Dispatch to the correct incremental rebuild based on which directory changed.
    switch (true) {
      case filePath.includes('.DS_Store'):
        break;
      case filePath.includes(`${dir.src}js/`):
        bundleJS(configs);
        break;
      case filePath.includes(`${dir.src}styles/`):
        // Re-compile styles AND re-render templates (inlined SCSS may have changed).
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

  /**
   * Handles a build system file change event.
   *
   * Any modification to `build/` or `index.js` exits the process so the
   * developer gets a clean restart with the updated build logic.
   *
   * @param {string} filePath - Absolute path to the changed build file.
   */
  function buildChanged(filePath) {
    if (filePath.includes('.DS_Store')) return;
    log(`${timestamp.stamp()} ${`Build file modified: ${filePath.split('briananders.com')[1]}`.bold.red}`);
    process.exit();
  }

  // Watch the build directory and index.js for changes that require a restart.
  const buildDirWatcher = chokidar.watch(dir.build);
  const indexWatcher = chokidar.watch(`${dir.root}index.js`);
  // Watch the source directory for incremental rebuild triggers.
  const sourceWatcher = chokidar.watch(dir.src);

  // Only register change/add/unlink listeners after the initial scan is complete
  // to avoid spurious events for files that existed before the watcher started.
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
