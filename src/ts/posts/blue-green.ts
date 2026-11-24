const noAnimations = require('../_modules/no-animations.ts');
const ready = require('../_modules/document-ready.ts');

/**
 * Initializes the Blue-Green color boundary perception experiment.
 */
ready.document(() => {
  const {
    floor, min, max, random,
  } = Math;
  const { log } = require('../_modules/log.ts');
  const MAX_COLOR = 255;

  type ColorDirection = 'blue' | 'green';

  const canvas = document.getElementById('canvas') as HTMLElement;
  const blueButton = document.getElementById('blue-button') as HTMLElement;
  const greenButton = document.getElementById('green-button') as HTMLElement;
  const resetButton = document.getElementById('reset') as HTMLElement;
  const submitButton = document.getElementById('submit') as HTMLElement;
  const chartElement = document.getElementById('chart') as HTMLElement;
  const chartBlue = chartElement.querySelector<HTMLElement>('.blue')!;
  const chartGreen = chartElement.querySelector<HTMLElement>('.green')!;

  const buttonsElement = document.querySelector<HTMLElement>('.buttons')!;
  const revealElement = document.querySelector<HTMLElement>('.reveal')!;

  let colorDirection: ColorDirection | null = null;
  let step = 32;

  const colors = {
    red: 0,
    green: 0,
    blue: 0,
  };

  /**
   * Resets color channels to randomized initial values and resets step size to 32.
   */
  function reset(): void {
    colorDirection = null;
    step = 32;
    colors.green = floor((MAX_COLOR / 2) + (random() * (MAX_COLOR / 2)));
    colors.blue = floor((MAX_COLOR / 2) + (random() * (MAX_COLOR / 2)));
  }

  /**
   * Clamps color values to valid range [0, 255], applies background color to the canvas,
   * and renders the difference indicator gradient charts.
   */
  function updateColors(): void {
    colors.blue = max(min(colors.blue, MAX_COLOR), 0);
    colors.green = max(min(colors.green, MAX_COLOR), 0);

    canvas.style.backgroundColor = `rgb(${colors.red}, ${colors.green}, ${colors.blue})`;
    log(canvas.style.backgroundColor);

    let blueDiff: number;
    let greenDiff: number;

    if (colors.green < colors.blue) {
      blueDiff = colors.blue - colors.green;
      greenDiff = 0;
    } else {
      greenDiff = colors.green - colors.blue;
      blueDiff = 0;
    }

    // log({
    //   blueDiff,
    //   greenDiff,
    //   green: colors.green,
    //   blue: colors.blue,
    // });

    chartBlue.innerHTML = String(blueDiff);
    chartBlue.dataset.value = String(blueDiff);
    // eslint-disable-next-line @stylistic/max-len
    chartBlue.style.background = `linear-gradient(to left, blue 0%, blue ${blueDiff / 2}%, transparent ${blueDiff / 2}%)`;
    chartGreen.innerHTML = String(greenDiff);
    chartGreen.dataset.value = String(greenDiff);
    // eslint-disable-next-line @stylistic/max-len
    chartGreen.style.background = `linear-gradient(to right, green 0%, green ${greenDiff / 2}%, transparent ${greenDiff / 2}%)`;
  }

  /**
   * Halves the current search step size down to a minimum of 1.
   *
   * @param {number} currentStep - The current step increment.
   * @returns {number} The halved step value.
   */
  function halfStep(currentStep: number): number {
    return max(floor(currentStep / 2), 1);
  }

  /**
   * Tracks chosen color direction and reduces step size via binary search whenever the user reverses choice.
   *
   * @param {ColorDirection} color - The selected color ('blue' or 'green').
   */
  function setDirection(color: ColorDirection): void {
    if (colorDirection === null) {
      colorDirection = color;
    } else if (colorDirection !== color) {
      colorDirection = color;
      step = halfStep(step);
      log(`step size: ${step}`);
    }
  }

  /**
   * Adjusts color balance towards green when the user perceives the swatch as blue.
   */
  function moreGreen(): void {
    log('moreGreen()');

    if (colors.green >= MAX_COLOR && colors.blue >= MAX_COLOR) {
      colors.blue -= step;
    } else if (colors.green >= MAX_COLOR) {
      colors.blue -= step;
    } else {
      colors.green += step;
    }

    updateColors();
  }

  /**
   * Adjusts color balance towards blue when the user perceives the swatch as green.
   */
  function moreBlue(): void {
    log('moreBlue()');

    if (colors.blue >= MAX_COLOR && colors.green >= MAX_COLOR) {
      colors.green -= step;
    } else if (colors.blue >= MAX_COLOR) {
      colors.green -= step;
    } else {
      colors.blue += step;
    }

    updateColors();
  }

  blueButton.addEventListener('click', () => {
    setDirection('blue');
    moreGreen();
  });

  greenButton.addEventListener('click', () => {
    setDirection('green');
    moreBlue();
  });

  submitButton.addEventListener('click', () => {
    buttonsElement.style.display = 'none';
    revealElement.style.display = '';
  });

  resetButton.addEventListener('click', () => {
    buttonsElement.style.display = '';
    revealElement.style.display = 'none';
    reset();
    updateColors();
  });

  if (!noAnimations.areAnimationsDisabled) {
    reset();
    updateColors();
  }
});
