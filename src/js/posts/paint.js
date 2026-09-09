const { log } = require('../_modules/log');
const ready = require('../_modules/document-ready');
const windowResize = require('../_modules/window-resize');

const colors = [
  {
    name: 'black',
    code: 'black',
  },
  {
    name: 'white',
    code: 'white',
  },
  {
    name: 'grey',
    code: 'grey',
  },
  {
    name: 'red',
    code: 'red',
  },
  {
    name: 'orange',
    code: 'orange',
  },
  {
    name: 'yellow',
    code: 'yellow',
  },
  {
    name: 'green',
    code: 'green',
  },
  {
    name: 'blue',
    code: 'blue',
  },
  {
    name: 'indigo',
    code: 'indigo',
  },
  {
    name: 'violet',
    code: 'violet',
  },
  {
    name: 'nest-blue',
    code: '#00afd8',
  },
  {
    name: 'olive',
    code: 'olive',
  },
  {
    name: 'light-green',
    code: '#a1d800',
  },
  {
    name: 'burnt-orange',
    code: '#d88300',
  },
  {
    name: 'hot-pink',
    code: '#d800b2',
  },
  {
    name: 'light-purple',
    code: '#af00d8',
  },
  {
    name: 'purple',
    code: '#7d00d8',
  }
];

const canvas = document.getElementById('canvas');
const canvasContext = canvas.getContext('2d');
const mainStroke = document.querySelector('main-stroke');
const strokeSlider = document.getElementById('stroke-slider');
const mainColor = document.querySelector('main-color');
const shapePalette = document.querySelector('.shape-palette');
let currentColor = colors[0];
let diameter = strokeSlider.value;
let canDraw = false;
let shape = 'circle';

/**
 * Updates canvas coordinate width and height to match its rendered client dimensions.
 *
 * @returns {void}
 */
function setCanvasDimensions() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}

/**
 * Generates and injects dynamic CSS rules to style color swatches and the active color indicator.
 *
 * @returns {void}
 */
function setCSS() {
  const cssRules = colors
    .map((color) => `
        main-color[data-color="${color.name}"] {
          background-color: ${color.code};
        }
        color-sample[data-color="${color.name}"] {
          background-color: ${color.code};
        }
      `)
    .join('\n');

  const styleElement = document.createElement('style');
  styleElement.innerHTML = cssRules;
  document.body.appendChild(styleElement);
}

/**
 * Draws a stroke connecting the previous coordinate pair to the current coordinate pair.
 *
 * @param {number} x1 - Starting X coordinate.
 * @param {number} y1 - Starting Y coordinate.
 * @param {number} x2 - Ending X coordinate.
 * @param {number} y2 - Ending Y coordinate.
 * @returns {void}
 */
function drawLine(x1, y1, x2, y2) {
  canvasContext.beginPath();
  canvasContext.strokeStyle = currentColor.code;
  canvasContext.stroke();
  canvasContext.lineWidth = diameter;
  canvasContext.moveTo(x1, y1);
  canvasContext.lineTo(x2, y2);
  canvasContext.stroke();
}

/**
 * Renders the selected brush shape (circle or square) at the specified canvas coordinates.
 *
 * @param {number} [x=1] - Center X coordinate for the brush mark.
 * @param {number} [y=1] - Center Y coordinate for the brush mark.
 * @returns {void}
 */
function addCircle(x = 1, y = 1) {
  const radius = diameter / 2;

  canvasContext.beginPath();
  if (shape === 'square') {
    canvasContext.rect(x - radius, y - radius, diameter, diameter, false);
  } else {
    canvasContext.arc(x, y, radius, 0, 2 * Math.PI, false);
  }

  canvasContext.fillStyle = currentColor.code;

  canvasContext.fill();

  canvasContext.closePath();
}

/**
 * Draws connecting lines and brush shapes across the mouse delta if drawing is active.
 *
 * @param {Object} options - Mouse event offset and movement values.
 * @param {number} options.offsetX - Current X coordinate relative to canvas.
 * @param {number} options.movementX - X displacement since last move event.
 * @param {number} options.offsetY - Current Y coordinate relative to canvas.
 * @param {number} options.movementY - Y displacement since last move event.
 * @returns {void}
 */
function draw({
  offsetX,
  movementX,
  offsetY,
  movementY,
}) {
  if (canDraw) {
    drawLine(offsetX - movementX, offsetY - movementY, offsetX, offsetY);
    addCircle(offsetX, offsetY);
  }
}

/**
 * Activates drawing state and renders initial stroke marks.
 *
 * @param {...*} args - Arguments forwarded to `draw()`.
 * @returns {void}
 */
function drawOn(...args) {
  canDraw = true;
  draw(...args);
}

/**
 * Deactivates drawing state when pointer interaction ends.
 *
 * @returns {void}
 */
function drawOff() {
  canDraw = false;
}

/**
 * Clears canvas contents by resetting its coordinate dimensions.
 *
 * @returns {void}
 */
function erase() {
  setCanvasDimensions();
}

/**
 * Updates the data-color attribute on the main color indicator element.
 *
 * @returns {void}
 */
function updateColor() {
  mainColor.dataset.color = currentColor.name;
}

/**
 * Updates stroke indicator labels and CSS custom property for the current brush diameter.
 *
 * @returns {void}
 */
function updateStroke() {
  mainStroke.dataset.stroke = Number(diameter);
  mainStroke.querySelector('span').innerHTML = `${diameter}px`;
  mainStroke.setAttribute('style', `--stroke: ${diameter}px`);
}

/**
 * Handles slider adjustments by parsing the input value and updating stroke attributes.
 *
 * @returns {void}
 */
function updateSlider() {
  diameter = Number(escape(strokeSlider.value));
  updateStroke();
}

/**
 * Creates color swatch elements for the palette and binds selection click handlers.
 *
 * @returns {void}
 */
function setupColorSamples() {
  const colorPalette = document.querySelector('.color-palette');

  colors.forEach(({ name, code }) => {
    const colorSample = document.createElement('color-sample');
    colorSample.classList.add('color');
    colorSample.dataset.color = name;
    colorPalette.appendChild(colorSample);
    colorSample.addEventListener('click', () => {
      currentColor = { name, code };
      updateColor();
    }, false);
  });
}

/**
 * Registers all user interaction handlers for canvas drawing, resize, slider, and palette controls.
 *
 * @returns {void}
 */
function addEventListeners() {
  windowResize(erase.bind(this));

  canvas.addEventListener('mousedown', drawOn, false);
  canvas.addEventListener('mousemove', draw, false);
  document.documentElement.addEventListener('mouseup', drawOff, false);

  strokeSlider.addEventListener('input', updateSlider.bind(this));

  shapePalette.querySelectorAll('input').forEach((element) => {
    element.addEventListener('change', (evt) => {
      log(evt.target.value, evt.target.checked);
      if (evt.target.checked) {
        shape = evt.target.value;
      }
    });
  });

  setupColorSamples();
}

ready.all(() => {
  setCanvasDimensions();
  addEventListeners();
  updateColor();
  updateStroke();
  setCSS();
});
