const ready = require('../_modules/document-ready');
const windowResize = require('../_modules/window-resize');

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

  function addRow(y) {
    world[y] = new Array(WIDTH);
    for (let x = 0; x < WIDTH; x++) {
      world[y][x] = calculate(x, y);
    }
  }

  function getRow(y) {
    if (world[y] === undefined) {
      addRow(y);
    }
    return world[y];
  }

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

  function calculate(x, y) {
    const parentRow = getRow(y - 1);

    // get parent 3 values
    let binary = '';
    [-1, 0, 1].forEach((val) => {
      // add width and mod width to account for array overflow
      binary += parentRow[(x + val + WIDTH) % WIDTH];
    });

    // convert to decimal
    const ruleIndex = parseInt(binary, 2);

    return Number(ruleString.charAt(ruleIndex));
  }

  function drawRange(y1, y2) {
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = y1; y < y2; y++) {
      drawRow(y, y1);
    }
  }

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

  function reverse(str) {
    let retString = '';
    for (let i = 0; i < str.length; i++) {
      retString = str.charAt(i) + retString;
    }
    return retString;
  }

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
