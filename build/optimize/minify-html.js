const fs = require('fs-extra');
const glob = require('glob');
const htmlMinify = require('html-minifier');

const { log } = console;

module.exports = async function minifyHTML({
  dir, completionFlags, buildEvents, debug,
}) {
  completionFlags.HTML_IS_MINIFIED = false;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  log(`${timestamp.stamp()} minifyHTML()`);

  const htmlGlob = glob.globSync(`${dir.package}**/*.html`);

  const promises = htmlGlob.map(async (htmlFileName) => {
    if (debug) log(`${timestamp.stamp()} minifyHTML - ${htmlFileName.split('/package/')[1]}`);

    const data = await fs.readFile(htmlFileName);
    const minifiedHtml = htmlMinify.minify(data.toString(), {
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
    });

    await fs.writeFile(htmlFileName, minifiedHtml);
  });

  await Promise.all(promises);
  log(`${timestamp.stamp()} minifyHTML(): ${'DONE'.bold.green}`);
  completionFlags.HTML_IS_MINIFIED = true;
  buildEvents.emit(BUILD_EVENTS.htmlMinified);
};
