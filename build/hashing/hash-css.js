const fs = require('fs-extra');
const glob = require('glob');
const XXHash = require('xxhash');

const { log } = console;

module.exports = function hashCSS({
  dir, completionFlags, buildEvents, hashingFileNameList, debug,
}) {
  completionFlags.ASSET_HASH.CSS = false;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  log(`${timestamp.stamp()} assetHashing().css`);

  const cssGlob = glob.sync(`${dir.package}**/*.css`);
  let processedCss = 0;
  cssGlob.forEach((file, index, array) => {
    const fileContents = fs.readFileSync(file);
    const hash = XXHash.hash(fileContents, 0xCAFEBABE);
    const hashedFileName = `${file.substr(0, file.lastIndexOf('.'))}-${hash}${file.substr(file.lastIndexOf('.'))}`;
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
