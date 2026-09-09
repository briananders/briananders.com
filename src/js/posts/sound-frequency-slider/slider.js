/**
 * Creates an interactive sound frequency slider controller with playback and tone presets.
 *
 * @param {HTMLElement} parent - Container element where this slider component will be appended.
 */
module.exports = function Slider(parent) {
  let scope;
  const Sound = require('../../_modules/sound');
  /*
    tones.numberOfScales
    tones.order
    tones.hertz
    tones.labels
  */
  const tones = require('../../_modules/tones');
  const sound = new Sound();
  const DEFAULT_TONE = 'C4';
  const DEFAULT_HERTZ = tones.hertz[DEFAULT_TONE];

  const events = {
    removeMeEvent: new Event('remove'),
  };

  const elements = {};

  let hertz = [DEFAULT_HERTZ];

  let mouseDownOnSlider = false;

  /**
   * Stops audio playback, dispatches removal event, and removes the component element from the DOM.
   *
   * @returns {void}
   */
  function removeMe() {
    sound.stop();
    parent.dispatchEvent(events.removeMeEvent);
    scope.style.display = 'none';
    setTimeout(() => {
      scope.outerHTML = '';
    }, 250);
  }

  /**
   * Continuously samples slider values while user is holding mouse button down on the slider.
   *
   * @returns {void}
   */
  function watchSlider() {
    hertz.push(elements.slider.value);
    if (mouseDownOnSlider) {
      setTimeout(watchSlider, 100);
    }
  }

  /**
   * Sets up event listeners for inputs, dropdowns, remove button, and play/pause toggle.
   *
   * @returns {void}
   */
  function setupEventListeners() {
    elements.remove.addEventListener('click', removeMe);
    elements.slider.addEventListener('mousedown', () => {
      mouseDownOnSlider = true;
      watchSlider();
    });
    ['mouseup', 'mouseleave', 'mouseout'].forEach((activity) => {
      document.documentElement.addEventListener(activity, () => {
        mouseDownOnSlider = false;
      });
    });
    elements.input.addEventListener('change', () => {
      hertz.push(elements.input.value);
    });
    elements.select.addEventListener('change', () => {
      hertz.push(elements.select.value);
    });
    elements['play-pause'].addEventListener('click', () => {
      const btn = elements['play-pause'];
      if (sound.isPlaying()) {
        // Now paused → show the play icon (▶) via the .play class.
        btn.classList.remove('pause');
        btn.classList.add('play');
        sound.stop();
      } else {
        // Now playing → show the pause icon (⏸) via the .pause class.
        btn.classList.remove('play');
        btn.classList.add('pause');
        sound.start();
      }
    });
  }

  /**
   * Updates Web Audio oscillator frequency and synchronizes input/slider visual values.
   *
   * @returns {void}
   */
  function renderUpdatedValues() {
    const currentFrequency = hertz[0];
    sound.setFrequency(currentFrequency);
    if (elements.input.value !== currentFrequency) {
      elements.input.value = currentFrequency;
    }
    if (elements.slider.value !== currentFrequency) {
      elements.slider.value = currentFrequency;
    }
  }

  /**
   * Calculates dynamic padding dashes between tone note labels and frequency values for alignment.
   *
   * @param {string} startLabel - Leading note name label.
   * @param {string} endLabel - Trailing frequency string.
   * @returns {string} String of dash characters.
   */
  function labelDashes(startLabel, endLabel) {
    const numberOfStartDashes = 8 - startLabel.length;
    const startDashes = new Array(numberOfStartDashes).fill('-').join('');
    const numberOfEndDashes = 4 - endLabel.split('.')[0].length;
    const endDashes = new Array(numberOfEndDashes).fill('-').join('');
    return startDashes + endDashes;
  }

  /**
   * Generates and populates the tone preset select dropdown options across all musical scales.
   *
   * @returns {void}
   */
  function addToneSelect() {
    elements.select = document.createElement('select');
    scope.appendChild(elements.select);

    const optionElements = [];

    for (let scale = 0; scale < tones.numberOfScales; scale++) {
      tones.order.forEach((tone) => {
        const optionElement = document.createElement('option');
        optionElement.value = tones.hertz[`${tone}${scale}`];
        optionElement.innerHTML = `${scale} ${tones.labels[tone]} ${labelDashes(`${scale} ${tones.labels[tone]}`, `${tones.hertz[`${tone}${scale}`]}`)} ${tones.hertz[`${tone}${scale}`]}`;

        if (`${tone}${scale}` === DEFAULT_TONE) {
          optionElement.selected = 'selected';
        }

        optionElements.push(optionElement);
      });
    }

    optionElements.sort((a, b) => (Number(a.value) > Number(b.value) ? -1 : 1)).forEach((optionElement) => {
      elements.select.appendChild(optionElement);
    });
  }

  /**
   * Polling loop that processes frequency change queues and updates visual/audio state.
   *
   * @returns {void}
   */
  function runLoop() {
    if (hertz.length > 1) {
      hertz = [Number(hertz[hertz.length - 1])];
      renderUpdatedValues();
    }
    setTimeout(runLoop, 100);
  }

  /**
   * Parses HTML template, renders component into parent DOM, and captures DOM element references.
   *
   * @param {Function} [callback=() => {}] - Callback executed after markup is appended to the DOM.
   * @returns {*} Return value of the callback.
   */
  function buildAndRender(callback = () => {}) {
    const doc = new DOMParser().parseFromString(window.soundSlider, 'text/html');
    scope = doc.body.firstChild;
    parent.appendChild(scope);

    addToneSelect();

    elements['play-pause'] = scope.querySelector('button.play-pause');
    elements.slider = scope.querySelector('input.hertz-slider');
    elements.input = scope.querySelector('input.hertz-input');
    elements.remove = scope.querySelector('button[value=remove]');

    elements.slider.value = DEFAULT_HERTZ;
    elements.input.value = DEFAULT_HERTZ;

    return callback();
  }

  /**
   * Initializes slider component lifecycle, template rendering, and event bindings.
   *
   * @returns {void}
   */
  function init() {
    buildAndRender(setupEventListeners);
    runLoop();

    hertz.push(DEFAULT_HERTZ);
  }

  init();
};
