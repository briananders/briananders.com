const ready = require('../_modules/document-ready');
const windowResize = require('../_modules/window-resize');

const canvas = document.getElementById('canvas');
const ruleInput = document.getElementById('rule');
const ruleArrows = document.querySelectorAll('#rule-up-and-down button');
const playInput = document.getElementById('play');
const randomStartInput = document.getElementById('random-start');
const canvasContext = canvas.getContext('2d');

let nowPlane;
let thenPlane;

let rule;
let ruleString;
let cellWidth;
let play = true;
let randomStart = false;
let stepArray = [];
playInput.checked = true;

const MIN = 0;
const MAX = 65535;

const FILL_STYLE = '#ffffff';
const WIDTH = 256;
const FPS = 1000 / 15;

let date;
canvasContext.fillStyle = FILL_STYLE;

/**
 * Creates and returns a 2D array grid of size WIDTH x WIDTH initialized with zeroes.
 *
 * @returns {number[][]} A 2D array representing a blank plane.
 */
function resetPlane() {
  const returnArray = new Array(WIDTH);
  for (let i = 0; i < WIDTH; i++) {
    returnArray[i] = new Array(WIDTH).fill(0);
  }
  return returnArray;
}

/**
 * Generates an array of rule numbers between MIN and MAX whose binary representations
 * end in the pattern '10110'. Used for step navigation between interesting rule sets.
 *
 * @returns {number[]} Array of rule integers matching the binary suffix condition.
 */
function setup10110Array() {
  const CHECK = '10110';
  const returnArray = [];

  for (let i = MIN; i < MAX; i++) {
    const currBinary = i.toString(2);
    if (currBinary.substr(currBinary.length - 5) === CHECK) {
      returnArray.push(i);
    }
  }

  return returnArray;
}

/**
 * Computes the next state of cell (x, y) based on the von Neumann neighborhood (top, right, bottom, left)
 * with toroidal boundary wrapping, and stores the result in thenPlane.
 *
 * @param {number} x - X coordinate (row index) in the grid.
 * @param {number} y - Y coordinate (column index) in the grid.
 */
function calculate(x, y) {
  // get parent 4 orthogonal neighbor values (von Neumann neighborhood)
  let binary = '';
  [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
  ].forEach(([xVal, yVal]) => {
    // add width and modulo width to wrap around grid edges toroidally
    binary += nowPlane[(x + xVal + WIDTH) % WIDTH][(y + yVal + WIDTH) % WIDTH];
  });

  // convert 4-bit neighbor binary string to decimal index for rule lookup
  const ruleIndex = parseInt(binary, 2);

  thenPlane[x][y] = Number(ruleString.charAt(ruleIndex));
}

/**
 * Renders the current grid state (nowPlane) to the canvas, computes the next state
 * in thenPlane for every cell, and swaps the buffers.
 */
function drawPlane() {
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  nowPlane.forEach((row, rIndex) => {
    row.forEach((col, cIndex) => {
      calculate(rIndex, cIndex);

      if (col) {
        canvasContext.fillStyle = FILL_STYLE;
        canvasContext.strokeStyle = FILL_STYLE;
        canvasContext.fillRect(
          cellWidth * rIndex,
          cellWidth * cIndex,
          cellWidth,
          cellWidth
        );
      }
    });
  });
  nowPlane = thenPlane;
  thenPlane = resetPlane();
}

/**
 * Main animation loop throttled by FPS. Uses checkDate token to cancel stale animation chains.
 *
 * @param {number} checkDate - Timestamp token representing the active run session.
 * @param {number} then - Timestamp of the previous frame render.
 */
function run(checkDate, then) {
  if (checkDate !== date) {
    return;
  }

  if (then + FPS < Date.now() && (play || then === 0)) {
    drawPlane();
    then = Date.now();
  }

  window.requestAnimationFrame(() => {
    run(checkDate, then);
  });
}

/**
 * Reverses a string character-by-character.
 *
 * @param {string} str - The string to reverse.
 * @returns {string} The reversed string.
 */
function reverse(str) {
  let retString = '';
  for (let i = 0; i < str.length; i++) {
    retString = str.charAt(i) + retString;
  }
  return retString;
}

/**
 * Initializes the initial nowPlane with either a single center seed cell or random binary values.
 */
function setupFirstPlane() {
  const plane = resetPlane();
  const half = Math.floor(WIDTH / 2);
  if (randomStart) {
    plane.forEach((row, rIndex) => {
      row.forEach((col, cIndex) => {
        plane[rIndex][cIndex] = Math.round(Math.random());
      });
    });
  } else {
    plane[half][half] = 1;
  }
  nowPlane = plane;
}

/**
 * Resets the canvas sizing, parses rule configuration, re-initializes planes, and restarts animation loop.
 */
function reset() {
  const rect = canvas.getClientRects()[0];
  cellWidth = rect.width / WIDTH;
  canvas.width = rect.width;
  canvas.height = rect.width;
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  rule = Number(ruleInput.value);
  ruleString = `000000000000000000000${rule.toString(2)}`; // leading zeros on binary rule
  ruleString = ruleString.substr(ruleString.length - 8); // must be 8 characters long
  ruleString = reverse(ruleString);

  thenPlane = resetPlane();
  setupFirstPlane();
  date = Date.now();
  run(date, 0);
}

/**
 * Registers event listeners for window resizing, rule adjustments, play toggle, and step navigation.
 */
function addEventListeners() {
  windowResize(reset);

  ruleInput.addEventListener('change', reset);
  playInput.addEventListener('change', () => {
    play = playInput.checked;
  });

  randomStartInput.addEventListener('change', () => {
    randomStart = randomStartInput.checked;
    reset();
  });

  ruleArrows.forEach((arrow) => {
    arrow.addEventListener('click', () => {
      const iterator = Number(arrow.value);
      let newRule = rule + iterator;

      while (
        !stepArray.includes(newRule)
          && (newRule > MIN && newRule < MAX)
      ) {
        newRule += iterator;
      }

      ruleInput.value = newRule;
      reset();
    });
  });
}

/**
 * Initializes the 2D cellular automaton once DOM is fully loaded.
 */
ready.document(() => {
  reset(); // setup
  addEventListeners();
  stepArray = setup10110Array();
});
