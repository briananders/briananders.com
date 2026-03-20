const fs = require('fs-extra');
const { globSync } = require('glob');
const XXHash = require('xxhash');

const { log } = console;

/**
 * Content-hashes all JS and image/video asset files in the output directory.
 *
 * This function is called multiple times — once for each upstream event
 * (`stylesMoved`, `jsMinified`, `htmlMinified`, `imagesMoved`). It guards
 * against premature execution by checking that all five prerequisite flags are
 * set before doing any work. When called before all stages are ready it simply
 * returns `false`.
 *
 * Once all prerequisites are met it runs two parallel hashing passes:
 *
 * **JS pass** — all `.js` files under `package/`:
 *   - Reads each file, computes an XXHash (seed `0xCAFEBABE`), renames the
 *     file to `<basename>-<hash>.js`, and records the mapping in
 *     `hashingFileNameList`. Emits `assetHashJsListed` when done.
 *
 * **Images/Videos pass** — all image and video files under `package/images/`
 * and `package/videos/`:
 *   - Same rename/record process as JS. Emits `assetHashImagesListed` when done,
 *     which in turn triggers `updateCSSwithImageHashes` so CSS `url()` references
 *     are updated before CSS files are hashed.
 *
 * @param {{ dir: object, completionFlags: object, buildEvents: EventEmitter, hashingFileNameList: object, debug: boolean }} configs
 * @returns {false|undefined} `false` if prerequisites aren't met, otherwise `undefined`.
 */
module.exports = function assetHashing({
  dir, completionFlags, buildEvents, hashingFileNameList, debug,
}) {
  // Reset sub-flags so re-runs in watch mode start clean.
  completionFlags.ASSET_HASH.IMAGES = false;
  completionFlags.ASSET_HASH.JS = false;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);
  const { images, videos } = require(`${dir.build}constants/file-formats`);

  // Guard: all five upstream stages must be complete before we can hash.
  // This function is called on multiple events so it will be a no-op until
  // the last prerequisite finishes.
  if (!completionFlags.JS_IS_MINIFIED
      || !completionFlags.CSS_IS_MINIFIED
      || !completionFlags.HTML_IS_MINIFIED
      || !completionFlags.IMAGES_ARE_MOVED
      || !completionFlags.VIDEOS_ARE_MOVED) {
    return false;
  }
  log(`${timestamp.stamp()} assetHashing().images`);
  if (debug) {
    log(`completionFlags.JS_IS_MINIFIED :${completionFlags.JS_IS_MINIFIED}`);
    log(`completionFlags.CSS_IS_MINIFIED    :${completionFlags.CSS_IS_MINIFIED}`);
    log(`completionFlags.HTML_IS_MINIFIED     :${completionFlags.HTML_IS_MINIFIED}`);
    log(`completionFlags.IMAGES_ARE_MOVED     :${completionFlags.IMAGES_ARE_MOVED}`);
    log(`completionFlags.VIDEOS_ARE_MOVED     :${completionFlags.VIDEOS_ARE_MOVED}`);
  }

  // Collect JS and asset files for the two independent hashing passes.
  const jsGlob = globSync(`${dir.package}**/*.js`);
  const assetGlob = globSync(`${dir.package}{images,videos}/**/*.{${[...images, ...videos].join(',')}}`);

  // --- JS hashing pass ---
  let processedJs = 0;
  jsGlob.forEach((file, index, array) => {
    const fileContents = fs.readFileSync(file);
    const hash = XXHash.hash(fileContents, 0xCAFEBABE);
    // Insert the hash before the file extension: foo.js → foo-1234567890.js
    const hashedFileName = `${file.substr(0, file.lastIndexOf('.'))}-${hash}${file.substr(file.lastIndexOf('.'))}`;
    hashingFileNameList[file] = hashedFileName;
    fs.rename(file, hashedFileName, (err) => {
      if (err) throw err;
      if (debug) log(`${timestamp.stamp()} assetHashing().images: ${hashedFileName} renamed complete`);
      processedJs++;
      if (processedJs >= array.length) {
        completionFlags.ASSET_HASH.JS = true;
        if (debug) log(`${timestamp.stamp()} assetHashing().images: completionFlags.ASSET_HASH.JS: ${completionFlags.ASSET_HASH.JS}`);
        buildEvents.emit(BUILD_EVENTS.assetHashJsListed);
      }
    });
  });

  // --- Images/Videos hashing pass ---
  let processedImages = 0;
  assetGlob.forEach((file, index, array) => {
    const fileContents = fs.readFileSync(file);
    const hash = XXHash.hash(fileContents, 0xCAFEBABE);
    const hashedFileName = `${file.substr(0, file.lastIndexOf('.'))}-${hash}${file.substr(file.lastIndexOf('.'))}`;
    hashingFileNameList[file] = hashedFileName;
    fs.rename(file, hashedFileName, (err) => {
      if (err) throw err;
      if (debug) log(`${timestamp.stamp()} assetHashing().images: ${hashedFileName} renamed complete`);
      processedImages++;
      if (processedImages >= array.length) {
        completionFlags.ASSET_HASH.IMAGES = true;
        log(`${timestamp.stamp()} assetHashing().images: ${'DONE'.bold.green}`);
        // Emitting this event triggers updateCSSwithImageHashes so CSS url()
        // references are rewritten before CSS files are hashed.
        buildEvents.emit(BUILD_EVENTS.assetHashImagesListed);
      }
    });
  });
};
