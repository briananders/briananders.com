const handlebars = require('handlebars');
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

function setCanvasDimensions() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}

function setCSS() {
  const template = `
      {{#each colors}}
        main-color[data-color={{name}}] {
          background-color: {{code}};
        }
        color-sample[data-color={{name}}] {
          background-color: {{code}};
        }
      {{/each}}
    `;

  const styleElement = document.createElement('style');
  const compiledHandlebars = handlebars.compile(template);
  const outputHTML = compiledHandlebars({ colors });
  styleElement.innerHTML = outputHTML;
  document.body.appendChild(styleElement);
}

function drawLine(x1, y1, x2, y2) {
  canvasContext.beginPath();
  canvasContext.strokeStyle = currentColor.code;
  canvasContext.stroke();
  canvasContext.lineWidth = diameter;
  canvasContext.moveTo(x1, y1);
  canvasContext.lineTo(x2, y2);
  canvasContext.stroke();
}

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

function drawOn(...args) {
  canDraw = true;
  draw(...args);
}

function drawOff() {
  canDraw = false;
}

function erase() {
  setCanvasDimensions();
}

function updateColor() {
  mainColor.dataset.color = currentColor.name;
}

function updateStroke() {
  mainStroke.dataset.stroke = Number(diameter);
  mainStroke.querySelector('span').innerHTML = `${diameter}px`;
  mainStroke.setAttribute('style', `--stroke: ${diameter}px`);
}

function updateSlider() {
  diameter = Number(escape(strokeSlider.value));
  updateStroke();
}

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
