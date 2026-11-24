import type { BuildConfigs, BuildEventsMap } from './types.ts';

/**
 * Production build event wiring.
 *
 * Sets up the event listeners that chain the production-only optimization
 * and hashing stages together. This module is called once during startup
 * (when `NODE_ENV === 'production'` and `--golden` is not set) before the
 * initial asset pipeline begins.
 *
 * Pipeline wiring overview:
 *
 *   jsMoved           → minifyJS
 *   stylesMoved       → assetHashing (gate check)
 *   htmlMinified      → assetHashing (gate check)
 *   jsMinified        → assetHashing (gate check)
 *   imagesMoved       → assetHashing (gate check)
 *   ─────────────────────────────────────────────────────────────────────
 *   assetHashImagesListed → updateCSSwithImageHashes → indexCssForHashing
 *                         → finishHashing (gate check)
 *   assetHashCssListed    → finishHashing (gate check)
 *   assetHashJsListed     → finishHashing (gate check)
 *   ─────────────────────────────────────────────────────────────────────
 *   hashingDone  → checkDone + gzipFiles
 *   gzipDone     → checkDone
 *   sitemapDone  → checkDone
 *   ─────────────────────────────────────────────────────────────────────
 *   (checkDone exits when all completion flags are true)
 *
 * @param configs - Build configuration object (shared across all modules).
 */
module.exports = (configs: BuildConfigs): void => {
  const { buildEvents, dir } = configs;

  const assetHashing: (c: BuildConfigs) => false | undefined = require(`${dir.build}hashing/asset-hashing.ts`);
  const checkDone: (c: BuildConfigs) => false | undefined = require(`${dir.build}helpers/check-done.ts`);
  const finishHashing: (c: BuildConfigs) => Promise<void> = require(`${dir.build}hashing/finish-hashing.ts`);
  const gzipFiles: (c: BuildConfigs) => Promise<void> = require(`${dir.build}optimize/gzip-files.ts`);
  const hashCSS: (c: BuildConfigs) => void = require(`${dir.build}hashing/hash-css.ts`);
  const minifyHTML: (c: BuildConfigs) => void = require(`${dir.build}optimize/minify-html.ts`);
  const minifyJS: (c: BuildConfigs) => void = require(`${dir.build}optimize/minify-js.ts`);
  const updateCSSwithImageHashes: (c: BuildConfigs) => Promise<void> = require(
    `${dir.build}hashing/update-css-with-image-hashes.ts`
  );
  const BUILD_EVENTS: BuildEventsMap = require(`${dir.build}constants/build-events.ts`);

  // CSS hashing: triggered only after image hashes have been written into CSS.
  buildEvents.on(BUILD_EVENTS.assetHashCssListed, finishHashing.bind(null, configs));

  // Image hashing: first update CSS url() references, then check if hashing is done.
  buildEvents.on(BUILD_EVENTS.assetHashImagesListed, () => {
    updateCSSwithImageHashes(configs);
    finishHashing(configs);
  });

  // JS hashing done: check if all three asset types are done.
  buildEvents.on(BUILD_EVENTS.assetHashJsListed, finishHashing.bind(null, configs));

  // Final steps: check for completion after gzip, and after hash rewriting.
  buildEvents.on(BUILD_EVENTS.gzipDone, checkDone.bind(null, configs));
  buildEvents.on(BUILD_EVENTS.hashingDone, () => {
    checkDone(configs);
    gzipFiles(configs);
  });

  // HTML minified: kick off asset hashing (needs all five prereq flags).
  buildEvents.on(BUILD_EVENTS.htmlMinified, assetHashing.bind(null, configs));

  // Images moved: also attempt to start asset hashing (gate will block until ready).
  buildEvents.on(BUILD_EVENTS.imagesMoved, () => {
    assetHashing(configs);
  });

  // Image hashes applied to CSS → now hash the CSS files themselves.
  buildEvents.on(BUILD_EVENTS.indexCssForHashing, hashCSS.bind(null, configs));

  // JS minified: attempt asset hashing gate.
  buildEvents.on(BUILD_EVENTS.jsMinified, assetHashing.bind(null, configs));

  // JS bundled: start minification immediately.
  buildEvents.on(BUILD_EVENTS.jsMoved, minifyJS.bind(null, configs));

  // Sitemap done: check for overall build completion.
  buildEvents.on(BUILD_EVENTS.sitemapDone, () => {
    assetHashing(configs);
    checkDone(configs);
  });

  // CSS compiled: attempt asset hashing gate.
  buildEvents.on(BUILD_EVENTS.stylesMoved, assetHashing.bind(null, configs));

  // Templates rendered: start HTML minification.
  buildEvents.on(BUILD_EVENTS.templatesMoved, minifyHTML.bind(null, configs));
};
