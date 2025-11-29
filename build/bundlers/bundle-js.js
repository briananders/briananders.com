/* eslint-disable no-console */
const watchify = require('watchify');
const source = require('vinyl-source-stream');
const rename = require('gulp-rename');
const notifier = require('node-notifier');
const gulp = require('gulp');
const glob = require('glob');
const buffer = require('vinyl-buffer');
const browserify = require('browserify');
const babelify = require('babelify');

const { log } = console;

module.exports = function bundleJS({ dir, buildEvents, debug }) {
  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);
  const production = require(`${dir.build}helpers/production`);

  const scriptGlob = glob.globSync(`${dir.src}js/**/[^_]*.js`);
  let processed = 0;

  log(`${timestamp.stamp()} bundleJS()`);

  scriptGlob.forEach((jsFilename, index, array) => {
    const outFile = jsFilename.replace(`${dir.src}js/`, dir.jsOutputPath);
    if (debug) log(`${timestamp.stamp()} ${'REQUEST'.magenta} - Compiling JS - ${outFile.split(/scripts/)[1]}`);

    browserify({
      entries: [jsFilename],
      debug: true,
      plugin: [watchify],
      cache: {}, // required for watchify
      packageCache: {}, // required for watchify
    })
      .transform(babelify, { presets: ['@babel/preset-env', '@babel/preset-react'] })
      .bundle()
      .on('error', (error) => {
        if (production) throw error;
        else {
          console.error(error.message.red);
          notifier.notify({
            title: 'JavaScript Error',
            message: error.message,
          });
        }
        processed++;
      })
      .pipe(source(jsFilename))
      .pipe(buffer())
      .pipe(rename(outFile.replace(dir.jsOutputPath, '')))
      .pipe(gulp.dest(dir.jsOutputPath))
      .on('end', (err) => {
        if (err) throw err;
        if (debug) log(`${timestamp.stamp()} ${'SUCCESS'.bold.green} - Compiled JS  - ${outFile.split(/scripts/)[1]}`);
        processed++;

        if (processed === array.length) {
          log(`${timestamp.stamp()} bundleJS(): ${'DONE'.bold.green}`);
          buildEvents.emit(BUILD_EVENTS.jsMoved);
        }
      });
  });
};
