const fs = require('fs-extra');
const glob = require('glob');
const zlib = require('zlib');

const { log } = console;

module.exports = function gzipFiles({
  dir, completionFlags, buildEvents, debug,
}) {
  completionFlags.GZIP = false;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  log(`${timestamp.stamp()} gzip()`);

  const overallGlob = glob.sync(`${dir.package}**/*.+(html|xml|css|js|txt|json)`);

  let processed = 0;
  if (debug) log(`overallGlob: ${overallGlob.length} \n\n ${overallGlob} \n`);

  overallGlob.forEach((file) => {
    fs.readFile(file, (error, buffer) => {
      if (error) throw error;
      zlib.gzip(buffer, (err, result) => {
        if (err) throw err;
        fs.writeFile(`${file}.gz`, result, (e) => {
          if (e) throw e;
          if (debug) log(`${timestamp.stamp()} gzip: ${file} ${'complete'.bold.green}`);
          processed++;
          if (processed >= overallGlob.length) {
            log(`${timestamp.stamp()} gzip(): ${'DONE'.bold.green}`);
            completionFlags.GZIP = true;
            buildEvents.emit(BUILD_EVENTS.gzipDone);
          }
        });
      });
    });
  });
};
