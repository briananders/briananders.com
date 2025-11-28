const fs = require('fs-extra');
const glob = require('glob');

const { log } = console;

module.exports = async function updateCSSwithImageHashes({
  dir, buildEvents, hashingFileNameList, debug,
}) {
  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  log(`${timestamp.stamp()} hashingUpdateCSS()`);

  const cssGlob = glob.globSync(`${dir.package}**/*.css`);
  const promises = cssGlob.map(async (file) => {
    const fileBuffer = fs.readFileSync(file);
    let fileContents = fileBuffer.toString();
    (Object.keys(hashingFileNameList)).forEach((key) => {
      const fileName = key.split(dir.package)[1];
      const fileNameHash = hashingFileNameList[key].split(dir.package)[1];
      if (debug) log(`${timestamp.stamp()} hashingUpdateCSS():: ${fileName}`);
      // eslint-disable-next-line no-bitwise
      if (~fileContents.indexOf(fileName)) {
        fileContents = fileContents.split(fileName).join(fileNameHash);
      }
    });
    await fs.writeFile(file, fileContents);
    if (debug) log(`${timestamp.stamp()} hashingUpdateCSS()::: ${file}: ${'DONE'.bold.green}`);
  });
  await Promise.all(promises);
  log(`${timestamp.stamp()} hashingUpdateCSS(): ${'DONE'.bold.green}`);
  buildEvents.emit(BUILD_EVENTS.indexCssForHashing);
};
