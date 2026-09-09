const ready = require('../_modules/document-ready');
const noAnimations = require('../_modules/no-animations');

const canvas = document.getElementById('canvas');
const canvasContext = canvas.getContext('2d');
const colorCheckbox = document.querySelector('input[name=color]');
let worldColor = true;

const circleArray = [];

/**
 * Generates a random integer value for an RGB color channel (0-255).
 *
 * @returns {number} Integer between 0 and 255.
 */
function randomColor() {
  return Math.floor(Math.random() * 256);
}

/**
 * Updates canvas element width and height to match client dimensions.
 *
 * @returns {void}
 */
function setCanvasSize() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}

/**
 * Represents an individual falling paint circle with random size, speed, and color.
 *
 * @constructor
 */
function PaintCircle() {
  const r = randomColor();
  const g = randomColor();
  const b = randomColor();
  const rgbAverage = (r + g + b) / 3;
  const color = `rgb(${r}, ${g}, ${b})`;
  const grey = `rgb(${rgbAverage}, ${rgbAverage}, ${rgbAverage})`;

  this.color = worldColor ? color : grey;
  this.radius = (Math.random() * 45) + 5;
  this.speed = Math.random() * 6;
  this.x = Math.random() * canvas.width;
  this.y = -50;

  /**
   * Advances circle position downward and renders it on canvas.
   *
   * @returns {void}
   */
  this.update = () => {
    this.y += this.speed;
    this.draw();
  };

  /**
   * Renders the circle path to the 2D canvas context.
   *
   * @returns {void}
   */
  this.draw = () => {
    canvasContext.beginPath();
    canvasContext.arc(this.x, this.y, this.radius, 0, 2 * Math.PI, false);
    canvasContext.fillStyle = this.color;
    canvasContext.fill();
    canvasContext.closePath();
  };
}

/**
 * Toggles color mode flag based on the state of the UI color checkbox.
 *
 * @returns {void}
 */
function toggleColor() {
  worldColor = colorCheckbox.checked;
}

/**
 * Sets up DOM event listeners for checkbox clicks and window resizing.
 *
 * @returns {void}
 */
function setupEventListeners() {
  colorCheckbox.addEventListener('click', toggleColor);
  window.addEventListener('resize', setCanvasSize);
}

/**
 * Cleans up and removes circles that have fallen past the bottom of the canvas viewport.
 *
 * @returns {void}
 */
function maintenance() {
  for (let i = circleArray.length - 1; i >= 0; i--) {
    const circle = circleArray[i];
    if (circle.y - circle.radius > canvas.height) {
      circleArray.splice(i, 1);
    }
  }
}

/**
 * Main animation frame callback that updates and draws circles, and removes off-screen elements.
 *
 * @returns {void}
 */
function draw() {
  circleArray.forEach((circle) => {
    circle.update();
  });
  maintenance();
  window.requestAnimationFrame(draw);
}

/**
 * Starts periodic interval to instantiate new PaintCircle objects within capacity limits.
 *
 * @returns {void}
 */
function run() {
  setInterval(() => {
    if (circleArray.length < canvas.width / 5) {
      circleArray.push(new PaintCircle());
    }
  }, 500);
}

ready.all(() => {
  setupEventListeners();
  setCanvasSize();
  run();
  if (!noAnimations.areAnimationsDisabled) draw();
});
