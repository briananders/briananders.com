const { dasherize } = require('underscore.string');

const apiImage = require('./api-image');
const albumListingStyles = require('./album-listing.scss');

const albumTemplate = `
  <style>${albumListingStyles}</style>

  <a href="#" itemprop="url" rel="noopener" target="blank">
    <api-image></api-image>
    <span class="info">
      <slot>Loading Album Name...</slot>
      <div slot="artist">Loading Artist Name...</div>
      <div><span slot="count">00</span> Plays</div>
      <div id="bar" style="--length: 100%"></div>
    </span>
  </a>
`;

const attributes = ['name', 'artist', 'count', 'max', 'img'];

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
 * Custom Web Component for displaying album listing item with play count progress bar and artwork.
 *
 * @class AlbumListing
 * @extends {HTMLElement}
 */
class AlbumListing extends HTMLElement {
  /**
   * Initializes the AlbumListing instance and attaches shadow DOM.
   */
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = albumTemplate;
  }

  /**
   * Returns list of observed attributes to trigger attributeChangedCallback.
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
   * @param {string} name - The name of the attribute that changed.
   * @param {string|null} oldValue - Previous value of the attribute.
   * @param {string|null} newValue - New value of the attribute.
   */
  attributeChangedCallback(name, oldValue, newValue) {
    // console.log(name, oldValue, newValue);
    if (name === 'name') {
      this.shadowRoot.querySelector('slot').innerText = newValue;
    }
    if (['artist'].includes(name)) {
      this.shadowRoot.querySelector(`[slot="${name}"]`).innerText = newValue;
    }
    if (['count'].includes(name)) {
      this.shadowRoot.querySelector(`[slot="${name}"]`).innerText = formatNumber(newValue);
    }
    if (['count', 'max'].includes(name)) {
      const count = Number(this.getAttribute('count'));
      const max = Number(this.getAttribute('max'));

      const length = (count / max) * 100;
      this.shadowRoot.getElementById('bar').style.width = `${length}%`;
    }
    if (['name', 'artist'].includes(name)) {
      const albumName = this.getAttribute('name') || '';
      const artistName = this.getAttribute('artist') || '';
      this.shadowRoot.querySelector('a').setAttribute('href', `?trends=albums/${dasherize(artistName.trim().toLowerCase())}/${dasherize(albumName.trim().toLowerCase())}`);

      const imageElement = this.shadowRoot.querySelector('api-image');
      imageElement.setAttribute('alt', `${albumName} album cover`);
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
 * Registers the <album-listing> custom element definition and initializes child dependencies.
 */
module.exports.init = () => {
  apiImage.init();
  customElements.define('album-listing', AlbumListing);
};
