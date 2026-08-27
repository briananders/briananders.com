const { dasherize } = require('underscore.string');

const albumListingStyles = require('./album-listing.scss');

const albumTemplate = `
  <style>${albumListingStyles}</style>

  <a href="#" itemprop="url" rel="noopener" target="blank">
    <img src="" alt="" />
    <span class="info">
      <slot>Loading Album Name...</slot>
      <div slot="artist">Loading Artist Name...</div>
      <div><span slot="count">00</span> Plays</div>
      <div id="bar" style="--length: 100%"></div>
    </span>
  </a>
`;

const attributes = ['name', 'artist', 'count', 'max', 'img'];

function formatNumber(number) {
  return Number(number).toLocaleString();
}

class AlbumListing extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = albumTemplate;
  }

  static get observedAttributes() {
    return attributes;
  }

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
      const albumName = this.getAttribute('name');
      const artistName = this.getAttribute('artist') || '';
      this.shadowRoot.querySelector('a').setAttribute('href', `?trends=albums/${dasherize(artistName.trim().toLowerCase())}/${dasherize(albumName.trim().toLowerCase())}`);

      const imgElement = this.shadowRoot.querySelector('img');
      imgElement.setAttribute('alt', `${albumName} album cover`);
    }
    if (name === 'img') {
      const imgElement = this.shadowRoot.querySelector('img');
      imgElement.setAttribute('src', newValue);
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
  customElements.define('album-listing', AlbumListing);
};
