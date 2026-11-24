import type { Board as BoardInstance } from './_board.ts';
import type { ScoreBar as ScoreBarInstance, ScoreBarOptions } from './_score-bar.ts';
import type { ScoreBoard as ScoreBoardInstance, ScoreBoardOptions } from './_score-board.ts';

const ready = require('../../_modules/document-ready.ts');

const Board: new (element: HTMLElement, size: number) => BoardInstance = require('./_board.ts');
const ScoreBar: new (options: ScoreBarOptions) => ScoreBarInstance = require('./_score-bar.ts');
const ScoreBoard: new (options: ScoreBoardOptions) => ScoreBoardInstance = require('./_score-board.ts');

const {
  BOARD_SIZE,
  DURATION,
  DELAY,
} = require('./_constants.ts');

/**
 * Hides an overlay element by adding the CSS hidden class.
 *
 * @param {HTMLElement} element - The overlay element to hide.
 */
function hideOverlay(element: HTMLElement): void {
  element.classList.add('hidden');
}

/**
 * Displays the overlay element and changes its action button label to "Replay".
 *
 * @param {HTMLElement} element - The overlay element to show.
 */
function showOverlay(element: HTMLElement): void {
  element.classList.remove('hidden');
  const button = element.querySelector<HTMLButtonElement>('button')!;
  button.innerText = 'Replay';
}

/**
 * Initializes the Ant Life Simulator application once the DOM is loaded.
 */
ready.document(() => {
  let shouldReset = false;
  const overlayElement = document.getElementById('overlay') as HTMLElement;

  const boardElement = document.getElementById('board') as HTMLElement;
  let board = new Board(boardElement, BOARD_SIZE);

  const antsCountElement = document.getElementById('ants-count') as HTMLElement;
  const antEatersCountElement = document.getElementById('ant-eaters-count') as HTMLElement;
  const antsEatenElement = document.getElementById('ants-eaten') as HTMLElement;
  const antEatersEatenElement = document.getElementById('ant-eaters-eaten') as HTMLElement;
  const antEatersKilledElement = document.getElementById('ant-eaters-killed') as HTMLElement;
  const scoreBoard = new ScoreBoard({
    board,
    antsCountElement,
    antEatersCountElement,
    antsEatenElement,
    antEatersEatenElement,
    antEatersKilledElement,
  });

  const antsBarElement = document.getElementById('ants-bar') as HTMLElement;
  const antEatersBarElement = document.getElementById('ant-eaters-bar') as HTMLElement;
  const scoreBar = new ScoreBar({
    board,
    antsBarElement,
    antEatersBarElement,
  });

  const buttonElement = document.getElementById('button') as HTMLElement;
  const intervals: number[] = [];
  buttonElement.addEventListener('click', () => {
    if (shouldReset) {
      board.destroy();
      board = new Board(boardElement, BOARD_SIZE);
      scoreBoard.setBoard(board);
      scoreBar.setBoard(board);
    }

    hideOverlay(overlayElement);
    board.render();
    intervals.push(window.setInterval(() => { board.move(); }, DURATION));
    intervals.push(window.setInterval(() => { scoreBoard.update(); }, DELAY));
    intervals.push(window.setInterval(() => { scoreBar.update(); }, DELAY));

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
