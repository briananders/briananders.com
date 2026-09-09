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

/**
 * Generates a random velocity value with randomized direction and magnitude.
 *
 * @returns {number} A random velocity between roughly -3 and 3.
 */
const randomVelocity = () => (Math.random() - 0.5) * ((Math.random() * 5) + 1);

/**
 * Clamps a given numeric value between -6 and 6.
 *
 * @param {number} value - The velocity value to clamp.
 * @returns {number} Clamped value within [-6, 6].
 */
const minMax = (value) => Math.max(Math.min(value, 6), -6);

/**
 * Creates and spawns a new circle with modified velocity if under the capacity limit.
 *
 * @param {number} x - The initial X coordinate of the circle.
 * @param {number} y - The initial Y coordinate of the circle.
 * @param {number} radius - The radius of the circle.
 * @param {number} xVelocity - The base X velocity to perturb.
 * @param {number} yVelocity - The base Y velocity to perturb.
 * @returns {number|void} Returns current circle count if limit is reached.
 */
function newCircle(x, y, radius, xVelocity, yVelocity) {
  // Cap max number of circles at 1024 (2^10) to prevent performance degradation
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
 * Circle entity representing a moving, bouncing, multiplier circle on canvas.
 *
 * @constructor
 * @param {number} [x=1] - Starting X coordinate.
 * @param {number} [y=1] - Starting Y coordinate.
 */
function Circle(x = 1, y = 1) {
  // size
  let radius = Math.floor(5 + (Math.random() * 100));

  // color
  const fill = new ColorObject();
  const border = new ColorObject();

  // velocity
  let xVelocity = randomVelocity();
  let yVelocity = randomVelocity();

  /**
   * Renders the circle to the canvas context according to current fill and border style settings.
   */
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

  /**
   * Updates position and checks for collisions against canvas boundaries.
   * Spawns a new circle whenever a boundary bounce occurs.
   */
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

  /**
   * Sets the radius of the circle.
   *
   * @param {number} newRadius - The new radius value.
   */
  this.setRadius = (newRadius) => {
    radius = newRadius;
  };

  /**
   * Sets clamped X and Y velocity components.
   *
   * @param {number} setX - The requested X velocity.
   * @param {number} setY - The requested Y velocity.
   */
  this.setVelocity = (setX, setY) => {
    xVelocity = minMax(setX);
    yVelocity = minMax(setY);
  };

  /**
   * Toggles the border opacity between full opacity and its generated random alpha.
   */
  this.updateAlphaBorder = () => {
    if (alphaBorder.checked) {
      border.resetAlpha();
    } else {
      border.alpha = 1;
    }
  };

  /**
   * Toggles the fill opacity between full opacity and its generated random alpha.
   */
  this.updateAlphaFill = () => {
    if (alphaFill.checked) {
      fill.resetAlpha();
    } else {
      fill.alpha = 1;
    }
  };

  /**
   * Calculates the Euclidean speed magnitude of the circle.
   *
   * @returns {number} Speed rounded to 2 decimal places.
   */
  this.getVelocity = () => Math.round(Math.sqrt((xVelocity ** 2) + (yVelocity ** 2)) * 100) / 100;

  this.updateAlphaBorder();
  this.updateAlphaFill();
}

// //////////////////////////////////////////////////////////////////////////////
// //////////////////////////////////////////////////////////////////////////////
// //////////////////////////// PRIVATE FUNCTIONS ///////////////////////////////
// //////////////////////////////////////////////////////////////////////////////
// //////////////////////////////////////////////////////////////////////////////

/**
 * Iterates through all existing circles and updates their border alpha setting.
 */
function updateAlphaBorder() {
  let i = circles.length;

  while (i) {
    circles[--i].updateAlphaBorder();
  }
}

/**
 * Iterates through all existing circles and updates their fill alpha setting.
 */
function updateAlphaFill() {
  let i = circles.length;

  while (i) {
    circles[--i].updateAlphaFill();
  }
}

/**
 * Resizes canvas dimensions accounting for high-DPI (retina) displays (2x scale).
 */
function setCanvasDimensions() {
  canvas.width = canvas.clientWidth * 2; // x2 for retina displays
  canvas.height = canvas.clientHeight * 2; // x2 for retina displays
}

/**
 * Iterates through all circles and triggers their position updates and collision checks.
 */
function update() {
  let i = circles.length;

  while (i) {
    circles[--i].update();
  }
}

/**
 * Clears the canvas and re-draws every active circle.
 */
function drawCanvas() {
  canvasContext.save();
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);

  let i = circles.length;

  while (i) {
    circles[--i].draw();
  }

  canvasContext.restore();
}

/**
 * Main animation loop step. Runs update and draw steps twice per tick and schedules the next frame.
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
 * Toggles the pause/play state of the animation loop and updates the UI button state.
 */
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

/**
 * Handles canvas click events to spawn a new circle at the clicked coordinates.
 *
 * @param {MouseEvent} e - The mouse click event.
 */
function createCircle(e) {
  circles.push(new Circle(e.offsetX * 2, e.offsetY * 2)); // x2 for retina displays

  if (circles.length === 1) {
    pauseUnpause();
  }
}

/**
 * Re-computes canvas dimensions and re-renders current circles (used on resize).
 */
function erase() {
  setCanvasDimensions();
  drawCanvas();
}

/**
 * Clears the canvas, removes all circles, and pauses the animation.
 */
function clear() {
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  circles = [];
  pauseUnpause();
}

/**
 * Attaches DOM and window event listeners for user interaction and controls.
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

  canvas.addEventListener('click', createCircle, false);
  pauseButton.addEventListener('click', pauseUnpause, false);
  clearButton.addEventListener('click', clear, false);
  eraseButton.addEventListener('click', erase, false);
}

/**
 * Initializes DOM elements, context, listeners, and canvas dimensions on document ready.
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

ready.all(initialize.bind(this));
