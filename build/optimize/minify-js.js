const fs = require('fs-extra');
const glob = require('glob');
const UglifyJS = require('uglify-js');

const { log } = console;

module.exports = async function minifyJS({ dir, completionFlags, buildEvents }) {
  completionFlags.JS_IS_MINIFIED = false;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  log(`${timestamp.stamp()} minifyJS()`);

  const jsGlob = glob.globSync(`${dir.package}**/*.js`);

  const promises = jsGlob.map(async (jsFileName) => {
    const data = await fs.readFile(jsFileName);
    const uglifiedJS = UglifyJS.minify(data.toString());

    if (uglifiedJS.error) throw 'uglifiedJS.error'.red;

    await fs.writeFile(jsFileName, uglifiedJS.code);
  });

  await Promise.all(promises);
  log(`${timestamp.stamp()} minifyJS(): ${'DONE'.bold.green}`);
  completionFlags.JS_IS_MINIFIED = true;
  buildEvents.emit(BUILD_EVENTS.jsMinified);
};
