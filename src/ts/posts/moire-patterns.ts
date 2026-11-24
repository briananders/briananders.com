const ready = require('../_modules/document-ready.ts');
const windowResize = require('../_modules/window-resize.ts');

let playing = false;
let direction = 0.1;

/**
 * Retrieves the client height of a given DOM element in pixels.
 *
 * @param {HTMLElement} element - Target DOM element.
 * @returns {number} Measured client height in pixels.
 */
function getHeight(element: HTMLElement): number {
  return element.clientHeight;
}

/**
 * Fills an element with horizontal line divs spaced according to line thickness.
 *
 * @param {HTMLElement} element - Target DOM element to populate.
 */
function fillWithLines(element: HTMLElement): void {
  const elementHeight = getHeight(element);
  const lineThickness = getLineThickness();
  element.style.setProperty('--height', String(elementHeight / lineThickness));
  element.innerHTML = '';

  for (let i = 0; i < elementHeight; i += getLineThickness() * 2) {
    const lineElement = document.createElement('div');
    lineElement.classList.add('line');
    element.appendChild(lineElement);
  }
}

/**
 * Reads the line thickness value from the thickness range slider.
 *
 * @returns {number} Line thickness value in pixels.
 */
function getLineThickness(): number {
  const thicknessElement = document.getElementById('thickness') as HTMLInputElement | null;

  return Number(thicknessElement ? thicknessElement.value : 0);
}

/**
 * Reads the current angle value from the rotation range slider.
 *
 * @returns {number} Rotation angle in degrees.
 */
function getRotation(): number {
  const rotationElement = document.getElementById('rotation') as HTMLInputElement | null;

  return Number(rotationElement ? rotationElement.value : 0);
}

/**
 * Sets the value of the rotation range slider.
 *
 * @param {number} value - The rotation angle in degrees.
 */
function setRotation(value: number): void {
  const rotationElement = document.getElementById('rotation') as HTMLInputElement | null;

  if (rotationElement) {
    rotationElement.value = String(value);
  }
}

/**
 * Synchronizes the display labels and canvas CSS custom properties with current thickness and rotation.
 */
function updateValues(): void {
  const thicknessValueElement = document.getElementById('thickness-value');
  const rotationValueElement = document.getElementById('rotation-value');
  const canvas = document.getElementById('canvas');

  if (!thicknessValueElement || !rotationValueElement || !canvas) {
    return;
  }

  const rotation = getRotation();
  const lineThickness = getLineThickness();

  thicknessValueElement.innerText = String(lineThickness);
  rotationValueElement.innerText = String(rotation);
  canvas.style.setProperty('--rotation', `${rotation}deg`);
  canvas.style.setProperty('--thickness', `${lineThickness}px`);
}

/**
 * Advances the rotation animation between 0 and 90 degrees and requests the next animation frame.
 */
function runLoop(): void {
  const rotation = getRotation();
  if (rotation >= 90 || rotation <= 0) {
    direction = 0 - direction;
  }

  if (playing) setRotation(rotation + direction);

  updateValues();

  if (playing) {
    window.requestAnimationFrame(runLoop);
  }
}

/**
 * Populates both the control and variant canvas elements with lines and runs the animation loop.
 */
function render(): void {
  const controlElement = document.getElementById('control');
  const variantElement = document.getElementById('variant');
  if (controlElement) {
    fillWithLines(controlElement);
  }
  if (variantElement) {
    fillWithLines(variantElement);
  }

  runLoop();
}

/**
 * Initializes the moiré pattern interactive demo and attaches event listeners on DOM ready.
 */
ready.document(() => {
  const playButton = document.getElementById('play-pause');
  const thicknessElement = document.getElementById('thickness');
  const rotationElement = document.getElementById('rotation');

  if (!playButton || !thicknessElement || !rotationElement) {
    return;
  }

  render();

  windowResize(() => {
    const playingTemp = playing;
    playing = false;
    render();
    playing = playingTemp;
  });

  playButton.addEventListener('click', () => {
    playing = !playing;
    // Class-driven icon: paused → `.play` (▶); playing → `.pause` (⏸).
    playButton.classList.toggle('play', !playing);
    playButton.classList.toggle('pause', playing);
    render();
  });

  thicknessElement.addEventListener('input', () => {
    const playingTemp = playing;
    playing = false;
    render();
    playing = playingTemp;
  });

  rotationElement.addEventListener('input', () => {
    const playingTemp = playing;
    playing = false;
    render();
    playing = playingTemp;
  });
});
