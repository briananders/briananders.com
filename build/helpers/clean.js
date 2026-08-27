const fs = require('fs-extra');

const timestamp = require('./timestamp');

const { log } = console;

/**
 * Clears the output directory before starting a new build.
 *
 * Empties `dir.package` (typically `package/` or `golden/` for golden builds)
 * using `fs-extra`'s `emptyDir`, which deletes all contents while leaving the
 * directory itself intact. Returns a Promise so callers can `.then()` into the
 * rest of the pipeline and be certain the old output is gone before writing new
 * files.
 *
 * @param {{ dir: { package: string } }} configs - Build configuration object.
 * @returns {Promise<void>} Resolves once the directory has been emptied; rejects on error.
 */
module.exports = ({ dir }) => new Promise((resolve, reject) => {
  log(`${timestamp.stamp()} clean()`);

  fs.emptyDir(dir.package, (error) => {
    if (error) {
      log(error);
      reject();
    } else {
      resolve();
    }
  });
});
