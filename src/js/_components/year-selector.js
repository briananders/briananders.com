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

/**
 * Custom Web Component that provides interactive year navigation via forward/back buttons and dropdown select.
 *
 * @class YearSelector
 * @extends {HTMLElement}
 */
class YearSelector extends HTMLElement {
  /**
   * Initializes the YearSelector component, attaches template clone, and binds DOM element references.
   */
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.append(yearTemplate.cloneNode(true));

    ['min', 'max', 'value'].forEach((id) => {
      this[id] = Number(this.getAttribute(id));
    });

    this.debounceDate = Date.now();

    this.backButton = shadow.getElementById('back');
    this.nextButton = shadow.getElementById('next');
    this.selectElement = shadow.getElementById('dropdown');
    this.initEventListeners();
    this.update();
  }

  /**
   * Returns list of observed attributes to monitor for changes.
   *
   * @static
   * @returns {string[]} Array of attribute names.
   */
  static get observedAttributes() {
    return ['min', 'max', 'value'];
  }

  /**
   * Handles updates when an observed attribute changes, with debounce protection against re-entry loops.
   *
   * @param {string} name - The attribute name.
   * @param {string|null} oldValue - The prior value.
   * @param {string|null} newValue - The updated value.
   */
  attributeChangedCallback(name, oldValue, newValue) {
    // console.log(name, oldValue, newValue);

    if (Date.now() - this.debounceDate < 10) return;

    if (['min', 'max', 'value'].includes(name)) {
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
  update() {
    this.checkDisabled();
    this.debounceDate = Date.now();
    ['min', 'max', 'value'].forEach((id) => {
      this.setAttribute(id, this[id]);
    });
    this.shadowRoot.querySelector('slot').innerText = this.value;
    this.dispatchEvent(new Event('change'));
  }

  /**
   * Increments the selected year value by 1 and updates the component.
   */
  next() {
    this.value++;
    this.update();
  }

  /**
   * Decrements the selected year value by 1 and updates the component.
   */
  back() {
    this.value--;
    this.update();
  }

  /**
   * Disables next/back navigation buttons when boundaries (max/min) are reached,
   * and refreshes dropdown options.
   */
  checkDisabled() {
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
  updateSelect() {
    this.selectElement.innerHTML = '';
    for (let i = this.max; i >= this.min; i--) {
      const optionElement = document.createElement('option');
      optionElement.value = i;
      optionElement.innerText = i;
      this.selectElement.append(optionElement);
    }
    this.selectElement.value = this.value;
  }

  /**
   * Event handler when user selects a year from the dropdown element.
   */
  selectChanged() {
    this.value = Number(this.selectElement.value);
    this.update();
  }

  /**
   * Attaches click, change, hover, and focus event listeners to buttons and select element.
   */
  initEventListeners() {
    this.nextButton.addEventListener('click', this.next.bind(this));
    this.backButton.addEventListener('click', this.back.bind(this));
    this.selectElement.addEventListener('change', this.selectChanged.bind(this));
    this.selectElement.addEventListener('mouseover', () => {
      this.shadowRoot.querySelector('slot').classList.add('hover');
    });
    this.selectElement.addEventListener('mouseout', () => {
      this.shadowRoot.querySelector('slot').classList.remove('hover');
    });
    this.selectElement.addEventListener('focus', () => {
      this.shadowRoot.querySelector('slot').classList.add('focus');
    });
    this.selectElement.addEventListener('blur', () => {
      this.shadowRoot.querySelector('slot').classList.remove('focus');
    });
  }
}

/**
 * Registers the <year-selector> custom element definition.
 */
module.exports.init = () => {
  customElements.define('year-selector', YearSelector);
};
