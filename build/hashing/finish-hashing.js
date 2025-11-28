const fs = require('fs-extra');
const glob = require('glob');

const { log } = console;

module.exports = async function finishHashing({
  dir, completionFlags, buildEvents, hashingFileNameList, debug,
}) {
  completionFlags.ASSET_HASH.DONE = false;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  log(`${timestamp.stamp()} finishHashing()`);

  if (debug) log(`${timestamp.stamp()} finishHashing(): ${Object.keys(hashingFileNameList)}`);
  if (debug) log(`${timestamp.stamp()} finishHashing(): completionFlags.ASSET_HASH.IMAGES :${completionFlags.ASSET_HASH.IMAGES}`);
  if (debug) log(`${timestamp.stamp()} finishHashing(): completionFlags.ASSET_HASH.CSS    :${completionFlags.ASSET_HASH.CSS}`);
  if (debug) log(`${timestamp.stamp()} finishHashing(): completionFlags.ASSET_HASH.JS     :${completionFlags.ASSET_HASH.JS}`);
  if (!completionFlags.ASSET_HASH.IMAGES
      || !completionFlags.ASSET_HASH.CSS
      || !completionFlags.ASSET_HASH.JS) {
    return false;
  }
  if (debug) log(`${timestamp.stamp()} finishHashing(): ${Object.keys(hashingFileNameList)}`);
  const htmlGlob = [...glob.globSync(`${dir.package}**/*.html`), ...glob.globSync(`${dir.package}**/*.json`)];
  const promises = htmlGlob.map(async (file) => {
    const fileBuffer = fs.readFileSync(file);
    let fileContents = fileBuffer.toString();
    (Object.keys(hashingFileNameList)).forEach((key) => {
      const fileName = key.split(dir.package)[1];
      const fileNameHash = hashingFileNameList[key].split(dir.package)[1];
      if (debug) log(`${timestamp.stamp()} finishHashing():: ${fileName}`);
      // eslint-disable-next-line no-bitwise
      if (~fileContents.indexOf(fileName)) {
        fileContents = fileContents.split(fileName).join(fileNameHash);
      }
    });
    await fs.writeFile(file, fileContents);
    if (debug) log(`${timestamp.stamp()} finishHashing()::: ${file}: ${'DONE'.bold.green}`);
  });
  await Promise.all(promises);
  log(`${timestamp.stamp()} finishHashing(): ${'DONE'.bold.green}`);
  completionFlags.ASSET_HASH.DONE = true;
  buildEvents.emit(BUILD_EVENTS.hashingDone);
};
