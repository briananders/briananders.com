const ready = require('../_modules/document-ready');
let urlParams = new URLSearchParams(window.location.search);

const eventKeys = {
  reRender: 're-render',
  isPlaying: 'is-playing',
  gameOver: 'game-over',
};
const events = {};

Object.keys(eventKeys).forEach((key) => {
  events[key] = document.createEvent('Event');
  events[key].initEvent(eventKeys[key], true, true);
});

const difficulties = {
  beginner: {
    square: 8,
    mineCount: 10,
  },
  intermediate: {
    square: 16,
    mineCount: 40,
  },
  expert: {
    square: 24,
    mineCount: 99,
  },
};

const difficultyElement = document.querySelector('select[name=difficulty]');
const tableElement = document.querySelector('ul.table');
const faceElement = document.querySelector('button.face-button');

const time = {
  containerElement: document.querySelector('.time'),
  hundredsElement: document.querySelector('.time .hundreds'),
  tensElement: document.querySelector('.time .tens'),
  onesElement: document.querySelector('.time .ones'),
  value: 0,
  date: undefined,
};

const mines = {
  containerElement: document.querySelector('.mine-count-down'),
  hundredsElement: document.querySelector('.mine-count-down .hundreds'),
  tensElement: document.querySelector('.mine-count-down .tens'),
  onesElement: document.querySelector('.mine-count-down .ones'),
  flagCount: 0,
  minesMinusFlags: 0,
};

const state = {
  isPlaying: false,
  gameOver: false,
  hasWon: false,
  minesSet: false,
};

let game = [];

function MineSquare([row, column], element) {
  this.isMine = false;
  this.hasFlag = false;
  this.isRevealed = false;
  this.value = 0;
  this.row = row;
  this.column = column;

  let abc;

  this.updateClasses = () => {
    if (this.hasFlag) {
      element.classList.add('flag');
    } else {
      element.classList.remove('flag');
    }

    if (this.isRevealed) {
      element.classList.add('active');
      element.dataset.value = this.value;
    }

    if (state.hasWon && this.isMine) {
      element.classList.add('flag');
    } else if (state.gameOver && this.isMine) {
      element.classList.add('mine');
    }

    if (state.gameOver && this.hasFlag && !this.isMine) {
      element.classList.add('not-flag');
    }
  };

  this.reveal = () => {
    if (this.isRevealed) return;
    if (this.hasFlag) return;

    this.isRevealed = true;
    if (!state.isPlaying) {
      return;
    }
    revealPrivate();
  };

  const leftClicked = (e) => {
    if (e) e.preventDefault();
    if (!this.isRevealed) {
      this.reveal();
    } else if (countSurroundingFlags([row, column]) === this.value) {
      revealAround([row, column]);
    }
  };

  const rightClicked = (e) => {
    if (e) e.preventDefault();
    if (!this.isRevealed) {
      this.hasFlag = !this.hasFlag;
      document.body.dispatchEvent(events.reRender);
    }
  };

  const revealPrivate = () => {
    if (!this.isRevealed) return;
    if (this.isMine) {
      state.gameOver = true;
      element.classList.add('red');
      state.isPlaying = false;
      document.body.dispatchEvent(events.gameOver);
    }
    if (this.value === 0) {
      revealAround([row, column]);
    }
    document.body.dispatchEvent(events.reRender);
  };

  const addEventListeners = () => {
    element.addEventListener('click', leftClicked);
    element.addEventListener('contextmenu', rightClicked);
    element.addEventListener('mousedown', addOFace);
    element.addEventListener('mouseup', removeOFace);
    element.addEventListener('mouseout', removeOFace);
    document.body.addEventListener(eventKeys.gameOver, this.updateClasses);
    document.body.addEventListener(eventKeys.reRender, this.updateClasses);
    document.body.addEventListener(eventKeys.isPlaying, revealPrivate);
  };

  const removeListeners = () => {
    element.removeEventListener('click', leftClicked);
    element.removeEventListener('contextmenu', rightClicked);
    element.removeEventListener('mousedown', addOFace);
    element.removeEventListener('mouseup', removeOFace);
    element.removeEventListener('mouseout', removeOFace);
    document.body.removeEventListener(eventKeys.gameOver, this.updateClasses);
    document.body.removeEventListener(eventKeys.reRender, this.updateClasses);
    document.body.removeEventListener(eventKeys.isPlaying, revealPrivate);
  };

  addEventListeners();
  document.body.addEventListener(eventKeys.gameOver, removeListeners);

  this.destroy = () => {
    removeListeners();
    document.body.removeEventListener(eventKeys.gameOver, removeListeners);
    element.remove();
  };
}

function getNeighbors([row, column]) {
  const { square } = getDifficulty();
  const neighbors = [];
  for (let rowIndex = row - 1; rowIndex <= row + 1; rowIndex++) {
    for (let columnIndex = column - 1; columnIndex <= column + 1; columnIndex++) {
      if (
        !(
          rowIndex < 0
          || columnIndex < 0
          || rowIndex >= square
          || columnIndex >= square
          || (rowIndex === row && columnIndex === column)
        )
      ) {
        neighbors.push(game[rowIndex][columnIndex]);
      }
    }
  }
  return neighbors;
}

function gameAsArray() {
  return game.reduce((accumulator, currentArray) => accumulator.concat(currentArray), []);
}

function addOFace() {
  if (state.hasWon || state.gameOver) return;
  faceElement.classList.add('o');
}

function removeOFace() {
  faceElement.classList.remove('o');
}

function updateDifficulty() {
  document.querySelectorAll('[data-difficulty]').forEach((el) => {
    el.dataset.difficulty = difficultyElement.value;
  });
}

function revealAround([row, column]) {
  getNeighbors([row, column]).forEach((cell) => {
    cell.reveal();
  });
}

function difficultyChanged() {
  const newDifficulty = difficultyElement.value.toString();
  urlParams = new URLSearchParams(window.location.search);
  urlParams.set('difficulty', newDifficulty);
  history.pushState('', '', `?${urlParams.toString()}`);
  window.top.postMessage(`difficulty=${newDifficulty}`, '*');
}

function watchHeaderElements() {
  difficultyElement.addEventListener('change', () => {
    difficultyChanged();
    reset();
  });
  faceElement.addEventListener('click', reset);
  faceElement.addEventListener('mousedown', addOFace);
  faceElement.addEventListener('mouseup', removeOFace);
  faceElement.addEventListener('mouseout', removeOFace);
}

function getDifficulty() {
  return difficulties[difficultyElement.value];
}

function fillTable() {
  const { square } = getDifficulty();
  tableElement.innerHTML = '';

  for (let row = 0; row < square; row++) {
    game.push(new Array(square));
    for (let column = 0; column < square; column++) {
      const li = document.createElement('li');
      li.classList.add(`${row}-${column}`);
      li.classList.add('mine-sweeper-tile');
      li.innerHTML = `${row}-${column}`;
      game[row][column] = new MineSquare([row, column], li);
      tableElement.appendChild(li);
    }
  }
}

function updateTimeElements() {
  const {
    hundredsElement, tensElement, onesElement, value,
  } = time;
  hundredsElement.dataset.number = Math.floor(value / 100);
  tensElement.dataset.number = Math.floor((value / 10) % 10);
  onesElement.dataset.number = value % 10;
}

function setMines() {
  const { mineCount, square } = getDifficulty();
  let mineCounter = mineCount;
  while (mineCounter) {
    const row = Math.floor(Math.random() * square);
    const column = Math.floor(Math.random() * square);
    if (!game[row][column].isRevealed && !game[row][column].isMine) {
      game[row][column].isMine = true;
      mineCounter--;
    }
  }

  gameAsArray().forEach((cell) => {
    cell.value = getValue([cell.row, cell.column]);
    cell.updateClasses();
  });

  state.minesSet = true;
  play();
}

function countUnrevealed() {
  const { mineCount } = getDifficulty();
  const unrevealedCells = gameAsArray().filter((cell) => !cell.isRevealed);
  if (unrevealedCells.length === mineCount) {
    state.hasWon = true;
    state.isPlaying = false;
    document.body.dispatchEvent(events.gameOver);
  }
}

function updateFlagElements() {
  const {
    hundredsElement,
    tensElement,
    onesElement,
    minesMinusFlags,
  } = mines;
  hundredsElement.dataset.number = Math.floor(minesMinusFlags / 100);
  tensElement.dataset.number = Math.floor((minesMinusFlags / 10) % 10);
  onesElement.dataset.number = minesMinusFlags % 10;
}

function updateFlagCount() {
  const { mineCount } = getDifficulty();
  const valueReducer = (accumulator, currentValue) => accumulator + (currentValue.hasFlag ? 1 : 0);
  const arrayReducer = (accumulator, currArray) => accumulator + currArray.reduce(valueReducer, 0);

  mines.flagCount = game.reduce(arrayReducer, 0);
  mines.minesMinusFlags = mineCount - mines.flagCount;

  updateFlagElements();
}

function getValue([row, column]) {
  return getNeighbors([row, column]).filter((cell) => cell.isMine).length;
}

function countSurroundingFlags([row, column]) {
  return getNeighbors([row, column]).filter((cell) => cell.hasFlag).length;
}

function watchTableFirstClick() {
  tableElement.addEventListener('click', () => {
    if (state.isPlaying || state.hasWon || state.gameOver) return;
    setMines();
  });
}

function runLoop() {
  if (state.isPlaying) {
    if (Date.now() - time.date > 1000) {
      time.value++;
      updateTimeElements();
      time.date = Date.now();
    }
    setTimeout(runLoop, 200);
  }
}

function renderGameOver() {
  if (state.hasWon) {
    faceElement.classList.add('sunglasses');
    mines.minesMinusFlags = 0;
    updateFlagElements();
  } else {
    faceElement.classList.add('dead');
  }
}

function play() {
  state.isPlaying = true;
  time.date = Date.now();
  document.body.dispatchEvent(events.isPlaying);
}

function destroyGame() {
  for (let i = 0; i < game.length; i++) {
    for (let j = 0; j < game[i].length; j++) {
      game[i][j].destroy();
      game[i][j] = undefined;
    }
  }
}

function reset() {
  destroyGame();
  game = [];
  time.value = 0;
  time.date = undefined;
  mines.flagCount = 0;
  mines.minesMinusFlags = 0;
  state.hasWon = false;
  state.gameOver = false;
  state.isPlaying = false;
  state.minesSet = false;
  faceElement.classList.remove('sunglasses');
  faceElement.classList.remove('dead');
  fillTable();
  updateDifficulty();
  updateTimeElements();
  updateFlagElements();
}

ready.document(() => {
  document.body.addEventListener(eventKeys.gameOver, renderGameOver);
  document.body.addEventListener(eventKeys.reRender, updateFlagCount);
  document.body.addEventListener(eventKeys.reRender, countUnrevealed);
  document.body.addEventListener(eventKeys.isPlaying, runLoop);

  // window.addEventListener('message', ({data}) => {
  //   debugger;
  //   if (data.indexOf('difficulty') === 0) {
  //     const [key, value] = data.split('=');
  //     const newDifficulty = value.toString();
  //     difficultyElement.value = newDifficulty;
  //     debugger;
  //   }
  // });

  if (urlParams.has('difficulty')) {
    const difficultyElement = document.querySelector('select[name=difficulty]');
    difficultyElement.value = urlParams.get('difficulty');
  }

  watchHeaderElements();
  watchTableFirstClick();

  difficultyChanged();
  reset();
});
