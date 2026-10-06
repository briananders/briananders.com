import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const buildDate = require('../build/helpers/build-date');
const buildRandom = require('../build/helpers/build-random');
const goldenBuild = require('../build/constants/golden-build');

const PINNED_VARS = ['BUILD_DATETIME', 'BUILD_RANDOM_SEED'];
const original = Object.fromEntries(PINNED_VARS.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of PINNED_VARS) {
    if (original[name] === undefined) delete process.env[name];
    else process.env[name] = original[name];
  }
});

test('buildDate returns the current time when BUILD_DATETIME is unset', () => {
  delete process.env.BUILD_DATETIME;
  const before = Date.now();
  const result = buildDate().getTime();
  assert.ok(result >= before && result <= Date.now());
});

test('buildDate returns BUILD_DATETIME when set', () => {
  process.env.BUILD_DATETIME = '2020-02-29T12:34:56.000Z';
  assert.equal(buildDate().toISOString(), '2020-02-29T12:34:56.000Z');
});

test('buildDate throws on an unparseable BUILD_DATETIME', () => {
  process.env.BUILD_DATETIME = 'not-a-date';
  assert.throws(() => buildDate(), RangeError);
});

test('golden datetime is noon UTC so local date math is stable across timezones', () => {
  const date = new Date(goldenBuild.BUILD_DATETIME);
  assert.equal(date.getUTCHours(), 12);
  assert.equal(date.getUTCMinutes(), 0);
});

test('buildRandom returns Math.random when BUILD_RANDOM_SEED is unset', () => {
  delete process.env.BUILD_RANDOM_SEED;
  assert.equal(buildRandom(), Math.random);
});

test('buildRandom with a seed repeats the same sequence on every call', () => {
  process.env.BUILD_RANDOM_SEED = goldenBuild.BUILD_RANDOM_SEED;
  const first = buildRandom();
  const second = buildRandom();
  const a = Array.from({ length: 5 }, () => first());
  const b = Array.from({ length: 5 }, () => second());
  assert.deepEqual(a, b);
  assert.ok(a.every((n) => n >= 0 && n < 1));
  assert.equal(new Set(a).size, a.length, 'sequence should not repeat a value in 5 draws');
});

test('buildRandom throws on a non-integer BUILD_RANDOM_SEED', () => {
  process.env.BUILD_RANDOM_SEED = 'abc';
  assert.throws(() => buildRandom(), RangeError);
});

test('no template calls Math.random at build time', async () => {
  const { globSync } = require('glob');
  const fs = require('fs');
  const offenders = globSync('src/{templates,partials,layout}/**/*.ejs')
    .filter((file) => {
      // Only scriptlet code (<% ... %>) runs at build time; <script> bodies run in the browser.
      const scriptlets = fs.readFileSync(file, 'utf8').match(/<%[\s\S]*?%>/g) || [];
      return scriptlets.some((code) => code.includes('Math.random'));
    });
  assert.deepEqual(offenders, [], 'use buildRandom() so golden builds stay reproducible');
});

test('formattedDate returns the front-matter calendar date in any timezone', () => {
  const ejsFunctions = require('../build/helpers/ejs-functions')({}, []);
  const originalTZ = process.env.TZ;
  try {
    // gray-matter parses `date: 2024-08-21` as UTC midnight.
    const frontMatterDate = new Date('2024-08-21');
    for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
      process.env.TZ = tz;
      assert.equal(ejsFunctions.formattedDate(frontMatterDate), '2024-08-21', tz);
    }
  } finally {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  }
});
