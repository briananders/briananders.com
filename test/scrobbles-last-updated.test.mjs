import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);

// SCSS no-op shim — must come before the component require.
const Module = require('module');
Module._extensions['.scss'] = (mod) => { mod.exports = ''; };

// Single shared JSDOM instance — class extends global.HTMLElement at load time.
const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'http://localhost/' });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.customElements = dom.window.customElements;
global.Event = dom.window.Event;

// Controllable fetch mock — tests set mockFetch before triggering connectedCallback.
let mockFetch = null;
global.fetch = async (...args) => {
  if (!mockFetch) throw new Error('fetch: simulated network error');
  return mockFetch(...args);
};

const ScrobblesLastUpdated = require('../src/js/_components/scrobbles-last-updated.js');

// ── ScrobblesLastUpdated ───────────────────────────────────────────────────────

describe('ScrobblesLastUpdated', () => {
  before(() => {
    ScrobblesLastUpdated.init();
  });

  beforeEach(() => {
    dom.window.document.body.innerHTML = '';
    mockFetch = null;
  });

  function makeEl() {
    const el = dom.window.document.createElement('scrobbles-last-updated');
    dom.window.document.body.appendChild(el);
    return el;
  }

  // ── registration ────────────────────────────────────────────────────────────

  test('init() registers scrobbles-last-updated in the custom element registry', () => {
    assert.ok(
      dom.window.customElements.get('scrobbles-last-updated'),
      'scrobbles-last-updated should be defined after init()',
    );
  });

  // ── initial render ──────────────────────────────────────────────────────────

  test('shows loading text initially', () => {
    const el = makeEl();
    assert.equal(
      el.shadowRoot.getElementById('datetime').textContent,
      'Loading\u2026',
      'time element should show loading text before data arrives',
    );
  });

  test('time element has the loading class initially', () => {
    const el = makeEl();
    assert.ok(
      el.shadowRoot.getElementById('datetime').classList.contains('loading'),
      'time element should have the loading class before data arrives',
    );
  });

  test('label shows "Last updated:"', () => {
    const el = makeEl();
    assert.equal(
      el.shadowRoot.querySelector('.label').textContent,
      'Last updated:',
      'label span should always read "Last updated:"',
    );
  });

  // ── renderDate() — field name handling ──────────────────────────────────────

  test('renderDate() with last_updated ISO string sets datetime attribute', () => {
    const el = makeEl();
    el.renderDate({ last_updated: '2025-01-15T20:30:00Z' });
    const attr = el.shadowRoot.getElementById('datetime').getAttribute('datetime');
    assert.ok(attr && attr.startsWith('2025-01-15'), 'datetime attribute should reflect the ISO date');
  });

  test('renderDate() with epoch number (seconds) sets a non-loading, non-unknown value', () => {
    const el = makeEl();
    el.renderDate({ epoch: 1736960700 }); // 2025-01-15 ~ 19:05 UTC
    const text = el.shadowRoot.getElementById('datetime').textContent;
    assert.notEqual(text, 'Loading\u2026', 'should not show loading after renderDate');
    assert.notEqual(text, 'Unknown', 'epoch number should produce a valid date string');
  });

  test('renderDate() with timestamp field (number) renders correctly', () => {
    const el = makeEl();
    el.renderDate({ timestamp: 1736960700 });
    assert.notEqual(
      el.shadowRoot.getElementById('datetime').textContent,
      'Unknown',
      'timestamp field should be recognized',
    );
  });

  test('renderDate() with updated_at ISO string renders correctly', () => {
    const el = makeEl();
    el.renderDate({ updated_at: '2025-06-01T00:00:00Z' });
    assert.notEqual(
      el.shadowRoot.getElementById('datetime').textContent,
      'Unknown',
      'updated_at field should be recognized',
    );
  });

  test('renderDate() with datetime field renders correctly', () => {
    const el = makeEl();
    el.renderDate({ datetime: '2025-03-20T12:00:00Z' });
    assert.notEqual(
      el.shadowRoot.getElementById('datetime').textContent,
      'Unknown',
      'datetime field should be recognized',
    );
  });

  test('renderDate() with date field renders correctly', () => {
    const el = makeEl();
    el.renderDate({ date: '2025-03-20' });
    assert.notEqual(
      el.shadowRoot.getElementById('datetime').textContent,
      'Unknown',
      'date field should be recognized',
    );
  });

  // ── renderDate() — class handling ───────────────────────────────────────────

  test('renderDate() removes the loading class', () => {
    const el = makeEl();
    assert.ok(el.shadowRoot.getElementById('datetime').classList.contains('loading'));
    el.renderDate({ last_updated: '2025-01-15T20:30:00Z' });
    assert.ok(
      !el.shadowRoot.getElementById('datetime').classList.contains('loading'),
      'loading class should be removed after renderDate()',
    );
  });

  // ── renderDate() — invalid data fallback ────────────────────────────────────

  test('renderDate() with an invalid date string falls back to Unknown', () => {
    const el = makeEl();
    el.renderDate({ last_updated: 'not-a-valid-date' });
    assert.equal(
      el.shadowRoot.getElementById('datetime').textContent,
      'Unknown',
      'an unparseable date string should fall back to Unknown',
    );
  });

  test('renderDate() with an empty object falls back to Unknown', () => {
    const el = makeEl();
    el.renderDate({});
    assert.equal(
      el.shadowRoot.getElementById('datetime').textContent,
      'Unknown',
      'an object with no recognized field should fall back to Unknown',
    );
  });

  test('renderDate() with null value for a known field falls back to Unknown', () => {
    const el = makeEl();
    el.renderDate({ last_updated: null });
    assert.equal(
      el.shadowRoot.getElementById('datetime').textContent,
      'Unknown',
      'null value for a known field should fall back to Unknown',
    );
  });

  // ── renderError() ───────────────────────────────────────────────────────────

  test('renderError() sets text content to Unknown', () => {
    const el = makeEl();
    el.renderError();
    assert.equal(
      el.shadowRoot.getElementById('datetime').textContent,
      'Unknown',
      'renderError() should show "Unknown"',
    );
  });

  test('renderError() removes the loading class', () => {
    const el = makeEl();
    el.renderError();
    assert.ok(
      !el.shadowRoot.getElementById('datetime').classList.contains('loading'),
      'renderError() should remove the loading class',
    );
  });

  test('renderError() removes the datetime attribute', () => {
    const el = makeEl();
    el.renderDate({ last_updated: '2025-01-15T20:30:00Z' });
    assert.ok(el.shadowRoot.getElementById('datetime').getAttribute('datetime'), 'should have datetime after renderDate');
    el.renderError();
    assert.equal(
      el.shadowRoot.getElementById('datetime').getAttribute('datetime'),
      null,
      'renderError() should remove the datetime attribute',
    );
  });

  // ── fetchLastUpdated() — async integration ──────────────────────────────────

  test('fetchLastUpdated() renders the date when fetch succeeds', async () => {
    mockFetch = async () => ({
      ok: true,
      json: async () => ({ last_updated: '2025-06-15T10:00:00Z' }),
    });
    const el = dom.window.document.createElement('scrobbles-last-updated');
    dom.window.document.body.appendChild(el); // triggers connectedCallback → fetchLastUpdated
    await new Promise((resolve) => setTimeout(resolve, 0)); // allow promise chain to settle
    const text = el.shadowRoot.getElementById('datetime').textContent;
    assert.notEqual(text, 'Loading\u2026', 'should not show loading after successful fetch');
    assert.notEqual(text, 'Unknown', 'should not show Unknown after successful fetch');
  });

  test('fetchLastUpdated() shows Unknown when response is not ok', async () => {
    mockFetch = async () => ({ ok: false, json: async () => ({}) });
    const el = dom.window.document.createElement('scrobbles-last-updated');
    dom.window.document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(
      el.shadowRoot.getElementById('datetime').textContent,
      'Unknown',
      'a non-ok HTTP response should show Unknown',
    );
  });

  test('fetchLastUpdated() shows Unknown when fetch throws (network error)', async () => {
    mockFetch = null; // causes global.fetch to throw
    const el = dom.window.document.createElement('scrobbles-last-updated');
    dom.window.document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(
      el.shadowRoot.getElementById('datetime').textContent,
      'Unknown',
      'a fetch error should show Unknown',
    );
  });

  test('fetchLastUpdated() shows Unknown when response JSON has no recognized field', async () => {
    mockFetch = async () => ({
      ok: true,
      json: async () => ({ unrecognized_field: 'some value' }),
    });
    const el = dom.window.document.createElement('scrobbles-last-updated');
    dom.window.document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(
      el.shadowRoot.getElementById('datetime').textContent,
      'Unknown',
      'JSON with no recognized date field should show Unknown',
    );
  });
});
