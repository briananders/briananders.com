import type { EventEmitter } from 'node:events';
import type { BuildDirectories, BuildEventsMap, CompletionFlags } from '../types.ts';

const fs: typeof import('fs-extra') = require('fs-extra');
const { globSync }: typeof import('glob') = require('glob');
const UglifyJS: typeof import('uglify-js') = require('uglify-js');

const { log } = console;

interface MinifyJsParams {
  dir: Pick<BuildDirectories, 'package' | 'build'>;
  completionFlags: Pick<CompletionFlags, 'JS_IS_MINIFIED'>;
  buildEvents: EventEmitter;
}

/**
 * Minifies all JavaScript files in the output directory using UglifyJS.
 *
 * Runs after the `jsMoved` event (i.e., after Browserify has finished
 * bundling all entry points). Each `.js` file in `package/` is read,
 * minified in place, and written back to the same path. When every file
 * has been processed, the `jsMinified` event is emitted, which triggers
 * the asset-hashing stage.
 *
 * @param configs - Build directories, completion flags, and event emitter.
 */
module.exports = function minifyJS({ dir, completionFlags, buildEvents }: MinifyJsParams): void {
  // Reset the flag so re-runs in watch mode start clean.
  completionFlags.JS_IS_MINIFIED = false;

  const BUILD_EVENTS: BuildEventsMap = require(`${dir.build}constants/build-events.ts`);
  const timestamp: { stamp: () => string } = require(`${dir.build}helpers/timestamp.ts`);

  log(`${timestamp.stamp()} minifyJS()`);

  const jsGlob = globSync(`${dir.package}**/*.js`);
  let processed = 0;

  jsGlob.forEach((jsFileName: string, _index: number, array: string[]) => {
    fs.readFile(jsFileName, (error: NodeJS.ErrnoException | null, data: Buffer) => {
      if (error) throw error;

      const uglifiedJS = UglifyJS.minify(data.toString());

      // UglifyJS reports parse/compilation errors on the result object rather
      // than throwing — check explicitly and treat as a fatal build error.
      if (uglifiedJS.error) throw 'uglifiedJS.error'.red;

      fs.writeFile(jsFileName, uglifiedJS.code, (err: NodeJS.ErrnoException | null) => {
        if (err) throw err;
        processed++;

        // Emit jsMinified only after the last file has been written.
        if (processed === array.length) {
          log(`${timestamp.stamp()} minifyJS(): ${'DONE'.green.bold}`);
          completionFlags.JS_IS_MINIFIED = true;
          buildEvents.emit(BUILD_EVENTS.jsMinified);
        }
      });
    });
  });
};
