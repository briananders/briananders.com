const ready = require('../_modules/document-ready');
const windowResize = require('../_modules/window-resize');

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
 * Color generator helper for randomized RGB color values and transparency handling.
 *
 * @constructor
 */
function ColorObject() {
  /**
   * Generates a random color component in the brighter range (128-255).
   *
   * @returns {number} Color channel byte value.
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
   * Returns an RGBA string with the base random color.
   *
   * @returns {string} RGBA color string.
   */
  this.rgb = () => `rgba(${red},${green},${blue},${this.alpha})`;

  /**
   * Returns an RGBA grayscale string with averaged color channels.
   *
   * @returns {string} RGBA grayscale color string.
   */
  this.gray = () => `rgba(${average},${average},${average},${this.alpha})`;

  /**
   * Returns an RGBA string with freshly randomized color channels on each call.
   *
   * @returns {string} RGBA color string.
   */
  this.random = () => `rgba(${randomColor()},${randomColor()},${randomColor()},${this.alpha})`;

  /**
   * Resets the alpha value back to its original initial random value.
   *
   * @returns {void}
   */
  this.resetAlpha = () => {
    this.alpha = alpha;
  };
}

/**
 * Represents a moving, bouncing circle particle that draws pattern trails on the canvas.
 *
 * @constructor
 * @param {number} [x=1] - Initial X coordinate.
 * @param {number} [y=1] - Initial Y coordinate.
 */
function Circle(x = 1, y = 1) {
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
   * Draws the circle onto the canvas context according to current fill and border settings.
   *
   * @returns {void}
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
   * Updates particle coordinates and handles boundary collision reflection.
   *
   * @returns {void}
   */
  this.update = () => {
    if ((y + yVelocity) < radius) {
      yVelocity = Math.abs(yVelocity);
    } else if ((y + yVelocity) > (canvas.height - radius)) {
      yVelocity = 0 - Math.abs(yVelocity);
    }

    if ((x + xVelocity) < radius) {
      xVelocity = Math.abs(xVelocity);
    } else if ((x + xVelocity) > (canvas.width - radius)) {
      xVelocity = 0 - Math.abs(xVelocity);
    }

    y += yVelocity;
    x += xVelocity;
  };

  /**
   * Updates border opacity setting based on the UI checkbox.
   *
   * @returns {void}
   */
  this.updateAlphaBorder = () => {
    if (alphaBorder.checked) {
      border.resetAlpha();
    } else {
      border.alpha = 1;
    }
  };

  /**
   * Updates fill opacity setting based on the UI checkbox.
   *
   * @returns {void}
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
 * Updates the border alpha setting across all active circle instances.
 *
 * @returns {void}
 */
function updateAlphaBorder() {
  let i = circles.length;

  while (i) {
    circles[--i].updateAlphaBorder();
  }
}

/**
 * Updates the fill alpha setting across all active circle instances.
 *
 * @returns {void}
 */
function updateAlphaFill() {
  let i = circles.length;

  while (i) {
    circles[--i].updateAlphaFill();
  }
}

/**
 * Adjusts canvas width and height for high-DPI (retina) displays.
 *
 * @returns {void}
 */
function setCanvasDimensions() {
  canvas.width = canvas.clientWidth * 2; // x2 for retina displays
  canvas.height = canvas.clientHeight * 2; // x2 for retina displays
}

/**
 * Iterates through all circles and invokes their update methods.
 *
 * @returns {void}
 */
function update() {
  let i = circles.length;

  while (i) {
    circles[--i].update();
  }
}

/**
 * Renders all circles to the 2D canvas context.
 *
 * @returns {void}
 */
function drawCanvas() {
  canvasContext.save();

  let i = circles.length;

  while (i) {
    circles[--i].draw(canvasContext);
  }

  canvasContext.restore();
}

/**
 * Animation loop step function that performs physics updates and rendering passes.
 *
 * @returns {void}
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
 * Toggles the running/paused animation state and updates button style.
 *
 * @returns {void}
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
 * Click handler that spawns a new Circle particle at the clicked canvas coordinate.
 *
 * @param {MouseEvent} e - The mouse click event.
 * @returns {void}
 */
function createCircle(e) {
  circles.push(new Circle(e.offsetX * 2, e.offsetY * 2)); // x2 for retina displays

  if (circles.length === 1) {
    pauseUnpause();
  }
}

/**
 * Clears and resets the canvas surface while maintaining active circle particles.
 *
 * @returns {void}
 */
function erase() {
  setCanvasDimensions();
  drawCanvas();
}

/**
 * Wipes the canvas clear, removes all circles, and pauses animation.
 *
 * @returns {void}
 */
function clear() {
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  circles = [];
  pauseUnpause();
}

/**
 * Binds DOM event listeners for canvas interaction, shortcuts, and form controls.
 *
 * @returns {void}
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
 * Initializes DOM element references, binds events, and configures canvas dimensions.
 *
 * @returns {void}
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
