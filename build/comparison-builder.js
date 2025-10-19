module.exports = (configs) => {
  const { buildEvents, dir } = configs;

  const checkDone = require(`${dir.build}helpers/check-done`);
  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);

  // For comparison builds, we skip gzip and asset hashing
  // but still need to handle the completion flow
  buildEvents.on(BUILD_EVENTS.imagesMoved, () => {
    // Skip asset hashing for comparison builds
    buildEvents.emit(BUILD_EVENTS.assetHashImagesListed);
  });
  
  buildEvents.on(BUILD_EVENTS.stylesMoved, () => {
    // Skip asset hashing for comparison builds
    buildEvents.emit(BUILD_EVENTS.assetHashCssListed);
  });
  
  buildEvents.on(BUILD_EVENTS.jsMoved, () => {
    // Skip asset hashing for comparison builds
    buildEvents.emit(BUILD_EVENTS.assetHashJsListed);
  });
  
  buildEvents.on(BUILD_EVENTS.templatesMoved, () => {
    // Skip asset hashing for comparison builds
    buildEvents.emit(BUILD_EVENTS.assetHashJsListed);
  });

  buildEvents.on(BUILD_EVENTS.assetHashImagesListed, () => {
    // Skip CSS hash updating for comparison builds
    buildEvents.emit(BUILD_EVENTS.assetHashCssListed);
  });
  
  buildEvents.on(BUILD_EVENTS.assetHashCssListed, () => {
    // Skip finishing hashing for comparison builds
    buildEvents.emit(BUILD_EVENTS.assetHashJsListed);
  });
  
  buildEvents.on(BUILD_EVENTS.assetHashJsListed, () => {
    // Mark hashing as done without actually doing it
    configs.completionFlags.ASSET_HASH.DONE = true;
    buildEvents.emit(BUILD_EVENTS.hashingDone);
  });
  
  buildEvents.on(BUILD_EVENTS.hashingDone, () => {
    // Skip gzip for comparison builds
    configs.completionFlags.GZIP = true;
    buildEvents.emit(BUILD_EVENTS.gzipDone);
  });
  
  buildEvents.on(BUILD_EVENTS.gzipDone, checkDone.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.sitemapDone, checkDone.bind(this, configs));
};