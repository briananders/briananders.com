import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const TrendsBarChart = require('../src/js/_modules/trends-bar-chart');

test('year charts stay within the selected year and fill missing months', () => {
  const months = TrendsBarChart.prototype.adaptData([
    { month: '2023-03', count: 12 },
    { month: '2024-01', count: 99 },
  ], 2023);
  assert.equal(months.length, 12);
  assert.ok(months.every(month => month.year === 2023));
  assert.equal(months[0].value, 0);
  assert.equal(months[2].value, 12);
  const currentYear = new Date().getFullYear();
  assert.equal(TrendsBarChart.prototype.adaptData([], currentYear).length, new Date().getMonth() + 1);
  assert.equal(TrendsBarChart.prototype.adaptData([{ month: '2023-01', count: 1 }]).at(-1).year, currentYear);
});

test('clicking a year loads its monthly trends in the existing modal and Escape closes it', () => {
  const dom = new JSDOM('<body><div id="yearly-scrobbles"></div></body>', {
    url: 'https://example.com/posts/last-fm-scrobbles/',
    runScripts: 'outside-only',
  });
  const context = dom.getInternalVMContext();
  const requests = [];
  let ready;
  const load = (path, imports) => {
    context.module = { exports: {} };
    context.require = name => imports[name];
    vm.runInContext(`(function(require, module) {
${readFileSync(new URL(path, import.meta.url), 'utf8')}
})(require, module);`, context);
    return context.module.exports;
  };
  context.requestAnimationFrame = () => {};
  const listing = load('../src/js/_components/year-listing.js', { '../_modules/in-view': () => {} });
  const chart = load('../src/js/_modules/trends-bar-chart.js', {});
  context.XMLHttpRequest = class {
    open(method, url) { this.url = url; }
    setRequestHeader() {}
    send() {
      requests.push(this.url);
      if (!this.url.includes('trends/')) return;
      this.status = 200;
      this.response = JSON.stringify({ year: 2023, months: [{ month: '2023-03', count: 12 }], totalScrobbles: 12 });
      this.onload();
    }
  };
  load('../src/js/posts/last-fm-scrobbles.js', {
    '../_modules/document-ready': { document: callback => { ready = callback; } },
    '../_modules/trends-bar-chart': chart,
    '../_components/year-listing': listing,
    '../_components/album-listing': { init() {} },
    '../_components/artist-listing': { init() {} },
    '../_components/last-updated': { init() {} },
  });
  ready();
  const el = dom.window.document.createElement('year-listing');
  el.setAttribute('year', '2023');
  dom.window.document.body.appendChild(el);
  const anchor = el.shadowRoot.querySelector('a');
  assert.equal(anchor.getAttribute('href'), '?trends=years/2023');
  assert.equal(anchor.hasAttribute('target'), false);
  anchor.click();
  assert.ok(requests.includes('/last-fm-history/trends/years/2023.json'));
  assert.equal(dom.window.document.querySelector('h2').innerText, 'History: 2023');
  assert.equal(dom.window.document.querySelectorAll('.tc-col').length, 12);
  assert.equal(dom.window.document.querySelector('.total-scrobbles').innerText, '12');
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(dom.window.document.querySelector('h2'), null);
  assert.equal(dom.window.location.search, '');
  dom.window.close();
});
