import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);

// A single JSDOM instance is required across the entire suite because the
// YearSelector class extends global.HTMLElement at module-load time.  JSDOM's
// HTMLConstructor validates that the class is registered in the *same* registry
// as the HTMLElement it extends, so swapping global.HTMLElement (by creating a
// fresh JSDOM per test) would break the prototype chain.
const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'http://localhost/' });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.customElements = dom.window.customElements;
global.Event = dom.window.Event;

// JSDOM limitation workaround: appending a cloneNode() of a custom-element-
// named node (year-template) into a shadow root triggers JSDOM's synchronous
// CE upgrade path, which enforces "no attributes on constructed element".
// The year-selector constructor violates this by calling update() → setAttribute
// inside the constructor.  Replacing the clone with a plain <div> carrying the
// same innerHTML sidesteps the upgrade check entirely.
const origCloneNode = dom.window.Node.prototype.cloneNode;
dom.window.Node.prototype.cloneNode = function yearTemplateCloneShim(deep) {
  if (this.tagName === 'YEAR-TEMPLATE') {
    const wrapper = dom.window.document.createElement('div');
    wrapper.innerHTML = this.innerHTML;
    return wrapper;
  }
  return origCloneNode.call(this, deep);
};

const YearSelector = require('../src/js/_components/year-selector.js');

describe('YearSelector', () => {
  // customElements.define can only be called once per name per registry, so
  // call init() once before the suite rather than per test.
  before(() => {
    YearSelector.init();
  });

  // Clear the document body before each test so elements don't accumulate.
  beforeEach(() => {
    dom.window.document.body.innerHTML = '';
  });

  // Creating via innerHTML (not document.createElement) uses the HTML parser's
  // async upgrade path, which does not enforce the "no attributes after
  // construction" invariant that the synchronous createElement path does.
  function makeElement(min, max, value) {
    const container = dom.window.document.createElement('div');
    container.innerHTML = `<year-selector min="${min}" max="${max}" value="${value}"></year-selector>`;
    dom.window.document.body.appendChild(container);
    return container.querySelector('year-selector');
  }

  // ── Registration ─────────────────────────────────────────────────────────────

  test('init() defines year-selector as a custom element', () => {
    assert.ok(
      dom.window.customElements.get('year-selector'),
      'year-selector should be defined in the custom element registry',
    );
  });

  // ── Initial render ───────────────────────────────────────────────────────────

  test('renders the current value in the slot', () => {
    const el = makeElement(2020, 2023, 2022);
    const slot = el.shadowRoot.querySelector('slot');
    // JSDOM does not coerce innerText values to strings, so compare via String()
    // (real browsers always return a string from innerText).
    assert.equal(String(slot.innerText), '2022', 'slot should display the current value');
  });

  test('populates the select with one option per year in the range', () => {
    const el = makeElement(2020, 2023, 2022);
    const select = el.shadowRoot.getElementById('dropdown');
    assert.equal(select.options.length, 4, 'select should have 4 options for years 2020–2023');
  });

  test('select is set to the current value', () => {
    const el = makeElement(2020, 2023, 2022);
    const select = el.shadowRoot.getElementById('dropdown');
    assert.equal(select.value, '2022', 'select value should match the current value');
  });

  test('select options are ordered from max down to min', () => {
    const el = makeElement(2020, 2023, 2022);
    const select = el.shadowRoot.getElementById('dropdown');
    const values = Array.from(select.options).map((o) => Number(o.value));
    assert.deepEqual(values, [2023, 2022, 2021, 2020], 'options should be newest-first');
  });

  test('back and next buttons are both enabled when value is between min and max', () => {
    const el = makeElement(2020, 2023, 2022);
    assert.equal(el.shadowRoot.getElementById('back').disabled, false, 'back should be enabled');
    assert.equal(el.shadowRoot.getElementById('next').disabled, false, 'next should be enabled');
  });

  // ── Boundary state ───────────────────────────────────────────────────────────

  test('next button is disabled when value equals max', () => {
    const el = makeElement(2020, 2023, 2023);
    assert.equal(
      el.shadowRoot.getElementById('next').disabled,
      true,
      'next button should be disabled at max',
    );
  });

  test('back button is enabled when value equals max', () => {
    const el = makeElement(2020, 2023, 2023);
    assert.equal(
      el.shadowRoot.getElementById('back').disabled,
      false,
      'back button should be enabled at max',
    );
  });

  test('back button is disabled when value equals min', () => {
    const el = makeElement(2020, 2023, 2020);
    assert.equal(
      el.shadowRoot.getElementById('back').disabled,
      true,
      'back button should be disabled at min',
    );
  });

  test('next button is enabled when value equals min', () => {
    const el = makeElement(2020, 2023, 2020);
    assert.equal(
      el.shadowRoot.getElementById('next').disabled,
      false,
      'next button should be enabled at min',
    );
  });

  // ── next() and back() ────────────────────────────────────────────────────────

  test('next() increments the displayed value by one', () => {
    const el = makeElement(2020, 2023, 2022);
    el.next();
    assert.equal(
      String(el.shadowRoot.querySelector('slot').innerText),
      '2023',
      'slot should show incremented value after next()',
    );
  });

  test('back() decrements the displayed value by one', () => {
    const el = makeElement(2020, 2023, 2022);
    el.back();
    assert.equal(
      String(el.shadowRoot.querySelector('slot').innerText),
      '2021',
      'slot should show decremented value after back()',
    );
  });

  test('next() updates the select to the new value', () => {
    const el = makeElement(2020, 2023, 2022);
    el.next();
    assert.equal(
      el.shadowRoot.getElementById('dropdown').value,
      '2023',
      'select should reflect the incremented value after next()',
    );
  });

  test('back() updates the select to the new value', () => {
    const el = makeElement(2020, 2023, 2022);
    el.back();
    assert.equal(
      el.shadowRoot.getElementById('dropdown').value,
      '2021',
      'select should reflect the decremented value after back()',
    );
  });

  test('next() dispatches a change event on the host element', () => {
    const el = makeElement(2020, 2023, 2022);
    let fired = false;
    el.addEventListener('change', () => { fired = true; });
    el.next();
    assert.ok(fired, 'change event should fire after next()');
  });

  test('back() dispatches a change event on the host element', () => {
    const el = makeElement(2020, 2023, 2022);
    let fired = false;
    el.addEventListener('change', () => { fired = true; });
    el.back();
    assert.ok(fired, 'change event should fire after back()');
  });

  // ── Button clicks ────────────────────────────────────────────────────────────

  test('clicking the next button increments the displayed value', () => {
    const el = makeElement(2020, 2023, 2022);
    el.shadowRoot.getElementById('next').click();
    assert.equal(
      String(el.shadowRoot.querySelector('slot').innerText),
      '2023',
      'slot should show 2023 after next button click',
    );
  });

  test('clicking the back button decrements the displayed value', () => {
    const el = makeElement(2020, 2023, 2022);
    el.shadowRoot.getElementById('back').click();
    assert.equal(
      String(el.shadowRoot.querySelector('slot').innerText),
      '2021',
      'slot should show 2021 after back button click',
    );
  });

  test('clicking the next button dispatches exactly one change event', () => {
    const el = makeElement(2020, 2023, 2022);
    let count = 0;
    el.addEventListener('change', () => { count++; });
    el.shadowRoot.getElementById('next').click();
    assert.equal(count, 1, 'exactly one change event should fire on next click');
  });

  test('clicking the back button dispatches exactly one change event', () => {
    const el = makeElement(2020, 2023, 2022);
    let count = 0;
    el.addEventListener('change', () => { count++; });
    el.shadowRoot.getElementById('back').click();
    assert.equal(count, 1, 'exactly one change event should fire on back click');
  });

  // ── Select dropdown ──────────────────────────────────────────────────────────

  test('changing the select updates the slot to the chosen year', () => {
    const el = makeElement(2020, 2023, 2022);
    const select = el.shadowRoot.getElementById('dropdown');
    select.value = '2020';
    select.dispatchEvent(new dom.window.Event('change'));
    assert.equal(
      String(el.shadowRoot.querySelector('slot').innerText),
      '2020',
      'slot should reflect the selected year',
    );
  });

  test('changing the select dispatches a change event on the host element', () => {
    const el = makeElement(2020, 2023, 2022);
    let fired = false;
    el.addEventListener('change', () => { fired = true; });
    const select = el.shadowRoot.getElementById('dropdown');
    select.value = '2020';
    select.dispatchEvent(new dom.window.Event('change'));
    assert.ok(fired, 'change event should fire when select changes');
  });

  // ── attributeChangedCallback ─────────────────────────────────────────────────

  test('setting the value attribute after the debounce window updates the slot', (t) => {
    t.mock.timers.enable(['Date']);
    const el = makeElement(2020, 2023, 2022);
    t.mock.timers.tick(100); // advance past the 10 ms debounce window
    el.setAttribute('value', '2021');
    assert.equal(
      String(el.shadowRoot.querySelector('slot').innerText),
      '2021',
      'slot should update when value attribute changes outside the debounce window',
    );
  });

  test('setting min attribute after debounce window disables back when new min equals value', (t) => {
    t.mock.timers.enable(['Date']);
    const el = makeElement(2020, 2023, 2022);
    t.mock.timers.tick(100);
    el.setAttribute('min', '2022'); // new min equals current value
    assert.equal(
      el.shadowRoot.getElementById('back').disabled,
      true,
      'back should be disabled when new min equals value',
    );
  });

  test('setting max attribute after debounce window disables next when new max equals value', (t) => {
    t.mock.timers.enable(['Date']);
    const el = makeElement(2020, 2023, 2022);
    t.mock.timers.tick(100);
    el.setAttribute('max', '2022'); // new max equals current value
    assert.equal(
      el.shadowRoot.getElementById('next').disabled,
      true,
      'next should be disabled when new max equals value',
    );
  });

  // ── Debounce ─────────────────────────────────────────────────────────────────

  test('a second setAttribute within 10 ms of the first is debounced', (t) => {
    t.mock.timers.enable(['Date']);
    const el = makeElement(2020, 2023, 2022);
    t.mock.timers.tick(100); // let first change through
    el.setAttribute('value', '2023');

    // Immediately set another value — still within the 10 ms debounce window
    el.setAttribute('value', '2020');

    assert.equal(
      String(el.shadowRoot.querySelector('slot').innerText),
      '2023',
      'second rapid setAttribute should be debounced and the slot should not change',
    );
  });

  test('a setAttribute after the debounce window resolves the pending state', (t) => {
    t.mock.timers.enable(['Date']);
    const el = makeElement(2020, 2023, 2022);
    t.mock.timers.tick(100);
    el.setAttribute('value', '2023'); // first update goes through

    t.mock.timers.tick(100); // advance past the debounce window again
    el.setAttribute('value', '2020'); // second update should now go through

    assert.equal(
      String(el.shadowRoot.querySelector('slot').innerText),
      '2020',
      'slot should update to the second setAttribute value after the debounce window passes',
    );
  });
});
