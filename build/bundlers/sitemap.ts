import type { EventEmitter } from 'node:events';
import type { BuildDirectories, BuildEventsMap, CompletionFlags, PageMappingEntry } from '../types.ts';

const ejs: typeof import('ejs') = require('ejs');
const fs: typeof import('fs-extra') = require('fs-extra');

const { log } = console;

interface CompileSitemapParams {
  dir: BuildDirectories;
  completionFlags: Pick<CompletionFlags, 'SITE_MAP'>;
  buildEvents: EventEmitter;
  pageMappingData: PageMappingEntry[];
}

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
 * @param configs - Build directories, completion flags, event emitter, and page mappings.
 */
module.exports = function compileSitemap({
  dir, completionFlags, buildEvents, pageMappingData,
}: CompileSitemapParams): void {
  // Reset the flag so re-runs in watch mode start clean.
  completionFlags.SITE_MAP = false;

  // Tracks how many of the two sitemap files have finished writing.
  let doneCount = 0;

  const BUILD_EVENTS: BuildEventsMap = require(`${dir.build}constants/build-events.ts`);
  const timestamp: { stamp: () => string } = require(`${dir.build}helpers/timestamp.ts`);
  const createSiteData: (d: BuildDirectories) => Record<string, unknown> = require(
    `${dir.build}constants/site-data.ts`
  );
  const siteData = createSiteData(dir);

  /** Emits `sitemapDone` once both sitemap files have been written. */
  function checkForDone(): void {
    if (doneCount >= 2) {
      log(`${timestamp.stamp()} compileSitemap(): ${'DONE'.green.bold}`);
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
  }, (error: Error | null, str: string) => {
    if (error) throw error;
    fs.writeFile(`${dir.package}sitemap.json`, str, (err: NodeJS.ErrnoException | null) => {
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
  }, (error: Error | null, str: string) => {
    if (error) throw error;
    fs.writeFile(`${dir.package}sitemap.xml`, str, (err: NodeJS.ErrnoException | null) => {
      if (err) throw err;

      doneCount++;
      checkForDone();
    });
  });
};
