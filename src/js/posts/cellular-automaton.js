const ready = require('../_modules/document-ready');
const windowResize = require('../_modules/window-resize');

/**
 * Initializes the 1D elementary cellular automaton (e.g. Rule 30, Rule 110) visualization.
 */
ready.document(() => {
  const canvas = document.getElementById('canvas');
  const ruleInput = document.getElementById('rule');
  const ruleArrows = document.querySelectorAll('#rule-up-and-down button');
  const heightInput = document.getElementById('height');
  const heightArrows = document.querySelectorAll('#height-up-and-down button');
  const playInput = document.getElementById('play');
  const randomStartInput = document.getElementById('random-start');
  const canvasContext = canvas.getContext('2d');

  let rule;
  let world;
  let ruleString;
  let cellWidth;
  let maxHeight;
  let play = false;
  let randomStart = false;

  const FILL_STYLE = '#ffffff';
  const WIDTH = 255;
  const FPS = 1000 / 30;

  let date;

  /**
   * Generates a new row of cells in the automaton world at index y by calculating each cell value.
   *
   * @param {number} y - Row index in the world array.
   */
  function addRow(y) {
    world[y] = new Array(WIDTH);
    for (let x = 0; x < WIDTH; x++) {
      world[y][x] = calculate(x, y);
    }
  }

  /**
   * Lazily gets or creates row y from the world history.
   *
   * @param {number} y - Row index.
   * @returns {number[]} Array of binary cell states for row y.
   */
  function getRow(y) {
    if (world[y] === undefined) {
      addRow(y);
    }
    return world[y];
  }

  /**
   * Renders a single row of cells to the canvas offset by a starting row index.
   *
   * @param {number} rowNumber - The row in world history to draw.
   * @param {number} offset - The topmost visible row index on canvas.
   */
  function drawRow(rowNumber, offset) {
    const row = getRow(rowNumber);
    row.forEach((val, index) => {
      if (val) {
        canvasContext.fillStyle = FILL_STYLE;
        canvasContext.strokeStyle = FILL_STYLE;
        canvasContext.fillRect(
          cellWidth * index,
          cellWidth * (rowNumber - offset),
          cellWidth,
          cellWidth
        );
      }
    });
  }

  /**
   * Computes the binary state of cell (x, y) based on the 3 parent cells above it
   * (left, center, right) in row y-1 with toroidal edge wrapping.
   *
   * @param {number} x - Cell horizontal position.
   * @param {number} y - Cell generation / row index.
   * @returns {number} Next cell state (0 or 1).
   */
  function calculate(x, y) {
    const parentRow = getRow(y - 1);

    // get parent 3 values (left, center, right)
    let binary = '';
    [-1, 0, 1].forEach((val) => {
      // add width and modulo width to wrap around grid boundaries
      binary += parentRow[(x + val + WIDTH) % WIDTH];
    });

    // convert 3-bit pattern into decimal index for Wolfram rule lookup
    const ruleIndex = parseInt(binary, 2);

    return Number(ruleString.charAt(ruleIndex));
  }

  /**
   * Clears canvas and renders all rows between y1 and y2.
   *
   * @param {number} y1 - Starting row index (inclusive).
   * @param {number} y2 - Ending row index (exclusive).
   */
  function drawRange(y1, y2) {
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = y1; y < y2; y++) {
      drawRow(y, y1);
    }
  }

  /**
   * Main scrolling animation loop controlling vertical progression at target FPS.
   *
   * @param {number} count - Current vertical scroll row offset.
   * @param {number} checkDate - Session timestamp token to cancel outdated loops.
   * @param {number} [runDate] - Previous frame timestamp.
   */
  function run(count, checkDate, runDate) {
    let then = runDate || 0;

    if (checkDate !== date) {
      return;
    }

    if (then + FPS < Date.now() && (play || then === 0)) {
      drawRange(++count, count + maxHeight);
      then = Date.now();
    }

    window.requestAnimationFrame(() => {
      run(count, checkDate, then);
    });
  }

  /**
   * Reverses a string character-by-character.
   *
   * @param {string} str - String to reverse.
   * @returns {string} Reversed string.
   */
  function reverse(str) {
    let retString = '';
    for (let i = 0; i < str.length; i++) {
      retString = str.charAt(i) + retString;
    }
    return retString;
  }

  /**
   * Resets simulation canvas sizing, parses elementary rule binary string,
   * generates initial seed row, and starts rendering.
   */
  function reset() {
    const rect = canvas.getClientRects()[0];
    const newHeight = (Number(heightInput.value) / 255) * rect.width;
    canvas.style.height = newHeight;
    cellWidth = rect.width / WIDTH;
    canvas.width = rect.width;
    canvas.height = newHeight;
    maxHeight = newHeight / cellWidth;
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    world = [];
    rule = Number(ruleInput.value);
    ruleString = `00000000${rule.toString(2)}`; // leading zeros on binary rule
    ruleString = ruleString.substr(ruleString.length - 8); // must be 8 characters long
    ruleString = reverse(ruleString);
    world.push(new Array(WIDTH).fill(0));
    if (randomStart) {
      world[0] = world[0].map(() => ((Math.random() > 0.4) ? 0 : 1));
    } else {
      world[0][Math.floor(WIDTH / 2)] = 1;
    }
    date = Date.now();
    run(-1, date, 0);
  }

  /**
   * Registers control event listeners for rule changes, height adjustments, resize, and play toggle.
   */
  function addEventListeners() {
    ruleInput.addEventListener('change', reset);
    heightInput.addEventListener('change', reset);
    windowResize(reset.bind(this));
    playInput.addEventListener('change', () => {
      play = playInput.checked;
    });
    randomStartInput.addEventListener('change', () => {
      randomStart = randomStartInput.checked;
      reset();
    });
    ruleArrows.forEach((arrow) => {
      arrow.addEventListener('click', () => {
        ruleInput.value = rule + Number(arrow.value);
        reset();
      });
    });
    heightArrows.forEach((arrow) => {
      arrow.addEventListener('click', () => {
        heightInput.value = Number(heightInput.value) + Number(arrow.value);
        if (Number(heightInput.value) > 255) {
          heightInput.value = 255;
        } else if (Number(heightInput.value) < 1) {
          heightInput.value = 1;
        }
        reset();
      });
    });
  }

  reset(); // setup
  addEventListeners();
});
