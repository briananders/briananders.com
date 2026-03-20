const fs = require('fs-extra');
const { globSync } = require('glob');

const { log } = console;

/**
 * Rewrites HTML and JSON files to reference hashed asset filenames.
 *
 * This is the final step of the asset-hashing pipeline. It is called after
 * each of the three asset-hash events (`assetHashCssListed`,
 * `assetHashImagesListed`, `assetHashJsListed`) but only proceeds when all
 * three sub-flags are `true` — i.e., when JS, CSS, and image/video files
 * have all been renamed.
 *
 * For every HTML and JSON file in the output directory, the function iterates
 * the full `hashingFileNameList` map (original path → hashed path) and does a
 * global string-replace for each entry. Paths are compared as relative strings
 * (without the `package/` prefix) so they match how they appear in `src` and
 * `href` attributes.
 *
 * When every file has been updated, `ASSET_HASH.DONE` is set to `true` and
 * the `hashingDone` event is emitted, which triggers gzip compression.
 *
 * @param {{ dir: object, completionFlags: object, buildEvents: EventEmitter, hashingFileNameList: object, debug: boolean }} configs
 * @returns {false|undefined} `false` if not all hashing sub-stages are done yet.
 */
module.exports = function finishHashing({
  dir, completionFlags, buildEvents, hashingFileNameList, debug,
}) {
  // Reset the flag so re-runs in watch mode start clean.
  completionFlags.ASSET_HASH.DONE = false;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  log(`${timestamp.stamp()} finishHashing()`);

  if (debug) log(`${timestamp.stamp()} finishHashing(): ${Object.keys(hashingFileNameList)}`);
  if (debug) log(`${timestamp.stamp()} finishHashing(): completionFlags.ASSET_HASH.IMAGES :${completionFlags.ASSET_HASH.IMAGES}`);
  if (debug) log(`${timestamp.stamp()} finishHashing(): completionFlags.ASSET_HASH.CSS    :${completionFlags.ASSET_HASH.CSS}`);
  if (debug) log(`${timestamp.stamp()} finishHashing(): completionFlags.ASSET_HASH.JS     :${completionFlags.ASSET_HASH.JS}`);

  // Guard: all three asset types must be hashed before we can update HTML/JSON.
  if (!completionFlags.ASSET_HASH.IMAGES
      || !completionFlags.ASSET_HASH.CSS
      || !completionFlags.ASSET_HASH.JS) {
    return false;
  }
  if (debug) log(`${timestamp.stamp()} finishHashing(): ${Object.keys(hashingFileNameList)}`);

  // Collect both HTML pages and JSON data files — both may contain asset paths.
  const htmlGlob = [...globSync(`${dir.package}**/*.html`), ...globSync(`${dir.package}**/*.json`)];
  let htmlFilesProcessed = 0;

  htmlGlob.forEach((file, index, array) => {
    const fileBuffer = fs.readFileSync(file);
    let fileContents = fileBuffer.toString();
    let keysProcessed = 0;

    // Apply every original→hashed substitution to the file content.
    (Object.keys(hashingFileNameList)).forEach((key, keyIndex, keyArray) => {
      // Work with paths relative to the package dir to match in-page references.
      const fileName = key.split(dir.package)[1];
      const fileNameHash = hashingFileNameList[key].split(dir.package)[1];
      if (debug) log(`${timestamp.stamp()} finishHashing():: ${fileName}`);

      // Bitwise NOT of indexOf: truthy when the substring is present.
      // eslint-disable-next-line no-bitwise
      if (~fileContents.indexOf(fileName)) {
        // Replace all occurrences (split/join is faster than RegExp for simple strings).
        fileContents = fileContents.split(fileName).join(fileNameHash);
      }
      keysProcessed++;

      if (keysProcessed >= keyArray.length) {
        // All mappings applied — write the updated file back to disk.
        fs.writeFile(file, fileContents, (err) => {
          if (err) throw err;
          if (debug) log(`${timestamp.stamp()} finishHashing()::: ${file}: ${'DONE'.bold.green}`);
          htmlFilesProcessed++;
          if (htmlFilesProcessed >= array.length) {
            log(`${timestamp.stamp()} finishHashing(): ${'DONE'.bold.green}`);
            completionFlags.ASSET_HASH.DONE = true;
            buildEvents.emit(BUILD_EVENTS.hashingDone);
          }
        });
      }
    });
  });
};
