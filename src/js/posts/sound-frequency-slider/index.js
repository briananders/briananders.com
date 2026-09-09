/**
 * Immediately invoked function expression that initializes the sound frequency slider manager.
 */
(function soundSlider() {
  const Slider = require('./slider');
  const sliders = [];

  const scope = document.getElementById('slider-holder');

  /**
   * Instantiates and registers a new frequency Slider component within the container.
   *
   * @returns {void}
   */
  function addAnother() {
    sliders.push(new Slider(scope));
  }

  /**
   * Binds click event listener to the "add slider" button.
   *
   * @returns {void}
   */
  function addEventListeners() {
    scope.querySelector('button[value=add]').addEventListener('click', addAnother.bind(this));
  }

  addEventListeners();
  addAnother();
}());
