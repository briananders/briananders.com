'use strict';

/* //////////////////////////// node modules //////////////////////////////// */

require('colors');
const fs = require('fs-extra');
const express = require('express');
const serve = require('express-static');
const { createProxyMiddleware } = require('http-proxy-middleware');
const EventEmitter = require('events');
const chokidar = require('chokidar');

/* ///////////////////////////// local variables //////////////////////////// */

const { log } = console;

/** Pass `--verbose` to enable debug logging throughout the build pipeline. */
const debug = process.argv.includes('--verbose');

/** Pass `--golden` to produce an unhashed/uncompressed golden build for visual diffing. */
const isGoldenBuild = process.argv.includes('--golden');

/**
 * Directory paths for this build. In a golden build, `dir.package` points to
 * `golden/` instead of `package/`.
 */
const dir = require('./build/constants/directories')(__dirname, isGoldenBuild);

/* //////////////////////////// local packages ////////////////////////////// */

const timestamp = require(`${dir.build}helpers/timestamp`);
const production = require(`${dir.build}helpers/production`);

const bundleEJS = require(`${dir.build}bundlers/bundle-ejs`);
const bundleJS = require(`${dir.build}bundlers/bundle-js`);
const bundleSCSS = require(`${dir.build}bundlers/bundle-scss`);
const clean = require(`${dir.build}helpers/clean`);
const compilePageMappingData = require(`${dir.build}page-mapping-data`);
const { moveAssets } = require(`${dir.build}move-assets`);
const previewBuilder = require(`${dir.build}preview-builder`);
const prodBuilder = require(`${dir.build}prod-builder`);
const goldenBuilder = require(`${dir.build}golden-builder`);
const compileSitemap = require(`${dir.build}bundlers/sitemap`);
const generateBuildTxt = require(`${dir.build}helpers/generate-build-txt`);

const completionFlagsSource = require(`${dir.build}constants/completion-flags`);
const BUILD_EVENTS = require(`${dir.build}constants/build-events`);

/* //////////////////////////// express + event setup /////////////////////// */

const app = express();

/**
 * Shared EventEmitter that drives the event-based build pipeline.
 * Every build stage both listens for upstream events and emits downstream
 * events on this single instance.
 */
const buildEvents = new EventEmitter();

/**
 * Map of original output paths → hashed output paths, populated during the
 * asset-hashing stage and consumed by `finishHashing` to rewrite HTML/JSON.
 *
 * @type {Object.<string, string>}
 */
const hashingFileNameList = {};

/**
 * Array of `{ url, data }` objects compiled from each template's front matter.
 * Passed by reference so all modules see the same live array.
 *
 * @type {Array<{ url: string, data: object }>}
 */
const pageMappingData = [];

/**
 * Shared configuration object passed to every build-pipeline module.
 * Using a single object (passed by reference) means every module shares the
 * same `completionFlags`, `hashingFileNameList`, and `pageMappingData` without
 * tight coupling.
 */
const configs = {
  BUILD_EVENTS,
  buildEvents,
  completionFlags: completionFlagsSource,
  debug,
  dir,
  hashingFileNameList,
  pageMappingData,
  isGoldenBuild,
};

/* ////////////////////////////// event listeners /////////////////////////// */

/**
 * Starts the EJS template bundling stage once both images and videos have
 * been moved to the output directory.
 *
 * EJS templates often reference image dimensions via `img()` / `lazyImage()`
 * helper functions, which read image files from the output directory. Those
 * reads would fail if templates were compiled before the images were copied.
 *
 * This gate is triggered by both `imagesMoved` and `videosMoved` events so
 * that whichever fires last actually starts the bundle.
 *
 * @param {object} configs - Build configuration object.
 */
function shouldBundleEjs(configs) {
  const { completionFlags } = configs;

  if (completionFlags.IMAGES_ARE_MOVED
    && completionFlags.VIDEOS_ARE_MOVED) {
    bundleEJS(configs);
  }
}

// Start EJS bundling once images and videos are both ready.
buildEvents.on(BUILD_EVENTS.videosMoved, shouldBundleEjs.bind(this, configs));
buildEvents.on(BUILD_EVENTS.imagesMoved, shouldBundleEjs.bind(this, configs));

// Re-bundle EJS whenever page-mapping data is recompiled (e.g. on template changes in dev).
buildEvents.on(BUILD_EVENTS.pageMappingDataCompiled, shouldBundleEjs.bind(this, configs));

// Build the sitemap as soon as front-matter data is available.
buildEvents.on(BUILD_EVENTS.pageMappingDataCompiled, compileSitemap.bind(this, configs));

// Log a message when the dev server is ready for the first time.
buildEvents.on(BUILD_EVENTS.previewReady, log.bind(this, `${timestamp.stamp()} ${'Preview Ready'.green.bold}`));

/* /////////////////////// build mode selection ///////////////////////////// */

// Wire up the correct builder based on the current mode:
// - Dev (NODE_ENV !== 'production'): file watchers + live reload
// - Golden (--golden flag): minify only, no hashing/gzip
// - Production: full optimization pipeline
if (!production) {
  previewBuilder(configs);
} else if (isGoldenBuild) {
  goldenBuilder(configs);
} else {
  prodBuilder(configs);
}

/* ////////////////////////////////////////////////////////////////////////// */
/* ////////////////////////////// initializers ////////////////////////////// */
/* ////////////////////////////////////////////////////////////////////////// */

log(`production: ${production}`.toUpperCase().brightBlue.bold);

// Clean the output directory, then kick off all parallel build stages.
clean(configs).then(() => {
  if (debug) log(`${timestamp.stamp()} clean().then()`);
  fs.mkdirp(dir.package);
  generateBuildTxt(configs);
  compilePageMappingData(configs);
  bundleJS(configs);
  bundleSCSS(configs);
  moveAssets(configs);   // Starts images + videos + txt + downloads in parallel
});

/* /////////////////////// dev server + live reload ///////////////////////// */

if (!production) {
  /**
   * Active Server-Sent Events (SSE) response objects for connected browser tabs.
   * The live-reload script in each page opens a persistent connection to `/livereload`
   * and waits for `data: reload` messages.
   *
   * @type {import('express').Response[]}
   */
  const liveReloadClients = [];

  /**
   * GET /livereload
   *
   * Keeps an SSE connection open for each browser tab. When a file changes in
   * the output directory, all connected clients receive `data: reload\n\n`
   * and the page refreshes. Connections are cleaned up when the client closes.
   */
  app.get('/livereload', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    liveReloadClients.push(res);
    req.on('close', () => {
      const i = liveReloadClients.indexOf(res);
      if (i !== -1) liveReloadClients.splice(i, 1);
    });
  });

  // Suppress noisy 404s from Chrome's well-known endpoint probing.
  app.use('/.well-known', (req, res) => res.sendStatus(404));

  // Proxy external data paths to the staging S3 bucket so they're available
  // during local development without needing to download them.
  app.use('/last-fm-history', createProxyMiddleware({
    target: 'http://staging.briananders.com.s3-website-us-east-1.amazonaws.com/last-fm-history',
    changeOrigin: true,
  }));
  app.use('/band-news', createProxyMiddleware({
    target: 'http://staging.briananders.com.s3-website-us-east-1.amazonaws.com/band-news',
    changeOrigin: true,
  }));
  app.use('/data', createProxyMiddleware({
    target: 'http://staging.briananders.com.s3-website-us-east-1.amazonaws.com/data',
    changeOrigin: true,
  }));
  app.use('/movies', createProxyMiddleware({
    target: 'http://staging.briananders.com.s3-website-us-east-1.amazonaws.com/movies',
    changeOrigin: true,
  }));

  // Serve the built output directory as static files.
  app.use(serve(dir.package));

  const server = app.listen(3000, () => {
    log(`${timestamp.stamp()} server is running at http://localhost:%s`, server.address().port);
  });

  // Once the initial build finishes, watch for output file changes and
  // push a reload event to all connected browser tabs.
  buildEvents.on(BUILD_EVENTS.previewReady, () => {
    chokidar.watch(dir.package, { ignoreInitial: true })
      .on('change', () => liveReloadClients.forEach((client) => client.write('data: reload\n\n')))
      .on('add', () => liveReloadClients.forEach((client) => client.write('data: reload\n\n')));
  });
}
