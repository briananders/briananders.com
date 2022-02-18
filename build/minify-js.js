const fs = require('fs-extra');
const glob = require('glob');
const UglifyJS = require('uglify-js');

const BUILD_EVENTS = require('./constants/build-events');

const { log } = console;

module.exports = function minifyJS({ dir, completionFlags, buildEvents }) {
  completionFlags.JS_IS_MINIFIED = false;

  const timestamp = require(`${dir.build}timestamp`);

  log(`${timestamp.stamp()} minifyJS()`);

  const jsGlob = glob.sync(`${dir.package}**/*.js`);
  let processed = 0;

  jsGlob.forEach((jsFileName, index, array) => {
    fs.readFile(jsFileName, (error, data) => {
      if (error) throw error;

      const uglifiedJS = UglifyJS.minify(data.toString());

      if (uglifiedJS.error) throw 'uglifiedJS.error'.red;

      fs.writeFile(jsFileName, uglifiedJS.code, (err) => {
        if (err) throw err;
        processed++;

        if (processed === array.length) {
          log(`${timestamp.stamp()} minifyJS(): ${'DONE'.bold.green}`);
          completionFlags.JS_IS_MINIFIED = true;
          buildEvents.emit(BUILD_EVENTS.jsMinified);
        }
      });
    });
  });
};
