const ready = require('../_modules/document-ready');
const windowResize = require('../_modules/window-resize');

/**
 * Manages an individual color channel moiré pattern canvas, controls, and rotation animation.
 */
class Variant {

  #playing;
  #direction;

  #elementPlayButton;
  #elementRotationValue;
  #elementRotationSlider;
  #elementCanvas;

  /**
   * Retrieves the current client height in pixels of the canvas element.
   *
   * @private
   * @returns {number} Pixel height of the canvas container.
   */
  #getHeight() {
    return this.#elementCanvas.clientHeight;
  }

  /**
   * Reads the current rotation angle value from the range slider.
   *
   * @private
   * @returns {number} Rotation angle in degrees.
   */
  #getRotation() {
    return Number(this.#elementRotationSlider.value);
  }

  /**
   * Updates the range slider value.
   *
   * @private
   * @param {number} value - The rotation angle in degrees.
   */
  #setRotation(value) {
    this.#elementRotationSlider.value = value;
  }

  /**
   * Updates the text display and CSS variable `--rotation` to reflect the current angle.
   *
   * @private
   */
  #updateValues() {
    const rotation = this.#getRotation();

    this.#elementRotationValue.innerText = rotation;
    this.#elementCanvas.style.setProperty('--rotation', `${rotation}deg`);
  }

  /**
   * Advances the rotation angle back and forth between 0 and 90 degrees and schedules animation frames.
   *
   * @private
   */
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

  /**
   * Attaches event listeners for play/pause toggling, window resize, and slider input.
   *
   * @private
   */
  #addEventListener() {
    this.#elementPlayButton.addEventListener('click', () => {
      this.#playing = !this.#playing;

      // Class-driven icon: `.play` = paused (button shows ▶ meaning
      // "click to play"), `.pause` = playing (button shows ⏸ meaning
      // "click to pause"). See system/classes/_elements.scss.
      this.#elementPlayButton.classList.toggle('play', !this.#playing);
      this.#elementPlayButton.classList.toggle('pause', this.#playing);

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

  /**
   * Fills the container element with alternating line divs based on its measured pixel height.
   *
   * @private
   * @param {HTMLElement} element - The canvas container to populate.
   */
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

  /**
   * Re-populates lines in the canvas and executes the animation loop.
   */
  render() {
    this.#fillWithLines(this.#elementCanvas);

    this.#runLoop();
  }

  /**
   * Constructs a Variant instance for a color channel moiré pattern.
   *
   * @param {Object} options - Configuration options.
   * @param {HTMLElement} options.controllerElement - The container element holding the UI controls.
   * @param {HTMLElement} options.variantCanvasElement - The DOM container representing the pattern canvas.
   * @param {number} [options.speed=1] - Rotation step speed multiplier.
   */
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

/**
 * Initializes moiré color channel variants (red, green, blue) on DOM ready.
 */
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
