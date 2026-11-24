/**
 * @fileoverview Accessible multi-select dropdown web component.
 *
 * Provides a mobile-friendly, keyboard-accessible dropdown with checkbox
 * options and match counts for filtering. Conforms to W3C APG Listbox pattern
 * with multiselect support.
 */

const template = `
  <style>
    :host {
      display: block;
      position: relative;
      font-family: var(--font-sans);
      width: 100%;
      max-width: var(--max-6-columns);
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    .multiselect-wrap {
      position: relative;
      width: 100%;
    }

    .trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      width: 100%;
      min-height: 44px;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      background-color: var(--color-surface-2);
      border: 1px solid var(--color-border);
      color: var(--color-text);
      font-family: inherit;
      font-size: var(--fs-sm);
      text-align: left;
      cursor: pointer;
      transition:
        background-color var(--dur-2) var(--ease-standard),
        border-color var(--dur-2) var(--ease-standard);
    }

    .trigger:hover {
      background-color: var(--color-surface-3);
      border-color: var(--color-border-strong);
    }

    .trigger:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
      border-color: var(--color-primary-500);
    }

    .trigger[aria-expanded="true"] {
      border-color: var(--color-primary-500);
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }

    .trigger-content {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }

    .trigger-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--color-text);
      font-weight: var(--fw-medium);
    }

    .trigger-label.placeholder {
      color: var(--color-text-muted);
      font-weight: var(--fw-regular);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 var(--space-2);
      min-width: 1.5rem;
      height: 1.25rem;
      border-radius: var(--radius-pill);
      background-color: var(--color-primary-500);
      color: var(--color-text-inverse);
      font-size: var(--fs-2xs);
      font-weight: var(--fw-bold);
      line-height: 1;
      flex-shrink: 0;
    }

    .badge[hidden] {
      display: none;
    }

    .chevron {
      display: inline-block;
      width: 0.5rem;
      height: 0.5rem;
      border-right: 2px solid currentColor;
      border-bottom: 2px solid currentColor;
      transform: rotate(45deg);
      transition: transform var(--dur-2) var(--ease-standard);
      margin-right: var(--space-1);
      flex-shrink: 0;
    }

    .trigger[aria-expanded="true"] .chevron {
      transform: rotate(-135deg);
    }

    .panel {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: 50;
      background-color: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-top: none;
      border-bottom-left-radius: var(--radius-md);
      border-bottom-right-radius: var(--radius-md);
      box-shadow: var(--elev-3);
      max-height: 20rem;
      display: flex;
      flex-direction: column;
    }

    .panel[hidden] {
      display: none;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-2) var(--space-3);
      border-bottom: 1px solid var(--color-border);
      background-color: var(--color-surface-2);
      font-size: var(--fs-xs);
      color: var(--color-text-muted);
      flex-shrink: 0;
    }

    .clear-btn {
      background: none;
      border: none;
      color: var(--color-primary-300);
      font-size: var(--fs-xs);
      font-family: inherit;
      cursor: pointer;
      padding: 0;
      text-decoration: underline;
    }

    .clear-btn:hover {
      color: var(--color-primary-500);
    }

    .clear-btn:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
    }

    .clear-btn[hidden] {
      display: none;
    }

    .options-list {
      list-style: none;
      margin: 0;
      padding: var(--space-1) 0;
      overflow-y: auto;
      max-height: 16rem;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
    }

    .options-list:focus {
      outline: none;
    }

    .option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      min-height: 40px;
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
      font-size: var(--fs-sm);
      color: var(--color-text);
      user-select: none;
      transition: background-color var(--dur-1) var(--ease-standard);
    }

    .option:hover,
    .option.focused {
      background-color: var(--color-surface-3);
    }

    .option[aria-selected="true"] {
      background-color: var(--color-surface-2);
    }

    .option[aria-selected="true"]:hover,
    .option[aria-selected="true"].focused {
      background-color: var(--color-surface-3);
    }

    .option-main {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
      flex: 1;
    }

    .checkbox {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.125rem;
      height: 1.125rem;
      border-radius: var(--radius-xs);
      border: 1px solid var(--color-border-strong);
      background-color: var(--color-surface-1);
      flex-shrink: 0;
      transition:
        background-color var(--dur-1) var(--ease-standard),
        border-color var(--dur-1) var(--ease-standard);
    }

    .option[aria-selected="true"] .checkbox {
      background-color: var(--color-primary-500);
      border-color: var(--color-primary-500);
    }

    .checkbox::after {
      content: '';
      display: none;
      width: 0.3rem;
      height: 0.55rem;
      border: solid var(--color-text-inverse);
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
      margin-bottom: 2px;
    }

    .option[aria-selected="true"] .checkbox::after {
      display: block;
    }

    .option-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .option-count {
      min-width: 1.5em;
      padding: 0 var(--space-2);
      border-radius: var(--radius-pill);
      background-color: var(--color-divider);
      color: var(--color-text-muted);
      font-size: var(--fs-2xs);
      font-weight: var(--fw-bold);
      text-align: center;
      flex-shrink: 0;
    }

    .option[aria-selected="true"] .option-count {
      color: var(--color-primary-300);
    }

    .empty-message {
      padding: var(--space-3);
      color: var(--color-text-muted);
      font-size: var(--fs-sm);
      text-align: center;
    }

    @media (prefers-reduced-motion: reduce) {
      .trigger,
      .chevron,
      .option,
      .checkbox {
        transition: none !important;
      }
    }
  </style>

  <div class="multiselect-wrap">
    <button type="button" class="trigger" id="trigger" aria-haspopup="listbox"
      aria-expanded="false" aria-controls="listbox">
      <span class="trigger-content">
        <span class="trigger-label" id="trigger-label"></span>
        <span class="badge" id="trigger-badge" hidden></span>
      </span>
      <span class="chevron" aria-hidden="true"></span>
    </button>
    <div class="panel" id="panel" hidden>
      <div class="panel-header">
        <span id="summary-text">0 selected</span>
        <button type="button" class="clear-btn" id="clear-btn" hidden>Clear</button>
      </div>
      <ul class="options-list" id="listbox" role="listbox" aria-multiselectable="true" tabindex="-1"></ul>
    </div>
  </div>
`;

export interface MultiselectOptionInput {
  value: string | number;
  label?: string;
  count?: number | null;
}

export interface MultiselectOption {
  value: string;
  label: string;
  count: number | null;
}

export type MultiselectOptionItem = MultiselectOptionInput | string | number;

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes characters for safe string rendering in HTML text.
 *
 * @param {unknown} str - Raw string.
 * @returns {string} Escaped string.
 */
function escapeText(str: unknown): string {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => HTML_ESCAPE_MAP[c] || c);
}

/**
 * MultiselectDropdown Custom Element
 *
 * @class MultiselectDropdown
 * @extends {HTMLElement}
 */
class MultiselectDropdown extends HTMLElement {
  triggerEl: HTMLButtonElement;

  labelEl: HTMLElement;

  badgeEl: HTMLElement;

  panelEl: HTMLElement;

  summaryEl: HTMLElement;

  clearBtnEl: HTMLButtonElement;

  listboxEl: HTMLUListElement;

  options: MultiselectOption[];

  selected: Set<string>;

  isOpen: boolean;

  focusedIndex: number;

  placeholder: string | null = null;

  onDocumentClick: (event: MouseEvent) => void;

  onTriggerClick: (event: MouseEvent) => void;

  onListboxClick: (event: MouseEvent) => void;

  onKeydown: (event: KeyboardEvent) => void;

  onClearClick: (event: MouseEvent) => void;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = template;

    this.triggerEl = shadow.getElementById('trigger') as HTMLButtonElement;
    this.labelEl = shadow.getElementById('trigger-label') as HTMLElement;
    this.badgeEl = shadow.getElementById('trigger-badge') as HTMLElement;
    this.panelEl = shadow.getElementById('panel') as HTMLElement;
    this.summaryEl = shadow.getElementById('summary-text') as HTMLElement;
    this.clearBtnEl = shadow.getElementById('clear-btn') as HTMLButtonElement;
    this.listboxEl = shadow.getElementById('listbox') as HTMLUListElement;

    this.options = [];
    this.selected = new Set();
    this.isOpen = false;
    this.focusedIndex = -1;

    this.onDocumentClick = this.handleDocumentClick.bind(this);
    this.onTriggerClick = this.handleTriggerClick.bind(this);
    this.onListboxClick = this.handleListboxClick.bind(this);
    this.onKeydown = this.handleKeydown.bind(this);
    this.onClearClick = this.handleClearClick.bind(this);
  }

  connectedCallback(): void {
    this.triggerEl.addEventListener('click', this.onTriggerClick);
    this.listboxEl.addEventListener('click', this.onListboxClick);
    this.clearBtnEl.addEventListener('click', this.onClearClick);
    this.addEventListener('keydown', this.onKeydown);
    document.addEventListener('click', this.onDocumentClick);

    if (this.hasAttribute('placeholder')) {
      this.placeholder = this.getAttribute('placeholder');
    }
    const ariaLabelledBy = this.getAttribute('aria-labelledby');
    if (ariaLabelledBy !== null) {
      this.triggerEl.setAttribute('aria-labelledby', ariaLabelledBy);
      this.listboxEl.setAttribute('aria-labelledby', ariaLabelledBy);
    }
    const ariaLabel = this.getAttribute('aria-label');
    if (ariaLabel !== null) {
      this.triggerEl.setAttribute('aria-label', ariaLabel);
      this.listboxEl.setAttribute('aria-label', ariaLabel);
    }

    this.updateTrigger();
  }

  disconnectedCallback(): void {
    this.triggerEl.removeEventListener('click', this.onTriggerClick);
    this.listboxEl.removeEventListener('click', this.onListboxClick);
    this.clearBtnEl.removeEventListener('click', this.onClearClick);
    this.removeEventListener('keydown', this.onKeydown);
    document.removeEventListener('click', this.onDocumentClick);
  }

  get value(): string[] {
    return Array.from(this.selected);
  }

  set value(val: string[] | Set<string>) {
    this.setSelected(val);
  }

  /**
   * Sets options in the multiselect and updates the listbox DOM.
   * Prunes any selected value that is no longer present in options.
   *
   * @param {MultiselectOptionItem[]} items - Options list.
   */
  setOptions(items: MultiselectOptionItem[] | null | undefined): void {
    this.options = (items || []).map((item) => {
      if (typeof item === 'object' && item !== null) {
        return {
          value: String(item.value),
          label: String(item.label || item.value),
          count: typeof item.count === 'number' ? item.count : null,
        };
      }
      return { value: String(item), label: String(item), count: null };
    });

    const validValues = new Set(this.options.map((opt) => opt.value));
    let pruned = false;
    this.selected.forEach((val) => {
      if (!validValues.has(val)) {
        this.selected.delete(val);
        pruned = true;
      }
    });

    this.renderOptions();
    this.updateTrigger();

    if (pruned) {
      this.dispatchChangeEvent();
    }
  }

  /**
   * Sets the selected values and refreshes the UI.
   *
   * @param {Iterable<string>|null|undefined} values - Array or Set of selected values.
   */
  setSelected(values: Iterable<string> | null | undefined): void {
    const list = Array.isArray(values) ? values : Array.from(values || []);
    this.selected = new Set(list.map(String));
    this.updateSelectionDom();
    this.updateTrigger();
  }

  /**
   * Clears all selections.
   */
  clear(): void {
    if (this.selected.size === 0) return;
    this.selected.clear();
    this.updateSelectionDom();
    this.updateTrigger();
    this.dispatchChangeEvent();
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.triggerEl.setAttribute('aria-expanded', 'true');
    this.panelEl.hidden = false;
    this.focusedIndex = this.findInitialFocusedIndex();
    this.updateFocusedOption();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.triggerEl.setAttribute('aria-expanded', 'false');
    this.panelEl.hidden = true;
    this.focusedIndex = -1;
    this.updateFocusedOption();
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  findInitialFocusedIndex(): number {
    if (this.options.length === 0) return -1;
    const firstSelected = this.options.findIndex((opt) => this.selected.has(opt.value));
    return firstSelected >= 0 ? firstSelected : 0;
  }

  handleDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) return;
    const path = event.composedPath ? event.composedPath() : [];
    if (!path.includes(this)) {
      this.close();
    }
  }

  handleTriggerClick(event: MouseEvent): void {
    event.preventDefault();
    this.toggle();
    if (this.isOpen && this.focusedIndex >= 0) {
      this.focusOption(this.focusedIndex);
    }
  }

  handleClearClick(event: MouseEvent): void {
    event.stopPropagation();
    this.clear();
    this.triggerEl.focus();
  }

  handleListboxClick(event: MouseEvent): void {
    const target = event.target as Element | null;
    const optionEl = target && typeof target.closest === 'function'
      ? target.closest<HTMLElement>('[role="option"]')
      : null;
    if (!optionEl) return;
    const { value } = optionEl.dataset;
    if (value !== undefined) {
      this.toggleValue(value);
      this.focusedIndex = this.options.findIndex((opt) => opt.value === value);
      this.updateFocusedOption();
    }
  }

  toggleValue(value: string): void {
    if (this.selected.has(value)) {
      this.selected.delete(value);
    } else {
      this.selected.add(value);
    }
    this.updateSelectionDom();
    this.updateTrigger();
    this.dispatchChangeEvent();
  }

  dispatchChangeEvent(): void {
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true,
      composed: true,
      detail: { values: this.value },
    }));
  }

  updateSelectionDom(): void {
    const optionEls = this.listboxEl.querySelectorAll<HTMLElement>('[role="option"]');
    optionEls.forEach((el) => {
      const isSelected = el.dataset.value !== undefined && this.selected.has(el.dataset.value);
      el.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
  }

  updateTrigger(): void {
    const placeholder = this.placeholder || this.getAttribute('placeholder') || 'Select items\u2026';
    const count = this.selected.size;

    if (count === 0) {
      this.labelEl.textContent = placeholder;
      this.labelEl.classList.add('placeholder');
      this.badgeEl.hidden = true;
      this.summaryEl.textContent = 'None selected';
      this.clearBtnEl.hidden = true;
    } else if (count === 1) {
      const selectedVal = Array.from(this.selected)[0];
      const match = this.options.find((opt) => opt.value === selectedVal);
      const label = match ? match.label : selectedVal;
      this.labelEl.textContent = label;
      this.labelEl.classList.remove('placeholder');
      this.badgeEl.hidden = true;
      this.summaryEl.textContent = '1 selected';
      this.clearBtnEl.hidden = false;
    } else {
      this.labelEl.textContent = `${count} artists selected`;
      this.labelEl.classList.remove('placeholder');
      this.badgeEl.textContent = String(count);
      this.badgeEl.hidden = false;
      this.summaryEl.textContent = `${count} selected`;
      this.clearBtnEl.hidden = false;
    }
  }

  renderOptions(): void {
    if (this.options.length === 0) {
      this.listboxEl.innerHTML = '<li class="empty-message">No matching artists</li>';
      return;
    }

    this.listboxEl.innerHTML = this.options.map((opt, index) => {
      const isSelected = this.selected.has(opt.value);
      const countHtml = typeof opt.count === 'number'
        ? `<span class="option-count">${opt.count}</span>`
        : '';
      return `
        <li role="option"
            id="opt-${index}"
            class="option${isSelected ? ' selected' : ''}"
            data-value="${escapeText(opt.value)}"
            data-index="${index}"
            aria-selected="${isSelected ? 'true' : 'false'}">
          <span class="option-main">
            <span class="checkbox" aria-hidden="true"></span>
            <span class="option-name">${escapeText(opt.label)}</span>
          </span>
          ${countHtml}
        </li>`;
    }).join('');
  }

  focusOption(index: number): void {
    if (index < 0 || index >= this.options.length) return;
    this.focusedIndex = index;
    this.updateFocusedOption();
    const optEl = this.listboxEl.querySelector(`[data-index="${index}"]`);
    if (optEl && typeof optEl.scrollIntoView === 'function') {
      optEl.scrollIntoView({ block: 'nearest' });
    }
  }

  updateFocusedOption(): void {
    const optionEls = this.listboxEl.querySelectorAll('[role="option"]');
    optionEls.forEach((el, idx) => {
      if (idx === this.focusedIndex && this.isOpen) {
        el.classList.add('focused');
        this.triggerEl.setAttribute('aria-activedescendant', el.id);
      } else {
        el.classList.remove('focused');
      }
    });
    if (!this.isOpen || this.focusedIndex < 0) {
      this.triggerEl.removeAttribute('aria-activedescendant');
    }
  }

  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.isOpen) {
        event.preventDefault();
        event.stopPropagation();
        this.close();
        this.triggerEl.focus();
      }
      return;
    }

    if (!this.isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        this.open();
        this.focusOption(this.findInitialFocusedIndex());
      }
      return;
    }

    if (this.options.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.focusOption((this.focusedIndex + 1) % this.options.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.focusOption((this.focusedIndex - 1 + this.options.length) % this.options.length);
        break;
      case 'Home':
        event.preventDefault();
        this.focusOption(0);
        break;
      case 'End':
        event.preventDefault();
        this.focusOption(this.options.length - 1);
        break;
      case ' ':
      case 'Enter':
        event.preventDefault();
        if (this.focusedIndex >= 0 && this.focusedIndex < this.options.length) {
          const opt = this.options[this.focusedIndex];
          this.toggleValue(opt.value);
        }
        break;
      case 'Tab':
        this.close();
        break;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const char = event.key.toLowerCase();
          const start = this.focusedIndex + 1;
          const match = this.options.findIndex((opt, idx) => idx >= start && opt.label.toLowerCase().startsWith(char));
          if (match >= 0) {
            this.focusOption(match);
          } else {
            const wrapMatch = this.options.findIndex((opt) => opt.label.toLowerCase().startsWith(char));
            if (wrapMatch >= 0) this.focusOption(wrapMatch);
          }
        }
        break;
    }
  }
}

module.exports = MultiselectDropdown;
module.exports.init = (): void => {
  if (typeof customElements !== 'undefined' && !customElements.get('multiselect-dropdown')) {
    customElements.define('multiselect-dropdown', MultiselectDropdown);
  }
};
