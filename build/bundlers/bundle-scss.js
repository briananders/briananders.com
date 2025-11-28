/* eslint-disable no-console */
const sass = require('sass');
const fs = require('fs-extra');
const glob = require('glob');
const path = require('path');
const CleanCSS = require('clean-css');
const notifier = require('node-notifier');

const { log } = console;

module.exports = async function bundleSCSS({
  dir, completionFlags, buildEvents, debug,
}) {
  completionFlags.CSS_IS_MINIFIED = false;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);
  const production = require(`${dir.build}helpers/production`);

  log(`${timestamp.stamp()} bundleSCSS()`);
  const stylesGlob = glob.globSync(`${dir.src}**/**/[^_]*.scss`);
  const promises = stylesGlob.map(async (scssFilename) => {
    const outFile = scssFilename.replace(dir.src, dir.package).replace(/\.scss$/, '.css');

    if (debug) log(`${timestamp.stamp()} ${'REQUEST'.magenta} - Compiling SASS - ${outFile.split(/styles/)[1]}`);

    try {
      const result = await sass.compileAsync(scssFilename, {
        loadPaths: [`${dir.src}styles/`, dir.nodeModules],
        sourceMap: false,
      });

      // Ensure output directory exists
      await fs.mkdirp(path.dirname(outFile));

      let cssOutput;
      if (production) {
        cssOutput = new CleanCSS().minify(result.css.toString()).styles;
      } else {
        cssOutput = result.css.toString();
      }

      await fs.writeFile(outFile, cssOutput);
      if (debug) log(`${timestamp.stamp()} ${'SUCCESS'.bold.green} - Compiled SASS - ${outFile.split(/styles/)[1]}`);
    } catch (error) {
      if (production) throw error;
      else {
        const errorMessage = error.message || error.toString();
        console.error(errorMessage.red);
        notifier.notify({
          title: 'SASS Error',
          message: errorMessage,
        });
      }
    }
  });

  await Promise.all(promises);
  log(`${timestamp.stamp()} bundleSCSS(): ${'DONE'.bold.green}`);
  completionFlags.CSS_IS_MINIFIED = true;
  buildEvents.emit(BUILD_EVENTS.stylesMoved);
};
