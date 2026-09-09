/**
 * Custom element representing a single colored square tile used in
 * client-side rendering performance experiments.
 *
 * @class CSRSquare
 * @extends {HTMLElement}
 */
class CSRSquare extends HTMLElement {
  /**
   * Initializes the CSRSquare element, attaches shadow root, and injects styles
   * with a randomly generated background color.
   */
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
      <style>
        :host {
          width: 20px;
          height: 20px;
          background-color: magenta;
          float: left;
          margin-left: 10px;
          margin-top: 10px;
          display: block;
          border-radius: 3px;
          background-color: ${this.randomColor()}
        }
      </style>
    `;
  }

  /**
   * Returns list of observed attribute names for custom element lifecycle.
   *
   * @static
   * @returns {string[]} List of observed attribute names.
   */
  static get observedAttributes() {
    return [];
  }

  /**
   * Lifecycle callback invoked when an observed attribute is added, removed, or changed.
   *
   * @param {string} name - The name of the attribute that changed.
   * @param {string|null} oldValue - The previous value of the attribute.
   * @param {string|null} newValue - The new value of the attribute.
   */
  attributeChangedCallback(name, oldValue, newValue) {
    console.log('attributeChangedCallback');
  }

  /**
   * Lifecycle callback invoked when the element is appended into a document-connected tree.
   */
  connectedCallback() {
    console.log('connected');
  }

  /**
   * Lifecycle callback invoked when the element is disconnected from the document's DOM tree.
   */
  disconnectedCallback() {
    console.log('disconnected');
  }

  /**
   * Generates a random CSS RGB color string.
   *
   * @returns {string} Color string in `rgb(r, g, b)` format.
   */
  randomColor() {
    const randomRed = Math.floor(Math.random() * 256);
    const randomGreen = Math.floor(Math.random() * 256);
    const randomBlue = Math.floor(Math.random() * 256);

    return `rgb(${randomRed},${randomGreen},${randomBlue})`;
  }
}

/**
 * Registers the 'csr-square' custom element tag in the CustomElementRegistry.
 */
module.exports.init = () => {
  customElements.define('csr-square', CSRSquare);
};
