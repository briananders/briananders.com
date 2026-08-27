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

function resetPlane() {
  const returnArray = new Array(WIDTH);
  for (let i = 0; i < WIDTH; i++) {
    returnArray[i] = new Array(WIDTH).fill(0);
  }
  return returnArray;
}

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

function calculate(x, y) {
  // get parent 3 values
  let binary = '';
  [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
  ].forEach(([xVal, yVal]) => {
    // add width and mod width to account for array overflow
    binary += nowPlane[(x + xVal + WIDTH) % WIDTH][(y + yVal + WIDTH) % WIDTH];
  });

  // convert to decimal
  const ruleIndex = parseInt(binary, 2);

  thenPlane[x][y] = Number(ruleString.charAt(ruleIndex));
}

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

function reverse(str) {
  let retString = '';
  for (let i = 0; i < str.length; i++) {
    retString = str.charAt(i) + retString;
  }
  return retString;
}

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

ready.document(() => {
  reset(); // setup
  addEventListeners();
  stepArray = setup10110Array();
});
