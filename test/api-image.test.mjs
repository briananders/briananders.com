import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'http://localhost/' });

global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.customElements = dom.window.customElements;

const apiImage = require('../src/js/_components/api-image.js');

describe('ApiImage', () => {
  before(() => {
    apiImage.init();
  });

  beforeEach(() => {
    dom.window.document.body.innerHTML = '';
  });

  function makeImage(attrs = {}) {
    const el = dom.window.document.createElement('api-image');
    dom.window.document.body.appendChild(el);
    Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, value));
    return el;
  }

  test('registers api-image in the custom element registry', () => {
    assert.ok(dom.window.customElements.get('api-image'));
  });

  test('defaults rendered images to native lazy loading', () => {
    const el = makeImage({ src: '/images/poster' });
    const img = el.querySelector('img');

    assert.equal(img.getAttribute('loading'), 'lazy');
    assert.equal(img.getAttribute('decoding'), 'async');
  });

  test('adds AVIF, WebP, and JPG extensions to a basename', () => {
    const el = makeImage({ src: '/movies/images/tt123' });

    assert.equal(
      el.querySelector('[data-format="avif"]').getAttribute('srcset'),
      '/movies/images/tt123.avif',
    );
    assert.equal(
      el.querySelector('[data-format="webp"]').getAttribute('srcset'),
      '/movies/images/tt123.webp',
    );
    assert.equal(el.querySelector('img').getAttribute('src'), '/movies/images/tt123.jpg');
  });

  test('does not duplicate an existing image extension', () => {
    const el = makeImage({ src: '/images/album.jpg' });

    assert.equal(el.querySelector('img').getAttribute('src'), '/images/album.jpg');
    assert.equal(
      el.querySelector('[data-format="avif"]').getAttribute('srcset'),
      '/images/album.avif',
    );
  });

  test('forwards image attributes to the img element', () => {
    const el = makeImage({
      src: '/images/poster',
      alt: 'Movie poster',
      loading: 'lazy',
      width: '240',
      height: '356',
    });
    const img = el.querySelector('img');

    assert.equal(img.getAttribute('alt'), 'Movie poster');
    assert.equal(img.getAttribute('loading'), 'lazy');
    assert.equal(img.getAttribute('width'), '240');
    assert.equal(img.getAttribute('height'), '356');
  });

  test('clears generated URLs when src is removed', () => {
    const el = makeImage({ src: '/images/poster' });
    el.removeAttribute('src');

    assert.equal(el.querySelector('img').getAttribute('src'), null);
    assert.equal(el.querySelector('[data-format="avif"]').getAttribute('srcset'), null);
    assert.equal(el.querySelector('[data-format="webp"]').getAttribute('srcset'), null);
  });
});
