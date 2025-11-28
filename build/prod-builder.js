module.exports = (configs) => {
  const { buildEvents, dir } = configs;

  const assetHashing = require(`${dir.build}hashing/asset-hashing`);
  const checkDone = require(`${dir.build}helpers/check-done`);
  const finishHashing = require(`${dir.build}hashing/finish-hashing`);
  const gzipFiles = require(`${dir.build}optimize/gzip-files`);
  const hashCSS = require(`${dir.build}hashing/hash-css`);
  const minifyHTML = require(`${dir.build}optimize/minify-html`);
  const minifyJS = require(`${dir.build}optimize/minify-js`);
  const updateCSSwithImageHashes = require(`${dir.build}hashing/update-css-with-image-hashes`);
  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);

  buildEvents.on(BUILD_EVENTS.assetHashCssListed, async () => {
    await finishHashing(configs);
  });
  buildEvents.on(BUILD_EVENTS.assetHashImagesListed, async () => {
    await updateCSSwithImageHashes(configs);
    await finishHashing(configs);
  });
  buildEvents.on(BUILD_EVENTS.assetHashJsListed, async () => {
    await finishHashing(configs);
  });
  buildEvents.on(BUILD_EVENTS.gzipDone, checkDone.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.hashingDone, async () => {
    checkDone(configs);
    await gzipFiles(configs);
  });
  buildEvents.on(BUILD_EVENTS.htmlMinified, assetHashing.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.imagesMoved, () => {
    assetHashing(configs);
  });
  buildEvents.on(BUILD_EVENTS.indexCssForHashing, hashCSS.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.jsMinified, assetHashing.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.jsMoved, async () => {
    await minifyJS(configs);
  });
  buildEvents.on(BUILD_EVENTS.sitemapDone, checkDone.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.stylesMoved, assetHashing.bind(this, configs));
  buildEvents.on(BUILD_EVENTS.templatesMoved, async () => {
    await minifyHTML(configs);
  });
};
