const ready = require('../_modules/document-ready');
const windowResize = require('../_modules/window-resize');

let canvasContext;
let canvas;
let squares = [];
let borderStyle;
let alphaBorder;
let fillStyle;
let alphaFill;
let fastSlow;
let clearButton;
let eraseButton;
let paused = true;
let pauseButton;

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

// Square Class
function Square(x = 1, y = 1) {
  // size
  const radius = Math.floor(5 + (Math.random() * 100));

  // color
  const fill = new ColorObject();
  const border = new ColorObject();

  // speed
  const speed = (Math.random() * 100) + 100;
  let xVelocity = (Math.random() - 0.5) * speed;
  let yVelocity = (Math.random() - 0.5) * speed;

  this.draw = () => {
    // canvasContext.beginPath();
    // canvasContext.arc(x, y, radius, 0, 2 * Math.PI, false);
    // canvasContext.fillRect(25, 25, 100, 100);
    // canvasContext.clearRect(45, 45, 60, 60);
    // canvasContext.strokeRect(x - radius, y - radius, x + radius, y + radius);
    const rectangle = new Path2D();
    rectangle.rect(x - radius, y - radius, 2 * radius, 2 * radius);

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

    canvasContext.fillRect(x - radius, y - radius, (2 * radius), (2 * radius));

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
      canvasContext.stroke(rectangle);
    }
  };

  this.update = () => {
    if ((y + yVelocity) < radius) {
      yVelocity = Math.abs(yVelocity);
    } else if ((y + yVelocity) > (canvas.height - radius)) {
      yVelocity = 0 - Math.abs(yVelocity);
    }

    y += yVelocity;

    if ((x + xVelocity) < radius) {
      xVelocity = Math.abs(xVelocity);
    } else if ((x + xVelocity) > (canvas.width - radius)) {
      xVelocity = 0 - Math.abs(xVelocity);
    }

    x += xVelocity;
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

  this.updateAlphaBorder();
  this.updateAlphaFill();
}

// //////////////////////////////////////////////////////////////////////////////
// //////////////////////////////////////////////////////////////////////////////
// //////////////////////////// PRIVATE FUNCTIONS ///////////////////////////////
// //////////////////////////////////////////////////////////////////////////////
// //////////////////////////////////////////////////////////////////////////////

function updateAlphaBorder() {
  let i = squares.length;

  while (i) {
    squares[--i].updateAlphaBorder();
  }
}

function updateAlphaFill() {
  let i = squares.length;

  while (i) {
    squares[--i].updateAlphaFill();
  }
}

function setCanvasDimensions() {
  canvas.width = canvas.clientWidth * 2; // x2 for retina displays
  canvas.height = canvas.clientHeight * 2; // x2 for retina displays
}

function update() {
  let i = squares.length;

  while (i) {
    squares[--i].update();
  }
}

function drawCanvas() {
  canvasContext.save();

  let i = squares.length;

  while (i) {
    squares[--i].draw(canvasContext);
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

  if (squares.length < 1) {
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
  }

  if (pauseCache !== paused) {
    if (paused) {
      pauseButton.classList.add('paused');
    } else {
      pauseButton.classList.remove('paused');
    }
  }
}

function createSquare(e) {
  squares.push(new Square(e.offsetX * 2, e.offsetY * 2)); // x2 for retina displays

  if (squares.length === 1) {
    pauseUnpause();
  }
}

function erase() {
  setCanvasDimensions();
  drawCanvas();
}

function clear() {
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  squares = [];
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

  canvas.addEventListener('click', createSquare, false);
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

ready.all(initialize);
