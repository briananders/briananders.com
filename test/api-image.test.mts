import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'http://localhost/' });

Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  customElements: dom.window.customElements,
});

const apiImage = require('../src/ts/_components/api-image.ts');

describe('ApiImage', () => {
  before(() => {
    apiImage.init();
  });

  beforeEach(() => {
    dom.window.document.body.innerHTML = '';
  });

  /**
   * Creates and appends an `api-image` custom element with the given attributes.
   */
  function makeImage(attrs: Record<string, string> = {}): HTMLElement {
    const el = dom.window.document.createElement('api-image');
    dom.window.document.body.appendChild(el);
    Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, value));
    return el;
  }

  /**
   * Queries a required child element and asserts its existence.
   */
  function queryRequired(parent: ParentNode, selector: string): Element {
    const found = parent.querySelector(selector);
    assert.ok(found, `Expected element matching ${selector}`);
    return found;
  }

  test('registers api-image in the custom element registry', () => {
    assert.ok(dom.window.customElements.get('api-image'));
  });

  test('defaults rendered images to native lazy loading', () => {
    const el = makeImage({ src: '/images/poster' });
    const img = queryRequired(el, 'img');

    assert.equal(img.getAttribute('loading'), 'lazy');
    assert.equal(img.getAttribute('decoding'), 'async');
  });

  test('adds AVIF, WebP, and JPG extensions to a basename', () => {
    const el = makeImage({ src: '/movies/images/tt123' });

    assert.equal(
      queryRequired(el, '[data-format="avif"]').getAttribute('srcset'),
      '/movies/images/tt123.avif',
    );
    assert.equal(
      queryRequired(el, '[data-format="webp"]').getAttribute('srcset'),
      '/movies/images/tt123.webp',
    );
    assert.equal(queryRequired(el, 'img').getAttribute('src'), '/movies/images/tt123.jpg');
  });

  test('does not duplicate an existing image extension', () => {
    const el = makeImage({ src: '/images/album.jpg' });

    assert.equal(queryRequired(el, 'img').getAttribute('src'), '/images/album.jpg');
    assert.equal(
      queryRequired(el, '[data-format="avif"]').getAttribute('srcset'),
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
    const img = queryRequired(el, 'img');

    assert.equal(img.getAttribute('alt'), 'Movie poster');
    assert.equal(img.getAttribute('loading'), 'lazy');
    assert.equal(img.getAttribute('width'), '240');
    assert.equal(img.getAttribute('height'), '356');
  });

  test('clears generated URLs when src is removed', () => {
    const el = makeImage({ src: '/images/poster' });
    el.removeAttribute('src');

    assert.equal(queryRequired(el, 'img').getAttribute('src'), null);
    assert.equal(queryRequired(el, '[data-format="avif"]').getAttribute('srcset'), null);
    assert.equal(queryRequired(el, '[data-format="webp"]').getAttribute('srcset'), null);
  });
});
