/* eslint-disable no-console */
const sass = require('node-sass');
const fs = require('fs-extra');
const glob = require('glob');
const path = require('path');
const CleanCSS = require('clean-css');
const notifier = require('node-notifier');

const { log } = console;

module.exports = function bundleSCSS({
  dir, completionFlags, buildEvents, debug,
}) {
  completionFlags.CSS_IS_MINIFIED = false;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);
  const production = require(`${dir.build}helpers/production`);

  log(`${timestamp.stamp()} bundleSCSS()`);
  const stylesGlob = glob.sync(`${dir.src}**/**/[^_]*.scss`);
  let processed = 0;
  stylesGlob.forEach((scssFilename, index, array) => {
    const outFile = scssFilename.replace(dir.src, dir.package).replace(/\.scss$/, '.css');

    if (debug) log(`${timestamp.stamp()} ${'REQUEST'.magenta} - Compiling SASS - ${outFile.split(/styles/)[1]}`);

    sass.render({
      file: scssFilename,
      outFile,
      includePaths: [`${dir.src}styles/`, dir.nodeModules],
      sourceMap: false,
    }, (error, result) => { // node-style callback from v3.0.0 onwards
      if (error) {
        if (production) throw error;
        else {
          console.error(error.formatted.red);
          notifier.notify({
            title: 'SASS Error',
            message: error.formatted,
          });
          processed++;
        }
      } else {
        // No errors during the compilation, write this result on the disk

        fs.mkdirp(path.dirname(outFile), (err) => {
          if (err) {
            if (production) throw err;
            console.error(err);
          }
          let cssOutput;

          if (production) {
            cssOutput = new CleanCSS().minify(result.css).styles;
          } else {
            cssOutput = result.css;
          }

          fs.writeFile(outFile, cssOutput, (e) => {
            if (e) throw e;
            if (debug) log(`${timestamp.stamp()} ${'SUCCESS'.bold.green} - Compiled SASS - ${outFile.split(/styles/)[1]}`);
            processed++;

            if (processed === array.length) {
              log(`${timestamp.stamp()} bundleSCSS(): ${'DONE'.bold.green}`);
              completionFlags.CSS_IS_MINIFIED = true;
              buildEvents.emit(BUILD_EVENTS.stylesMoved);
            }
          });
        });
      }
    });
  });
};
