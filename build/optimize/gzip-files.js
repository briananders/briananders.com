const fs = require('fs-extra');
const glob = require('glob');
const zlib = require('zlib');
const { promisify } = require('util');

const { log } = console;
const gzip = promisify(zlib.gzip);

module.exports = async function gzipFiles({
  dir, completionFlags, buildEvents, debug,
}) {
  completionFlags.GZIP = false;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  log(`${timestamp.stamp()} gzip()`);

  const overallGlob = glob.globSync(`${dir.package}**/*.+(html|xml|css|js|txt|json)`);

  if (debug) log(`overallGlob: ${overallGlob.length} \n\n ${overallGlob} \n`);

  const promises = overallGlob.map(async (file) => {
    const data = await fs.readFile(file);
    const result = await gzip(data);
    await fs.writeFile(`${file}.gz`, result);
    if (debug) log(`${timestamp.stamp()} gzip: ${file} ${'complete'.bold.green}`);
  });

  await Promise.all(promises);
  log(`${timestamp.stamp()} gzip(): ${'DONE'.bold.green}`);
  completionFlags.GZIP = true;
  buildEvents.emit(BUILD_EVENTS.gzipDone);
};
