const albumTemplate = document.createElement("album-template");
albumTemplate.innerHTML = `
  <style>
    a {
      color: inherit;
      text-decoration: none;
      display: grid;
      grid-template-columns: 90px 1fr;
      gap: 12px;
    }
    #bar {
      width: 0%;
      height: 10px;
      border-radius: 3px;
      background: linear-gradient(to left, #f57f17, #cd4800);
      transition: width 300ms ease;
    }
    img {
      display: block;
      width: 90px;
    }
    slot {
      font-family: "Roboto", sans-serif;
      font-weight: 500;
    }
    @key-frames slide-animation {
      0% {
        width: 0%;
      }
      100% {
        width: var(--length, 0%);
      }
    }
  </style>

  <a href="" itemprop="url" rel="noopener" target="blank">
    <img src="" alt="" />
    <span class="info">
      <slot>Loading Album Name...</slot>
      <div slot="artist">Loading Artist Name...</div>
      <div><span slot="count">00</span> Plays</div>
      <div id="bar" style="--length: 100%"></div>
    </span>
  </a>
`;

const attributes = ["name", "artist", "count", "max", 'img'];

class AlbumListing extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.append(albumTemplate.cloneNode(true));
  }

  static get observedAttributes() {
    return attributes;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // console.log(name, oldValue, newValue);
    if (name === "name") {
      this.shadowRoot.querySelector(`slot`).innerText = newValue;
    }
    if (['count', 'artist'].includes(name)) {
      this.shadowRoot.querySelector(`[slot="${name}"]`).innerText = newValue;
    }
    if (['count', 'max'].includes(name)) {
      const count = Number(this.getAttribute('count'));
      const max = Number(this.getAttribute('max'));

      const length = count / max * 100;
      this.shadowRoot.getElementById('bar').style.width = `${length}%`;
    }
    if (["name", 'artist'].includes(name)) {
      const albumName = this.getAttribute('name');
      const artistName = this.getAttribute('artist') || "";
      this.shadowRoot.querySelector('a').setAttribute('href', `https://www.last.fm/music/${artistName.replace(/\s/g, '+')}/${albumName.replace(/\s/g, '+')}`);

      const imgElement = this.shadowRoot.querySelector('img');
      imgElement.setAttribute('alt', albumName);
    }
    if (name === "img") {
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