/* eslint-disable no-console */
const sass = require('sass');
const fs = require('fs-extra');
const { globSync } = require('glob');
const path = require('path');
const CleanCSS = require('clean-css');
const notifier = require('node-notifier');

const { log } = console;

/**
 * Compiles all SCSS entry points to CSS using Dart Sass.
 *
 * Globs for every non-underscore-prefixed `.scss` file under `src/` (entry
 * points; files prefixed with `_` are partials imported by others and excluded
 * from direct compilation). Each file is compiled with `sass.compileAsync()`
 * and written to `package/` mirroring the source directory structure.
 *
 * Load paths:
 * - `src/styles/` — so SCSS files can `@use 'system/utilities'` without a
 *   relative path.
 * - `node_modules/` — allows importing npm packages directly in SCSS.
 *
 * **Production mode**: The compiled CSS is passed through CleanCSS for
 * minification before being written. The `CSS_IS_MINIFIED` flag is then set
 * and the `stylesMoved` event is emitted.
 *
 * **Dev mode**: Raw (unminified) CSS is written directly. `CSS_IS_MINIFIED`
 * is still set to `true` (the flag name is a slight misnomer in dev context)
 * and `stylesMoved` is emitted.
 *
 * Sass compilation errors in dev mode show a desktop notification and log the
 * message in red rather than crashing the process.
 *
 * @param {{ dir: object, completionFlags: object, buildEvents: EventEmitter, debug: boolean }} configs
 */
module.exports = function bundleSCSS({
  dir, completionFlags, buildEvents, debug,
}) {
  // Reset the flag so re-runs in watch mode start clean.
  completionFlags.CSS_IS_MINIFIED = false;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);
  const production = require(`${dir.build}helpers/production`);

  log(`${timestamp.stamp()} bundleSCSS()`);

  // Find all non-private SCSS entry points (files NOT starting with `_`).
  // SCSS co-located under src/js/ is bundled via Browserify (shadow DOM); exclude from site CSS.
  const stylesGlob = globSync(`${dir.src}**/**/[^_]*.scss`, {
    ignore: [`${dir.src}js/**/*.scss`],
  });
  let processed = 0;

  stylesGlob.forEach((scssFilename, index, array) => {
    // Mirror the source path into the output directory and swap `.scss` → `.css`.
    const outFile = scssFilename.replace(dir.src, dir.package).replace(/\.scss$/, '.css');

    if (debug) log(`${timestamp.stamp()} ${'REQUEST'.magenta} - Compiling SASS - ${outFile.split(/styles/)[1]}`);

    sass.compileAsync(scssFilename, {
      // Allow SCSS files to @use 'system/utilities' (relative to src/styles/)
      // and import npm packages directly.
      loadPaths: [`${dir.src}styles/`, dir.nodeModules],
    }).then((result) => {
      // Ensure the destination subdirectory exists before writing.
      fs.mkdirp(path.dirname(outFile), (err) => {
        if (err) {
          if (production) throw err;
          console.error(err);
        }

        // In production, minify with CleanCSS; in dev, use the raw Sass output.
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

          // Emit stylesMoved only after the last SCSS file has been compiled.
          if (processed === array.length) {
            log(`${timestamp.stamp()} bundleSCSS(): ${'DONE'.bold.green}`);
            completionFlags.CSS_IS_MINIFIED = true;
            buildEvents.emit(BUILD_EVENTS.stylesMoved);
          }
        });
      });
    }).catch((error) => {
      // Sass errors are fatal in production; in dev, notify and keep running.
      if (production) throw error;
      const message = (error && error.message) || 'SASS error';
      console.error(message.red);
      notifier.notify({
        title: 'SASS Error',
        message,
      });
      processed++;
    });
  });
};
