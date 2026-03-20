const fs = require('fs-extra');
const { globSync } = require('glob');
const XXHash = require('xxhash');

const { log } = console;

/**
 * Content-hashes all CSS files in the output directory.
 *
 * Runs after the `indexCssForHashing` event, which fires once CSS files
 * have been updated to reference hashed image/video filenames. Each `.css`
 * file is:
 *   1. Read from disk.
 *   2. Hashed with XXHash (seed `0xCAFEBABE`) to produce a short integer hash.
 *   3. Renamed to `<basename>-<hash>.css`.
 *   4. Recorded in `hashingFileNameList` (old path → new path) so that
 *      `finishHashing` can rewrite HTML/JSON references later.
 *
 * When all CSS files have been renamed, `ASSET_HASH.CSS` is set to `true`
 * and the `assetHashCssListed` event is emitted.
 *
 * @param {{ dir: object, completionFlags: object, buildEvents: EventEmitter, hashingFileNameList: object, debug: boolean }} configs
 */
module.exports = function hashCSS({
  dir, completionFlags, buildEvents, hashingFileNameList, debug,
}) {
  // Reset the flag so re-runs in watch mode start clean.
  completionFlags.ASSET_HASH.CSS = false;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  log(`${timestamp.stamp()} assetHashing().css`);

  const cssGlob = globSync(`${dir.package}**/*.css`);
  let processedCss = 0;
  cssGlob.forEach((file, index, array) => {
    const fileContents = fs.readFileSync(file);

    // Produce a numeric content hash using the XXHash algorithm.
    const hash = XXHash.hash(fileContents, 0xCAFEBABE);

    // Construct the new filename by inserting the hash before the extension.
    const hashedFileName = `${file.substr(0, file.lastIndexOf('.'))}-${hash}${file.substr(file.lastIndexOf('.'))}`;

    // Record the mapping from original to hashed path for use in finishHashing.
    hashingFileNameList[file] = hashedFileName;

    fs.rename(file, hashedFileName, (err) => {
      if (err) throw err;
      if (debug) log(`${timestamp.stamp()} assetHashing().css: ${hashedFileName} renamed complete`);
      processedCss++;
      if (processedCss >= array.length) {
        completionFlags.ASSET_HASH.CSS = true;
        log(`${timestamp.stamp()} assetHashing().css: ${'DONE'.bold.green}`);
        buildEvents.emit(BUILD_EVENTS.assetHashCssListed);
      }
    });
  });
};
