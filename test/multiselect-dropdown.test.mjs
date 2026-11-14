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
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;

const MultiselectDropdown = require('../src/js/_components/multiselect-dropdown.js');

describe('MultiselectDropdown', () => {
  before(() => {
    MultiselectDropdown.init();
  });

  beforeEach(() => {
    dom.window.document.body.innerHTML = '';
  });

  function makeDropdown(attrs = {}) {
    const el = dom.window.document.createElement('multiselect-dropdown');
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    dom.window.document.body.appendChild(el);
    return el;
  }

  test('init() registers multiselect-dropdown in the custom element registry', () => {
    assert.ok(
      dom.window.customElements.get('multiselect-dropdown'),
      'multiselect-dropdown should be defined'
    );
  });

  test('renders trigger button and listbox with correct accessibility attributes', () => {
    const el = makeDropdown({ placeholder: 'Select artists' });
    const trigger = el.shadowRoot.getElementById('trigger');
    const listbox = el.shadowRoot.getElementById('listbox');
    const panel = el.shadowRoot.getElementById('panel');

    assert.ok(trigger);
    assert.equal(trigger.getAttribute('aria-haspopup'), 'listbox');
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(trigger.getAttribute('aria-controls'), 'listbox');

    assert.ok(listbox);
    assert.equal(listbox.getAttribute('role'), 'listbox');
    assert.equal(listbox.getAttribute('aria-multiselectable'), 'true');
    assert.equal(panel.hidden, true);
  });

  test('setOptions populates options and updates listbox', () => {
    const el = makeDropdown();
    el.setOptions([
      { value: 'Beatles', label: 'The Beatles', count: 12 },
      { value: 'Underoath', label: 'Underoath', count: 4 }
    ]);

    const options = el.shadowRoot.querySelectorAll('[role="option"]');
    assert.equal(options.length, 2);
    assert.equal(options[0].dataset.value, 'Beatles');
    assert.ok(options[0].textContent.includes('The Beatles'));
    assert.ok(options[0].textContent.includes('12'));
    assert.equal(options[0].getAttribute('aria-selected'), 'false');
  });

  test('setOptions prunes selections no longer present in options and fires change event', () => {
    const el = makeDropdown();
    el.setOptions([
      { value: 'Beatles', label: 'The Beatles', count: 10 },
      { value: 'Underoath', label: 'Underoath', count: 5 }
    ]);
    el.setSelected(['Beatles', 'Underoath']);
    assert.deepEqual(el.value, ['Beatles', 'Underoath']);

    let changeFired = false;
    el.addEventListener('change', () => { changeFired = true; });

    // New options without Underoath
    el.setOptions([
      { value: 'Beatles', label: 'The Beatles', count: 10 }
    ]);

    assert.deepEqual(el.value, ['Beatles']);
    assert.equal(changeFired, true);
  });

  test('setSelected updates aria-selected and trigger label', () => {
    const el = makeDropdown({ placeholder: 'All artists' });
    el.setOptions([
      { value: 'Beatles', label: 'The Beatles', count: 10 },
      { value: 'Eagles', label: 'Eagles', count: 5 }
    ]);

    const label = el.shadowRoot.getElementById('trigger-label');
    const badge = el.shadowRoot.getElementById('trigger-badge');
    assert.equal(label.textContent, 'All artists');
    assert.equal(badge.hidden, true);

    // Select 1 item
    el.setSelected(['Beatles']);
    assert.equal(label.textContent, 'The Beatles');
    assert.equal(badge.hidden, true);

    // Select 2 items
    el.setSelected(['Beatles', 'Eagles']);
    assert.equal(label.textContent, '2 artists selected');
    assert.equal(badge.hidden, false);
    assert.equal(badge.textContent, '2');
  });

  test('clicking trigger toggles open state and aria-expanded', () => {
    const el = makeDropdown();
    const trigger = el.shadowRoot.getElementById('trigger');
    const panel = el.shadowRoot.getElementById('panel');

    assert.equal(panel.hidden, true);
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');

    trigger.click();
    assert.equal(panel.hidden, false);
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');

    trigger.click();
    assert.equal(panel.hidden, true);
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  });

  test('clicking option toggles selection and dispatches change event', () => {
    const el = makeDropdown();
    el.setOptions([
      { value: 'Beatles', label: 'The Beatles', count: 10 },
      { value: 'Underoath', label: 'Underoath', count: 5 }
    ]);

    let lastDetail = null;
    el.addEventListener('change', (e) => {
      lastDetail = e.detail;
    });

    el.open();
    const opt0 = el.shadowRoot.querySelectorAll('[role="option"]')[0];
    opt0.click();

    assert.deepEqual(el.value, ['Beatles']);
    assert.deepEqual(lastDetail, { values: ['Beatles'] });
    assert.equal(opt0.getAttribute('aria-selected'), 'true');

    // Clicking again deselects
    opt0.click();
    assert.deepEqual(el.value, []);
    assert.equal(opt0.getAttribute('aria-selected'), 'false');
  });

  test('clear button unselects all and dispatches change event', () => {
    const el = makeDropdown();
    el.setOptions([
      { value: 'Beatles', label: 'The Beatles', count: 10 }
    ]);
    el.setSelected(['Beatles']);

    let cleared = false;
    el.addEventListener('change', () => { cleared = true; });

    const clearBtn = el.shadowRoot.getElementById('clear-btn');
    clearBtn.click();

    assert.deepEqual(el.value, []);
    assert.equal(cleared, true);
  });

  test('keyboard navigation cycles options and toggles with Space/Enter', () => {
    const el = makeDropdown();
    el.setOptions([
      { value: 'A', label: 'Band A', count: 1 },
      { value: 'B', label: 'Band B', count: 2 },
      { value: 'C', label: 'Band C', count: 3 }
    ]);

    const trigger = el.shadowRoot.getElementById('trigger');

    // ArrowDown on trigger opens dropdown
    el.dispatchEvent(new dom.window.Event('keydown', { bubbles: true }));
    el.handleKeydown({ key: 'ArrowDown', preventDefault: () => {} });
    assert.equal(el.isOpen, true);

    // ArrowDown moves focus
    el.handleKeydown({ key: 'ArrowDown', preventDefault: () => {} });
    assert.equal(el.focusedIndex, 1);
    assert.equal(trigger.getAttribute('aria-activedescendant'), 'opt-1');

    // Space toggles option at focusedIndex
    el.handleKeydown({ key: ' ', preventDefault: () => {} });
    assert.deepEqual(el.value, ['B']);

    // Escape closes dropdown
    el.handleKeydown({ key: 'Escape', preventDefault: () => {}, stopPropagation: () => {} });
    assert.equal(el.isOpen, false);
  });

  test('type-ahead jumps to option starting with typed key', () => {
    const el = makeDropdown();
    el.setOptions([
      { value: 'A', label: 'Atreyu', count: 1 },
      { value: 'B', label: 'Bayside', count: 2 },
      { value: 'C', label: 'Coheed', count: 3 }
    ]);
    el.open();

    el.handleKeydown({ key: 'b', preventDefault: () => {} });
    assert.equal(el.focusedIndex, 1);
  });
});
