module.exports = (configs) => {
  const { buildEvents, dir, completionFlags } = configs;

  const checkDone = require(`${dir.build}helpers/check-done`);
  const minifyHTML = require(`${dir.build}optimize/minify-html`);
  const minifyJS = require(`${dir.build}optimize/minify-js`);

  completionFlags.ASSET_HASH.IMAGES = true;
  completionFlags.ASSET_HASH.CSS = true;
  completionFlags.ASSET_HASH.JS = true;
  completionFlags.ASSET_HASH.DONE = true;
  completionFlags.GZIP = true;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);

  buildEvents.on(BUILD_EVENTS.jsMoved,
    minifyJS.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.templatesMoved,
    minifyHTML.bind(this, configs));

  buildEvents.on(BUILD_EVENTS.assetHashCssListed,
    checkDone.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.assetHashImagesListed,
    checkDone.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.assetHashJsListed,
    checkDone.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.gzipDone,
    checkDone.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.hashingDone,
    checkDone.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.htmlMinified,
    checkDone.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.imagesMoved,
    checkDone.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.indexCssForHashing,
    checkDone.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.jsMinified,
    checkDone.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.jsMoved,
    checkDone.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.pageMappingDataCompiled,
    checkDone.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.previewReady,
    checkDone.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.sitemapDone,
    checkDone.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.stylesMoved,
    checkDone.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.templatesMoved,
    checkDone.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.videosMoved,
    checkDone.bind(this, configs));
};
