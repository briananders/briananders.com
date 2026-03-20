const fs = require('fs-extra');
const { globSync } = require('glob');
const { minify: htmlMinify } = require('html-minifier-terser');

const { log } = console;

module.exports = function minifyHTML({
  dir, completionFlags, buildEvents, debug,
}) {
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

      htmlMinify(data.toString(), {
        caseSensitive: true,
        collapseWhitespace: true,
        conservativeCollapse: true,
        html5: true,
        keepClosingSlash: true,
        minifyCSS: true,
        minifyJS: true,
        preserveLineBreaks: false,
        quoteCharacter: '"',
        removeAttributeQuotes: true,
        removeComments: true,
        sortClassName: true,
        useShortDoctype: true,
      }).then((minifiedHtml) => {
        fs.writeFile(htmlFileName, minifiedHtml, (err) => {
          if (err) throw err;
          processed++;

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
