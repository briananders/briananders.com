const Cell = require('./_cell');

const {
  ANT,
  ANT_EATER,
  STARTING_ANT_COUNT,
  STARTING_ANT_EATER_COUNT,
  ANT_REPRODUCTION_RATE,
  ANT_EATER_REPRODUCTION_RATE,
  ANT_EATER_DIE_OF_HUNGER,
  DELAY,
} = require('./_constants');

/**
 * Manages the simulation grid, creature movement, reproduction, predation, and rendering.
 *
 * @class Board
 */
class Board {
  /*
    Private variables
  */
  #element;
  #board;

  /*
    Public variables
  */
  width = 0;
  height = 0;
  antsEaten = 0;
  antEatersEaten = 0;
  antEatersKilled = 0;

  /*
    Constructor
  */
  /**
   * Initializes the simulation board with given dimensions, generates cell DOM elements,
   * and seeds initial ant and ant eater populations.
   *
   * @param {HTMLElement} element - The container DOM element for the grid.
   * @param {number} size - The width and height of the grid in number of cells.
   */
  constructor(element, size) {
    // Set up
    this.#element = element;
    this.width = size;
    this.height = size;
    this.#element.dataset.size = size;
    this.#element.style.setProperty('--size', size);

    const returnArray = [];
    for (let i = 0; i < size; i++) {
      returnArray[i] = [];

      for (let j = 0; j < size; j++) {
        const cellElement = document.createElement('div');
        cellElement.dataset.x = i;
        cellElement.dataset.y = j;
        element.append(cellElement);

        returnArray[i][j] = new Cell(cellElement);
      }
    }
    this.#board = returnArray;

    // Start
    this.#mapElementsToBoard();

    this.#initializeAnts();
    this.#initializeAntEaters();
  }

  /*
    Private functions
  */
  /**
   * Maps existing child elements in container to corresponding grid positions in board matrix.
   *
   * @private
   */
  #mapElementsToBoard() {
    Array.from(this.#element.children).forEach((childElement) => {
      const x = Number(childElement.dataset.x);
      const y = Number(childElement.dataset.y);

      this.#board[x][y] = new Cell(childElement);
    });
  }

  /**
   * Randomly populates the grid with initial ant population.
   *
   * @private
   */
  #initializeAnts() {
    let antsToPlace = STARTING_ANT_COUNT;

    while (antsToPlace > 0) {
      const randomX = Math.floor(Math.random() * this.width);
      const randomY = Math.floor(Math.random() * this.height);

      if (this.#cellIsEmpty(randomX, randomY)) {
        this.#setCell(randomX, randomY, ANT);
        antsToPlace--;
      }
    }
  }

  /**
   * Randomly populates the grid with initial ant eater population.
   *
   * @private
   */
  #initializeAntEaters() {
    let antEatersToPlace = STARTING_ANT_EATER_COUNT;

    while (antEatersToPlace > 0) {
      const randomX = Math.floor(Math.random() * this.width);
      const randomY = Math.floor(Math.random() * this.height);

      if (this.#cellIsEmpty(randomX, randomY)) {
        this.#setCell(randomX, randomY, ANT_EATER);
        antEatersToPlace--;
      }
    }
  }

  /**
   * Relocates a creature from a source cell to a target cell.
   *
   * @private
   * @param {[number, number]} param0 - Source coordinate [x, y].
   * @param {[number, number]} param1 - Destination coordinate [newX, newY].
   * @param {string} type - Creature type identifier.
   */
  #moveFromTo([x, y], [newX, newY], type) {
    const oldCell = this.#getCell(x, y);
    const newCell = this.#getCell(newX, newY);

    oldCell.value = undefined;
    newCell.value = type;
  }

  /**
   * Moves creature at (x, y) one cell to the left if destination is in bounds and empty.
   *
   * @private
   * @param {number} x - Current X coordinate.
   * @param {number} y - Current Y coordinate.
   * @param {string} type - Creature type identifier.
   */
  #moveLeft(x, y, type) {
    if (x - 1 >= 0 && this.#getCell(x - 1, y).isEmpty()) {
      this.#moveFromTo([x, y], [x - 1, y], type);
    }
  }

  /**
   * Moves creature at (x, y) one cell to the right if destination is in bounds and empty.
   *
   * @private
   * @param {number} x - Current X coordinate.
   * @param {number} y - Current Y coordinate.
   * @param {string} type - Creature type identifier.
   */
  #moveRight(x, y, type) {
    if (x + 1 < this.width && this.#getCell(x + 1, y).isEmpty()) {
      this.#moveFromTo([x, y], [x + 1, y], type);
    }
  }

  /**
   * Moves creature at (x, y) one cell down if destination is in bounds and empty.
   *
   * @private
   * @param {number} x - Current X coordinate.
   * @param {number} y - Current Y coordinate.
   * @param {string} type - Creature type identifier.
   */
  #moveDown(x, y, type) {
    if (y - 1 >= 0 && this.#getCell(x, y - 1).isEmpty()) {
      this.#moveFromTo([x, y], [x, y - 1], type);
    }
  }

  /**
   * Moves creature at (x, y) one cell up if destination is in bounds and empty.
   *
   * @private
   * @param {number} x - Current X coordinate.
   * @param {number} y - Current Y coordinate.
   * @param {string} type - Creature type identifier.
   */
  #moveUp(x, y, type) {
    if (y + 1 < this.height && this.#getCell(x, y + 1).isEmpty()) {
      this.#moveFromTo([x, y], [x, y + 1], type);
    }
  }

  /**
   * Returns all valid adjacent neighbor cells surrounding coordinate (x, y) in the grid.
   *
   * @private
   * @param {number} x - X coordinate.
   * @param {number} y - Y coordinate.
   * @returns {Cell[]} Array of surrounding Cell instances.
   */
  #getSurroundingCells(x, y) {
    const returnArray = [];
    for (let i = -1; i < 2; i++) {
      for (let j = -1; j < 2; j++) {
        if ((x + i >= 0)
            && (x + i < this.width)
            && (y + j >= 0)
            && (y + j < this.height)
            && !(i === 0 && j === 0)) {
          returnArray.push(this.#getCell(x + i, y + j));
        }
      }
    }
    return returnArray;
  }

  /**
   * Executes reproduction step for ants. When adjacent to another ant and an empty space exists,
   * spawns new ant based on probability rate.
   *
   * @private
   */
  #multiplyAnts() {
    const ants = this.#getAnts();
    ants.forEach((ant) => {
      const { x, y } = ant;
      const surrounds = this.#getSurroundingCells(x, y);
      const surroundAnts = surrounds.filter((cell) => cell.isAnt() && !cell.procreated);
      const surroundEmpty = surrounds.filter((cell) => cell.isEmpty());

      if (surroundAnts.length && surroundEmpty.length && Math.random() < ANT_REPRODUCTION_RATE) {
        const randomEmptyIndex = Math.floor(Math.random() * surroundEmpty.length);
        const randomAntIndex = Math.floor(Math.random() * surroundAnts.length);
        surroundEmpty[randomEmptyIndex].value = ANT;

        // mark as procreated.
        ant.procreated = true;
        surroundAnts[randomAntIndex].procreated = true;
        surroundEmpty[randomEmptyIndex].procreated = true;
      }
    });
  }

  /**
   * Executes reproduction step for ant eaters. When adjacent to another ant eater and an empty space exists,
   * spawns new ant eater based on probability rate.
   *
   * @private
   */
  #multiplyAntEaters() {
    const antEaters = this.#getAntEaters();
    antEaters.forEach((antEater) => {
      const { x, y } = antEater;
      const surrounds = this.#getSurroundingCells(x, y);
      const surroundAntEaters = surrounds.filter((cell) => cell.isAntEater() && !cell.procreated);
      const surroundEmpty = surrounds.filter((cell) => cell.isEmpty());

      if (surroundAntEaters.length && surroundEmpty.length && Math.random() < ANT_EATER_REPRODUCTION_RATE) {
        const randomEmptyIndex = Math.floor(Math.random() * surroundEmpty.length);
        const randomAntIndex = Math.floor(Math.random() * surroundAntEaters.length);
        surroundEmpty[randomEmptyIndex].value = ANT_EATER;

        // mark as procreated.
        antEater.procreated = true;
        surroundAntEaters[randomAntIndex].procreated = true;
        surroundEmpty[randomEmptyIndex].procreated = true;
      }
    });
  }

  /**
   * Moves each ant randomly in one of 4 cardinal directions.
   *
   * @private
   */
  #moveAnts() {
    const ants = this.#getAnts();
    ants.forEach((ant) => {
      const { x, y } = ant;

      switch (Math.floor(Math.random() * 4)) {
        case 0: // left
          this.#moveLeft(x, y, ANT);
          break;
        case 1: // right
          this.#moveRight(x, y, ANT);
          break;
        case 2: // up
          this.#moveUp(x, y, ANT);
          break;
        default: // down
          this.#moveDown(x, y, ANT);
      }
    });
  }

  /**
   * Causes ant eaters to consume adjacent ants and resets/increments hunger counters.
   *
   * @private
   */
  #eatAnts() {
    const antEaters = this.#getAntEaters();
    antEaters.forEach((eater) => {
      const { x, y } = eater;
      const surrounds = this.#getSurroundingCells(x, y);
      const surroundAnts = surrounds.filter((cell) => cell.isAnt());

      if (surroundAnts.length === 0) {
        eater.hungryCount++;
      } else {
        eater.hungryCount = 0;
      }

      surroundAnts.forEach((ant) => { ant.value = undefined; this.antsEaten++; });
    });
  }

  /**
   * Kills ant eaters that are swarmed by ants or have starved past the hunger threshold.
   *
   * @private
   */
  #killAntEaters() {
    const antEaters = this.#getAntEaters();
    antEaters.forEach((eater) => {
      const { x, y } = eater;
      const surrounds = this.#getSurroundingCells(x, y);
      const surroundAnts = surrounds.filter((cell) => cell.isAnt());
      const surroundAntEaters = surrounds.filter((cell) => cell.isAntEater());

      if (surroundAnts.length === surrounds.length) {
        eater.value = undefined;
        this.antEatersEaten++;
      } else if (eater.hungryCount >= ANT_EATER_DIE_OF_HUNGER) {
        eater.toDie = true;
      } else if (surroundAntEaters.length === surrounds.length) {
        // eater.toDie = true;
      }
    });
    antEaters.forEach((eater) => {
      if (eater.toDie) {
        eater.value = undefined;
        this.antEatersKilled++;
        eater.toDie = false;
      }
    });
  }

  /**
   * Moves each ant eater randomly in one of 4 cardinal directions.
   *
   * @private
   */
  #moveAntEaters() {
    const antEaters = this.#getAntEaters();
    antEaters.forEach((antEater) => {
      const { x, y } = antEater;

      switch (Math.floor(Math.random() * 4)) {
        case 0: // left
          this.#moveLeft(x, y, ANT_EATER);
          break;
        case 1: // right
          this.#moveRight(x, y, ANT_EATER);
          break;
        case 2: // up
          this.#moveUp(x, y, ANT_EATER);
          break;
        default: // down
          this.#moveDown(x, y, ANT_EATER);
      }
    });
  }

  /**
   * Retrieves the Cell instance at grid coordinate (x, y).
   *
   * @private
   * @param {number} x - X coordinate.
   * @param {number} y - Y coordinate.
   * @returns {Cell} Cell instance at (x, y).
   */
  #getCell(x, y) { return this.#board[Number(x)][Number(y)]; }

  /**
   * Checks whether the cell at coordinate (x, y) is empty.
   *
   * @private
   * @param {number} x - X coordinate.
   * @param {number} y - Y coordinate.
   * @returns {boolean} True if cell has no occupant, false otherwise.
   */
  #cellIsEmpty(x, y) { return this.#getCell(Number(x), Number(y)).isEmpty(); }

  /**
   * Sets the occupant value of the cell at coordinate (x, y).
   *
   * @private
   * @param {number} x - X coordinate.
   * @param {number} y - Y coordinate.
   * @param {string|undefined} value - Creature identifier or undefined.
   */
  #setCell(x, y, value) {
    this.#getCell(Number(x), Number(y)).value = value;
  }

  /**
   * Collects all cells on the board currently occupied by ants.
   *
   * @private
   * @returns {Cell[]} Array of ant cell instances.
   */
  #getAnts() {
    const ants = [];

    this.#board.forEach((row) => {
      row.forEach((cell) => {
        if (cell.isAnt()) ants.push(cell);
      });
    });

    return ants;
  }

  /**
   * Collects all cells on the board currently occupied by ant eaters.
   *
   * @private
   * @returns {Cell[]} Array of ant eater cell instances.
   */
  #getAntEaters() {
    const antEaters = [];

    this.#board.forEach((row) => {
      row.forEach((cell) => {
        if (cell.isAntEater()) antEaters.push(cell);
      });
    });

    return antEaters;
  }

  /**
   * Dispatches an 'end' event on the board element if either species population drops to 0.
   *
   * @private
   */
  #checkForEnd() {
    const { antsCount, antEatersCount } = this.getScores();
    if (antsCount === 0 || antEatersCount === 0) {
      const endEvent = new Event('end');
      this.#element.dispatchEvent(endEvent);
    }
  }

  /*
    Public functions
  */

  /**
   * Retrieves current simulation statistics and population counts.
   *
   * @returns {{antsCount: number, antEatersCount: number, antsEaten: number, antEatersEaten: number, antEatersKilled: number}} Current score snapshot.
   */
  getScores() {
    return {
      antsCount: this.#getAnts().length,
      antEatersCount: this.#getAntEaters().length,
      antsEaten: this.antsEaten,
      antEatersEaten: this.antEatersEaten,
      antEatersKilled: this.antEatersKilled,
    };
  }

  /**
   * Executes a full simulation cycle through staggered timed phases:
   * 1. Move ants
   * 2. Move ant eaters
   * 3. Kill starving/swarmed ant eaters
   * 4. Ant eaters eat ants
   * 5. Multiply ant eaters
   * 6. Multiply ants
   */
  move() {
    let index = 0;

    setTimeout(() => {
      // step 0
      this.#moveAnts();
      this.render();
    }, DELAY * index);

    index++;

    setTimeout(() => {
      // step 1
      this.#moveAntEaters();
      this.render();
    }, DELAY * index);

    index++;

    setTimeout(() => {
      // step 2
      this.#killAntEaters();
      this.render();
    }, DELAY * index);

    index++;

    setTimeout(() => {
      // step 3
      this.#eatAnts();
      this.render();
    }, DELAY * index);

    index++;

    setTimeout(() => {
      // step 4
      this.#multiplyAntEaters();
      this.render();
    }, DELAY * index);

    index++;

    setTimeout(() => {
      // step 5
      this.#multiplyAnts();
      this.render();
    }, DELAY * index);

    this.#checkForEnd();
  }

  /**
   * Renders each cell on the board to reflect its current state in the DOM.
   */
  render() {
    this.#board.forEach((row) => {
      row.forEach((cell) => {
        cell.render();
      });
    });
  }

  /**
   * Clears the board DOM content and resets internal references.
   */
  destroy() {
    this.#element.innerHTML = '';
    this.#board = undefined;
  }
}

module.exports = Board;
