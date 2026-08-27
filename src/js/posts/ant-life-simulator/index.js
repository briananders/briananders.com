const ready = require('../../_modules/document-ready');

const Board = require('./_board');
const ScoreBar = require('./_score-bar');
const ScoreBoard = require('./_score-board');

const {
  BOARD_SIZE,
  DURATION,
  DELAY,
} = require('./_constants');

function hideOverlay(element) {
  element.classList.add('hidden');
}

function showOverlay(element) {
  element.classList.remove('hidden');
  const button = element.querySelector('button');
  button.innerText = 'Replay';
}

ready.document(() => {
  let shouldReset = false;
  const overlayElement = document.getElementById('overlay');

  const boardElement = document.getElementById('board');
  let board = new Board(boardElement, BOARD_SIZE);

  const antsCountElement = document.getElementById('ants-count');
  const antEatersCountElement = document.getElementById('ant-eaters-count');
  const antsEatenElement = document.getElementById('ants-eaten');
  const antEatersEatenElement = document.getElementById('ant-eaters-eaten');
  const antEatersKilledElement = document.getElementById('ant-eaters-killed');
  const scoreBoard = new ScoreBoard({
    board,
    antsCountElement,
    antEatersCountElement,
    antsEatenElement,
    antEatersEatenElement,
    antEatersKilledElement,
  });

  const antsBarElement = document.getElementById('ants-bar');
  const antEatersBarElement = document.getElementById('ant-eaters-bar');
  const scoreBar = new ScoreBar({
    board,
    antsBarElement,
    antEatersBarElement,
  });

  const buttonElement = document.getElementById('button');
  const intervals = [];
  buttonElement.addEventListener('click', () => {
    if (shouldReset) {
      board.destroy();
      board = new Board(boardElement, BOARD_SIZE);
      scoreBoard.setBoard(board);
      scoreBar.setBoard(board);
    }

    hideOverlay(overlayElement);
    board.render();
    intervals.push(setInterval(() => { board.move(); }, DURATION));
    intervals.push(setInterval(() => { scoreBoard.update(); }, DELAY));
    intervals.push(setInterval(() => { scoreBar.update(); }, DELAY));

    shouldReset = false;
  });

  boardElement.addEventListener('end', () => {
    shouldReset = true;
    board.render();
    intervals.forEach((interval) => {
      clearInterval(interval);
    });
    showOverlay(overlayElement);
  });
});
