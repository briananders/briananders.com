import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);

// Register a no-op handler for .scss requires so the component modules
// (album-listing.js, artist-listing.js) can be loaded without a bundler.
const Module = require('module');
Module._extensions['.scss'] = (mod) => { mod.exports = ''; };

// Single shared JSDOM instance — each component class extends global.HTMLElement
// at module-load time, so the prototype chain must stay bound to one registry.
const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'http://localhost/' });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.customElements = dom.window.customElements;
global.Event = dom.window.Event;

// year-listing uses requestAnimationFrame for its count animation.
// Store pending callbacks in a queue so tests can flush them manually.
let rafQueue = [];
global.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };

function flushRaf() {
  const pending = [...rafQueue];
  rafQueue = [];
  pending.forEach((cb) => cb());
}

const AlbumListing = require('../src/js/_components/album-listing.js');
const ArtistListing = require('../src/js/_components/artist-listing.js');
const YearListing = require('../src/js/_components/year-listing.js');

// ── AlbumListing ──────────────────────────────────────────────────────────────

describe('AlbumListing', () => {
  before(() => {
    AlbumListing.init();
  });

  beforeEach(() => {
    dom.window.document.body.innerHTML = '';
    rafQueue = [];
  });

  function makeAlbum(attrs = {}) {
    const el = dom.window.document.createElement('album-listing');
    dom.window.document.body.appendChild(el);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  test('init() registers album-listing in the custom element registry', () => {
    assert.ok(
      dom.window.customElements.get('album-listing'),
      'album-listing should be defined',
    );
  });

  // ── name attribute ──────────────────────────────────────────────────────────

  test('setting name updates the slot text', () => {
    const el = makeAlbum({ name: 'Abbey Road' });
    assert.equal(
      el.shadowRoot.querySelector('slot').innerText,
      'Abbey Road',
      'slot should display the album name',
    );
  });

  test('setting name updates the img alt to "<name> album cover"', () => {
    const el = makeAlbum({ name: 'Abbey Road' });
    assert.equal(
      el.shadowRoot.querySelector('img').getAttribute('alt'),
      'Abbey Road album cover',
      'img alt should include the album name',
    );
  });

  // ── artist attribute ────────────────────────────────────────────────────────

  test('setting artist updates [slot="artist"] text', () => {
    const el = makeAlbum({ artist: 'The Beatles' });
    assert.equal(
      el.shadowRoot.querySelector('[slot="artist"]').innerText,
      'The Beatles',
      'artist slot should display the artist name',
    );
  });

  // ── href ────────────────────────────────────────────────────────────────────

  test('setting name and artist produces a dasherized, lowercased href', () => {
    const el = makeAlbum({ name: 'Abbey Road', artist: 'The Beatles' });
    assert.equal(
      el.shadowRoot.querySelector('a').getAttribute('href'),
      '?trends=albums/the-beatles/abbey-road',
      'href should use dasherized lowercase artist and album names',
    );
  });

  test('href handles multi-word names with mixed case and spaces', () => {
    const el = makeAlbum({ name: 'Dark Side of the Moon', artist: 'Pink Floyd' });
    assert.equal(
      el.shadowRoot.querySelector('a').getAttribute('href'),
      '?trends=albums/pink-floyd/dark-side-of-the-moon',
      'href should dasherize multi-word names correctly',
    );
  });

  test('href updates when artist is set after name', () => {
    const el = makeAlbum({ name: 'Kind of Blue' });
    el.setAttribute('artist', 'Miles Davis');
    assert.equal(
      el.shadowRoot.querySelector('a').getAttribute('href'),
      '?trends=albums/miles-davis/kind-of-blue',
      'href should update when artist attribute changes',
    );
  });

  test('href uses empty string for artist when artist attribute is absent', () => {
    const el = makeAlbum({ name: 'Unknown Pleasures' });
    const href = el.shadowRoot.querySelector('a').getAttribute('href');
    assert.ok(
      href.includes('unknown-pleasures'),
      'href should include dasherized album name even without artist',
    );
  });

  // ── count attribute ─────────────────────────────────────────────────────────

  test('setting count updates [slot="count"] with a formatted number', () => {
    const el = makeAlbum({ count: '1234' });
    assert.equal(
      el.shadowRoot.querySelector('[slot="count"]').innerText,
      Number(1234).toLocaleString(),
      'count slot should display the locale-formatted play count',
    );
  });

  test('count of 42 displays without thousands separator', () => {
    const el = makeAlbum({ count: '42' });
    assert.equal(
      el.shadowRoot.querySelector('[slot="count"]').innerText,
      '42',
      'small count should display without formatting overhead',
    );
  });

  // ── bar width ───────────────────────────────────────────────────────────────

  test('bar width is count/max * 100%', () => {
    const el = makeAlbum({ count: '2500', max: '5000' });
    assert.equal(
      el.shadowRoot.getElementById('bar').style.width,
      '50%',
      'bar should be 50% wide when count is half of max',
    );
  });

  test('bar width is 100% when count equals max', () => {
    const el = makeAlbum({ count: '1000', max: '1000' });
    assert.equal(
      el.shadowRoot.getElementById('bar').style.width,
      '100%',
      'bar should be 100% wide when count equals max',
    );
  });

  test('updating max alone recalculates bar width', () => {
    const el = makeAlbum({ count: '500', max: '1000' });
    assert.equal(el.shadowRoot.getElementById('bar').style.width, '50%');
    el.setAttribute('max', '2000');
    assert.equal(
      el.shadowRoot.getElementById('bar').style.width,
      '25%',
      'bar width should recalculate when max changes',
    );
  });

  test('updating count alone recalculates bar width', () => {
    const el = makeAlbum({ count: '500', max: '1000' });
    el.setAttribute('count', '750');
    assert.equal(
      el.shadowRoot.getElementById('bar').style.width,
      '75%',
      'bar width should recalculate when count changes',
    );
  });

  // ── img attribute ───────────────────────────────────────────────────────────

  test('setting img updates the img src', () => {
    const el = makeAlbum({ img: '/images/abbey-road.jpg' });
    assert.equal(
      el.shadowRoot.querySelector('img').getAttribute('src'),
      '/images/abbey-road.jpg',
      'img src should match the img attribute value',
    );
  });
});

// ── ArtistListing ─────────────────────────────────────────────────────────────

describe('ArtistListing', () => {
  before(() => {
    ArtistListing.init();
  });

  beforeEach(() => {
    dom.window.document.body.innerHTML = '';
    rafQueue = [];
  });

  function makeArtist(attrs = {}) {
    const el = dom.window.document.createElement('artist-listing');
    dom.window.document.body.appendChild(el);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  test('init() registers artist-listing in the custom element registry', () => {
    assert.ok(
      dom.window.customElements.get('artist-listing'),
      'artist-listing should be defined',
    );
  });

  // ── name attribute ──────────────────────────────────────────────────────────

  test('setting name updates the img alt to the artist name', () => {
    const el = makeArtist({ name: 'The Beatles' });
    assert.equal(
      el.shadowRoot.querySelector('img').getAttribute('alt'),
      'The Beatles',
      'img alt should match the artist name',
    );
  });

  test('setting name produces a dasherized, lowercased href', () => {
    const el = makeArtist({ name: 'The Beatles' });
    assert.equal(
      el.shadowRoot.querySelector('a').getAttribute('href'),
      '?trends=artists/the-beatles',
      'href should use dasherized lowercase artist name',
    );
  });

  test('href handles multi-word names with mixed case and spaces', () => {
    const el = makeArtist({ name: 'Led Zeppelin' });
    assert.equal(
      el.shadowRoot.querySelector('a').getAttribute('href'),
      '?trends=artists/led-zeppelin',
      'href should dasherize multi-word names correctly',
    );
  });

  test('href updates when name attribute changes', () => {
    const el = makeArtist({ name: 'The Beatles' });
    el.setAttribute('name', 'Pink Floyd');
    assert.equal(
      el.shadowRoot.querySelector('a').getAttribute('href'),
      '?trends=artists/pink-floyd',
      'href should update when name attribute changes',
    );
  });

  // ── count attribute ─────────────────────────────────────────────────────────

  test('setting count updates [slot="count"] with a formatted number', () => {
    const el = makeArtist({ count: '1500' });
    assert.equal(
      el.shadowRoot.querySelector('[slot="count"]').innerText,
      Number(1500).toLocaleString(),
      'count slot should display the locale-formatted play count',
    );
  });

  test('count of 7 displays without thousands separator', () => {
    const el = makeArtist({ count: '7' });
    assert.equal(
      el.shadowRoot.querySelector('[slot="count"]').innerText,
      '7',
      'small count should not have a thousands separator',
    );
  });

  // ── bar width ───────────────────────────────────────────────────────────────

  test('bar width is count/max * 100%', () => {
    const el = makeArtist({ count: '1500', max: '3000' });
    assert.equal(
      el.shadowRoot.getElementById('bar').style.width,
      '50%',
      'bar should be 50% wide when count is half of max',
    );
  });

  test('bar width is 100% when count equals max', () => {
    const el = makeArtist({ count: '500', max: '500' });
    assert.equal(
      el.shadowRoot.getElementById('bar').style.width,
      '100%',
      'bar should be 100% wide when count equals max',
    );
  });

  test('updating max alone recalculates bar width', () => {
    const el = makeArtist({ count: '1000', max: '2000' });
    assert.equal(el.shadowRoot.getElementById('bar').style.width, '50%');
    el.setAttribute('max', '4000');
    assert.equal(
      el.shadowRoot.getElementById('bar').style.width,
      '25%',
      'bar width should recalculate when max changes',
    );
  });

  test('updating count alone recalculates bar width', () => {
    const el = makeArtist({ count: '1000', max: '2000' });
    el.setAttribute('count', '500');
    assert.equal(
      el.shadowRoot.getElementById('bar').style.width,
      '25%',
      'bar width should recalculate when count changes',
    );
  });

  // ── img attribute ───────────────────────────────────────────────────────────

  test('setting img updates the img src', () => {
    const el = makeArtist({ img: '/images/beatles.jpg' });
    assert.equal(
      el.shadowRoot.querySelector('img').getAttribute('src'),
      '/images/beatles.jpg',
      'img src should match the img attribute value',
    );
  });
});

// ── YearListing ───────────────────────────────────────────────────────────────

describe('YearListing', () => {
  before(() => {
    YearListing.init();
  });

  beforeEach(() => {
    dom.window.document.body.innerHTML = '';
    rafQueue = [];
  });

  // Append to DOM before setting attributes so connectedCallback fires first.
  function makeYear(attrs = {}) {
    const el = dom.window.document.createElement('year-listing');
    dom.window.document.body.appendChild(el);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  test('init() registers year-listing in the custom element registry', () => {
    assert.ok(
      dom.window.customElements.get('year-listing'),
      'year-listing should be defined',
    );
  });

  // ── year attribute ──────────────────────────────────────────────────────────

  test('setting year updates [slot="year"] text', () => {
    const el = makeYear({ year: '2022' });
    assert.equal(
      el.shadowRoot.querySelector('[slot="year"]').innerText,
      '2022',
      'year slot should display the year value',
    );
  });

  test('setting year updates the href to the correct Last.fm URL', () => {
    const el = makeYear({ year: '2022' });
    assert.equal(
      el.shadowRoot.querySelector('a').getAttribute('href'),
      'https://www.last.fm/user/imbanders/library/artists?from=2022-01-01&rangetype=year',
      'href should link to the Last.fm year page',
    );
  });

  test('href uses the correct year when year attribute changes', () => {
    const el = makeYear({ year: '2019' });
    el.setAttribute('year', '2023');
    assert.equal(
      el.shadowRoot.querySelector('a').getAttribute('href'),
      'https://www.last.fm/user/imbanders/library/artists?from=2023-01-01&rangetype=year',
      'href should update when year changes',
    );
  });

  // ── aria-label ──────────────────────────────────────────────────────────────

  test('setting year updates the aria-label with year info', () => {
    const el = makeYear({ year: '2022', value: '5000' });
    assert.equal(
      el.shadowRoot.querySelector('a').getAttribute('aria-label'),
      '5000 plays in the year 2022',
      'aria-label should describe plays and year',
    );
  });

  test('setting value updates the aria-label with the new count', () => {
    const el = makeYear({ year: '2022', value: '3000' });
    el.setAttribute('value', '4500');
    assert.equal(
      el.shadowRoot.querySelector('a').getAttribute('aria-label'),
      '4500 plays in the year 2022',
      'aria-label should update when value changes',
    );
  });

  // ── animateToValue ──────────────────────────────────────────────────────────

  test('animateToValue shows the final formatted value when animation completes', (t) => {
    t.mock.timers.enable(['Date']);
    const el = makeYear();

    el.animateToValue(5000);

    t.mock.timers.tick(2001); // advance past the 2000 ms animation duration
    flushRaf();               // run the final requestAnimationFrame callback

    assert.equal(
      el.shadowRoot.querySelector('slot').innerHTML,
      '5,000',
      'slot should show the final formatted count after animation ends',
    );
  });

  test('animateToValue formats values with thousands separator (year-listing format)', (t) => {
    t.mock.timers.enable(['Date']);
    const el = makeYear();

    el.animateToValue(12345);

    t.mock.timers.tick(2001);
    flushRaf();

    assert.equal(
      el.shadowRoot.querySelector('slot').innerHTML,
      '12,345',
      'animateToValue should format four-digit thousands correctly',
    );
  });

  test('animateToValue displays an intermediate value mid-animation', (t) => {
    t.mock.timers.enable(['Date']);
    const el = makeYear();

    el.animateToValue(10000);

    // At exactly the midpoint (1000 ms into a 2000 ms animation) the running
    // value should be 5000 (half of 10000 starting from 0).
    t.mock.timers.tick(1000);
    flushRaf(); // run the pending RAF — the animation is still in progress

    const slotText = el.shadowRoot.querySelector('slot').innerHTML;
    // The slot should show a value between 0 and 10000 (exclusive) mid-way.
    const displayed = Number(slotText.replace(',', ''));
    assert.ok(
      displayed > 0 && displayed < 10000,
      `mid-animation slot (${slotText}) should be between 0 and 10,000`,
    );
  });

  test('a second animateToValue call always starts from the initial value (0)', (t) => {
    t.mock.timers.enable(['Date']);
    const el = makeYear();

    // First animation: 0 → 5000
    el.animateToValue(5000);
    t.mock.timers.tick(2001);
    flushRaf();

    // Second animation: should start from 0 again (this.value is never updated)
    // and animate to 3000.
    el.animateToValue(3000);
    t.mock.timers.tick(2001);
    flushRaf();

    assert.equal(
      el.shadowRoot.querySelector('slot').innerHTML,
      '3,000',
      'second animation should end at its target value',
    );
  });

  // ── bar width via updateWidth ────────────────────────────────────────────────

  test('bar width is value/maximum * 100% after the 1 ms setTimeout fires', (t) => {
    t.mock.timers.enable(['setTimeout']);
    // Set attributes before appending so connectedCallback reads them.
    const el = dom.window.document.createElement('year-listing');
    el.setAttribute('value', '5000');
    el.setAttribute('maximum', '10000');
    dom.window.document.body.appendChild(el); // fires connectedCallback → updateWidth → setTimeout

    t.mock.timers.tick(2);

    assert.equal(
      el.shadowRoot.querySelector('.bar').style.getPropertyValue('--bar-width'),
      '50%',
      '--bar-width CSS property should be 50% when value is half of maximum',
    );
  });

  test('bar width is 25% when value is a quarter of maximum', (t) => {
    t.mock.timers.enable(['setTimeout']);
    const el = dom.window.document.createElement('year-listing');
    el.setAttribute('value', '2500');
    el.setAttribute('maximum', '10000');
    dom.window.document.body.appendChild(el);

    t.mock.timers.tick(2);

    assert.equal(
      el.shadowRoot.querySelector('.bar').style.getPropertyValue('--bar-width'),
      '25%',
      '--bar-width should be 25% when value is a quarter of maximum',
    );
  });

  test('bar width is 100% when value equals maximum', (t) => {
    t.mock.timers.enable(['setTimeout']);
    const el = dom.window.document.createElement('year-listing');
    el.setAttribute('value', '8000');
    el.setAttribute('maximum', '8000');
    dom.window.document.body.appendChild(el);

    t.mock.timers.tick(2);

    assert.equal(
      el.shadowRoot.querySelector('.bar').style.getPropertyValue('--bar-width'),
      '100%',
      '--bar-width should be 100% when value equals maximum',
    );
  });

  // ── connectedCallback / updateWidth ─────────────────────────────────────────

  test('connectedCallback triggers updateWidth (via in-view fallback when no IntersectionObserver)', (t) => {
    // JSDOM has no IntersectionObserver, so in-view.js falls back to calling
    // the callback immediately, which fires updateWidth.
    t.mock.timers.enable(['setTimeout']);
    const el = dom.window.document.createElement('year-listing');
    el.setAttribute('value', '1000');
    el.setAttribute('maximum', '4000');
    dom.window.document.body.appendChild(el);

    t.mock.timers.tick(2);

    assert.equal(
      el.shadowRoot.querySelector('.bar').style.getPropertyValue('--bar-width'),
      '25%',
      'bar width should be set via the updateWidth triggered by connectedCallback',
    );
  });
});
