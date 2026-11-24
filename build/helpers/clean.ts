import type { BuildDirectories } from '../types.ts';

const fs: typeof import('fs-extra') = require('fs-extra');

const timestamp: { stamp: () => string } = require('./timestamp.ts');

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
 * @param configs - Build configuration object containing `dir.package`.
 * @returns Resolves once the directory has been emptied; rejects on error.
 */
module.exports = ({ dir }: { dir: Pick<BuildDirectories, 'package'> }): Promise<void> => (
  new Promise<void>((resolve, reject) => {
    log(`${timestamp.stamp()} clean()`);

    fs.emptyDir(dir.package, (error: Error | null) => {
      if (error) {
        log(error);
        reject();
      } else {
        resolve();
      }
    });
  })
);
