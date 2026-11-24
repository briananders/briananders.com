import type { Board } from './_board.ts';

export interface ScoreBarOptions {
  board: Board;
  antsBarElement: HTMLElement;
  antEatersBarElement: HTMLElement;
}

/**
 * Manages the visualization of population ratios as proportional percentage bars in the UI.
 *
 * @class ScoreBar
 */
class ScoreBar {
  #board: Board;

  #antsBarElement: HTMLElement;

  #antEatersBarElement: HTMLElement;

  /**
   * Initializes the score bar with a board instance and corresponding DOM bar elements.
   *
   * @param {ScoreBarOptions} options - Configuration options.
   */
  constructor({
    board,
    antsBarElement,
    antEatersBarElement,
  }: ScoreBarOptions) {
    this.#board = board;
    this.#antsBarElement = antsBarElement;
    this.#antEatersBarElement = antEatersBarElement;
  }

  /**
   * Recalculates ant and ant eater population percentages and updates bar element widths.
   */
  update(): void {
    const scores = this.#board.getScores();
    const total = this.#board.width * this.#board.height;
    this.#antsBarElement.style.width = `${(scores.antsCount / total) * 100}%`;
    this.#antEatersBarElement.style.width = `${(scores.antEatersCount / total) * 100}%`;
  }

  /**
   * Assigns a new board instance and updates the bar displays.
   *
   * @param {Board} newBoard - New Board simulation instance.
   */
  setBoard(newBoard: Board): void {
    this.#board = newBoard;
    this.update();
  }
}

export type { ScoreBar };
module.exports = ScoreBar;
