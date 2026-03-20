const fs = require('fs-extra');
const { globSync } = require('glob');
const { minify: htmlMinify } = require('html-minifier-terser');

const { log } = console;

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
 * @param {{ dir: object, completionFlags: object, buildEvents: EventEmitter, debug: boolean }} configs
 */
module.exports = function minifyHTML({
  dir, completionFlags, buildEvents, debug,
}) {
  // Reset the flag so re-runs in watch mode start clean.
  completionFlags.HTML_IS_MINIFIED = false;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  log(`${timestamp.stamp()} minifyHTML()`);

  const htmlGlob = globSync(`${dir.package}**/*.html`);
  let processed = 0;

  htmlGlob.forEach((htmlFileName, index, array) => {
    if (debug) log(`${timestamp.stamp()} minifyHTML - ${htmlFileName.split(dir.package)[1]}`);

    fs.readFile(htmlFileName, (error, data) => {
      if (error) throw error;

      // Minify asynchronously — html-minifier-terser v7+ returns a Promise.
      htmlMinify(data.toString(), {
        caseSensitive: true,       // Preserve mixed-case attribute values
        collapseWhitespace: true,  // Collapse runs of whitespace to a single space
        conservativeCollapse: true, // Keep at least one space between tokens
        html5: true,               // Apply HTML5-specific optimizations
        keepClosingSlash: true,    // Keep the slash on void elements (<br />)
        minifyCSS: true,           // Minify inline <style> blocks
        minifyJS: true,            // Minify inline <script> blocks
        preserveLineBreaks: false,
        quoteCharacter: '"',
        removeAttributeQuotes: true, // Remove quotes from attributes when safe
        removeComments: true,
        sortClassName: true,       // Alphabetically sort class attributes
        useShortDoctype: true,     // Replace full doctype with <!DOCTYPE html>
      }).then((minifiedHtml) => {
        fs.writeFile(htmlFileName, minifiedHtml, (err) => {
          if (err) throw err;
          processed++;

          // Emit htmlMinified only after every file has been written.
          if (processed === array.length) {
            log(`${timestamp.stamp()} minifyHTML(): ${'DONE'.bold.green}`);
            completionFlags.HTML_IS_MINIFIED = true;
            buildEvents.emit(BUILD_EVENTS.htmlMinified);
          }
        });
      }).catch((err) => { throw err; });
    });
  });
};
