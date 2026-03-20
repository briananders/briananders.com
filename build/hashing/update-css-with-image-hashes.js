const fs = require('fs-extra');
const { globSync } = require('glob');

const { log } = console;

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
    (Object.keys(hashingFileNameList)).forEach((key, keyIndex, keyArray) => {
      const fileName = key.split(dir.package)[1];
      const fileNameHash = hashingFileNameList[key].split(dir.package)[1];
      if (debug) log(`${timestamp.stamp()} hashingUpdateCSS():: ${fileName}`);
      // eslint-disable-next-line no-bitwise
      if (~fileContents.indexOf(fileName)) {
        fileContents = fileContents.split(fileName).join(fileNameHash);
      }
      keysProcessed++;
      if (keysProcessed >= keyArray.length) {
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
