const noAnimations = require('../_modules/no-animations');
const ready = require('../_modules/document-ready');

ready.document(() => {
  const maxSet = 8;

  function a(power) {
    const containerElement = document.querySelector('.circle');
    containerElement.innerHTML = '';

    const setLength = 2 ** power;
    const setStep = 180 / setLength;
    const duration = 2000 / setLength;

    for (let set = 0; set < setLength; set++) {
      const angle = set * setStep;
      const delay = set * duration;
      const span = document.createElement('span');
      const line = document.createElement('line');
      // span.style.animationDelay = `${delay}ms`;
      span.style.setProperty('--animation-delay', `${delay}ms`);
      line.style.setProperty('--animation-delay', `${delay}ms`);
      line.style.setProperty('transform', `translate(-50%,-50%) rotate(${angle}deg)`);
      span.style.setProperty('transform', `translate(-50%,-50%) rotate(${angle}deg)`);

      containerElement.appendChild(span);
      containerElement.appendChild(line);
    }
  }

  function setUpSelect() {
    const select = document.getElementById('select');
    for (let i = 1; i < maxSet; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.text = 2 ** i;
      select.options.add(option);
    }

    select.addEventListener('change', (evt) => {
      a(Number(evt.target.value));
    });
  }

  setUpSelect();

  if (!noAnimations.areAnimationsDisabled) {
    a(1);
  }
});
