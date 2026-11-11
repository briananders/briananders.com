import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const Board = require('../src/js/posts/ant-life-simulator/_board');

// Exercise real board turns, including movement against all four boundaries.
test('turns preserve accurate populations and finish without pending phase callbacks', (t) => {
  const dom = new JSDOM('<div id="board"></div>');
  global.document = dom.window.document;
  global.Event = dom.window.Event;
  const element = document.getElementById('board');
  let seed = 42;
  t.mock.method(Math, 'random', () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  });
  const board = new Board(element, 10);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let ended = false;
  element.addEventListener('end', () => { ended = true; });
  for (let turn = 0; turn < 100 && !ended; turn++) {
    board.move();
    t.mock.timers.tick(100);
    const scores = board.getScores();
    assert.equal(scores.antsCount, element.querySelectorAll('[data-value="ant"]').length);
    assert.equal(scores.antEatersCount, element.querySelectorAll('[data-value="anteater"]').length);
    assert.ok(scores.antsCount + scores.antEatersCount <= 100);
  }
  assert.ok(ended, 'starvation or predation must eventually end a finite run');
  board.destroy();
  t.mock.timers.tick(1000);
  assert.equal(element.children.length, 0);
  dom.window.close();
});

// Rendering must not make a parent eligible to reproduce again in the same turn.
test('rendering preserves reproduction and hunger state', () => {
  const dom = new JSDOM('<div data-x="0" data-y="0"></div>');
  const Cell = require('../src/js/posts/ant-life-simulator/_cell');
  const cell = new Cell(dom.window.document.querySelector('div'));
  cell.value = 'anteater';
  cell.hungryCount = 7;
  cell.procreated = true;
  cell.render();
  assert.equal(cell.element.dataset.value, 'anteater');
  assert.equal(cell.hungryCount, 7);
  assert.equal(cell.procreated, true);
  cell.value = undefined;
  cell.render();
  assert.equal(cell.element.dataset.value, '');
  dom.window.close();
});

// Start is idempotent, and Replay must replace the old board without delayed work.
test('Start and Replay keep one loop and update scores after each turn', (t) => {
  const dom = new JSDOM(`<div id="board"></div><div id="overlay"><button id="button">Start</button></div>
    <span id="ants-count"></span><span id="ant-eaters-count"></span><span id="ants-eaten"></span>
    <span id="ant-eaters-eaten"></span><span id="ant-eaters-killed"></span>
    <span id="ants-bar"></span><span id="ant-eaters-bar"></span>`);
  global.document = dom.window.document;
  global.Event = dom.window.Event;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ready = require('../src/js/_modules/document-ready');
  t.mock.method(ready, 'document', callback => callback());
  require('../src/js/posts/ant-life-simulator/index');
  const button = document.getElementById('button');
  const element = document.getElementById('board');
  button.click();
  button.click();
  t.mock.timers.tick(0);
  assert.equal(document.getElementById('ants-count').innerText,
    new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 })
      .format(element.querySelectorAll('[data-value="ant"]').length));
  element.dispatchEvent(new Event('end'));
  assert.equal(button.innerText, 'Replay');
  const endedMarkup = element.innerHTML;
  t.mock.timers.tick(500);
  assert.equal(element.innerHTML, endedMarkup);
  button.click();
  assert.equal(element.children.length, 10000);
  assert.equal(element.querySelectorAll('[data-value="ant"]').length, 50);
  assert.equal(element.querySelectorAll('[data-value="anteater"]').length, 20);
  t.mock.timers.tick(100);
  element.dispatchEvent(new Event('end'));
  t.mock.timers.tick(1000);
  dom.window.close();
});

// A creature's hunger follows it into an empty cell, rather than restarting on movement.
test('a moving anteater starves on its twelfth unfed turn', (t) => {
  const dom = new JSDOM('<div id="board"></div>');
  global.document = dom.window.document;
  global.Event = dom.window.Event;
  const Cell = require('../src/js/posts/ant-life-simulator/_cell');
  const cells = [];
  const render = Cell.prototype.render;
  t.mock.method(Cell.prototype, 'render', function captureCell() {
    cells.push(this);
    render.call(this);
  });
  const board = new Board(document.getElementById('board'), 10);
  board.render();
  cells.forEach(cell => { cell.value = undefined; });
  const eater = cells.find(cell => cell.x === 5 && cell.y === 5);
  eater.value = 'anteater';
  eater.hungryCount = 11;
  cells.find(cell => cell.x === 0 && cell.y === 0).value = 'ant';
  t.mock.method(Math, 'random', () => 0);
  board.move();
  assert.equal(board.getScores().antEatersCount, 0);
  assert.equal(board.getScores().antEatersKilled, 1);
  assert.equal(board.getScores().antsCount, 1);
  board.destroy();
  dom.window.close();
});
