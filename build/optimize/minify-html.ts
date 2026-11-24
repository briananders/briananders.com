import type { EventEmitter } from 'node:events';
import type { MinifyOptions } from 'html-minifier-terser';
import type { BuildDirectories, BuildEventsMap, CompletionFlags } from '../types.ts';

const fs: typeof import('fs-extra') = require('fs-extra');
const { globSync }: typeof import('glob') = require('glob');
const { minify: htmlMinify }: {
  minify: (value: string, options?: MinifyOptions & { quoteCharacter?: string }) => Promise<string>;
} = require('html-minifier-terser');

const { log } = console;

interface MinifyHtmlParams {
  dir: Pick<BuildDirectories, 'package' | 'build'>;
  completionFlags: Pick<CompletionFlags, 'HTML_IS_MINIFIED'>;
  buildEvents: EventEmitter;
  debug: boolean;
}

/**
 * Minifies all HTML files in the output directory using html-minifier-terser.
 *
 * Runs after the `templatesMoved` event (i.e., after all EJS templates have
 * been rendered to HTML). Each `.html` file in `package/` is read, minified
 * in place, and written back to the same path. When every file has been
 * processed, the `htmlMinified` event is emitted, which triggers the
 * asset-hashing stage.
 *
 * Note: `html-minifier-terser`'s `minify()` is async (returns a Promise),
 * so completion counting happens inside the `.then()` callback rather than
 * synchronously after the call.
 *
 * @param configs - Build directories, completion flags, event emitter, and debug flag.
 */
module.exports = function minifyHTML({
  dir, completionFlags, buildEvents, debug,
}: MinifyHtmlParams): void {
  // Reset the flag so re-runs in watch mode start clean.
  completionFlags.HTML_IS_MINIFIED = false;

  const BUILD_EVENTS: BuildEventsMap = require(`${dir.build}constants/build-events.ts`);
  const timestamp: { stamp: () => string } = require(`${dir.build}helpers/timestamp.ts`);

  log(`${timestamp.stamp()} minifyHTML()`);

  const htmlGlob = globSync(`${dir.package}**/*.html`);
  let processed = 0;

  htmlGlob.forEach((htmlFileName: string, _index: number, array: string[]) => {
    if (debug) log(`${timestamp.stamp()} minifyHTML - ${htmlFileName.split(dir.package)[1]}`);

    fs.readFile(htmlFileName, (error: NodeJS.ErrnoException | null, data: Buffer) => {
      if (error) throw error;

      // Minify asynchronously — html-minifier-terser v7+ returns a Promise.
      htmlMinify(data.toString(), {
        caseSensitive: true, // Preserve mixed-case attribute values
        collapseWhitespace: true, // Collapse runs of whitespace to a single space
        conservativeCollapse: true, // Keep at least one space between tokens
        html5: true, // Apply HTML5-specific optimizations
        keepClosingSlash: true, // Keep the slash on void elements (<br />)
        minifyCSS: true, // Minify inline <style> blocks
        minifyJS: true, // Minify inline <script> blocks
        preserveLineBreaks: false,
        quoteCharacter: '"',
        removeAttributeQuotes: true, // Remove quotes from attributes when safe
        removeComments: true,
        sortClassName: true, // Alphabetically sort class attributes
        useShortDoctype: true, // Replace full doctype with <!DOCTYPE html>
      }).then((minifiedHtml: string) => {
        fs.writeFile(htmlFileName, minifiedHtml, (err: NodeJS.ErrnoException | null) => {
          if (err) throw err;
          processed++;

          // Emit htmlMinified only after every file has been written.
          if (processed === array.length) {
            log(`${timestamp.stamp()} minifyHTML(): ${'DONE'.green.bold}`);
            completionFlags.HTML_IS_MINIFIED = true;
            buildEvents.emit(BUILD_EVENTS.htmlMinified);
          }
        });
      }).catch((err: unknown) => { throw err; });
    });
  });
};
