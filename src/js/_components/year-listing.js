const inView = require('../_modules/in-view');

const yearTemplate = `
  <style>
    a {
      display: grid;
      grid-template-columns: 50px 1fr;
      text-decoration: none;
      color: white;
      border-radius: 3px;
      outline: none;

      transition-duration: var(--transition-speed);
      transition-timing-function: var(--transition-timing);

      transition-property: background-color;
    }
    a:focus {
      box-shadow: 0px 0px 0px 2px var(--palette--primary-grey), 0px 0px 0px 4px var(--palette--secondary-grey);
    }
    a:hover {
      background-color: var(--palette--hover-grey);
    }

    .bar {
      display: flex;
      width: var(--bar-width, 1%);
      height: 24px;
      background-color: var(--palette--primary-color-light);
      background: linear-gradient(to right, var(--palette--primary-color-dark), var(--palette--primary-color-light));
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      overflow: hidden;
      border-radius: 3px;
      align-items: center;

      transition-duration: var(--transition-speed);
      transition-timing-function: var(--transition-timing);

      transition-property: width;
    }

    .bar slot {
      color: black;
      text-shadow: 0 1px 1px white;
      position: absolute;
      right: 0;
      margin-right: 5px;
    }

    .bar-container {
      display: block;
      width: 100%;
      overflow: hidden;
      position: relative;
    }

    slot {
      margin-left: 5px;
      display: inline;
      font-family: "Roboto", sans-serif;
      font-size: 14px;
      font-weight: 700;
      display: block;
    }
  </style>

  <a href="" aria-label="" itemprop="url" rel="noopener" target="blank">
    <span slot="year">2000</span>
    <span class="bar-container">
      <span class="bar">
        <slot>0</slot>
      </span>
    </span>
  </a>
`;

const attributes = ['year', 'value', 'maximum'];

class YearListing extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = yearTemplate;
    this.value = 0;

    this.barElement = this.shadowRoot.querySelector('.bar');
  }

  static get observedAttributes() {
    return attributes;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.barElement = this.shadowRoot.querySelector('.bar');

    // console.log(name, oldValue, newValue);
    if (name === 'value') {
      this.animateToValue(newValue);
    }
    if (name === 'year') {
      this.shadowRoot.querySelector(`[slot="${name}"]`).innerText = newValue;
      this.shadowRoot.querySelector('a').setAttribute('href', `https://www.last.fm/user/imbanders/library/artists?from=${newValue}-01-01&rangetype=year`);
    }
    if (['year', 'value'].includes(name)) {
      const year = this.getAttribute('year');
      const value = this.getAttribute('value');
      this.shadowRoot.querySelector('a').setAttribute('aria-label', `${value} scrobbles in the year ${year}`);
    }
  }

  animateToValue(value) {
    const oldValue = this.value;
    const valueDiff = value - oldValue;

    const duration = 2000;
    const startTime = Date.now();

    const slotElement = this.shadowRoot.querySelector('slot');

    function formatNumber(num) {
      const rounded = Math.round(num);
      const thousands = Math.floor(rounded / 1000);
      const digits = `000${Math.floor(rounded % 1000)}`;
      return `${thousands},${digits.substring(digits.length - 3, digits.length)}`;
    }

    function run() {
      const now = Date.now();
      const runningValue = ((now - startTime) / duration) * valueDiff;
      slotElement.innerHTML = formatNumber(runningValue + oldValue);

      if (now <= (startTime + duration)) {
        requestAnimationFrame(run);
      } else {
        slotElement.innerHTML = formatNumber(value);
      }
    }
    run();
  }

  updateWidth() {
    const { barElement } = this;
    const maximum = Number(this.getAttribute('maximum') || 1);
    const value = Number(this.getAttribute('value') || 0);

    setTimeout(() => {
      barElement.style.setProperty('--bar-width', `${value / maximum * 100}%`);
    }, 1);
  }

  connectedCallback() {
    inView(this.barElement, this.updateWidth.bind(this), {
      rootMargin: '-70px 0px -20px 0px',
    });
  }

  // disconnectedCallback() {
  //   console.log('disconnected');
  // }
}

module.exports.init = () => {
  customElements.define('year-listing', YearListing);
};
