const yearTemplate = document.createElement("year-template");
yearTemplate.innerHTML = `
<style>
  div {
    display: block;
    min-height: 28px;
    position: relative;
  }
  slot {
    display: inline-block;
    border: 1px solid #f57f17;
    border-radius: 4px;
    padding: 0 6px;
    height: 22px;
    line-height: 24px;
    font-size: 18px;
    width: 50px;
    text-align: center;
  }
  select {
    position: absolute;
    left: 39px;
    width: 65px;
    height: 25px;
    opacity: 0;
  }
  button {
    appearance: none;
    border: 1px solid;
    color: #f57f17;
    background: none;
    border-radius: 4px;
    height: 24px;
    width: 36px;
    line-height: 20px;
    font-size: 18px;
    cursor: pointer;
  }
  button:disabled,
  button:disabled:hover {
    color: grey;
    cursor: unset;
  }
  button:hover {
    color: white;
  }
</style>

<div>
  <button id="back">&#9204;</button>
  <slot>2022</slot>
  <button id="next">&#9205;</button>
  <select id="dropdown"></select>
</div>
`;

class YearSelector extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.append(yearTemplate.cloneNode(true));

    ["min", "max", "value"].forEach((id) => {
      this[id] = Number(this.getAttribute(id));
    });

    this.debounceDate = 1;

    this.backButton = shadow.getElementById('back');
    this.nextButton = shadow.getElementById('next');
    this.selectElement = shadow.getElementById('dropdown');
    this.initEventListeners();
    this.update();
  }

  static get observedAttributes() {
    return ["min", "max", "value"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // console.log(name, oldValue, newValue);

    if(Date.now() - this.debounceDate < 10) return;

    if (["min", "max", "value"].includes(name)) {
      this[name] = Number(this.getAttribute(name));
    }

    this.update();
  }

  // connectedCallback() {
  //   console.log('connected');
  // }

  // disconnectedCallback() {
  //   console.log('disconnected');
  // }

  update() {
    this.checkDisabled();
    this.debounceDate = Date.now();
    ["min", "max", "value"].forEach((id) => {
      this.setAttribute(id, this[id]);
    });
    this.shadowRoot.querySelector('slot').innerText = this.value;
    this.dispatchEvent(new Event('change'));
  }

  next() {
    this.value++;
    this.update();
  }

  back() {
    this.value--;
    this.update();
  }

  checkDisabled() {
    if (this.max === this.value) {
      this.nextButton.setAttribute('disabled', 'disabled');
    } else {
      this.nextButton.removeAttribute('disabled');
    }

    if (this.min === this.value) {
      this.backButton.setAttribute('disabled', 'disabled');
    } else {
      this.backButton.removeAttribute('disabled');
    }

    this.updateSelect();
  }

  updateSelect() {
    this.selectElement.innerHTML = "";
    for (let i = this.max; i >= this.min; i--) {
      const optionElement = document.createElement('option');
      optionElement.value = i;
      optionElement.innerText = i;
      this.selectElement.append(optionElement);
    }
    this.selectElement.value = this.value;
  }

  selectChanged() {
    this.value = Number(this.selectElement.value);
    this.update();
  }

  initEventListeners() {
    this.nextButton.addEventListener('click', this.next.bind(this));
    this.backButton.addEventListener('click', this.back.bind(this));
    this.selectElement.addEventListener('change', this.selectChanged.bind(this));
  }
}

module.exports.init = () => {
  customElements.define('year-selector', YearSelector);
};