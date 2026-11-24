const ready = require('../_modules/document-ready.ts');

/**
 * Initializes the circle wave illusion controls, setting up the play/pause trigger
 * and animation duration slider on DOM ready.
 */
ready.document(() => {
  const triggerButton = document.getElementById('animate-trigger') as HTMLElement;
  const circleContainer = document.querySelector<HTMLElement>('.circle-container')!;
  const slider = document.querySelector<HTMLInputElement>('input[type="range"]')!;

  /**
   * Reads the current range slider value and updates the CSS custom property `--duration`
   * on the circle container element to adjust wave speed.
   */
  const getSliderValue = (): void => {
    const value = Number(slider.value);
    circleContainer.style.setProperty('--duration', `${value}s`);
  };

  /**
   * Handles click events on the trigger button to toggle play/pause state
   * and update UI button icon classes.
   */
  triggerButton.addEventListener('click', () => {
    const nowPlaying = circleContainer.classList.toggle('animate');
    // Class-driven icon: paused → `.play` (▶); playing → `.pause` (⏸).
    triggerButton.classList.toggle('play', !nowPlaying);
    triggerButton.classList.toggle('pause', nowPlaying);
  });

  slider.addEventListener('input', getSliderValue);

  getSliderValue();
});
