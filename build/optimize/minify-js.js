const fs = require('fs-extra');
const { globSync } = require('glob');
const UglifyJS = require('uglify-js');

const { log } = console;

module.exports = function minifyJS({ dir, completionFlags, buildEvents }) {
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
