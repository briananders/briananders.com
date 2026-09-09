/**
 * Formats a number with up to 3 significant digits using US English locale.
 *
 * @param {number} number - The numerical value to format.
 * @returns {string} Formatted number string.
 */
function formatNumber(number) {
  return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 }).format(number);
}

/**
 * Manages numerical score statistics displays (living counts, predation, starvation totals).
 *
 * @class ScoreBoard
 */
class ScoreBoard {

  #board;
  #antsCountElement;
  #antEatersCountElement;
  #antsEatenElement;
  #antEatersEatenElement;
  #antEatersKilledElement;

  /**
   * Initializes ScoreBoard with references to the simulation board and metric DOM elements.
   *
   * @param {Object} options - Configuration options.
   * @param {Object} options.board - Board simulation instance.
   * @param {HTMLElement} options.antsCountElement - Living ant count element.
   * @param {HTMLElement} options.antEatersCountElement - Living ant eater count element.
   * @param {HTMLElement} options.antsEatenElement - Cumulative ants eaten count element.
   * @param {HTMLElement} options.antEatersEatenElement - Cumulative ant eaters eaten element.
   * @param {HTMLElement} options.antEatersKilledElement - Cumulative ant eaters killed by starvation element.
   */
  constructor({
    board,
    antsCountElement,
    antEatersCountElement,
    antsEatenElement,
    antEatersEatenElement,
    antEatersKilledElement,
  }) {
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
  update() {
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
   * @param {Object} newBoard - New Board simulation instance.
   */
  setBoard(newBoard) {
    this.#board = newBoard;
    this.update();
  }
}

module.exports = ScoreBoard;
