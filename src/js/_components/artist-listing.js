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

function formatNumber(number) {
  return Number(number).toLocaleString();
}

class ArtistListing extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = artistTemplate;
  }

  static get observedAttributes() {
    return attributes;
  }

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

module.exports.init = () => {
  apiImage.init();
  customElements.define('artist-listing', ArtistListing);
};
