/* eslint-disable no-console */
const watchify = require('watchify');
const source = require('vinyl-source-stream');
const rename = require('gulp-rename');
const notifier = require('node-notifier');
const gulp = require('gulp');
const { globSync } = require('glob');
const buffer = require('vinyl-buffer');
const browserify = require('browserify');
const babelify = require('babelify');
const path = require('path');

const { log } = console;

/**
 * Bundles all JavaScript entry points with Browserify + Babel.
 *
 * Glob discovers every non-underscore-prefixed `.js` file directly under
 * `src/js/` (entry points). Each file is independently bundled through the
 * Browserify → Babelify pipeline and written to `package/scripts/` preserving
 * the source subdirectory structure.
 *
 * **Dev mode** (`NODE_ENV !== 'production'`): Watchify is added as a Browserify
 * plugin, enabling incremental rebuilds. Source maps are enabled (`debug: true`).
 *
 * **Production mode**: Watchify is omitted and source maps are disabled. The
 * resulting bundles are later minified by `minifyJS`.
 *
 * Babel presets applied:
 * - `@babel/preset-env` — transpiles modern JS syntax for broader browser support.
 * - `@babel/preset-react` — transpiles JSX (used by some interactive experiments).
 *
 * The gulp/vinyl pipeline (`source → buffer → rename → gulp.dest`) is used
 * here as a convenient stream-based file writer compatible with Browserify's
 * streaming output, not as a task runner.
 *
 * When all entry points have been bundled the `jsMoved` event is emitted.
 *
 * @param {{ dir: object, buildEvents: EventEmitter, debug: boolean }} configs
 */
module.exports = function bundleJS({ dir, buildEvents, debug }) {
  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);
  const production = require(`${dir.build}helpers/production`);

  const jsOutputPath = path.join(dir.package, 'scripts');

  // Find all non-private JS entry points (files NOT starting with `_`).
  const scriptGlob = globSync(`${dir.src}js/**/[^_]*.js`);
  let processed = 0;

  log(`${timestamp.stamp()} bundleJS()`);

  scriptGlob.forEach((jsFilename, index, array) => {
    const outFile = jsFilename.replace(`${dir.src}js/`, jsOutputPath);
    if (debug) log(`${timestamp.stamp()} ${'REQUEST'.magenta} - Compiling JS - ${outFile.split(/scripts/)[1]}`);

    const isProd = production;
    const browserifyOptions = {
      entries: [jsFilename],
      debug: !isProd, // Source maps only in dev
      cache: {},
      packageCache: {},
    };

    // In dev mode, watchify enables fast incremental re-bundling on file changes.
    if (!isProd) {
      browserifyOptions.plugin = [watchify];
    }

    browserify(browserifyOptions)
      .transform(babelify, { presets: ['@babel/preset-env', '@babel/preset-react'] })
      .bundle()
      .on('error', (error) => {
        // In production, JS errors are fatal; in dev, show a notification and continue.
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
      // vinyl-source-stream converts the Browserify readable stream into a
      // vinyl file object that gulp can work with.
      .pipe(source(jsFilename))
      // vinyl-buffer converts the streaming vinyl file to a buffered one,
      // required by plugins that don't support streaming mode.
      .pipe(buffer())
      // Rename to just the relative path portion (strip the jsOutputPath prefix).
      .pipe(rename(outFile.replace(jsOutputPath, '')))
      .pipe(gulp.dest(jsOutputPath))
      .on('end', (err) => {
        if (err) throw err;
        if (debug) log(`${timestamp.stamp()} ${'SUCCESS'.bold.green} - Compiled JS  - ${outFile.split(/scripts/)[1]}`);
        processed++;

        // Emit jsMoved only after the last entry point has been written.
        if (processed === array.length) {
          log(`${timestamp.stamp()} bundleJS(): ${'DONE'.bold.green}`);
          buildEvents.emit(BUILD_EVENTS.jsMoved);
        }
      });
  });
};
