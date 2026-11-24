type SliderConstructor = new (parent: HTMLElement) => Record<string, unknown>;

/**
 * Immediately invoked function expression that initializes the sound frequency slider manager.
 */
(function soundSlider() {
  const Slider = require('./slider.ts') as SliderConstructor;
  const sliders: Array<Record<string, unknown>> = [];

  const scope = document.getElementById('slider-holder');
  if (!scope) {
    return;
  }

  /**
   * Instantiates and registers a new frequency Slider component within the container.
   *
   * @returns {void}
   */
  function addAnother(): void {
    sliders.push(new Slider(scope!));
  }

  /**
   * Binds click event listener to the "add slider" button.
   *
   * @returns {void}
   */
  function addEventListeners(): void {
    const addButton = scope!.querySelector<HTMLButtonElement>('button[value=add]');
    if (addButton) {
      addButton.addEventListener('click', addAnother);
    }
  }

  addEventListeners();
  addAnother();
}());
