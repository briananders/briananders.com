class CSRSquare extends HTMLElement {
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

  randomColor() {
    const randomRed = Math.floor(Math.random() * 256);
    const randomGreen = Math.floor(Math.random() * 256);
    const randomBlue = Math.floor(Math.random() * 256);

    return `rgb(${randomRed},${randomGreen},${randomBlue})`;
  }
}

module.exports.init = () => {
  customElements.define('csr-square', CSRSquare);
};
