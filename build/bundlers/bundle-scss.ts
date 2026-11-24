import type { EventEmitter } from 'node:events';
import type { CompileResult } from 'sass';
import type { BuildDirectories, BuildEventsMap, CompletionFlags } from '../types.ts';

const sass: typeof import('sass') = require('sass');
const fs: typeof import('fs-extra') = require('fs-extra');
const { globSync }: typeof import('glob') = require('glob');
const path: typeof import('path') = require('path');
const CleanCSS: typeof import('clean-css') = require('clean-css');
const notifier: typeof import('node-notifier') = require('node-notifier');

const { log } = console;

interface BundleScssParams {
  dir: BuildDirectories;
  completionFlags: Pick<CompletionFlags, 'CSS_IS_MINIFIED'>;
  buildEvents: EventEmitter;
  debug: boolean;
}

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
 * @param configs - Build directories, completion flags, event emitter, and debug flag.
 */
module.exports = function bundleSCSS({
  dir, completionFlags, buildEvents, debug,
}: BundleScssParams): void {
  // Reset the flag so re-runs in watch mode start clean.
  completionFlags.CSS_IS_MINIFIED = false;

  const BUILD_EVENTS: BuildEventsMap = require(`${dir.build}constants/build-events.ts`);
  const timestamp: { stamp: () => string } = require(`${dir.build}helpers/timestamp.ts`);
  const production: boolean = require(`${dir.build}helpers/production.ts`);

  log(`${timestamp.stamp()} bundleSCSS()`);

  // Find all non-private SCSS entry points (files NOT starting with `_`).
  // SCSS co-located under src/ts/ is bundled via Browserify (shadow DOM); exclude from site CSS.
  const stylesGlob = globSync(`${dir.src}**/**/[^_]*.scss`, {
    ignore: [`${dir.src}ts/**/*.scss`],
  });
  let processed = 0;

  stylesGlob.forEach((scssFilename: string, _index: number, array: string[]) => {
    // Mirror the source path into the output directory and swap `.scss` → `.css`.
    const outFile = scssFilename.replace(dir.src, dir.package).replace(/\.scss$/, '.css');

    if (debug) log(`${timestamp.stamp()} ${'REQUEST'.magenta} - Compiling SASS - ${outFile.split(/styles/)[1]}`);

    sass.compileAsync(scssFilename, {
      // Allow SCSS files to @use 'system/utilities' (relative to src/styles/)
      // and import npm packages directly.
      loadPaths: [`${dir.src}styles/`, dir.nodeModules],
    }).then((result: CompileResult) => {
      // Ensure the destination subdirectory exists before writing.
      fs.mkdirp(path.dirname(outFile), (err: Error | null) => {
        if (err) {
          if (production) throw err;
          console.error(err);
        }

        // In production, minify with CleanCSS; in dev, use the raw Sass output.
        let cssOutput: string;
        if (production) {
          cssOutput = new CleanCSS().minify(result.css).styles;
        } else {
          cssOutput = result.css;
        }

        fs.writeFile(outFile, cssOutput, (e: NodeJS.ErrnoException | null) => {
          if (e) throw e;
          if (debug) {
            log(`${timestamp.stamp()} ${'SUCCESS'.green.bold} - Compiled SASS - ${outFile.split(/styles/)[1]}`);
          }
          processed++;

          // Emit stylesMoved only after the last SCSS file has been compiled.
          if (processed === array.length) {
            log(`${timestamp.stamp()} bundleSCSS(): ${'DONE'.green.bold}`);
            completionFlags.CSS_IS_MINIFIED = true;
            buildEvents.emit(BUILD_EVENTS.stylesMoved);
          }
        });
      });
    }).catch((error: unknown) => {
      // Sass errors are fatal in production; in dev, notify and keep running.
      if (production) throw error;
      let message = 'SASS error';
      if (error instanceof Error && error.message) {
        ({ message } = error);
      }
      console.error(message.red);
      notifier.notify({
        title: 'SASS Error',
        message,
      });
      processed++;
    });
  });
};
