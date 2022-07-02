'use strict';

/* //////////////////////////// node modules //////////////////////////////// */

require('colors');
const fs = require('fs-extra');
const express = require('express');
const serve = require('express-static');
const EventEmitter = require('events');
const dir = require('./build/constants/directories')(__dirname);

/* //////////////////////////// local packages ////////////////////////////// */

const timestamp = require(`${dir.build}helpers/timestamp`);
const production = require(`${dir.build}helpers/production`);

const bundleEJS = require(`${dir.build}bundlers/bundle-ejs`);
const bundleJS = require(`${dir.build}bundlers/bundle-js`);
const bundleSCSS = require(`${dir.build}bundlers/bundle-scss`);
const clean = require(`${dir.build}helpers/clean`);
const compilePageMappingData = require(`${dir.build}page-mapping-data`);
const { moveAssets } = require(`${dir.build}move-images`);
const previewBuilder = require(`${dir.build}preview-builder`);
const prodBuilder = require(`${dir.build}prod-builder`);
const sitemap = require(`${dir.build}bundlers/sitemap`);

const completionFlagsSource = require(`${dir.build}constants/completion-flags`);
const BUILD_EVENTS = require(`${dir.build}constants/build-events`);

/* ///////////////////////////// local variables //////////////////////////// */

const { log } = console;
const debug = process.argv.includes('--verbose');

const app = express();
const buildEvents = new EventEmitter();

const hashingFileNameList = {};
const pageMappingData = [];

const configs = {
  BUILD_EVENTS,
  buildEvents,
  completionFlags: completionFlagsSource,
  debug,
  dir,
  hashingFileNameList,
  pageMappingData,
};

/* ////////////////////////////// event listeners /////////////////////////// */

function shouldBundleEjs(configs) {
  const { completionFlags } = configs;

  if (completionFlags.IMAGES_ARE_MOVED &&
      completionFlags.VIDEOS_ARE_MOVED) {
    bundleEJS(configs);
  }
}

buildEvents.on(BUILD_EVENTS.videosMoved, shouldBundleEjs.bind(this, configs));
buildEvents.on(BUILD_EVENTS.imagesMoved, shouldBundleEjs.bind(this, configs));
buildEvents.on(BUILD_EVENTS.pageMappingDataCompiled, shouldBundleEjs.bind(this, configs));
buildEvents.on(BUILD_EVENTS.pageMappingDataCompiled, sitemap.bind(this, configs));
buildEvents.on(BUILD_EVENTS.previewReady, log.bind(this, `${timestamp.stamp()} ${'Preview Ready'.green.bold}`));

if (!production) {
  previewBuilder(configs);
} else {
  prodBuilder(configs);
}

/* ////////////////////////////////////////////////////////////////////////// */
/* ////////////////////////////// initializers ////////////////////////////// */
/* ////////////////////////////////////////////////////////////////////////// */

log(`production: ${production}`.toUpperCase().brightBlue.bold);

clean(configs).then(() => {
  if (debug) log(`${timestamp.stamp()} clean().then()`);
  fs.mkdirp(dir.package);
  compilePageMappingData(configs);
  bundleJS(configs);
  bundleSCSS(configs);
  moveAssets(configs);
});

if (!production) {
  app.use(serve(dir.package));

  const server = app.listen(3000, () => {
    log(`${timestamp.stamp()} server is running at http://localhost:%s`, server.address().port);
  });
}
