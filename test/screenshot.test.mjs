import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseArgs, slugify, planSheet } = require('../bin/screenshot.js');

test('parseArgs defaults to the home page at the three grid breakpoints, dark scheme', () => {
  assert.deepEqual(parseArgs([]), {
    paths: ['/'],
    dir: 'package',
    out: 'screenshots',
    widths: [375, 768, 1280],
    schemes: ['dark'],
    sheetHeight: 3000,
  });
});

test('parseArgs accepts paths with or without a leading slash, plus options', () => {
  const options = parseArgs(['posts/coin-flip/', '/about/', '--dir=golden', '--widths=320,1440', '--schemes=dark,light', '--sheet-height=500']);
  assert.deepEqual(options.paths, ['/posts/coin-flip/', '/about/']);
  assert.equal(options.dir, 'golden');
  assert.deepEqual(options.widths, [320, 1440]);
  assert.deepEqual(options.schemes, ['dark', 'light']);
  assert.equal(options.sheetHeight, 500);
});

test('parseArgs rejects unknown options and invalid values', () => {
  assert.throws(() => parseArgs(['--colour=dark']), /Unknown option/);
  assert.throws(() => parseArgs(['--widths=375,wide']), /positive integers/);
  assert.throws(() => parseArgs(['--schemes=sepia']), /dark and light/);
});

test('slugify turns URL paths into directory names', () => {
  assert.equal(slugify('/'), 'home');
  assert.equal(slugify('/posts/coin-flip/'), 'posts-coin-flip');
  assert.equal(slugify('/posts/last-fm/?period=7day#top'), 'posts-last-fm');
  assert.equal(slugify('/404.html'), '404.html');
});

test('planSheet places columns side by side and crops only columns taller than the limit', () => {
  const plan = planSheet([{ width: 375, height: 5000 }, { width: 768, height: 1200 }], 3000);
  const [mobile, tablet] = plan.columns;
  assert.equal(mobile.cropHeight, 3000);
  assert.equal(mobile.cropped, true);
  assert.equal(tablet.cropHeight, 1200);
  assert.equal(tablet.cropped, false);
  assert.ok(tablet.left > mobile.left + 375, 'columns must not overlap');
  assert.ok(plan.width >= tablet.left + 768);
  assert.ok(plan.height >= mobile.top + 3000);
});
