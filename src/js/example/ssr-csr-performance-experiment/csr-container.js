class CSRContainer extends HTMLElement {
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

  static get observedAttributes() {
    return [];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    console.log('attributeChangedCallback');
  }

  connectedCallback() {
    console.log('connected');
  }

  disconnectedCallback() {
    console.log('disconnected');
  }
}

module.exports.init = () => {
  customElements.define('csr-container', CSRContainer);
};
