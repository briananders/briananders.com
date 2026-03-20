const fs = require('fs-extra');
const { globSync } = require('glob');

const { log } = console;

/**
 * Rewrites CSS files to reference hashed image and video filenames.
 *
 * The asset-hashing pipeline runs in two passes:
 *   1. Image/video files are renamed with content hashes (`assetHashing`).
 *   2. CSS files that reference those assets must be updated before CSS
 *      files themselves are hashed — otherwise the CSS hash would be based
 *      on the pre-updated content, and the HTML/JSON rewrite would produce
 *      mismatched references.
 *
 * This function performs step 2: it scans every `.css` file in the output
 * directory and does a simple string-replace for each `originalPath →
 * hashedPath` entry in `hashingFileNameList`. Paths are stored as relative
 * filenames (without the `package/` prefix) to match how they appear inside
 * CSS `url()` values.
 *
 * When all CSS files have been updated the `indexCssForHashing` event is
 * emitted, which triggers `hashCSS` to hash the (now-updated) CSS files.
 *
 * @param {{ dir: object, buildEvents: EventEmitter, hashingFileNameList: object, debug: boolean }} configs
 */
module.exports = function updateCSSwithImageHashes({
  dir, buildEvents, hashingFileNameList, debug,
}) {
  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  log(`${timestamp.stamp()} hashingUpdateCSS()`);

  const cssGlob = globSync(`${dir.package}**/*.css`);
  let processedCss = 0;
  cssGlob.forEach((file, index, array) => {
    const fileBuffer = fs.readFileSync(file);
    let fileContents = fileBuffer.toString();
    let keysProcessed = 0;

    // Iterate every known original→hashed mapping and substitute in this file.
    (Object.keys(hashingFileNameList)).forEach((key, keyIndex, keyArray) => {
      // Strip the package directory prefix to get the path as it appears in CSS.
      const fileName = key.split(dir.package)[1];
      const fileNameHash = hashingFileNameList[key].split(dir.package)[1];
      if (debug) log(`${timestamp.stamp()} hashingUpdateCSS():: ${fileName}`);

      // Bitwise NOT of indexOf: truthy when the substring is found (indexOf >= 0).
      // eslint-disable-next-line no-bitwise
      if (~fileContents.indexOf(fileName)) {
        // Replace all occurrences of the original filename with the hashed one.
        fileContents = fileContents.split(fileName).join(fileNameHash);
      }

      keysProcessed++;
      if (keysProcessed >= keyArray.length) {
        // All mappings processed for this file — write it back to disk.
        fs.writeFile(file, fileContents, (err) => {
          if (err) throw err;
          if (debug) log(`${timestamp.stamp()} hashingUpdateCSS()::: ${file}: ${'DONE'.bold.green}`);
          processedCss++;
          if (processedCss >= array.length) {
            log(`${timestamp.stamp()} hashingUpdateCSS(): ${'DONE'.bold.green}`);
            buildEvents.emit(BUILD_EVENTS.indexCssForHashing);
          }
        });
      }
    });
  });
};
