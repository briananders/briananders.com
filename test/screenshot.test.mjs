import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const {
  parseArgs, slugify, planSheet, packWidths, sheetName, findEdgeOverflow,
} = require('../bin/screenshot.js');

test('parseArgs defaults to the home page at the five Directive 6 widths, dark scheme', () => {
  assert.deepEqual(parseArgs([]), {
    paths: ['/'],
    dir: 'package',
    out: 'screenshots',
    widths: [360, 600, 800, 1024, 1440],
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

test('packWidths keeps sheets narrow enough to read once scaled down', () => {
  assert.deepEqual(packWidths([360, 600, 800, 1024, 1440]), [[360, 600, 800], [1024, 1440]]);
  assert.deepEqual(packWidths([375, 768, 1280]), [[375, 768, 1280]]);
  assert.deepEqual(packWidths([3000, 360]), [[3000], [360]], 'an over-wide capture gets its own sheet');
  assert.deepEqual(packWidths([]), []);
});

test('sheetName records the scheme and width range', () => {
  assert.equal(sheetName('dark', [360, 600, 800]), 'sheet-dark-360-800.png');
  assert.equal(sheetName('light', [1440]), 'sheet-light-1440.png');
});

describe('findEdgeOverflow', () => {
  // jsdom has no layout engine, so each element's box is stubbed from data-box="left,width".
  function layOut(html, viewportWidth = 360) {
    const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`);
    Object.defineProperty(dom.window, 'innerWidth', { value: viewportWidth });
    dom.window.document.querySelectorAll('[data-box]').forEach((el) => {
      const [left, width] = el.dataset.box.split(',').map(Number);
      el.getBoundingClientRect = () => ({
        left, right: left + width, width, height: 10,
      });
    });
    return dom.window;
  }

  test('reports content cut off at either viewport edge, worst first', () => {
    const win = layOut(`
      <div id="board" class="board game" data-box="0,384"></div>
      <div class="bleed" data-box="-12,100"></div>
      <div class="fits" data-box="0,360"></div>`);
    assert.deepEqual(findEdgeOverflow(win), [
      { selector: 'div#board.board.game', overflow: 24 },
      { selector: 'div.bleed', overflow: 12 },
    ]);
  });

  test('reports only the outermost escaping element', () => {
    const win = layOut('<div class="outer" data-box="0,400"><span data-box="10,390"></span></div>');
    assert.deepEqual(findEdgeOverflow(win), [{ selector: 'div.outer', overflow: 40 }]);
  });

  test('ignores content an in-page ancestor clips or scrolls', () => {
    // Longhands only: jsdom doesn't expand the `overflow` shorthand the way browsers do.
    const win = layOut(`
      <pre style="overflow-x: auto" data-box="0,360"><code data-box="0,900"></code></pre>
      <div style="overflow-x: hidden" data-box="0,360"><img data-box="0,500"></div>
      <div style="overflow-x: clip" data-box="0,360"><img data-box="0,500"></div>`);
    assert.deepEqual(findEdgeOverflow(win), []);
  });

  test('ignores hidden, empty and fully off-screen elements', () => {
    const win = layOut(`
      <nav class="drawer" data-box="360,300"></nav>
      <div style="display: none" data-box="0,500"></div>
      <div style="visibility: hidden" data-box="0,500"></div>
      <div data-box="0,0"></div>`);
    assert.deepEqual(findEdgeOverflow(win), []);
  });
});
