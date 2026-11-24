const imageTemplate = `
  <picture>
    <source data-format="avif" type="image/avif" />
    <source data-format="webp" type="image/webp" />
    <img loading="lazy" decoding="async" />
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

interface ImageUrls {
  avif: string;
  webp: string;
  jpg: string;
}

/**
 * Parses an image source path to generate multi-format URL equivalents (avif, webp, jpg),
 * preserving any URL query parameters or hash suffixes.
 *
 * @param {string} src - The original image URL or relative file path.
 * @returns {ImageUrls} Generated URLs for avif, webp, and jpg formats.
 */
function getImageUrls(src: string): ImageUrls {
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
  static get observedAttributes(): string[] {
    return attributes;
  }

  /**
   * Lifecycle hook called when the element is connected to the DOM.
   * Populates initial template structure and synchronizes attributes.
   */
  connectedCallback(): void {
    if (!this.querySelector('img')) {
      this.innerHTML = imageTemplate;
    }
    this.updateImage();
    attributes
      .filter((attribute) => attribute !== 'src' && this.hasAttribute(attribute))
      .forEach((attribute) => {
        this.updateImageAttribute(attribute, this.getAttribute(attribute));
      });
  }

  /**
   * Handles updates when an observed attribute changes.
   *
   * @param {string} name - The attribute name.
   * @param {string|null} _oldValue - The prior value.
   * @param {string|null} newValue - The updated value.
   */
  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
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
  updateImage(): void {
    const src = this.getAttribute('src');
    const img = this.querySelector('img');
    const avifSource = this.querySelector<HTMLSourceElement>('[data-format="avif"]');
    const webpSource = this.querySelector<HTMLSourceElement>('[data-format="webp"]');

    if (!img || !avifSource || !webpSource) return;

    if (!src) {
      [avifSource, webpSource].forEach((source) => source.removeAttribute('srcset'));
      img.removeAttribute('src');
      return;
    }

    const urls = getImageUrls(src);
    avifSource.setAttribute('srcset', urls.avif);
    webpSource.setAttribute('srcset', urls.webp);
    img.setAttribute('src', urls.jpg);
  }

  /**
   * Propagates an HTML attribute (e.g. alt, width, height) down to the internal <img> element.
   *
   * @param {string} name - Attribute name.
   * @param {string|null} value - Attribute value, or null to remove the attribute.
   */
  updateImageAttribute(name: string, value: string | null): void {
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
module.exports.init = (): void => {
  if (!customElements.get('api-image')) {
    customElements.define('api-image', ApiImage);
  }
};
