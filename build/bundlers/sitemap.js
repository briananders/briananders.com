const ejs = require('ejs');
const fs = require('fs-extra');

const { log } = console;

/**
 * Generates `sitemap.json` and `sitemap.xml` from EJS templates.
 *
 * Both sitemap formats are rendered concurrently from their respective EJS
 * templates in `src/`. Each template receives the full `pageMappingData`
 * array (the compiled front-matter index of every page) and the global
 * `siteData` object so it can build canonical URLs.
 *
 * A simple counter (`doneCount`) tracks both async writes. When both files
 * have been written, `SITE_MAP` is set to `true` and the `sitemapDone` event
 * is emitted, which feeds into the `checkDone` gate.
 *
 * @param {{ dir: object, completionFlags: object, buildEvents: EventEmitter, pageMappingData: Array }} configs
 */
module.exports = function compileSitemap({
  dir, completionFlags, buildEvents, pageMappingData,
}) {
  // Reset the flag so re-runs in watch mode start clean.
  completionFlags.SITE_MAP = false;

  // Tracks how many of the two sitemap files have finished writing.
  let doneCount = 0;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);
  const siteData = require(`${dir.build}constants/site-data`)(dir);

  /** Emits `sitemapDone` once both sitemap files have been written. */
  function checkForDone() {
    if (doneCount >= 2) {
      log(`${timestamp.stamp()} compileSitemap(): ${'DONE'.bold.green}`);
      completionFlags.SITE_MAP = true;
      buildEvents.emit(BUILD_EVENTS.sitemapDone);
    }
  }

  log(`${timestamp.stamp()} compileSitemap()`);

  // Render and write sitemap.json
  ejs.renderFile(`${dir.src}sitemap.json.ejs`, {
    pages: pageMappingData,
    siteData,
  }, {
    compileDebug: true,
  }, (error, str) => {
    if (error) throw error;
    fs.writeFile(`${dir.package}sitemap.json`, str, (err) => {
      if (err) throw err;

      doneCount++;
      checkForDone();
    });
  });

  // Render and write sitemap.xml (runs concurrently with the JSON render above)
  ejs.renderFile(`${dir.src}sitemap.xml.ejs`, {
    pages: pageMappingData,
    siteData,
  }, {
    compileDebug: true,
  }, (error, str) => {
    if (error) throw error;
    fs.writeFile(`${dir.package}sitemap.xml`, str, (err) => {
      if (err) throw err;

      doneCount++;
      checkForDone();
    });
  });
};
