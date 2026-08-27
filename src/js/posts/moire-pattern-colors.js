const ready = require('../_modules/document-ready');
const windowResize = require('../_modules/window-resize');

class Variant {

  #playing;
  #direction;

  #elementPlayButton;
  #elementRotationValue;
  #elementRotationSlider;
  #elementCanvas;

  #getHeight() {
    return this.#elementCanvas.clientHeight;
  }

  #getRotation() {
    return Number(this.#elementRotationSlider.value);
  }

  #setRotation(value) {
    this.#elementRotationSlider.value = value;
  }

  #updateValues() {
    const rotation = this.#getRotation();

    this.#elementRotationValue.innerText = rotation;
    this.#elementCanvas.style.setProperty('--rotation', `${rotation}deg`);
  }

  #runLoop() {
    const rotation = this.#getRotation();
    if (rotation >= 90 || rotation <= 0) {
      this.#direction = 0 - this.#direction;
    }

    if (this.#playing) this.#setRotation(rotation + this.#direction);

    this.#updateValues();

    if (this.#playing) {
      window.requestAnimationFrame(this.#runLoop.bind(this));
    }
  }

  #addEventListener() {
    this.#elementPlayButton.addEventListener('click', () => {
      this.#playing = !this.#playing;

      if (this.#playing) {
        this.#elementPlayButton.classList.add('play');
      } else {
        this.#elementPlayButton.classList.remove('play');
      }

      this.render();
    });

    windowResize(() => {
      const playing = this.#playing;
      this.#playing = false;
      this.render();
      this.#playing = playing;
    });
    this.#elementRotationSlider.addEventListener('input', () => {
      const playing = this.#playing;
      this.#playing = false;
      this.render();
      this.#playing = playing;
    });
  }

  #fillWithLines(element) {
    const elementHeight = this.#getHeight();
    element.style.setProperty('--height', elementHeight);
    element.innerHTML = '';

    for (let i = 0; i < elementHeight; i += 2) {
      const lineElement = document.createElement('div');
      lineElement.classList.add('line');
      element.appendChild(lineElement);
    }
  }

  render() {
    this.#fillWithLines(this.#elementCanvas);

    this.#runLoop();
  }

  constructor({
    controllerElement,
    variantCanvasElement,
    speed = 1,
  }) {
    this.#playing = false;
    this.#direction = 0.1 * speed;

    this.#elementPlayButton = controllerElement.querySelector('button.play-pause');
    this.#elementRotationValue = controllerElement.querySelector('.rotation-value');
    this.#elementRotationSlider = controllerElement.querySelector('input[type=range]');
    this.#elementCanvas = variantCanvasElement;

    this.#addEventListener();
    this.render();
  }
}

ready.document(() => {
  const colors = ['red', 'green', 'blue'];
  const instances = colors.map((color, index) =>
    new Variant({
      controllerElement: document.querySelector(`[data-controller=${color}]`),
      variantCanvasElement: document.getElementById(`variant-${color}`),
      speed: index + 1,
    })
  );
});
