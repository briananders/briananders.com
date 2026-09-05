import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);

describe('grid-debug overlay', () => {
  /**
   * Helper to set up a clean JSDOM instance and require a fresh grid-debug instance.
   *
   * @param {string} url - The URL string to initialize JSDOM with.
   * @returns {object} The required grid-debug module.
   */
  function setupTestEnvironment(url = 'http://localhost/') {
    const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', { url });
    global.window = dom.window;
    global.document = dom.window.document;
    global.KeyboardEvent = dom.window.KeyboardEvent;
    global.URLSearchParams = dom.window.URLSearchParams;

    // Clear module cache so grid-debug module state is reset
    const resolvedPath = require.resolve('../src/js/_modules/grid-debug.js');
    delete require.cache[resolvedPath];

    return require('../src/js/_modules/grid-debug.js');
  }

  test('activates overlay automatically when grid query param is present', () => {
    const gridDebug = setupTestEnvironment('http://localhost/?grid');
    gridDebug.init();

    const overlay = document.getElementById('grid-debug-overlay');
    assert.ok(overlay, 'overlay element should exist in DOM');
    assert.equal(overlay.dataset.active, 'true');
  });

  test('does not activate overlay when grid query param is false', () => {
    const gridDebug = setupTestEnvironment('http://localhost/?grid=false');
    gridDebug.init();

    const overlay = document.getElementById('grid-debug-overlay');
    assert.equal(overlay, null, 'overlay should not be created if grid=false');
  });

  test('toggles overlay when Ctrl+G is pressed', () => {
    const gridDebug = setupTestEnvironment('http://localhost/');
    gridDebug.init();

    window.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      ctrlKey: true,
      code: 'KeyG',
      key: 'g',
    }));

    const overlay = document.getElementById('grid-debug-overlay');
    assert.ok(overlay, 'overlay should be created after Ctrl+G');
    assert.equal(overlay.dataset.active, 'true');

    // Toggle again to hide
    window.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      ctrlKey: true,
      code: 'KeyG',
      key: 'g',
    }));
    assert.equal(overlay.dataset.active, 'false');
  });

  test('toggles overlay when Cmd+G (metaKey) is pressed', () => {
    const gridDebug = setupTestEnvironment('http://localhost/');
    gridDebug.init();

    window.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      metaKey: true,
      code: 'KeyG',
      key: 'g',
    }));

    const overlay = document.getElementById('grid-debug-overlay');
    assert.ok(overlay);
    assert.equal(overlay.dataset.active, 'true');
  });

  test('toggles overlay when bare "g" key is pressed outside editable fields', () => {
    const gridDebug = setupTestEnvironment('http://localhost/');
    gridDebug.init();

    window.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      code: 'KeyG',
      key: 'g',
    }));

    const overlay = document.getElementById('grid-debug-overlay');
    assert.ok(overlay);
    assert.equal(overlay.dataset.active, 'true');
  });

  test('does not toggle overlay when typing "g" in an input field', () => {
    const gridDebug = setupTestEnvironment('http://localhost/');
    gridDebug.init();

    const input = document.createElement('input');
    document.body.appendChild(input);

    input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      code: 'KeyG',
      key: 'g',
    }));

    const overlay = document.getElementById('grid-debug-overlay');
    assert.equal(overlay, null, 'overlay should not trigger when typing in input');
  });
});
