import type { BuildConfigs, BuildEventsMap } from './types.ts';

/**
 * Golden build event wiring.
 *
 * The golden build produces unhashed, uncompressed output in `/golden/` for
 * use in visual regression testing. It runs JS and HTML minification (so the
 * output is realistic), but skips asset hashing and gzip compression entirely.
 *
 * To skip these stages gracefully — without rewriting `checkDone` — the
 * relevant completion flags are pre-set to `true` here. This tricks the gate
 * into treating those stages as "already done" so that `checkDone` can still
 * exit cleanly once the remaining stages (JS minify, HTML minify, images,
 * videos, sitemap) have finished.
 *
 * Pre-set flags:
 * - `ASSET_HASH.IMAGES`, `ASSET_HASH.CSS`, `ASSET_HASH.JS`, `ASSET_HASH.DONE`
 * - `GZIP`
 *
 * All build events route directly to `checkDone` (no side-effect chaining
 * like in the production builder), except for `jsMoved` and `templatesMoved`
 * which still trigger minification.
 *
 * @param configs - Build configuration object (shared across all modules).
 */
module.exports = (configs: BuildConfigs): void => {
  const { buildEvents, dir, completionFlags } = configs;

  const checkDone: (c: BuildConfigs) => false | undefined = require(`${dir.build}helpers/check-done.ts`);
  const minifyHTML: (c: BuildConfigs) => void = require(`${dir.build}optimize/minify-html.ts`);
  const minifyJS: (c: BuildConfigs) => void = require(`${dir.build}optimize/minify-js.ts`);

  // Pre-mark all hashing and gzip stages as complete so checkDone can exit
  // without waiting for them (golden builds skip those stages).
  completionFlags.ASSET_HASH.IMAGES = true;
  completionFlags.ASSET_HASH.CSS = true;
  completionFlags.ASSET_HASH.JS = true;
  completionFlags.ASSET_HASH.DONE = true;
  completionFlags.GZIP = true;

  const BUILD_EVENTS: BuildEventsMap = require(`${dir.build}constants/build-events.ts`);

  // JS bundled → minify, then checkDone.
  buildEvents.on(
    BUILD_EVENTS.jsMoved,
    minifyJS.bind(null, configs)
  );
  // Templates rendered → minify HTML, then checkDone.
  buildEvents.on(
    BUILD_EVENTS.templatesMoved,
    minifyHTML.bind(null, configs)
  );

  // All remaining events route straight to checkDone.
  buildEvents.on(
    BUILD_EVENTS.assetHashCssListed,
    checkDone.bind(null, configs)
  );
  buildEvents.on(
    BUILD_EVENTS.assetHashImagesListed,
    checkDone.bind(null, configs)
  );
  buildEvents.on(
    BUILD_EVENTS.assetHashJsListed,
    checkDone.bind(null, configs)
  );
  buildEvents.on(
    BUILD_EVENTS.gzipDone,
    checkDone.bind(null, configs)
  );
  buildEvents.on(
    BUILD_EVENTS.hashingDone,
    checkDone.bind(null, configs)
  );
  buildEvents.on(
    BUILD_EVENTS.htmlMinified,
    checkDone.bind(null, configs)
  );
  buildEvents.on(
    BUILD_EVENTS.imagesMoved,
    checkDone.bind(null, configs)
  );
  buildEvents.on(
    BUILD_EVENTS.indexCssForHashing,
    checkDone.bind(null, configs)
  );
  buildEvents.on(
    BUILD_EVENTS.jsMinified,
    checkDone.bind(null, configs)
  );
  buildEvents.on(
    BUILD_EVENTS.jsMoved,
    checkDone.bind(null, configs)
  );
  buildEvents.on(
    BUILD_EVENTS.pageMappingDataCompiled,
    checkDone.bind(null, configs)
  );
  buildEvents.on(
    BUILD_EVENTS.previewReady,
    checkDone.bind(null, configs)
  );
  buildEvents.on(
    BUILD_EVENTS.sitemapDone,
    checkDone.bind(null, configs)
  );
  buildEvents.on(
    BUILD_EVENTS.stylesMoved,
    checkDone.bind(null, configs)
  );
  buildEvents.on(
    BUILD_EVENTS.templatesMoved,
    checkDone.bind(null, configs)
  );
  buildEvents.on(
    BUILD_EVENTS.videosMoved,
    checkDone.bind(null, configs)
  );
};
