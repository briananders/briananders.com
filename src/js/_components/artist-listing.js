const { dasherize } = require('underscore.string');

const apiImage = require('./api-image');
const artistListingStyles = require('./artist-listing.scss');

const artistTemplate = `
  <style>${artistListingStyles}</style>

  <a href="#" itemprop="url" rel="noopener" target="blank">
    <api-image></api-image>
    <span class="info">
      <slot>Loading...</slot>
      <div><span slot="count">00</span> Plays</div>
      <div id="bar" style="--length: 100%"></div>
    </span>
  </a>
`;

const attributes = ['name', 'count', 'max', 'img'];

/**
 * Formats a number with locale-specific thousand separators.
 *
 * @param {number|string} number - The numeric value to format.
 * @returns {string} Formatted number string.
 */
function formatNumber(number) {
  return Number(number).toLocaleString();
}

/**
 * Custom Web Component for displaying artist listing items with relative play count bars and image artwork.
 *
 * @class ArtistListing
 * @extends {HTMLElement}
 */
class ArtistListing extends HTMLElement {
  /**
   * Initializes the ArtistListing component and attaches the shadow DOM.
   */
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = artistTemplate;
  }

  /**
   * Returns list of observed attributes to monitor for changes.
   *
   * @static
   * @returns {string[]} Array of attribute names.
   */
  static get observedAttributes() {
    return attributes;
  }

  /**
   * Handles lifecycle updates when an observed attribute changes.
   *
   * @param {string} name - The attribute name.
   * @param {string|null} oldValue - The prior value.
   * @param {string|null} newValue - The updated value.
   */
  attributeChangedCallback(name, oldValue, newValue) {
    // console.log(name, oldValue, newValue);
    if (['count'].includes(name)) {
      this.shadowRoot.querySelector(`[slot="${name}"]`).innerText = formatNumber(newValue);
    }
    if (['count', 'max'].includes(name)) {
      const count = Number(this.getAttribute('count'));
      const max = Number(this.getAttribute('max'));

      const length = (count / max) * 100;
      this.shadowRoot.getElementById('bar').style.width = `${length}%`;
    }
    if (name === 'name') {
      const imageElement = this.shadowRoot.querySelector('api-image');
      const artistName = newValue || '';
      imageElement.setAttribute('alt', artistName);
      this.shadowRoot.querySelector('a').setAttribute('href', `?trends=artists/${dasherize(artistName.trim().toLowerCase())}`);
    }
    if (name === 'img') {
      const imageElement = this.shadowRoot.querySelector('api-image');
      if (!newValue) {
        imageElement.removeAttribute('src');
        return;
      }
      imageElement.setAttribute('src', newValue);
    }
  }

  // connectedCallback() {
  //   console.log('connected');
  // }

  // disconnectedCallback() {
  //   console.log('disconnected');
  // }
}

/**
 * Registers the <artist-listing> custom element and initializes dependency components.
 */
module.exports.init = () => {
  apiImage.init();
  customElements.define('artist-listing', ArtistListing);
};
