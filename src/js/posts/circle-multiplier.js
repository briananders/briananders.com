const ready = require('../_modules/document-ready');
const windowResize = require('../_modules/window-resize');

const { log } = require('../_modules/log');

let canvasContext;
let canvas;
let circles = [];
let borderStyle;
let alphaBorder;
let fillStyle;
let alphaFill;
let fastSlow;
let clearButton;
let eraseButton;
let paused = true;
let pauseButton;

const randomVelocity = () => (Math.random() - 0.5) * ((Math.random() * 5) + 1);
const minMax = (value) => Math.max(Math.min(value, 6), -6);

function newCircle(x, y, radius, xVelocity, yVelocity) {
  if (circles.length > 2 ** 10) {
    // log(`circles exceed limit. ${circles.length}/1000`);
    return circles.length;
  }

  const circle = new Circle(x, y);
  circle.setRadius(radius);

  const newXVelocity = minMax(xVelocity + randomVelocity());
  const newYVelocity = minMax(yVelocity + randomVelocity());

  circle.setVelocity(newXVelocity, newYVelocity);

  circles.push(circle);
}

function ColorObject() {
  function randomColor() {
    const color = Math.floor(Math.random() * 128);
    return color + 128;
  }

  const alpha = Math.random();
  const red = randomColor();
  const green = randomColor();
  const blue = randomColor();
  const average = Math.floor((red + green + blue) / 3);

  this.alpha = alpha;
  this.rgb = () => `rgba(${red},${green},${blue},${this.alpha})`;
  this.gray = () => `rgba(${average},${average},${average},${this.alpha})`;
  this.random = () => `rgba(${randomColor()},${randomColor()},${randomColor()},${this.alpha})`;
  this.resetAlpha = () => {
    this.alpha = alpha;
  };
}

// Circle Class
function Circle(x = 1, y = 1) {
  // size
  let radius = Math.floor(5 + (Math.random() * 100));

  // color
  const fill = new ColorObject();
  const border = new ColorObject();

  // velocity
  let xVelocity = randomVelocity();
  let yVelocity = randomVelocity();

  this.draw = () => {
    canvasContext.beginPath();
    canvasContext.arc(x, y, radius, 0, 2 * Math.PI, false);

    switch (fillStyle.value) {
      case 'no-fill':
        canvasContext.fillStyle = 'rgba(0,0,0,0)';
        break;
      case 'fill-gray':
        canvasContext.fillStyle = fill.gray();
        break;
      case 'fill-color':
        canvasContext.fillStyle = fill.rgb();
        break;
      case 'epileptic':
        canvasContext.fillStyle = fill.random();
        break;
      default:
    }

    canvasContext.fill();

    if (borderStyle.value !== 'no-border') {
      canvasContext.lineWidth = '1px';

      switch (borderStyle.value) {
        case 'border-white':
          canvasContext.strokeStyle = `rgba(255,255,255,${border.alpha})`;
          break;
        case 'border-gray':
          canvasContext.strokeStyle = border.gray();
          break;
        case 'border-color':
          canvasContext.strokeStyle = border.rgb();
          break;
        case 'epileptic':
          canvasContext.strokeStyle = border.random();
          break;
        default:
      }
      canvasContext.stroke();
    }

    canvasContext.closePath();
  };

  this.update = () => {
    if ((y + yVelocity) < radius) {
      yVelocity = Math.abs(yVelocity);
      newCircle(x, y, radius, xVelocity, yVelocity);
    } else if ((y + yVelocity) > (canvas.height - radius)) {
      yVelocity = 0 - Math.abs(yVelocity);
      newCircle(x, y, radius, xVelocity, yVelocity);
    }

    if ((x + xVelocity) < radius) {
      xVelocity = Math.abs(xVelocity);
      newCircle(x, y, radius, xVelocity, yVelocity);
    } else if ((x + xVelocity) > (canvas.width - radius)) {
      xVelocity = 0 - Math.abs(xVelocity);
      newCircle(x, y, radius, xVelocity, yVelocity);
    }

    y += yVelocity;
    x += xVelocity;
  };

  this.setRadius = (newRadius) => {
    radius = newRadius;
  };

  this.setVelocity = (setX, setY) => {
    xVelocity = minMax(setX);
    yVelocity = minMax(setY);
  };

  this.updateAlphaBorder = () => {
    if (alphaBorder.checked) {
      border.resetAlpha();
    } else {
      border.alpha = 1;
    }
  };

  this.updateAlphaFill = () => {
    if (alphaFill.checked) {
      fill.resetAlpha();
    } else {
      fill.alpha = 1;
    }
  };

  this.getVelocity = () => Math.round(Math.sqrt((xVelocity ** 2) + (yVelocity ** 2)) * 100) / 100;

  this.updateAlphaBorder();
  this.updateAlphaFill();
}

// //////////////////////////////////////////////////////////////////////////////
// //////////////////////////////////////////////////////////////////////////////
// //////////////////////////// PRIVATE FUNCTIONS ///////////////////////////////
// //////////////////////////////////////////////////////////////////////////////
// //////////////////////////////////////////////////////////////////////////////

function updateAlphaBorder() {
  let i = circles.length;

  while (i) {
    circles[--i].updateAlphaBorder();
  }
}

function updateAlphaFill() {
  let i = circles.length;

  while (i) {
    circles[--i].updateAlphaFill();
  }
}

function setCanvasDimensions() {
  canvas.width = canvas.clientWidth * 2; // x2 for retina displays
  canvas.height = canvas.clientHeight * 2; // x2 for retina displays
}

function update() {
  let i = circles.length;

  while (i) {
    circles[--i].update();
  }
}

function drawCanvas() {
  canvasContext.save();
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);

  let i = circles.length;

  while (i) {
    circles[--i].draw();
  }

  canvasContext.restore();
}

function draw() {
  let i = 2;
  while (i--) {
    update();
    drawCanvas();
  }

  if (!paused) {
    if (fastSlow.checked) {
      window.setTimeout(draw, 0);
    } else {
      window.setTimeout(draw, 1000 / 60);
    }
  }
}

function pauseUnpause() {
  const pauseCache = paused;

  if (circles.length < 1) {
    paused = true;
    return;
  }

  paused = !paused;
  if (!paused) {
    if (fastSlow.checked) {
      window.setTimeout(draw, 0);
    } else {
      window.setTimeout(draw, 1000 / 60);
    }
  } else {
    log(
      Math.max(...circles.map((circle) => circle.getVelocity()))
    );
  }

  if (pauseCache !== paused) {
    if (paused) {
      pauseButton.classList.add('paused');
    } else {
      pauseButton.classList.remove('paused');
    }
  }
}

function createCircle(e) {
  circles.push(new Circle(e.offsetX * 2, e.offsetY * 2)); // x2 for retina displays

  if (circles.length === 1) {
    pauseUnpause();
  }
}

function erase() {
  setCanvasDimensions();
  drawCanvas();
}

function clear() {
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  circles = [];
  pauseUnpause();
}

function addEventListeners() {
  windowResize(erase.bind(this));

  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape') {
      clear();
    } else if (evt.key === ' ') {
      evt.preventDefault();
      pauseUnpause();
    }
  });

  alphaBorder.addEventListener('change', updateAlphaBorder, false);
  alphaFill.addEventListener('change', updateAlphaFill, false);

  canvas.addEventListener('click', createCircle, false);
  pauseButton.addEventListener('click', pauseUnpause, false);
  clearButton.addEventListener('click', clear, false);
  eraseButton.addEventListener('click', erase, false);
}

function initialize() {
  fastSlow = document.getElementById('fast-slow');
  borderStyle = document.getElementById('border-style');
  alphaBorder = document.getElementById('alpha-border');
  fillStyle = document.getElementById('fill-style');
  alphaFill = document.getElementById('alpha-fill');
  pauseButton = document.getElementById('pause-button');
  clearButton = document.getElementById('clear-button');
  eraseButton = document.getElementById('erase-button');
  canvas = document.getElementById('canvas');

  canvasContext = canvas.getContext('2d');

  addEventListeners();
  setCanvasDimensions();
}

ready.all(initialize.bind(this));
