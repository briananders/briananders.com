const { dasherize } = require('underscore.string');

const artistListingStyles = require('./artist-listing.scss');

const artistTemplate = `
  <style>${artistListingStyles}</style>

  <a href="#" itemprop="url" rel="noopener" target="blank">
    <span class="info">
      <slot>Loading...</slot>
      <div><span slot="count">00</span> Plays</div>
      <div id="bar" style="--length: 100%"></div>
    </span>
    <picture>
      <source data-format="avif" type="image/avif" />
      <source data-format="webp" type="image/webp" />
      <img src="" alt="" />
    </picture>
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
      const imgElement = this.shadowRoot.querySelector('img');
      const artistName = newValue || '';
      imgElement.setAttribute('alt', artistName);
      this.shadowRoot.querySelector('a').setAttribute('href', `?trends=artists/${dasherize(artistName.trim().toLowerCase())}`);
    }
    if (name === 'img') {
      const imgElement = this.shadowRoot.querySelector('img');
      const avifElement = this.shadowRoot.querySelector('[data-format="avif"]');
      const webpElement = this.shadowRoot.querySelector('[data-format="webp"]');
      if (!newValue) {
        avifElement.removeAttribute('srcset');
        webpElement.removeAttribute('srcset');
        imgElement.removeAttribute('src');
        return;
      }
      const imageBase = newValue.replace(/\.(jpg|jpeg|png|webp|avif)([?#].*)?$/, '');
      avifElement.setAttribute('srcset', `${imageBase}.avif`);
      webpElement.setAttribute('srcset', `${imageBase}.webp`);
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
  customElements.define('artist-listing', ArtistListing);
};
