const ready = require('../_modules/document-ready.ts');
const windowResize = require('../_modules/window-resize.ts');

let canvasContext!: CanvasRenderingContext2D;
let canvas!: HTMLCanvasElement;
let squares: Square[] = [];
let borderStyle!: HTMLSelectElement;
let alphaBorder!: HTMLInputElement;
let fillStyle!: HTMLSelectElement;
let alphaFill!: HTMLInputElement;
let fastSlow!: HTMLInputElement;
let clearButton!: HTMLButtonElement;
let eraseButton!: HTMLButtonElement;
let paused = true;
let pauseButton!: HTMLButtonElement;

/**
 * Represents a dynamic color object providing random, grayscale, and RGB strings with alpha management.
 */
class ColorObject {
  alpha: number;

  rgb: () => string;

  gray: () => string;

  random: () => string;

  resetAlpha: () => void;

  constructor() {
    /**
     * Generates a random color component in the brighter range (128-255).
     *
     * @returns {number} An integer value between 128 and 255.
     */
    function randomColor(): number {
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
}

/**
 * Square entity representing an animated bouncing square on the canvas.
 */
class Square {
  draw: () => void;

  update: () => void;

  updateAlphaBorder: () => void;

  updateAlphaFill: () => void;

  /**
   * @param {number} [x=1] - Starting X coordinate.
   * @param {number} [y=1] - Starting Y coordinate.
   */
  constructor(x = 1, y = 1) {
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
        canvasContext.lineWidth = 1;

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
}

// //////////////////////////////////////////////////////////////////////////////
// //////////////////////////////////////////////////////////////////////////////
// //////////////////////////// PRIVATE FUNCTIONS ///////////////////////////////
// //////////////////////////////////////////////////////////////////////////////
// //////////////////////////////////////////////////////////////////////////////

/**
 * Iterates through all existing squares and updates their border alpha setting.
 */
function updateAlphaBorder(): void {
  let i = squares.length;

  while (i) {
    squares[--i].updateAlphaBorder();
  }
}

/**
 * Iterates through all existing squares and updates their fill alpha setting.
 */
function updateAlphaFill(): void {
  let i = squares.length;

  while (i) {
    squares[--i].updateAlphaFill();
  }
}

/**
 * Resizes canvas dimensions for high-DPI (retina) displays (2x scale).
 */
function setCanvasDimensions(): void {
  canvas.width = canvas.clientWidth * 2; // x2 for retina displays
  canvas.height = canvas.clientHeight * 2; // x2 for retina displays
}

/**
 * Iterates through all squares and triggers position updates.
 */
function update(): void {
  let i = squares.length;

  while (i) {
    squares[--i].update();
  }
}

/**
 * Re-draws all active squares onto the canvas.
 */
function drawCanvas(): void {
  canvasContext.save();

  let i = squares.length;

  while (i) {
    squares[--i].draw();
  }

  canvasContext.restore();
}

/**
 * Animation loop step running two update/draw passes and scheduling next tick.
 */
function draw(): void {
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
function pauseUnpause(): void {
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
function createSquare(e: MouseEvent): void {
  squares.push(new Square(e.offsetX * 2, e.offsetY * 2)); // x2 for retina displays

  if (squares.length === 1) {
    pauseUnpause();
  }
}

/**
 * Re-computes canvas dimensions and re-renders active squares on window resize.
 */
function erase(): void {
  setCanvasDimensions();
  drawCanvas();
}

/**
 * Clears the canvas, empties the square collection, and pauses animation.
 */
function clear(): void {
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  squares = [];
  pauseUnpause();
}

/**
 * Binds user interaction event listeners to controls, keyboard shortcuts, and canvas.
 */
function addEventListeners(): void {
  windowResize(erase);

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
function initialize(): void {
  const fastSlowEl = document.getElementById('fast-slow') as HTMLInputElement | null;
  const borderStyleEl = document.getElementById('border-style') as HTMLSelectElement | null;
  const alphaBorderEl = document.getElementById('alpha-border') as HTMLInputElement | null;
  const fillStyleEl = document.getElementById('fill-style') as HTMLSelectElement | null;
  const alphaFillEl = document.getElementById('alpha-fill') as HTMLInputElement | null;
  const pauseButtonEl = document.getElementById('pause-button') as HTMLButtonElement | null;
  const clearButtonEl = document.getElementById('clear-button') as HTMLButtonElement | null;
  const eraseButtonEl = document.getElementById('erase-button') as HTMLButtonElement | null;
  const canvasEl = document.getElementById('canvas') as HTMLCanvasElement | null;

  if (
    !fastSlowEl
    || !borderStyleEl
    || !alphaBorderEl
    || !fillStyleEl
    || !alphaFillEl
    || !pauseButtonEl
    || !clearButtonEl
    || !eraseButtonEl
    || !canvasEl
  ) {
    return;
  }

  const context = canvasEl.getContext('2d');
  if (!context) {
    return;
  }

  fastSlow = fastSlowEl;
  borderStyle = borderStyleEl;
  alphaBorder = alphaBorderEl;
  fillStyle = fillStyleEl;
  alphaFill = alphaFillEl;
  pauseButton = pauseButtonEl;
  clearButton = clearButtonEl;
  eraseButton = eraseButtonEl;
  canvas = canvasEl;
  canvasContext = context;

  addEventListeners();
  setCanvasDimensions();
}

ready.all(initialize);
