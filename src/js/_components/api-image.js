const imageTemplate = `
  <picture>
    <source data-format="avif" type="image/avif" />
    <source data-format="webp" type="image/webp" />
    <img />
  </picture>
`;

const attributes = [
  'src',
  'alt',
  'width',
  'height',
  'loading',
  'decoding',
  'sizes'
];

function getImageUrls(src) {
  const match = String(src).match(/^([^?#]*)([?#].*)?$/);
  const path = match ? match[1] : String(src);
  const suffix = match ? (match[2] || '') : '';
  const imageBase = path.replace(/\.(jpg|jpeg|png|webp|avif)$/i, '');

  return {
    avif: `${imageBase}.avif${suffix}`,
    webp: `${imageBase}.webp${suffix}`,
    jpg: `${imageBase}.jpg${suffix}`,
  };
}

class ApiImage extends HTMLElement {
  static get observedAttributes() {
    return attributes;
  }

  connectedCallback() {
    if (!this.querySelector('img')) {
      this.innerHTML = imageTemplate;
    }
    this.updateImage();
    attributes.filter((attribute) => attribute !== 'src').forEach((attribute) => {
      this.updateImageAttribute(attribute, this.getAttribute(attribute));
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'src') {
      this.updateImage();
      return;
    }

    this.updateImageAttribute(name, newValue);
  }

  updateImage() {
    const src = this.getAttribute('src');
    const img = this.querySelector('img');
    const sources = {
      avif: this.querySelector('[data-format="avif"]'),
      webp: this.querySelector('[data-format="webp"]'),
    };

    if (!img || !sources.avif || !sources.webp) return;

    if (!src) {
      Object.values(sources).forEach((source) => source.removeAttribute('srcset'));
      img.removeAttribute('src');
      return;
    }

    const urls = getImageUrls(src);
    sources.avif.setAttribute('srcset', urls.avif);
    sources.webp.setAttribute('srcset', urls.webp);
    img.setAttribute('src', urls.jpg);
  }

  updateImageAttribute(name, value) {
    const img = this.querySelector('img');
    if (!img) return;

    if (value === null) {
      img.removeAttribute(name);
    } else {
      img.setAttribute(name, value);
    }
  }
}

module.exports.init = () => {
  if (!customElements.get('api-image')) {
    customElements.define('api-image', ApiImage);
  }
};
