const fs = require('fs-extra');
const glob = require('glob');
const XXHash = require('xxhash');

module.exports = function hashCSS(dir, completionFlags, buildEvents, hashingFileNameList) {
  const timestamp = require(`${dir.build}timestamp`);

  const cssGlob = glob.sync(`${dir.package}**/*.css`);
  let processedCss = 0;
  cssGlob.forEach((file, index, array) => {
    const fileContents = fs.readFileSync(file);
    const hash = XXHash.hash(fileContents, 0xCAFEBABE);
    const hashedFileName = `${file.substr(0, file.lastIndexOf('.'))}-${hash}${file.substr(file.lastIndexOf('.'))}`;
    hashingFileNameList[file] = hashedFileName;
    fs.rename(file, hashedFileName, (err) => {
      if (err) throw err;
      console.log(`${timestamp.stamp()}: assetHashing(): ${hashedFileName} renamed complete`);
      processedCss++;
      if (processedCss >= array.length) {
        completionFlags.ASSET_HASH.CSS = true;
        console.log(`${timestamp.stamp()}: assetHashing(): completionFlags.ASSET_HASH.CSS: ${completionFlags.ASSET_HASH.CSS}`);
        buildEvents.emit('asset-hash-css-listed');
      }
    });
  });
};
