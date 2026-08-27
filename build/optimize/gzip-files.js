const fs = require('fs-extra');
const { globSync } = require('glob');
const zlib = require('zlib');

const { log } = console;

/**
 * Gzip-compresses every text-based output file.
 *
 * Walks the output directory for all HTML, XML, CSS, JS, TXT, and JSON files
 * and writes a `.gz` sibling next to each one. The originals are preserved so
 * web servers can serve either the compressed or uncompressed version depending
 * on what the client supports.
 *
 * This is the last optimization step in the production pipeline and runs only
 * after asset hashing has finished (triggered by the `hashingDone` event).
 * When complete it emits `gzipDone`, which is the final event that triggers
 * `checkDone` → `process.exit()`.
 *
 * @param {{ dir: object, completionFlags: object, buildEvents: EventEmitter, debug: boolean }} configs
 */
module.exports = function gzipFiles({
  dir, completionFlags, buildEvents, debug,
}) {
  // Reset the flag so re-runs in watch mode start clean.
  completionFlags.GZIP = false;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  log(`${timestamp.stamp()} gzip()`);

  // Collect all compressible file types from the output directory.
  const overallGlob = globSync(`${dir.package}**/*.+(html|xml|css|js|txt|json)`);

  let processed = 0;
  if (debug) log(`overallGlob: ${overallGlob.length} \n\n ${overallGlob} \n`);

  overallGlob.forEach((file) => {
    // Read each file, compress with zlib.gzip, and write a .gz sibling.
    fs.readFile(file, (error, buffer) => {
      if (error) throw error;
      zlib.gzip(buffer, (err, result) => {
        if (err) throw err;
        fs.writeFile(`${file}.gz`, result, (e) => {
          if (e) throw e;
          if (debug) log(`${timestamp.stamp()} gzip: ${file} ${'complete'.bold.green}`);
          processed++;
          // Emit gzipDone once every file has been compressed.
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
