const noAnimations = require('../_modules/no-animations');
const ready = require('../_modules/document-ready');

ready.document(() => {
  const {
    floor, min, max, random,
  } = Math;
  const { log } = require('../_modules/log');
  const MAX_COLOR = 255;

  const canvas = document.getElementById('canvas');
  const blueButton = document.getElementById('blue-button');
  const greenButton = document.getElementById('green-button');
  const resetButton = document.getElementById('reset');
  const submitButton = document.getElementById('submit');
  const chartElement = document.getElementById('chart');
  const chartBlue = chartElement.querySelector('.blue');
  const chartGreen = chartElement.querySelector('.green');

  const buttonsElement = document.querySelector('.buttons');
  const revealElement = document.querySelector('.reveal');

  let colorDirection;
  let step;

  const colors = {
    red: 0,
    green: 0,
    blue: 0,
  };

  function reset() {
    colorDirection = null;
    step = 32;
    colors.green = floor((MAX_COLOR / 2) + (random() * (MAX_COLOR / 2)));
    colors.blue = floor((MAX_COLOR / 2) + (random() * (MAX_COLOR / 2)));
  }

  function updateColors() {
    colors.blue = max(min(colors.blue, MAX_COLOR), 0);
    colors.green = max(min(colors.green, MAX_COLOR), 0);

    canvas.style.backgroundColor = `rgb(${colors.red}, ${colors.green}, ${colors.blue})`;
    log(canvas.style.backgroundColor);

    let blueDiff = 0;
    let greenDiff = 0;

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

    chartBlue.innerHTML = blueDiff;
    chartBlue.dataset.value = blueDiff;
    chartBlue.style.background = `linear-gradient(to left, blue 0%, blue ${blueDiff / 2}%, transparent ${blueDiff / 2}%)`;
    chartGreen.innerHTML = greenDiff;
    chartGreen.dataset.value = greenDiff;
    chartGreen.style.background = `linear-gradient(to right, green 0%, green ${greenDiff / 2}%, transparent ${greenDiff / 2}%)`;
  }

  function halfStep(currentStep) {
    return max(floor(currentStep / 2), 1);
  }

  function setDirection(color) {
    if (colorDirection === null) {
      colorDirection = color;
    } else if (colorDirection !== color) {
      colorDirection = color;
      step = halfStep(step);
      log(`step size: ${step}`);
    }
  }

  function moreGreen() {
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

  function moreBlue() {
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
    revealElement.style.display = null;
  });

  resetButton.addEventListener('click', () => {
    buttonsElement.style.display = null;
    revealElement.style.display = 'none';
    reset();
    updateColors();
  });

  if (!noAnimations.areAnimationsDisabled) {
    reset();
    updateColors();
  }
});
