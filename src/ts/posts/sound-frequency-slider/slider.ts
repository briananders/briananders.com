import type { SoundInstance } from '../../_modules/sound.ts';

interface TonesModule {
  numberOfScales: number;
  order: string[];
  hertz: Record<string, number>;
  labels: Record<string, string>;
}

interface SoundSliderWindow extends Window {
  soundSlider: string;
}

interface SliderElements {
  select?: HTMLSelectElement;
  'play-pause'?: HTMLButtonElement | null;
  slider?: HTMLInputElement | null;
  input?: HTMLInputElement | null;
  remove?: HTMLButtonElement | null;
}

type SoundConstructor = new () => SoundInstance;

/**
 * Creates an interactive sound frequency slider controller with playback and tone presets.
 *
 * @param {HTMLElement} parent - Container element where this slider component will be appended.
 */
module.exports = function Slider(parent: HTMLElement): void {
  let scope!: HTMLElement;
  const Sound = require('../../_modules/sound.ts') as SoundConstructor;
  /*
    tones.numberOfScales
    tones.order
    tones.hertz
    tones.labels
  */
  const tones = require('../../_modules/tones.ts') as TonesModule;
  const sound = new Sound();
  const DEFAULT_TONE = 'C4';
  const DEFAULT_HERTZ = tones.hertz[DEFAULT_TONE];

  const events = {
    removeMeEvent: new Event('remove'),
  };

  const elements: SliderElements = {};

  let hertz: Array<number | string> = [DEFAULT_HERTZ];

  let mouseDownOnSlider = false;

  /**
   * Stops audio playback, dispatches removal event, and removes the component element from the DOM.
   *
   * @returns {void}
   */
  function removeMe(): void {
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
  function watchSlider(): void {
    if (elements.slider) {
      hertz.push(elements.slider.value);
    }
    if (mouseDownOnSlider) {
      setTimeout(watchSlider, 100);
    }
  }

  /**
   * Sets up event listeners for inputs, dropdowns, remove button, and play/pause toggle.
   *
   * @returns {void}
   */
  function setupEventListeners(): void {
    const {
      remove,
      slider,
      input,
      select,
    } = elements;
    const playPause = elements['play-pause'];

    if (remove) {
      remove.addEventListener('click', removeMe);
    }
    if (slider) {
      slider.addEventListener('mousedown', () => {
        mouseDownOnSlider = true;
        watchSlider();
      });
    }
    ['mouseup', 'mouseleave', 'mouseout'].forEach((activity) => {
      document.documentElement.addEventListener(activity, () => {
        mouseDownOnSlider = false;
      });
    });
    if (input) {
      input.addEventListener('change', () => {
        hertz.push(input.value);
      });
    }
    if (select) {
      select.addEventListener('change', () => {
        hertz.push(select.value);
      });
    }
    if (playPause) {
      playPause.addEventListener('click', () => {
        if (sound.isPlaying()) {
          // Now paused → show the play icon (▶) via the .play class.
          playPause.classList.remove('pause');
          playPause.classList.add('play');
          sound.stop();
        } else {
          // Now playing → show the pause icon (⏸) via the .pause class.
          playPause.classList.remove('play');
          playPause.classList.add('pause');
          sound.start();
        }
      });
    }
  }

  /**
   * Updates Web Audio oscillator frequency and synchronizes input/slider visual values.
   *
   * @returns {void}
   */
  function renderUpdatedValues(): void {
    const currentFrequency = Number(hertz[0]);
    const frequencyString = String(currentFrequency);
    sound.setFrequency(currentFrequency);
    if (elements.input && elements.input.value !== frequencyString) {
      elements.input.value = frequencyString;
    }
    if (elements.slider && elements.slider.value !== frequencyString) {
      elements.slider.value = frequencyString;
    }
  }

  /**
   * Calculates dynamic padding dashes between tone note labels and frequency values for alignment.
   *
   * @param {string} startLabel - Leading note name label.
   * @param {string} endLabel - Trailing frequency string.
   * @returns {string} String of dash characters.
   */
  function labelDashes(startLabel: string, endLabel: string): string {
    const numberOfStartDashes = 8 - startLabel.length;
    const startDashes = new Array<string>(numberOfStartDashes).fill('-').join('');
    const numberOfEndDashes = 4 - endLabel.split('.')[0].length;
    const endDashes = new Array<string>(numberOfEndDashes).fill('-').join('');
    return startDashes + endDashes;
  }

  /**
   * Generates and populates the tone preset select dropdown options across all musical scales.
   *
   * @returns {void}
   */
  function addToneSelect(): void {
    const selectEl = document.createElement('select');
    elements.select = selectEl;
    scope.appendChild(selectEl);

    const optionElements: HTMLOptionElement[] = [];

    for (let scale = 0; scale < tones.numberOfScales; scale++) {
      tones.order.forEach((tone) => {
        const toneKey = `${tone}${scale}`;
        const label = `${scale} ${tones.labels[tone]}`;
        const toneHertz = tones.hertz[toneKey];
        const optionElement = document.createElement('option');
        optionElement.value = String(toneHertz);
        optionElement.innerHTML = `${label} ${labelDashes(label, `${toneHertz}`)} ${toneHertz}`;

        if (toneKey === DEFAULT_TONE) {
          optionElement.selected = true;
        }

        optionElements.push(optionElement);
      });
    }

    optionElements.sort((a, b) => (Number(a.value) > Number(b.value) ? -1 : 1)).forEach((optionElement) => {
      selectEl.appendChild(optionElement);
    });
  }

  /**
   * Polling loop that processes frequency change queues and updates visual/audio state.
   *
   * @returns {void}
   */
  function runLoop(): void {
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
  function buildAndRender<T = void>(callback: () => T = (() => undefined) as () => T): T {
    const { soundSlider: template } = window as unknown as SoundSliderWindow;
    const doc = new DOMParser().parseFromString(template, 'text/html');
    scope = doc.body.firstChild as HTMLElement;
    parent.appendChild(scope);

    addToneSelect();

    elements['play-pause'] = scope.querySelector<HTMLButtonElement>('button.play-pause');
    elements.slider = scope.querySelector<HTMLInputElement>('input.hertz-slider');
    elements.input = scope.querySelector<HTMLInputElement>('input.hertz-input');
    elements.remove = scope.querySelector<HTMLButtonElement>('button[value=remove]');

    if (elements.slider) {
      elements.slider.value = String(DEFAULT_HERTZ);
    }
    if (elements.input) {
      elements.input.value = String(DEFAULT_HERTZ);
    }

    return callback();
  }

  /**
   * Initializes slider component lifecycle, template rendering, and event bindings.
   *
   * @returns {void}
   */
  function init(): void {
    buildAndRender(setupEventListeners);
    runLoop();

    hertz.push(DEFAULT_HERTZ);
  }

  init();
};
