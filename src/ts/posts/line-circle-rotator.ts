const noAnimations = require('../_modules/no-animations.ts');
const ready = require('../_modules/document-ready.ts');

/**
 * Initializes the line-circle rotator interactive illusion on DOM ready.
 */
ready.document(() => {
  const maxSet = 8;

  /**
   * Generates and mounts 2^power rotating line and span elements evenly spaced around 180 degrees.
   *
   * @param {number} power - Exponent specifying total elements (2^power).
   */
  function a(power: number): void {
    const containerElement = document.querySelector<HTMLElement>('.circle')!;
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

  /**
   * Populates the select dropdown with powers of two (2 to 128) and binds change events to re-render.
   */
  function setUpSelect(): void {
    const select = document.getElementById('select') as HTMLSelectElement;
    for (let i = 1; i < maxSet; i++) {
      const option = document.createElement('option');
      option.value = String(i);
      option.text = String(2 ** i);
      select.options.add(option);
    }

    select.addEventListener('change', (evt) => {
      const target = evt.target as HTMLSelectElement;
      a(Number(target.value));
    });
  }

  setUpSelect();

  if (!noAnimations.areAnimationsDisabled) {
    a(1);
  }
});
