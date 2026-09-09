/**
 * Manages the visualization of population ratios as proportional percentage bars in the UI.
 *
 * @class ScoreBar
 */
class ScoreBar {
  #board;
  #antsBarElement;
  #antEatersBarElement;

  /**
   * Initializes the score bar with a board instance and corresponding DOM bar elements.
   *
   * @param {Object} options - Configuration options.
   * @param {Object} options.board - Board simulation instance providing score data.
   * @param {HTMLElement} options.antsBarElement - DOM element representing the ant population bar.
   * @param {HTMLElement} options.antEatersBarElement - DOM element representing the ant eater population bar.
   */
  constructor({
    board,
    antsBarElement,
    antEatersBarElement,
  }) {
    this.#board = board;
    this.#antsBarElement = antsBarElement;
    this.#antEatersBarElement = antEatersBarElement;
  }

  /**
   * Recalculates ant and ant eater population percentages and updates bar element widths.
   */
  update() {
    const scores = this.#board.getScores();
    const total = this.#board.width * this.#board.height;
    this.#antsBarElement.style.width = `${(scores.antsCount / total) * 100}%`;
    this.#antEatersBarElement.style.width = `${(scores.antEatersCount / total) * 100}%`;
  }

  /**
   * Assigns a new board instance and updates the bar displays.
   *
   * @param {Object} newBoard - New Board simulation instance.
   */
  setBoard(newBoard) {
    this.#board = newBoard;
    this.update();
  }
}

module.exports = ScoreBar;
