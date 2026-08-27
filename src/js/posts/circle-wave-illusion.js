const ready = require('../_modules/document-ready');

ready.document(() => {
  const triggerButton = document.getElementById('animate-trigger');
  const circleContainer = document.querySelector('.circle-container');
  const slider = document.querySelector('input[type="range"]');

  const getSliderValue = () => {
    const value = Number(slider.value);
    circleContainer.style.setProperty('--duration', `${value}s`);
  };

  triggerButton.addEventListener('click', () => {
    circleContainer.classList.toggle('animate');
    triggerButton.classList.toggle('play');
  });

  slider.addEventListener('input', getSliderValue);

  getSliderValue();
});
