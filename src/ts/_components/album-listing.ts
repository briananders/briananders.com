const { dasherize } = require('underscore.string');

const apiImage = require('./api-image.ts');
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
 * @param {number|string|null} number - The numeric value to format.
 * @returns {string} Formatted number string.
 */
function formatNumber(number: number | string | null): string {
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
  static get observedAttributes(): string[] {
    return attributes;
  }

  /**
   * Handles lifecycle updates when an observed attribute changes.
   *
   * @param {string} name - The name of the attribute that changed.
   * @param {string|null} _oldValue - Previous value of the attribute.
   * @param {string|null} newValue - New value of the attribute.
   */
  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    const { shadowRoot } = this;
    if (!shadowRoot) return;

    if (name === 'name') {
      const slot = shadowRoot.querySelector<HTMLElement>('slot');
      if (slot) slot.innerText = newValue || '';
    }
    if (['artist'].includes(name)) {
      const slot = shadowRoot.querySelector<HTMLElement>(`[slot="${name}"]`);
      if (slot) slot.innerText = newValue || '';
    }
    if (['count'].includes(name)) {
      const slot = shadowRoot.querySelector<HTMLElement>(`[slot="${name}"]`);
      if (slot) slot.innerText = formatNumber(newValue);
    }
    if (['count', 'max'].includes(name)) {
      const count = Number(this.getAttribute('count'));
      const max = Number(this.getAttribute('max'));

      const length = (count / max) * 100;
      const bar = shadowRoot.getElementById('bar');
      if (bar) bar.style.width = `${length}%`;
    }
    if (['name', 'artist'].includes(name)) {
      const albumName = this.getAttribute('name') || '';
      const artistName = this.getAttribute('artist') || '';
      const artist = dasherize(artistName.trim().toLowerCase());
      const album = dasherize(albumName.trim().toLowerCase());
      const anchor = shadowRoot.querySelector('a');
      if (anchor) {
        anchor.setAttribute('href', `?trends=albums/${artist}/${album}`);
      }

      const imageElement = shadowRoot.querySelector('api-image');
      if (imageElement) {
        imageElement.setAttribute('alt', `${albumName} album cover`);
      }
    }
    if (name === 'img') {
      const imageElement = shadowRoot.querySelector('api-image');
      if (!imageElement) return;
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
module.exports.init = (): void => {
  apiImage.init();
  customElements.define('album-listing', AlbumListing);
};
