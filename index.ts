'use strict';

import type { Request, Response } from 'express';
import type {
  BuildConfigs,
  BuildDirectories,
  BuildEventsMap,
  CompletionFlags,
  PageMappingEntry
} from './build/types.ts';

/* //////////////////////////// node modules //////////////////////////////// */

require('colors');
const fs: typeof import('fs-extra') = require('fs-extra');
const express: typeof import('express') = require('express');
const { createProxyMiddleware }: typeof import('http-proxy-middleware') = require('http-proxy-middleware');
const EventEmitter: typeof import('node:events') = require('events');
const chokidar: typeof import('chokidar') = require('chokidar');

/* ///////////////////////////// local variables //////////////////////////// */

const { log } = console;

/** Pass `--verbose` to enable debug logging throughout the build pipeline. */
const debug = process.argv.includes('--verbose');

/** Pass `--golden` to produce an unhashed/uncompressed golden build for visual diffing. */
const isGoldenBuild = process.argv.includes('--golden');

// Pin build-time values so golden output only changes when page content does.
if (isGoldenBuild) {
  const goldenEnv: Record<string, string> = require('./build/constants/golden-build.ts');
  Object.assign(process.env, goldenEnv);
}

/**
 * Directory paths for this build. In a golden build, `dir.package` points to
 * `golden/` instead of `package/`.
 */
const getDirectories: (appRoot: string, isGolden?: boolean) => BuildDirectories = require(
  './build/constants/directories.ts',
);
const dir = getDirectories(__dirname, isGoldenBuild);

/* //////////////////////////// local packages ////////////////////////////// */

const timestamp: { stamp: () => string } = require(`${dir.build}helpers/timestamp.ts`);
const production: boolean = require(`${dir.build}helpers/production.ts`);

const bundleEJS: (configs: BuildConfigs) => Promise<void> = require(`${dir.build}bundlers/bundle-ejs.ts`);
const bundleJS: (configs: BuildConfigs) => void = require(`${dir.build}bundlers/bundle-js.ts`);
const bundleSCSS: (configs: BuildConfigs) => void = require(`${dir.build}bundlers/bundle-scss.ts`);
const clean: (configs: BuildConfigs) => Promise<void> = require(`${dir.build}helpers/clean.ts`);
const compilePageMappingData: (configs: BuildConfigs) => void = require(`${dir.build}page-mapping-data.ts`);
const { moveAssets }: { moveAssets: (configs: BuildConfigs) => Promise<void> } = require(
  `${dir.build}move-assets.ts`,
);
const previewBuilder: (configs: BuildConfigs) => void = require(`${dir.build}preview-builder.ts`);
const prodBuilder: (configs: BuildConfigs) => void = require(`${dir.build}prod-builder.ts`);
const goldenBuilder: (configs: BuildConfigs) => void = require(`${dir.build}golden-builder.ts`);
const compileSitemap: (configs: BuildConfigs) => void = require(`${dir.build}bundlers/sitemap.ts`);
const generateBuildTxt: (configs: BuildConfigs) => void = require(`${dir.build}helpers/generate-build-txt.ts`);
const generateRedirects: (configs: BuildConfigs) => void = require(`${dir.build}helpers/generate-redirects.ts`);

const completionFlagsSource: CompletionFlags = require(`${dir.build}constants/completion-flags.ts`);
const BUILD_EVENTS: BuildEventsMap = require(`${dir.build}constants/build-events.ts`);

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
 */
const hashingFileNameList: Record<string, string> = {};

/**
 * Array of `{ url, data }` objects compiled from each template's front matter.
 * Passed by reference so all modules see the same live array.
 */
const pageMappingData: PageMappingEntry[] = [];

/**
 * Shared configuration object passed to every build-pipeline module.
 * Using a single object (passed by reference) means every module shares the
 * same `completionFlags`, `hashingFileNameList`, and `pageMappingData` without
 * tight coupling.
 */
const configs: BuildConfigs = {
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

interface TemplateScheduler {
  assetsReady: () => Promise<void>;
  mappingReady: () => Promise<void>;
}

// Render from a page-mapping snapshot after every asset write has completed.
// The scheduler serializes preview renders and coalesces edits during a render.
const createScheduleTemplates: (
  configs: BuildConfigs,
  render: (configs: BuildConfigs) => Promise<void>,
) => TemplateScheduler = require('./build/helpers/schedule-templates.ts');
const scheduleTemplates = createScheduleTemplates(configs, bundleEJS);
buildEvents.on(BUILD_EVENTS.assetsMoved, scheduleTemplates.assetsReady);
buildEvents.on(BUILD_EVENTS.pageMappingDataCompiled, scheduleTemplates.mappingReady);

// Build the sitemap as soon as front-matter data is available.
buildEvents.on(BUILD_EVENTS.pageMappingDataCompiled, compileSitemap.bind(null, configs));

/**
 * Logs the preview ready status with an up-to-date timestamp.
 */
function logPreviewReady(): void {
  log(`${timestamp.stamp()} ${'Preview Ready'.green.bold}`);
}

// Log a message when the dev server is ready for the first time.
buildEvents.on(BUILD_EVENTS.previewReady, logPreviewReady);

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

/**
 * Cleans the output directory and initiates all parallel build stages.
 */
async function startInitialBuild(): Promise<void> {
  await clean(configs);
  if (debug) {
    log(`${timestamp.stamp()} clean().then()`);
  }
  await fs.mkdirp(dir.package);
  generateBuildTxt(configs);
  generateRedirects(configs);
  compilePageMappingData(configs);
  bundleJS(configs);
  bundleSCSS(configs);
  await moveAssets(configs);
}

// In production modes, kick off the build immediately.
// In dev mode, the build is triggered only after the HTTP server successfully binds the port.
if (production) {
  startInitialBuild();
}

/* /////////////////////// dev server + live reload ///////////////////////// */

if (!production) {
  /**
   * Active Server-Sent Events (SSE) response objects for connected browser tabs.
   * The live-reload script in each page opens a persistent connection to `/livereload`
   * and waits for `data: reload` messages.
   */
  const liveReloadClients: Response[] = [];

  /**
   * GET /livereload
   *
   * Keeps an SSE connection open for each browser tab. When a file changes in
   * the output directory, all connected clients receive `data: reload\n\n`
   * and the page refreshes. Connections are cleaned up when the client closes.
   */
  app.get('/livereload', (req: Request, res: Response) => {
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
  app.use('/.well-known', (_req: Request, res: Response) => {
    res.sendStatus(404);
  });

  // Proxy external data paths to the staging S3 bucket so they're available
  // during local development without needing to download them.
  // Serve local last-fm-history files if they exist on disk, otherwise proxy to the staging S3 bucket.
  const localLastFmHistory = '/Users/briananders/Code/last-fm-scrobbles';
  if (fs.existsSync(localLastFmHistory)) {
    app.use('/last-fm-history', express.static(localLastFmHistory));
  } else {
    app.use('/last-fm-history', createProxyMiddleware({
      target: 'http://staging.briananders.com.s3-website-us-east-1.amazonaws.com/last-fm-history',
      changeOrigin: true,
    }));
  }
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
  app.use(express.static(dir.package));

  let configuredPort = 3000;
  if (process.env.PORT) {
    configuredPort = parseInt(process.env.PORT, 10);
  }

  // Start the HTTP server without passing a callback directly to app.listen.
  // Express 5 registers an app.listen callback on both 'listening' and 'error'.
  // Handling events directly avoids an unhandled TypeError when server.address() is null.
  const server = app.listen(configuredPort);

  server.on('error', (serverError: NodeJS.ErrnoException) => {
    if (serverError.code === 'EADDRINUSE') {
      log(`${timestamp.stamp()} ${`Port ${configuredPort} is already in use by another process.`.red.bold}`);
      const portHint = 'Stop the process using that port or specify a different port '
        + `(e.g. PORT=${configuredPort + 1} npm start).`;
      log(`${timestamp.stamp()} ${portHint.yellow}`);
      process.exit(1);
    }

    log(`${timestamp.stamp()} ${`Server error: ${serverError.message}`.red.bold}`);
    process.exit(1);
  });

  // Only start the build once the port has been secured.
  // This prevents colliding processes from wiping the output directory while a server is running.
  server.on('listening', () => {
    const boundAddress = server.address();
    let boundPort: number | string = configuredPort;
    if (boundAddress && typeof boundAddress === 'object') {
      boundPort = boundAddress.port;
    }
    log(`${timestamp.stamp()} server is running at http://localhost:%s`, boundPort);
    startInitialBuild();
  });

  // Once the initial build finishes, watch for output file changes and
  // push a reload event to all connected browser tabs.
  buildEvents.once(BUILD_EVENTS.previewReady, () => {
    chokidar.watch(dir.package, { ignoreInitial: true })
      .on('change', () => liveReloadClients.forEach((client) => client.write('data: reload\n\n')))
      .on('add', () => liveReloadClients.forEach((client) => client.write('data: reload\n\n')));
  });
}
