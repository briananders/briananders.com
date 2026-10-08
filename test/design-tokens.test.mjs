import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { globSync } = require('glob');
const baseline = require('./design-tokens-baseline.json');

/**
 * Ratchet on hard-coded values outside the design system.
 *
 * Every SCSS file outside `system/` (the tokens' home) and `vendor/` (third
 * party) may hold at most its baseline count of color literals and raw px
 * values. New code uses tokens, mixins, and classes (DESIGN_SYSTEM.md §5–7).
 * Counts may only go down: when you remove one, lower the baseline to match.
 * Never raise a baseline.
 */

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(\s*[\d.]/g;
const RAW_PX = /(?<![\w$#-])-?\d*\.?\d+px\b/g;

function stripComments(scss) {
  return scss
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function countLiterals(scss) {
  const code = stripComments(scss);
  return {
    colors: (code.match(COLOR_LITERAL) || []).length,
    px: (code.match(RAW_PX) || []).length,
  };
}

const files = globSync('src/styles/**/*.scss', {
  ignore: ['src/styles/system/**', 'src/styles/vendor/**'],
}).sort();

test('countLiterals finds colors and px, ignoring comments, tokens, and interpolation', () => {
  const sample = `
    // #fff in a line comment
    /* rgba(0, 0, 0, .5) and 12px in a block comment */
    .a { color: #1a2b3c; background: rgba(0, 0, 0, .5); border: 1px solid var(--line); }
    .b { margin: -12px; padding: space(2); width: calc(100% - 20px); }
    .c { color: rgba(var(--rgb), .5); background: url(http://example.com/a.png); }
    .d { width: #{$cols}px; }
  `;
  assert.deepEqual(countLiterals(sample), { colors: 2, px: 3 });
});

test('no SCSS file exceeds its baseline of hard-coded colors or px', () => {
  const regressions = [];
  for (const file of files) {
    const actual = countLiterals(readFileSync(file, 'utf8'));
    const allowed = baseline[file] || { colors: 0, px: 0 };
    for (const kind of ['colors', 'px']) {
      if (actual[kind] > allowed[kind]) {
        regressions.push(`${file}: ${actual[kind]} ${kind} (baseline ${allowed[kind]})`);
      }
    }
  }
  assert.deepEqual(regressions, [], 'Use design-system tokens instead of hard-coded values. See DESIGN_SYSTEM.md.');
});

test('baseline is tight: lower it when hard-coded values are removed', () => {
  const stale = [];
  for (const [file, allowed] of Object.entries(baseline)) {
    if (!files.includes(file)) {
      stale.push(`${file}: file no longer exists; delete its baseline entry`);
      continue;
    }
    const actual = countLiterals(readFileSync(file, 'utf8'));
    for (const kind of ['colors', 'px']) {
      if (actual[kind] < allowed[kind]) {
        stale.push(`${file}: lower ${kind} baseline from ${allowed[kind]} to ${actual[kind]}`);
      }
    }
  }
  assert.deepEqual(stale, []);
});
