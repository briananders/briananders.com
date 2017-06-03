const fs = require('fs-extra');
const glob = require('glob');
const XXHash = require('xxhash');

module.exports = function assetHashing(dir, completionFlags, buildEvents, hashingFileNameList) {
  const timestamp = require(`${dir.build}timestamp`);

  if (!completionFlags.JS_IS_MINIFIED ||
      !completionFlags.CSS_IS_MINIFIED ||
      !completionFlags.HTML_IS_MINIFIED ||
      !completionFlags.IMAGES_ARE_MOVED) {
    return false;
  }
  console.log(`${timestamp.stamp()}: assetHashing()`);
  console.log(`completionFlags.JS_IS_MINIFIED :${completionFlags.JS_IS_MINIFIED}`);
  console.log(`completionFlags.CSS_IS_MINIFIED    :${completionFlags.CSS_IS_MINIFIED}`);
  console.log(`completionFlags.HTML_IS_MINIFIED     :${completionFlags.HTML_IS_MINIFIED}`);
  console.log(`completionFlags.IMAGES_ARE_MOVED     :${completionFlags.IMAGES_ARE_MOVED}`);

  const jsGlob = glob.sync(`${dir.package}**/*.js`);
  const imagesGlob = glob.sync(`${dir.package}images/**/*.{png,svg,jpg}`);

  let processedJs = 0;
  jsGlob.forEach((file, index, array) => {
    const fileContents = fs.readFileSync(file);
    const hash = XXHash.hash(fileContents, 0xCAFEBABE);
    const hashedFileName = `${file.substr(0, file.lastIndexOf('.'))}-${hash}${file.substr(file.lastIndexOf('.'))}`;
    hashingFileNameList[file] = hashedFileName;
    fs.rename(file, hashedFileName, (err) => {
      if (err) throw err;
      console.log(`${timestamp.stamp()}: assetHashing(): ${hashedFileName} renamed complete`);
      processedJs++;
      if (processedJs >= array.length) {
        completionFlags.ASSET_HASH.JS = true;
        console.log(`${timestamp.stamp()}: assetHashing(): completionFlags.ASSET_HASH.JS: ${completionFlags.ASSET_HASH.JS}`);
        buildEvents.emit('asset-hash-js-listed');
      }
    });
  });
  let processedImages = 0;
  imagesGlob.forEach((file, index, array) => {
    const fileContents = fs.readFileSync(file);
    const hash = XXHash.hash(fileContents, 0xCAFEBABE);
    const hashedFileName = `${file.substr(0, file.lastIndexOf('.'))}-${hash}${file.substr(file.lastIndexOf('.'))}`;
    hashingFileNameList[file] = hashedFileName;
    fs.rename(file, hashedFileName, (err) => {
      if (err) throw err;
      console.log(`${timestamp.stamp()}: assetHashing(): ${hashedFileName} renamed complete`);
      processedImages++;
      if (processedImages >= array.length) {
        completionFlags.ASSET_HASH.IMAGES = true;
        console.log(`${timestamp.stamp()}: assetHashing(): completionFlags.ASSET_HASH.IMAGES: ${completionFlags.ASSET_HASH.IMAGES}`);
        buildEvents.emit('asset-hash-images-listed');
      }
    });
  });
};
