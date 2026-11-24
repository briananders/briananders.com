import type { CreatureType } from './_constants.ts';

const {
  ANT,
  ANT_EATER,
} = require('./_constants.ts');

export type CellValue = CreatureType | '' | null | undefined;

/**
 * Represents a single grid cell in the ant life simulator.
 * Tracks cell coordinate, occupant status, and lifecycle flags.
 *
 * @class Cell
 */
class Cell {
  element: HTMLElement;

  x: number;

  y: number;

  value: CellValue;

  procreated: boolean;

  toDie: boolean;

  hungryCount: number;

  /**
   * Initializes cell with its corresponding DOM element and extracts coordinate data.
   *
   * @param {HTMLElement} element - The DOM element representing this cell.
   */
  constructor(element: HTMLElement) {
    this.element = element;
    /*
      Public Variables
    */
    this.x = Number(element.dataset.x);
    this.y = Number(element.dataset.y);
    this.value = undefined;
    this.procreated = false;
    this.toDie = false;
    this.hungryCount = 0;
  }

  /*
    Public Computed Properties
  */

  /**
   * Checks whether the cell is vacant.
   *
   * @returns {boolean} True if empty, false otherwise.
   */
  isEmpty(): boolean { return this.value === '' || this.value === null || this.value === undefined; }

  /**
   * Checks whether the cell contains an ant.
   *
   * @returns {boolean} True if cell contains an ant.
   */
  isAnt(): boolean { return this.value === ANT; }

  /**
   * Checks whether the cell contains an ant eater.
   *
   * @returns {boolean} True if cell contains an ant eater.
   */
  isAntEater(): boolean { return this.value === ANT_EATER; }

  /*
    Public Functions
  */

  /**
   * Updates data attributes on the cell DOM element and resets turn-specific flags (e.g. procreated).
   */
  render(): void {
    this.element.dataset.value = (this.value) ? this.value.toString() : '';
    this.procreated = false;
  }
}

export type { Cell };
module.exports = Cell;
