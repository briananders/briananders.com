import type { EventEmitter } from 'node:events';
import type { BuildConfigs, BuildDirectories, BuildEventsMap, CompletionFlags } from './types.ts';

const chokidar: typeof import('chokidar') = require('chokidar');
const path: typeof import('path') = require('path');

const { log } = console;

interface WatchPreviewReadyParams {
  buildEvents: EventEmitter;
  completionFlags: Pick<CompletionFlags, 'PREVIEW_READY'>;
  dir: Pick<BuildDirectories, 'build'>;
}

interface MoveAssetsModule {
  moveOneImage: (filePath: string, configs: BuildConfigs) => Promise<void>;
  moveOneVideo: (filePath: string, configs: BuildConfigs) => Promise<void>;
  moveOneTxtFile: (filePath: string, configs: BuildConfigs) => Promise<void>;
  moveOneDownload: (filePath: string, configs: BuildConfigs) => Promise<void>;
}

interface CommitHashHelper {
  (root: string): string;
  clear: () => void;
}

/**
 * Watches for the four initial compile events and emits `previewReady`.
 *
 * The dev server is "ready" once JS, CSS, templates, and images have all
 * finished their first compile. This function sets up four one-shot listeners
 * (via an `eventsToWatch` state object) and emits the `previewReady` event
 * — and sets `completionFlags.PREVIEW_READY` — as soon as all four have fired.
 *
 * @param params - Event emitter, completion flags, and build directory path.
 */
function watchForPreviewReady({ buildEvents, completionFlags, dir }: WatchPreviewReadyParams): void {
  const BUILD_EVENTS: BuildEventsMap = require(`${dir.build}constants/build-events.ts`);

  // Tracks which of the four initial stages have completed.
  const eventsToWatch = {
    jsMoved: false,
    templatesMoved: false,
    stylesMoved: false,
    imagesMoved: false,
  };

  /** Emits `previewReady` once all four watched events have fired. */
  function check(): void {
    if (completionFlags.PREVIEW_READY) return;
    // Every value in eventsToWatch must be true (no `false` values remain).
    if (Object.values(eventsToWatch).every(Boolean)) {
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
 * 1. **Build directory watcher** (`build/` + `index.ts`): any change to the
 *    build system itself calls `process.exit()` so the developer restarts
 *    manually. This prevents the live-reloading server from running on stale
 *    build logic.
 *
 * 2. **Source directory watcher** (`src/`): dispatches to the appropriate
 *    incremental rebuild function based on which file changed:
 *    - TypeScript files (`.ts`, `.tsx`) under `src/ts/` → `bundleJS`
 *    - SCSS files under `src/ts/` → `bundleJS` (re-bundle components that import SCSS)
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
 * @param configs - Build configuration object.
 */
function previewBuilder(configs: BuildConfigs): void {
  const { dir } = configs;

  const timestamp: { stamp: () => string } = require(`${dir.build}helpers/timestamp.ts`);
  const bundleJS: (c: BuildConfigs, changedFile?: string) => Promise<void> = require(
    `${dir.build}bundlers/bundle-js.ts`
  );
  const bundleSCSS: (c: BuildConfigs) => void = require(`${dir.build}bundlers/bundle-scss.ts`);
  const compilePageMappingData: (c: BuildConfigs) => void = require(`${dir.build}page-mapping-data.ts`);
  const {
    moveOneImage, moveOneVideo, moveOneTxtFile, moveOneDownload,
  }: MoveAssetsModule = require(`${dir.build}move-assets.ts`);
  const generateBuildTxt: (c: BuildConfigs) => void = require(`${dir.build}helpers/generate-build-txt.ts`);
  const commitHash: CommitHashHelper = require('./helpers/commit-hash.ts');

  // Start listening for previewReady before the first compile completes.
  watchForPreviewReady(configs);

  /**
   * Handles a source file change event.
   *
   * Ignores macOS `.DS_Store` noise, updates `build.txt` on any source
   * change, then dispatches to the appropriate incremental rebuild.
   *
   * @param filePath - Absolute path to the changed file.
   */
  function update(filePath: string): void {
    if (filePath.includes('.DS_Store')) return;
    log(`${timestamp.stamp()} ${`File modified: ${filePath.split('briananders.com')[1]}`.yellow}`);

    const extn = path.extname(filePath);
    const lowerExtn = extn.toLowerCase();
    const tsSourceDirectory = `${dir.src}ts${path.sep}`;
    const isTsSource = filePath.startsWith(tsSourceDirectory);
    const isTsScss = isTsSource && lowerExtn === '.scss';
    const isTsScript = isTsSource && (lowerExtn === '.ts' || lowerExtn === '.tsx');

    // Refresh build.txt whenever a source file changes.
    if (filePath.startsWith(dir.src) && !filePath.includes('build.txt')) {
      commitHash.clear();
      generateBuildTxt(configs);
    }

    // Dispatch to the correct incremental rebuild based on which directory changed.
    switch (true) {
      case filePath.includes('.DS_Store'):
        break;
      // SCSS co-located with TS components is bundled into the JS output by
      // scss-stringify-transform, so a stylesheet change must rebuild JS.
      case isTsScss:
        bundleJS(configs, filePath);
        break;
      case isTsScript:
        bundleJS(configs, filePath);
        break;
      case filePath.includes(`${dir.src}styles/`):
        // Re-compile styles AND re-render templates (inlined SCSS may have changed).
        bundleSCSS(configs);
        bundleJS(configs, filePath);
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
   * Any modification to `build/` or `index.ts` exits the process so the
   * developer gets a clean restart with the updated build logic.
   *
   * @param filePath - Absolute path to the changed build file.
   */
  function buildChanged(filePath: string): void {
    if (filePath.includes('.DS_Store')) return;
    log(`${timestamp.stamp()} ${`Build file modified: ${filePath.split('briananders.com')[1]}`.red.bold}`);
    process.exit();
  }

  // Watch the build directory and index.ts for changes that require a restart.
  const buildDirWatcher = chokidar.watch(dir.build);
  const indexWatcher = chokidar.watch(`${dir.root}index.ts`);
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
}

module.exports = previewBuilder;
module.exports.watchForPreviewReady = watchForPreviewReady;
