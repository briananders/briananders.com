class ScoreBar {
  #board;
  #antsBarElement;
  #antEatersBarElement;

  constructor({
    board,
    antsBarElement,
    antEatersBarElement,
  }) {
    this.#board = board;
    this.#antsBarElement = antsBarElement;
    this.#antEatersBarElement = antEatersBarElement;
  }

  update() {
    const scores = this.#board.getScores();
    const total = this.#board.width * this.#board.height;
    this.#antsBarElement.style.width = `${(scores.antsCount / total) * 100}%`;
    this.#antEatersBarElement.style.width = `${(scores.antEatersCount / total) * 100}%`;
  }

  setBoard(newBoard) {
    this.#board = newBoard;
    this.update();
  }
}

module.exports = ScoreBar;
