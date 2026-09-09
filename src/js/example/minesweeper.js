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

/**
 * MineSquare constructor representing an individual tile on the Minesweeper board.
 * Manages tile state (flagged, revealed, mine), DOM styling, and user interactions.
 *
 * @constructor
 * @param {[number, number]} param0 - Coordinates array containing [row, column].
 * @param {HTMLElement} element - The DOM element associated with this grid square.
 */
function MineSquare([row, column], element) {
  this.isMine = false;
  this.hasFlag = false;
  this.isRevealed = false;
  this.value = 0;
  this.row = row;
  this.column = column;

  let abc;

  /**
   * Updates CSS class names and dataset values on the square element based on current state.
   */
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

  /**
   * Reveals this square if it is not already revealed and not flagged.
   */
  this.reveal = () => {
    if (this.isRevealed) return;
    if (this.hasFlag) return;

    this.isRevealed = true;
    if (!state.isPlaying) {
      return;
    }
    revealPrivate();
  };

  /**
   * Handles left click on the square. Reveals tile or performs chorded reveal if already active.
   *
   * @param {MouseEvent} [e] - Click event object.
   */
  const leftClicked = (e) => {
    if (e) e.preventDefault();
    if (!this.isRevealed) {
      this.reveal();
    } else if (countSurroundingFlags([row, column]) === this.value) {
      // Chord action: if surrounding flag count matches tile value, auto-reveal adjacent unflagged tiles
      revealAround([row, column]);
    }
  };

  /**
   * Handles right click (context menu) to toggle flag marker on unrevealed square.
   *
   * @param {MouseEvent} [e] - Context menu event object.
   */
  const rightClicked = (e) => {
    if (e) e.preventDefault();
    if (!this.isRevealed) {
      this.hasFlag = !this.hasFlag;
      document.body.dispatchEvent(events.reRender);
    }
  };

  /**
   * Internal helper handling consequences of revealing the tile (mine trigger, flood fill for zero value).
   */
  const revealPrivate = () => {
    if (!this.isRevealed) return;
    if (this.isMine) {
      state.gameOver = true;
      element.classList.add('red');
      state.isPlaying = false;
      document.body.dispatchEvent(events.gameOver);
    }
    if (this.value === 0) {
      // Blank tile: cascade reveal neighbor squares
      revealAround([row, column]);
    }
    document.body.dispatchEvent(events.reRender);
  };

  /**
   * Attaches DOM and global event listeners for the square.
   */
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

  /**
   * Removes DOM and global event listeners from the square.
   */
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

  /**
   * Cleans up event listeners and removes the tile element from DOM.
   */
  this.destroy = () => {
    removeListeners();
    document.body.removeEventListener(eventKeys.gameOver, removeListeners);
    element.remove();
  };
}

/**
 * Returns all valid neighboring MineSquare objects surrounding a given coordinate.
 *
 * @param {[number, number]} param0 - Coordinates array [row, column].
 * @returns {MineSquare[]} Array of neighbor MineSquare instances.
 */
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

/**
 * Flattens the 2D game grid array into a single 1D array of MineSquare cells.
 *
 * @returns {MineSquare[]} Flattened array of all game squares.
 */
function gameAsArray() {
  return game.reduce((accumulator, currentArray) => accumulator.concat(currentArray), []);
}

/**
 * Changes smiley face button expression to surprised ('o') during mouse down on board.
 */
function addOFace() {
  if (state.hasWon || state.gameOver) return;
  faceElement.classList.add('o');
}

/**
 * Removes surprised expression from smiley face button on mouse release or exit.
 */
function removeOFace() {
  faceElement.classList.remove('o');
}

/**
 * Updates data-difficulty attribute on relevant DOM elements to match current selection.
 */
function updateDifficulty() {
  document.querySelectorAll('[data-difficulty]').forEach((el) => {
    el.dataset.difficulty = difficultyElement.value;
  });
}

/**
 * Reveals all valid neighboring cells around the specified coordinates.
 *
 * @param {[number, number]} param0 - Coordinates array [row, column].
 */
function revealAround([row, column]) {
  getNeighbors([row, column]).forEach((cell) => {
    cell.reveal();
  });
}

/**
 * Synchronizes difficulty change with URL parameters and sends postMessage to parent frame.
 */
function difficultyChanged() {
  const newDifficulty = difficultyElement.value.toString();
  urlParams = new URLSearchParams(window.location.search);
  urlParams.set('difficulty', newDifficulty);
  history.pushState('', '', `?${urlParams.toString()}`);
  window.top.postMessage(`difficulty=${newDifficulty}`, '*');
}

/**
 * Binds event listeners to difficulty dropdown and smiley face reset button.
 */
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

/**
 * Retrieves configuration settings (grid dimensions and mine count) for current difficulty level.
 *
 * @returns {{square: number, mineCount: number}} Difficulty configuration object.
 */
function getDifficulty() {
  return difficulties[difficultyElement.value];
}

/**
 * Generates the board grid in the DOM and initializes the 2D array of MineSquare instances.
 */
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

/**
 * Updates 7-segment-style digit displays for elapsed game time.
 */
function updateTimeElements() {
  const {
    hundredsElement, tensElement, onesElement, value,
  } = time;
  hundredsElement.dataset.number = Math.floor(value / 100);
  tensElement.dataset.number = Math.floor((value / 10) % 10);
  onesElement.dataset.number = value % 10;
}

/**
 * Places mines randomly across the board avoiding already revealed squares,
 * computes numerical neighbor values for each tile, and starts the game.
 */
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

/**
 * Counts unrevealed tiles to determine if win condition is met (all non-mine tiles revealed).
 */
function countUnrevealed() {
  const { mineCount } = getDifficulty();
  const unrevealedCells = gameAsArray().filter((cell) => !cell.isRevealed);
  if (unrevealedCells.length === mineCount) {
    state.hasWon = true;
    state.isPlaying = false;
    document.body.dispatchEvent(events.gameOver);
  }
}

/**
 * Updates digit displays for the remaining mines counter (total mines minus placed flags).
 */
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

/**
 * Recalculates total flags placed on the board and triggers display update.
 */
function updateFlagCount() {
  const { mineCount } = getDifficulty();
  /** Reducer summing flagged cells within a single row. */
  const valueReducer = (accumulator, currentValue) => accumulator + (currentValue.hasFlag ? 1 : 0);
  /** Reducer summing flagged cells across all board rows. */
  const arrayReducer = (accumulator, currArray) => accumulator + currArray.reduce(valueReducer, 0);

  mines.flagCount = game.reduce(arrayReducer, 0);
  mines.minesMinusFlags = mineCount - mines.flagCount;

  updateFlagElements();
}

/**
 * Counts the number of neighboring mines around a specific cell coordinate.
 *
 * @param {[number, number]} param0 - Coordinates array [row, column].
 * @returns {number} Number of neighboring mines.
 */
function getValue([row, column]) {
  return getNeighbors([row, column]).filter((cell) => cell.isMine).length;
}

/**
 * Counts the number of neighboring flagged cells around a specific cell coordinate.
 *
 * @param {[number, number]} param0 - Coordinates array [row, column].
 * @returns {number} Number of neighboring flags.
 */
function countSurroundingFlags([row, column]) {
  return getNeighbors([row, column]).filter((cell) => cell.hasFlag).length;
}

/**
 * Listens for the initial board click to seed mines and begin active gameplay.
 */
function watchTableFirstClick() {
  tableElement.addEventListener('click', () => {
    if (state.isPlaying || state.hasWon || state.gameOver) return;
    setMines();
  });
}

/**
 * Timer polling loop that updates elapsed seconds every interval while game is active.
 */
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

/**
 * Updates UI elements (sunglasses face for win, dead face for loss) when game ends.
 */
function renderGameOver() {
  if (state.hasWon) {
    faceElement.classList.add('sunglasses');
    mines.minesMinusFlags = 0;
    updateFlagElements();
  } else {
    faceElement.classList.add('dead');
  }
}

/**
 * Transitions state to active play, initializes timer timestamp, and dispatches isPlaying event.
 */
function play() {
  state.isPlaying = true;
  time.date = Date.now();
  document.body.dispatchEvent(events.isPlaying);
}

/**
 * Cleans up and destroys all MineSquare instances in the current game grid.
 */
function destroyGame() {
  for (let i = 0; i < game.length; i++) {
    for (let j = 0; j < game[i].length; j++) {
      game[i][j].destroy();
      game[i][j] = undefined;
    }
  }
}

/**
 * Resets the entire game state, timer, counters, and regenerates a fresh board.
 */
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
