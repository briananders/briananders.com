import type { Board } from './_board.ts';

export interface ScoreBoardOptions {
  board: Board;
  antsCountElement: HTMLElement;
  antEatersCountElement: HTMLElement;
  antsEatenElement: HTMLElement;
  antEatersEatenElement: HTMLElement;
  antEatersKilledElement: HTMLElement;
}

/**
 * Formats a number with up to 3 significant digits using US English locale.
 *
 * @param {number} number - The numerical value to format.
 * @returns {string} Formatted number string.
 */
function formatNumber(number: number): string {
  return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 }).format(number);
}

/**
 * Manages numerical score statistics displays (living counts, predation, starvation totals).
 *
 * @class ScoreBoard
 */
class ScoreBoard {
  #board: Board;

  #antsCountElement: HTMLElement;

  #antEatersCountElement: HTMLElement;

  #antsEatenElement: HTMLElement;

  #antEatersEatenElement: HTMLElement;

  #antEatersKilledElement: HTMLElement;

  /**
   * Initializes ScoreBoard with references to the simulation board and metric DOM elements.
   *
   * @param {ScoreBoardOptions} options - Configuration options.
   */
  constructor({
    board,
    antsCountElement,
    antEatersCountElement,
    antsEatenElement,
    antEatersEatenElement,
    antEatersKilledElement,
  }: ScoreBoardOptions) {
    this.#board = board;
    this.#antsCountElement = antsCountElement;
    this.#antEatersCountElement = antEatersCountElement;
    this.#antsEatenElement = antsEatenElement;
    this.#antEatersEatenElement = antEatersEatenElement;
    this.#antEatersKilledElement = antEatersKilledElement;
  }

  /**
   * Retrieves latest scores from the board and updates text content of scoreboard elements.
   */
  update(): void {
    const scores = this.#board.getScores();

    this.#antsCountElement.innerText = formatNumber(scores.antsCount);
    this.#antEatersCountElement.innerText = formatNumber(scores.antEatersCount);
    this.#antsEatenElement.innerText = formatNumber(scores.antsEaten);
    this.#antEatersEatenElement.innerText = formatNumber(scores.antEatersEaten);
    this.#antEatersKilledElement.innerText = formatNumber(scores.antEatersKilled);
  }

  /**
   * Rebinds the ScoreBoard to a new simulation board and refreshes stats.
   *
   * @param {Board} newBoard - New Board simulation instance.
   */
  setBoard(newBoard: Board): void {
    this.#board = newBoard;
    this.update();
  }
}

export type { ScoreBoard };
module.exports = ScoreBoard;
