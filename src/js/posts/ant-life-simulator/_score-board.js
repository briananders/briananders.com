function formatNumber(number) {
  return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 }).format(number);
}
class ScoreBoard {

  #board;
  #antsCountElement;
  #antEatersCountElement;
  #antsEatenElement;
  #antEatersEatenElement;
  #antEatersKilledElement;

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

  update() {
    const scores = this.#board.getScores();

    this.#antsCountElement.innerText = formatNumber(scores.antsCount);
    this.#antEatersCountElement.innerText = formatNumber(scores.antEatersCount);
    this.#antsEatenElement.innerText = formatNumber(scores.antsEaten);
    this.#antEatersEatenElement.innerText = formatNumber(scores.antEatersEaten);
    this.#antEatersKilledElement.innerText = formatNumber(scores.antEatersKilled);
  }

  setBoard(newBoard) {
    this.#board = newBoard;
    this.update();
  }
}

module.exports = ScoreBoard;
