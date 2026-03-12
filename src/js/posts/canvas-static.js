const ready = require('../_modules/document-ready');

const FILL_STYLE = 'rgba(255,255,255,1)';
const BACKGROUND_STYLE = 'rgba(33,33,33,0.005)';

const STEPS = 24; // squares per color spectrum

function Graph() {
  const graphElement = document.getElementById('graph');
  let count = 0;

  function fill() {
    for (let i = 0; i < STEPS; i++) {
      const columnElement = document.createElement('column');
      columnElement.dataset.value = 0;
      columnElement.style.width = `${1 / (STEPS) * 100}%`;
      graphElement.appendChild(columnElement);
    }
  }

  function updateColumns() {
    const columnElements = Array.from(graphElement.children);
    columnElements.forEach((columnElement) => {
      const value = Number(columnElement.dataset.value);
      const percent = Math.round(((value / count) + Number.EPSILON) * 10000) / 100;
      columnElement.style.paddingBottom = `${percent}%`;
      columnElement.innerHTML = `<span>${percent}%</span>`;
    });
  }

  function play() {
    const column = Math.floor(Math.random() * STEPS);
    count++;

    const columnElement = graphElement.children[column];
    const value = Number(columnElement.dataset.value) + 1;
    columnElement.dataset.value = value;

    updateColumns();

    setTimeout(play, 2);
  }

  this.start = () => {
    fill();
    play();
  };
}

ready.document(() => {
  const canvas = document.getElementById('canvas');
  const context = canvas.getContext('2d');
  let cellWidth;

  function setCanvasDimensions() {
    const rect = canvas.getClientRects()[0];
    cellWidth = rect.width / STEPS;
    canvas.width = rect.width;
    canvas.height = rect.width;
  }

  function draw(x, y) { // 0-256 for each
    context.fillStyle = FILL_STYLE;
    context.strokeStyle = FILL_STYLE;
    context.fillRect(
      cellWidth * x,
      cellWidth * y,
      cellWidth,
      cellWidth
    );

    context.fillStyle = BACKGROUND_STYLE;
    context.strokeStyle = BACKGROUND_STYLE;
    context.fillRect(
      cellWidth * 0,
      cellWidth * 0,
      cellWidth * STEPS,
      cellWidth * STEPS
    );
  }

  function play() {
    const x = Math.floor(Math.random() * STEPS);
    const y = Math.floor(Math.random() * STEPS);
    draw(x, y);

    // window.requestAnimationFrame(play);
    setTimeout(play, 1000 / 480);
  }

  function firstDraw() {
    context.fillStyle = FILL_STYLE;
    context.strokeStyle = FILL_STYLE;
    context.fillRect(
      cellWidth * 0,
      cellWidth * 0,
      cellWidth * STEPS,
      cellWidth * STEPS
    );

    context.fillStyle = BACKGROUND_STYLE;
    context.strokeStyle = BACKGROUND_STYLE;
    context.fillRect(
      cellWidth * 0,
      cellWidth * 0,
      cellWidth * STEPS,
      cellWidth * STEPS
    );
  }

  setCanvasDimensions();
  // firstDraw();
  play();

  const graph = new Graph();
  graph.start();
});
