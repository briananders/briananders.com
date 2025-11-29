const ejs = require('ejs');
const fs = require('fs-extra');

const { log } = console;

module.exports = function compileSitemap({
  dir, completionFlags, buildEvents, pageMappingData,
}) {
  completionFlags.SITE_MAP = false;
  let doneCount = 0;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);
  const siteData = require(`${dir.build}constants/site-data`)(dir);

  function checkForDone() {
    if (doneCount >= 2) {
      log(`${timestamp.stamp()} compileSitemap(): ${'DONE'.bold.green}`);
      completionFlags.SITE_MAP = true;
      buildEvents.emit(BUILD_EVENTS.sitemapDone);
    }
  }

  log(`${timestamp.stamp()} compileSitemap()`);
  (async () => {
    try {
      const jsonStr = await new Promise((resolve, reject) => {
        ejs.renderFile(`${dir.src}sitemap.json.ejs`, {
          pages: pageMappingData,
          siteData,
        }, {
          compileDebug: true,
        }, (error, str) => {
          if (error) reject(error);
          else resolve(str);
        });
      });
      await fs.writeFile(`${dir.package}sitemap.json`, jsonStr);
      doneCount++;
      checkForDone();
    } catch (error) {
      throw error;
    }
  })();

  (async () => {
    try {
      const xmlStr = await new Promise((resolve, reject) => {
        ejs.renderFile(`${dir.src}sitemap.xml.ejs`, {
          pages: pageMappingData,
          siteData,
        }, {
          compileDebug: true,
        }, (error, str) => {
          if (error) reject(error);
          else resolve(str);
        });
      });
      await fs.writeFile(`${dir.package}sitemap.xml`, xmlStr);
      doneCount++;
      checkForDone();
    } catch (error) {
      throw error;
    }
  })();
};
