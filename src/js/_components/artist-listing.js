const artistTemplate = `
  <style>
    a {
      color: inherit;
      text-decoration: none;
      display: grid;
      grid-template-columns: 90px 1fr;
      gap: 12px;
      border-radius: 3px;
      outline: none;
      padding: 6px;

      transition-duration: var(--transition-speed);
      transition-timing-function: var(--transition-timing);

      transition-property: box-shadow, background-color;
    }
    a:focus {
      box-shadow: 0px 0px 0px 2px var(--palette--primary-grey), 0px 0px 0px 4px var(--palette--secondary-grey);
    }
    a:hover {
      background-color: var(--palette--hover-grey);
    }
    #bar {
      width: 0%;
      max-width: 100%;
      height: 12px;
      border-radius: 3px;
      background: linear-gradient(to left, var(--palette--primary-color-light), var(--palette--primary-color-dark));
      margin-top: 6px;

      transition-duration: var(--transition-speed);
      transition-timing-function: var(--transition-timing);

      transition-property: width;
    }
    img {
      display: block;
      width: 90px;
    }
    slot {
      font-size: 24px;
      display: block;
      margin-bottom: 12px;
      font-family: "Roboto", sans-serif;
      font-weight: 500;
    }
    span.info {
      padding-top: 6px;
      display: block;
    }
  </style>

  <a href="#" itemprop="url" rel="noopener" target="blank">
    <img src="" alt="" />
    <span class="info">
      <slot>Loading...</slot>
      <div><span slot="count">00</span> Plays</div>
      <div id="bar" style="--length: 100%"></div>
    </span>
  </a>
`;

const attributes = ['name', 'count', 'max', 'img'];

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
      this.shadowRoot.querySelector(`[slot="${name}"]`).innerText = newValue;
    }
    if (['count', 'max'].includes(name)) {
      const count = Number(this.getAttribute('count'));
      const max = Number(this.getAttribute('max'));

      const length = count / max * 100;
      this.shadowRoot.getElementById('bar').style.width = `${length}%`;
    }
    if (name === 'name') {
      const imgElement = this.shadowRoot.querySelector('img');
      imgElement.setAttribute('alt', newValue);
      this.shadowRoot.querySelector('a').setAttribute('href', `https://www.last.fm/music/${newValue.replace(/\s/g, '+')}`);
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
  customElements.define('artist-listing', ArtistListing);
};
