const fs = require('fs-extra');
const { globSync } = require('glob');
const UglifyJS = require('uglify-js');

const { log } = console;

/**
 * Minifies all JavaScript files in the output directory using UglifyJS.
 *
 * Runs after the `jsMoved` event (i.e., after Browserify has finished
 * bundling all entry points). Each `.js` file in `package/` is read,
 * minified in place, and written back to the same path. When every file
 * has been processed, the `jsMinified` event is emitted, which triggers
 * the asset-hashing stage.
 *
 * @param {{ dir: object, completionFlags: object, buildEvents: EventEmitter }} configs
 */
module.exports = function minifyJS({ dir, completionFlags, buildEvents }) {
  // Reset the flag so re-runs in watch mode start clean.
  completionFlags.JS_IS_MINIFIED = false;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  log(`${timestamp.stamp()} minifyJS()`);

  const jsGlob = globSync(`${dir.package}**/*.js`);
  let processed = 0;

  jsGlob.forEach((jsFileName, index, array) => {
    fs.readFile(jsFileName, (error, data) => {
      if (error) throw error;

      const uglifiedJS = UglifyJS.minify(data.toString());

      // UglifyJS reports parse/compilation errors on the result object rather
      // than throwing — check explicitly and treat as a fatal build error.
      if (uglifiedJS.error) throw 'uglifiedJS.error'.red;

      fs.writeFile(jsFileName, uglifiedJS.code, (err) => {
        if (err) throw err;
        processed++;

        // Emit jsMinified only after the last file has been written.
        if (processed === array.length) {
          log(`${timestamp.stamp()} minifyJS(): ${'DONE'.bold.green}`);
          completionFlags.JS_IS_MINIFIED = true;
          buildEvents.emit(BUILD_EVENTS.jsMinified);
        }
      });
    });
  });
};
