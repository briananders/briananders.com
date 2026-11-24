import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
require('colors');
const mapLimit = require('../build/helpers/map-limit.ts');
const schedule = require('../build/helpers/schedule-templates.ts');
const { replacePaths } = require('../build/hashing/finish-hashing.ts');
const events = require('../build/constants/build-events.ts');

test('bounded workers await all writes and handle empty inputs', async () => {
  let active = 0;
  let peak = 0;
  const done: number[] = [];
  await mapLimit([1, 2, 3, 4], 2, async (item: number) => {
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    done.push(item);
  });
  assert.equal(peak, 2);
  assert.equal(done.length, 4);
  await mapLimit([], 2, () => assert.fail('empty batch must not run'));
  await assert.rejects(mapLimit([1], 2, async () => { throw Error('write failed'); }));
});

test('templates wait for both inputs, serialize renders, and snapshot edits', async () => {
  interface PageMappingEntry {
    url: string;
  }

  const configs: { pageMappingData: PageMappingEntry[] } = { pageMappingData: [{ url: 'before' }] };
  const snapshots: PageMappingEntry[][] = [];
  let release: (() => void) | undefined;
  const gate = schedule(configs, async (data: { pageMappingData: PageMappingEntry[] }) => {
    snapshots.push(data.pageMappingData);
    if (snapshots.length === 1) {
      await new Promise<void>((resolve) => { release = resolve; });
    }
  });
  await gate.assetsReady();
  assert.equal(snapshots.length, 0);
  const running = gate.mappingReady();
  configs.pageMappingData[0].url = 'after';
  await gate.mappingReady();
  await gate.mappingReady();
  assert.equal(snapshots.length, 1);
  assert.ok(release, 'first render should have paused on release');
  release();
  await running;
  assert.deepEqual(snapshots, [[{ url: 'before' }], [{ url: 'after' }]]);
  await gate.assetsReady();
  assert.equal(snapshots.length, 2);
});

test('hash replacement preserves suffixes and avoids filename and remote URL collisions', () => {
  const mapping = new Map([['images/a.png', 'images/a-123.png']]);
  const input = '<img src="/images/a.png?v=2#part" srcset="images/a.png 1x, /images/a.png 2x">';
  const expected = '<img src="/images/a-123.png?v=2#part" srcset="images/a-123.png 1x, /images/a-123.png 2x">';
  assert.equal(replacePaths(input, mapping), expected);
  const unchanged = '"/other/images/a.png" "images/a.png.webp" "https://remote.test/images/a.png"';
  assert.equal(replacePaths(unchanged, mapping), unchanged);
  assert.equal(replacePaths('{"image":"/images/a.png"}', mapping), '{"image":"/images/a-123.png"}');
});

test('asset completion includes svg, video, text, downloads, and favicon writes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brian-assets-'));
  try {
    const dir = { src: `${root}/src/`, package: `${root}/out/`, build: `${process.cwd()}/build/` };
    await Promise.all(['images', 'videos', 'downloads'].map((name) => mkdir(`${dir.src}${name}`, { recursive: true })));
    await require('sharp')({
      create: {
        width: 32, height: 32, channels: 4, background: '#ff0000',
      },
    }).png().toFile(`${dir.src}images/favicon_base.png`);
    const svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">'
      + '<path d="M0 0h10v10z"/></svg>';
    await writeFile(`${dir.src}images/example.svg`, svgMarkup);
    await writeFile(`${dir.src}videos/example.mp4`, 'video');
    await writeFile(`${dir.src}robots.txt`, 'robots');
    await writeFile(`${dir.src}downloads/example.txt`, 'download');
    const buildEvents = new EventEmitter();
    let completed = false;
    buildEvents.on(events.assetsMoved, () => { completed = true; });
    await require('../build/move-assets.ts').moveAssets({
      dir, buildEvents, BUILD_EVENTS: events, completionFlags: {},
    });
    assert.equal(completed, true);
    const expectedFiles = [
      'favicon.ico', 'images/example.svg', 'videos/example.mp4', 'robots.txt', 'downloads/example.txt'
    ];
    for (const file of expectedFiles) {
      assert.ok((await readFile(`${dir.package}${file}`)).length);
    }
    await assert.rejects(
      require('../build/move-assets.ts').moveOneImage(`${dir.src}images/favicon_base.png`, {
        dir: { ...dir, package: '/dev/null/' },
      }),
    );
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('empty gzip batch completes exactly once', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brian-gzip-'));
  try {
    let completed = 0;
    const buildEvents = new EventEmitter();
    buildEvents.on(events.gzipDone, () => completed++);
    const completionFlags: Record<string, boolean> = {};
    await require('../build/optimize/gzip-files.ts')({
      dir: { package: `${root}/`, build: `${process.cwd()}/build/` },
      buildEvents,
      completionFlags,
    });
    assert.equal(completed, 1);
    assert.equal(completionFlags.GZIP, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test(
  'development bundlers rebuild shared TS and Sass dependencies and reconcile entry points',
  { timeout: 15000 },
  async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'brian-bundlers-'));
    const bundleJS = require('../build/bundlers/bundle-js.ts');
    const configs = {
      dir: { src: `${root}/src/`, package: `${root}/out/` },
      buildEvents: new EventEmitter(), BUILD_EVENTS: events,
    };

    /**
     * Polls an output file until it contains the expected substring or times out.
     */
    async function waitFor(file: string, expected: string): Promise<void> {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const content = await readFile(file, 'utf8').catch(() => '');
        if (content.includes(expected)) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.fail(`${file} did not contain ${expected}`);
    }

    try {
      await mkdir(`${root}/src/ts`, { recursive: true });
      await writeFile(`${root}/src/ts/_shared.ts`, 'module.exports = "before";');
      await writeFile(`${root}/src/ts/_tokens.scss`, '$color: red;');
      await writeFile(`${root}/src/ts/_style.scss`, '@use "tokens"; a { color: tokens.$color; }');
      await writeFile(`${root}/src/ts/main.ts`, 'console.log(require("./_shared.ts"), require("./_style.scss"));');
      await bundleJS(configs);
      await waitFor(`${root}/out/scripts/main.js`, 'before');
      await writeFile(`${root}/src/ts/_shared.ts`, 'module.exports = "after";');
      await bundleJS(configs, `${root}/src/ts/_shared.ts`);
      await waitFor(`${root}/out/scripts/main.js`, 'after');
      await writeFile(`${root}/src/ts/_tokens.scss`, '$color: blue;');
      await bundleJS(configs, `${root}/src/ts/_tokens.scss`);
      await waitFor(`${root}/out/scripts/main.js`, 'color: blue');
      await writeFile(`${root}/src/ts/new.ts`, 'console.log("added");');
      await bundleJS(configs, `${root}/src/ts/new.ts`);
      await waitFor(`${root}/out/scripts/new.js`, 'added');
      await rm(`${root}/src/ts/new.ts`);
      await bundleJS(configs, `${root}/src/ts/new.ts`);
      await assert.rejects(readFile(`${root}/out/scripts/new.js`), { code: 'ENOENT' });
    } finally {
      await bundleJS.close(configs);
      await rm(root, { recursive: true, force: true });
    }
  },
);

test('preview readiness fires once even after repeated rebuild completion events', () => {
  const buildEvents = new EventEmitter();
  const completionFlags: Record<string, boolean> = {};
  let count = 0;
  buildEvents.on(events.previewReady, () => count++);
  require('../build/preview-builder.ts').watchForPreviewReady({
    buildEvents, completionFlags, dir: { build: `${process.cwd()}/build/` },
  });
  for (let pass = 0; pass < 3; pass++) {
    for (const event of [events.jsMoved, events.templatesMoved, events.stylesMoved, events.imagesMoved]) {
      buildEvents.emit(event);
    }
  }
  assert.equal(count, 1);
  assert.equal(completionFlags.PREVIEW_READY, true);
});

test('dev server gracefully handles port collision and respects PORT override', async () => {
  // Bind an ephemeral port so we guarantee a port collision without interfering with port 3000.
  const dummyServer = createServer((_request, response) => {
    response.end();
  });

  await new Promise<void>((resolve) => {
    dummyServer.listen(0, () => resolve());
  });

  const address = dummyServer.address();
  assert.ok(address && typeof address === 'object', 'dummy server should bind to an address object');
  const occupiedPort = address.port;

  try {
    const devServerProcess = spawn('node', ['index.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(occupiedPort),
        NODE_ENV: 'development',
      },
    });

    let combinedOutput = '';
    devServerProcess.stdout.on('data', (chunk: Buffer) => {
      combinedOutput += chunk.toString();
    });
    devServerProcess.stderr.on('data', (chunk: Buffer) => {
      combinedOutput += chunk.toString();
    });

    const exitCode = await new Promise<number | null>((resolve) => {
      devServerProcess.on('exit', resolve);
    });

    // The process should cleanly exit with code 1 instead of crashing with an uncaught exception.
    assert.equal(exitCode, 1);
    assert.match(combinedOutput, new RegExp(`Port ${occupiedPort} is already in use`));
    assert.doesNotMatch(combinedOutput, /Cannot read properties of null/);
  } finally {
    await new Promise<void>((resolve) => {
      dummyServer.close(() => resolve());
    });
  }
});
