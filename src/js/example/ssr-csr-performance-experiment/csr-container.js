/**
 * Custom element container that renders a large number of csr-square elements
 * inside a shadow DOM for client-side rendering performance benchmarking.
 *
 * @class CSRContainer
 * @extends {HTMLElement}
 */
class CSRContainer extends HTMLElement {
  /**
   * Initializes the CSRContainer element, attaches an open shadow root,
   * and populates it with host styles and 1,000 <csr-square> elements.
   */
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
    <style>
      :host {
        overflow: hidden;
        display: block;
      }
    </style>

    ${new Array(1000).fill('<csr-square></csr-square>').join('')}`;
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
}

/**
 * Registers the 'csr-container' custom element tag in the CustomElementRegistry.
 */
module.exports.init = () => {
  customElements.define('csr-container', CSRContainer);
};
