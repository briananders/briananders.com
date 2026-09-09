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

/**
 * Parses an image source path to generate multi-format URL equivalents (avif, webp, jpg),
 * preserving any URL query parameters or hash suffixes.
 *
 * @param {string} src - The original image URL or relative file path.
 * @returns {{avif: string, webp: string, jpg: string}} Generated URLs for avif, webp, and jpg formats.
 */
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

/**
 * Custom Web Component for rendering responsive <picture> elements with AVIF and WebP source fallbacks.
 *
 * @class ApiImage
 * @extends {HTMLElement}
 */
class ApiImage extends HTMLElement {
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
   * Lifecycle hook called when the element is connected to the DOM.
   * Populates initial template structure and synchronizes attributes.
   */
  connectedCallback() {
    if (!this.querySelector('img')) {
      this.innerHTML = imageTemplate;
    }
    this.updateImage();
    attributes.filter((attribute) => attribute !== 'src').forEach((attribute) => {
      this.updateImageAttribute(attribute, this.getAttribute(attribute));
    });
  }

  /**
   * Handles updates when an observed attribute changes.
   *
   * @param {string} name - The attribute name.
   * @param {string|null} oldValue - The prior value.
   * @param {string|null} newValue - The updated value.
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'src') {
      this.updateImage();
      return;
    }

    this.updateImageAttribute(name, newValue);
  }

  /**
   * Updates the srcset of <source> elements and src of the <img> element
   * based on the current 'src' attribute.
   */
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

  /**
   * Propagates an HTML attribute (e.g. alt, width, height) down to the internal <img> element.
   *
   * @param {string} name - Attribute name.
   * @param {string|null} value - Attribute value, or null to remove the attribute.
   */
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

/**
 * Defines the custom element <api-image> if not already registered.
 */
module.exports.init = () => {
  if (!customElements.get('api-image')) {
    customElements.define('api-image', ApiImage);
  }
};
