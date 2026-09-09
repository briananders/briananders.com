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

/**
 * Represents a dynamic color object providing random, grayscale, and RGB strings with alpha management.
 *
 * @constructor
 */
function ColorObject() {
  /**
   * Generates a random color component in the brighter range (128-255).
   *
   * @returns {number} An integer value between 128 and 255.
   */
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

  /**
   * Returns an RGBA color string using the initial RGB components and current alpha.
   *
   * @returns {string} RGBA formatted string.
   */
  this.rgb = () => `rgba(${red},${green},${blue},${this.alpha})`;

  /**
   * Returns an RGBA grayscale string based on the average component value and current alpha.
   *
   * @returns {string} RGBA grayscale string.
   */
  this.gray = () => `rgba(${average},${average},${average},${this.alpha})`;

  /**
   * Returns an RGBA string with new random RGB components and current alpha.
   *
   * @returns {string} RGBA formatted string.
   */
  this.random = () => `rgba(${randomColor()},${randomColor()},${randomColor()},${this.alpha})`;

  /**
   * Resets the alpha value back to its originally generated random value.
   */
  this.resetAlpha = () => {
    this.alpha = alpha;
  };
}

/**
 * Square entity representing an animated bouncing square on the canvas.
 *
 * @constructor
 * @param {number} [x=1] - Starting X coordinate.
 * @param {number} [y=1] - Starting Y coordinate.
 */
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

  /**
   * Renders the square to the canvas context according to current fill and border style settings.
   */
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

  /**
   * Updates square position and handles bouncing against canvas boundaries.
   */
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

  /**
   * Updates the border alpha based on the alphaBorder checkbox setting.
   */
  this.updateAlphaBorder = () => {
    if (alphaBorder.checked) {
      border.resetAlpha();
    } else {
      border.alpha = 1;
    }
  };

  /**
   * Updates the fill alpha based on the alphaFill checkbox setting.
   */
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

/**
 * Iterates through all existing squares and updates their border alpha setting.
 */
function updateAlphaBorder() {
  let i = squares.length;

  while (i) {
    squares[--i].updateAlphaBorder();
  }
}

/**
 * Iterates through all existing squares and updates their fill alpha setting.
 */
function updateAlphaFill() {
  let i = squares.length;

  while (i) {
    squares[--i].updateAlphaFill();
  }
}

/**
 * Resizes canvas dimensions for high-DPI (retina) displays (2x scale).
 */
function setCanvasDimensions() {
  canvas.width = canvas.clientWidth * 2; // x2 for retina displays
  canvas.height = canvas.clientHeight * 2; // x2 for retina displays
}

/**
 * Iterates through all squares and triggers position updates.
 */
function update() {
  let i = squares.length;

  while (i) {
    squares[--i].update();
  }
}

/**
 * Re-draws all active squares onto the canvas.
 */
function drawCanvas() {
  canvasContext.save();

  let i = squares.length;

  while (i) {
    squares[--i].draw(canvasContext);
  }

  canvasContext.restore();
}

/**
 * Animation loop step running two update/draw passes and scheduling next tick.
 */
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

/**
 * Toggles the pause/play state of the animation and synchronizes UI button text and classes.
 */
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
    // Track internal state on `.paused`, and drive the design-system icon
    // via `.play` (paused → ▶ = "click to play") vs `.pause` (playing → ⏸).
    pauseButton.classList.toggle('paused', paused);
    pauseButton.classList.toggle('play', paused);
    pauseButton.classList.toggle('pause', !paused);
    pauseButton.textContent = paused ? 'Resume' : 'Pause';
  }
}

/**
 * Handles canvas clicks to spawn a new square at the clicked coordinates.
 *
 * @param {MouseEvent} e - Mouse click event.
 */
function createSquare(e) {
  squares.push(new Square(e.offsetX * 2, e.offsetY * 2)); // x2 for retina displays

  if (squares.length === 1) {
    pauseUnpause();
  }
}

/**
 * Re-computes canvas dimensions and re-renders active squares on window resize.
 */
function erase() {
  setCanvasDimensions();
  drawCanvas();
}

/**
 * Clears the canvas, empties the square collection, and pauses animation.
 */
function clear() {
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  squares = [];
  pauseUnpause();
}

/**
 * Binds user interaction event listeners to controls, keyboard shortcuts, and canvas.
 */
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

/**
 * Queries DOM elements, gets 2D context, and sets up canvas dimensions on initialization.
 */
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
