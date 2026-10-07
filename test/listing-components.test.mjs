import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);

// Register a no-op handler for .scss requires so the component module
// (album-listing.js) can be loaded without a bundler.
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

const AlbumListing = require('../src/js/_components/album-listing.js');

// ── AlbumListing ──────────────────────────────────────────────────────────────

describe('AlbumListing', () => {
  before(() => {
    AlbumListing.init();
  });

  beforeEach(() => {
    dom.window.document.body.innerHTML = '';
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
