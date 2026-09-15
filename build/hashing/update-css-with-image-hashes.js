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
 * @param {object} configs - Build directories, events, and asset path mappings.
 */
module.exports = async function updateCSSwithImageHashes({
  dir, buildEvents, hashingFileNameList,
}) {
  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  log(`${timestamp.stamp()} hashingUpdateCSS()`);

  const mappings = new Map(Object.entries(hashingFileNameList).map(([from, to]) => [
    from.slice(dir.package.length), to.slice(dir.package.length)
  ]));
  await require('../helpers/map-limit')(globSync(`${dir.package}**/*.css`), 8, async (file) => {
    const contents = await fs.readFile(file, 'utf8');
    await fs.writeFile(file, require('./finish-hashing').replacePaths(contents, mappings));
  });
  buildEvents.emit(BUILD_EVENTS.indexCssForHashing);
};
