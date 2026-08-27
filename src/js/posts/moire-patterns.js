const ready = require('../_modules/document-ready');
const windowResize = require('../_modules/window-resize');

let playing = false;
let direction = 0.1;

function getHeight(element) {
  return element.clientHeight;
}

function fillWithLines(element) {
  const elementHeight = getHeight(element);
  const lineThickness = getLineThickness();
  element.style.setProperty('--height', elementHeight / lineThickness);
  element.innerHTML = '';

  for (let i = 0; i < elementHeight; i += getLineThickness() * 2) {
    const lineElement = document.createElement('div');
    lineElement.classList.add('line');
    element.appendChild(lineElement);
  }
}

function getLineThickness() {
  const thicknessElement = document.getElementById('thickness');

  return Number(thicknessElement.value);
}

function getRotation() {
  const rotationElement = document.getElementById('rotation');

  return Number(rotationElement.value);
}

function setRotation(value) {
  const rotationElement = document.getElementById('rotation');

  rotationElement.value = value;
}

function updateValues() {
  const thicknessValueElement = document.getElementById('thickness-value');
  const rotationValueElement = document.getElementById('rotation-value');
  const canvas = document.getElementById('canvas');

  const rotation = getRotation();
  const lineThickness = getLineThickness();

  thicknessValueElement.innerText = lineThickness;
  rotationValueElement.innerText = rotation;
  canvas.style.setProperty('--rotation', `${rotation}deg`);
  canvas.style.setProperty('--thickness', `${lineThickness}px`);
}

function runLoop() {
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

function render() {
  const controlElement = document.getElementById('control');
  const variantElement = document.getElementById('variant');
  fillWithLines(controlElement);
  fillWithLines(variantElement);

  runLoop();
}

ready.document(() => {
  const playButton = document.getElementById('play-pause');
  const thicknessElement = document.getElementById('thickness');
  const rotationElement = document.getElementById('rotation');

  render();

  windowResize(() => {
    const playingTemp = playing;
    playing = false;
    render();
    playing = playingTemp;
  });

  playButton.addEventListener('click', () => {
    playing = !playing;

    if (playing) {
      playButton.classList.add('play');
    } else {
      playButton.classList.remove('play');
    }

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
