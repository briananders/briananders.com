const yearTemplate = document.createElement('year-template');
yearTemplate.innerHTML = `
<style>
  div {
    display: block;
    min-height: 28px;
    position: relative;
  }
  slot {
    display: inline-block;
    border: 1px solid var(--palette--primary-color-light);
    border-radius: 4px;
    padding: 0 6px;
    height: 22px;
    line-height: 24px;
    font-size: 18px;
    width: 50px;
    text-align: left;
    cursor: pointer;

    transition-duration: var(--transition-speed);
    transition-timing-function: var(--transition-timing);

    transition-property: background-color;
  }
  select {
    position: absolute;
    left: 39px;
    width: 65px;
    height: 25px;
    opacity: 0;
    cursor: pointer;
  }
  button {
    appearance: none;
    border: 1px solid;
    color: var(--palette--primary-color-light);
    background-color: transparent;
    border-radius: 4px;
    height: 24px;
    width: 36px;
    line-height: 20px;
    font-size: 18px;
    cursor: pointer;
    outline: none;

    transition-duration: var(--transition-speed);
    transition-timing-function: var(--transition-timing);

    transition-property: background-color;
  }
  button:disabled,
  button:disabled:hover {
    color: grey;
    cursor: unset;
    background-color: transparent;
  }
  button:hover {
    background-color: var(--palette--hover-grey);
  }
  button:focus {
    box-shadow: 0px 0px 0px 2px var(--palette--primary-grey), 0px 0px 0px 4px var(--palette--secondary-grey);
  }
  slot.hover {
    background-color: var(--palette--hover-grey);
  }
  slot.focus {
    box-shadow: 0px 0px 0px 2px var(--palette--primary-grey), 0px 0px 0px 4px var(--palette--secondary-grey);
  }
</style>

<div>
  <button id="back">&#9204;</button>
  <slot>2022</slot>
  <select id="dropdown"></select>
  <button id="next">&#9205;</button>
</div>
`;

type YearAttribute = 'min' | 'max' | 'value';

const YEAR_ATTRIBUTES: readonly YearAttribute[] = ['min', 'max', 'value'];

/**
 * Type guard checking if an attribute name is one of the numeric year attributes.
 *
 * @param {string} name - The attribute name to check.
 * @returns {boolean} True when name is 'min', 'max', or 'value'.
 */
function isYearAttribute(name: string): name is YearAttribute {
  return name === 'min' || name === 'max' || name === 'value';
}

/**
 * Custom Web Component that provides interactive year navigation via forward/back buttons and dropdown select.
 *
 * @class YearSelector
 * @extends {HTMLElement}
 */
class YearSelector extends HTMLElement {
  min: number = 0;

  max: number = 0;

  value: number = 0;

  debounceDate: number;

  backButton: HTMLButtonElement;

  nextButton: HTMLButtonElement;

  selectElement: HTMLSelectElement;

  /**
   * Initializes the YearSelector component, attaches template clone, and binds DOM element references.
   */
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.append(yearTemplate.cloneNode(true));

    YEAR_ATTRIBUTES.forEach((id) => {
      this[id] = Number(this.getAttribute(id));
    });

    this.debounceDate = Date.now();

    this.backButton = shadow.getElementById('back') as HTMLButtonElement;
    this.nextButton = shadow.getElementById('next') as HTMLButtonElement;
    this.selectElement = shadow.getElementById('dropdown') as HTMLSelectElement;
    this.initEventListeners();
    this.update();
  }

  /**
   * Returns list of observed attributes to monitor for changes.
   *
   * @static
   * @returns {string[]} Array of attribute names.
   */
  static get observedAttributes(): string[] {
    return ['min', 'max', 'value'];
  }

  /**
   * Handles updates when an observed attribute changes, with debounce protection against re-entry loops.
   *
   * @param {string} name - The attribute name.
   * @param {string|null} _oldValue - The prior value.
   * @param {string|null} _newValue - The updated value.
   */
  attributeChangedCallback(name: string, _oldValue: string | null, _newValue: string | null): void {
    if (Date.now() - this.debounceDate < 10) return;

    if (isYearAttribute(name)) {
      this[name] = Number(this.getAttribute(name));
    }

    this.update();
  }

  // connectedCallback() {
  //   console.log('connected');
  // }

  // disconnectedCallback() {
  //   console.log('disconnected');
  // }

  /**
   * Synchronizes component state: enables/disables navigation buttons,
   * updates HTML attributes, renders slot text, and emits 'change' event.
   */
  update(): void {
    this.checkDisabled();
    this.debounceDate = Date.now();
    YEAR_ATTRIBUTES.forEach((id) => {
      this.setAttribute(id, String(this[id]));
    });
    const slot = this.shadowRoot?.querySelector<HTMLElement>('slot');
    if (slot) {
      slot.innerText = String(this.value);
    }
    this.dispatchEvent(new Event('change'));
  }

  /**
   * Increments the selected year value by 1 and updates the component.
   */
  next(): void {
    this.value++;
    this.update();
  }

  /**
   * Decrements the selected year value by 1 and updates the component.
   */
  back(): void {
    this.value--;
    this.update();
  }

  /**
   * Disables next/back navigation buttons when boundaries (max/min) are reached,
   * and refreshes dropdown options.
   */
  checkDisabled(): void {
    if (this.max === this.value) {
      this.nextButton.setAttribute('disabled', 'disabled');
    } else {
      this.nextButton.removeAttribute('disabled');
    }

    if (this.min === this.value) {
      this.backButton.setAttribute('disabled', 'disabled');
    } else {
      this.backButton.removeAttribute('disabled');
    }

    this.updateSelect();
  }

  /**
   * Rebuilds the <select> element's options from `max` down to `min` and sets current value.
   */
  updateSelect(): void {
    this.selectElement.innerHTML = '';
    for (let i = this.max; i >= this.min; i--) {
      const optionElement = document.createElement('option');
      optionElement.value = String(i);
      optionElement.innerText = String(i);
      this.selectElement.append(optionElement);
    }
    this.selectElement.value = String(this.value);
  }

  /**
   * Event handler when user selects a year from the dropdown element.
   */
  selectChanged(): void {
    this.value = Number(this.selectElement.value);
    this.update();
  }

  /**
   * Attaches click, change, hover, and focus event listeners to buttons and select element.
   */
  initEventListeners(): void {
    this.nextButton.addEventListener('click', this.next.bind(this));
    this.backButton.addEventListener('click', this.back.bind(this));
    this.selectElement.addEventListener('change', this.selectChanged.bind(this));
    this.selectElement.addEventListener('mouseover', () => {
      this.shadowRoot?.querySelector('slot')?.classList.add('hover');
    });
    this.selectElement.addEventListener('mouseout', () => {
      this.shadowRoot?.querySelector('slot')?.classList.remove('hover');
    });
    this.selectElement.addEventListener('focus', () => {
      this.shadowRoot?.querySelector('slot')?.classList.add('focus');
    });
    this.selectElement.addEventListener('blur', () => {
      this.shadowRoot?.querySelector('slot')?.classList.remove('focus');
    });
  }
}

/**
 * Registers the <year-selector> custom element definition.
 */
module.exports.init = (): void => {
  customElements.define('year-selector', YearSelector);
};
