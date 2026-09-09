const ready = require('../_modules/document-ready');

const FILL_STYLE = 'rgba(255,255,255,1)';
const BACKGROUND_STYLE = 'rgba(33,33,33,0.005)';

const STEPS = 24; // squares per color spectrum

/**
 * Graph constructor that renders and simulates a real-time distribution histogram
 * of random column selections.
 *
 * @constructor
 */
function Graph() {
  const graphElement = document.getElementById('graph');
  let count = 0;

  /**
   * Generates DOM column elements corresponding to each histogram bucket.
   */
  function fill() {
    for (let i = 0; i < STEPS; i++) {
      const columnElement = document.createElement('column');
      columnElement.dataset.value = 0;
      columnElement.style.width = `${1 / (STEPS) * 100}%`;
      graphElement.appendChild(columnElement);
    }
  }

  /**
   * Recalculates distribution percentages and updates column heights and percentage labels.
   */
  function updateColumns() {
    const columnElements = Array.from(graphElement.children);
    columnElements.forEach((columnElement) => {
      const value = Number(columnElement.dataset.value);
      const percent = Math.round(((value / count) + Number.EPSILON) * 10000) / 100;
      columnElement.style.paddingBottom = `${percent}%`;
      columnElement.innerHTML = `<span>${percent}%</span>`;
    });
  }

  /**
   * Randomly increments a column value, recalculates distribution, and schedules next update.
   */
  function play() {
    const column = Math.floor(Math.random() * STEPS);
    count++;

    const columnElement = graphElement.children[column];
    const value = Number(columnElement.dataset.value) + 1;
    columnElement.dataset.value = value;

    updateColumns();

    setTimeout(play, 2);
  }

  /**
   * Initializes graph columns and starts the continuous distribution loop.
   */
  this.start = () => {
    fill();
    play();
  };
}

/**
 * Initializes the static canvas noise animation and accompanying distribution graph.
 */
ready.document(() => {
  const canvas = document.getElementById('canvas');
  const context = canvas.getContext('2d');
  let cellWidth;

  /**
   * Measures canvas bounding box and adjusts internal canvas dimensions and cell unit width.
   */
  function setCanvasDimensions() {
    const rect = canvas.getClientRects()[0];
    cellWidth = rect.width / STEPS;
    canvas.width = rect.width;
    canvas.height = rect.width;
  }

  /**
   * Draws an active noise pixel at grid coordinates (x, y) and overlays a faint translucent
   * dark wash across the entire canvas to simulate phosphor decay / noise trail effect.
   *
   * @param {number} x - Grid X position.
   * @param {number} y - Grid Y position.
   */
  function draw(x, y) { // 0-256 for each
    context.fillStyle = FILL_STYLE;
    context.strokeStyle = FILL_STYLE;
    context.fillRect(
      cellWidth * x,
      cellWidth * y,
      cellWidth,
      cellWidth
    );

    // Overlay faint background layer to create persistence / decay trail
    context.fillStyle = BACKGROUND_STYLE;
    context.strokeStyle = BACKGROUND_STYLE;
    context.fillRect(
      cellWidth * 0,
      cellWidth * 0,
      cellWidth * STEPS,
      cellWidth * STEPS
    );
  }

  /**
   * Selects random coordinates on the grid, renders the noise particle, and schedules next tick.
   */
  function play() {
    const x = Math.floor(Math.random() * STEPS);
    const y = Math.floor(Math.random() * STEPS);
    draw(x, y);

    // window.requestAnimationFrame(play);
    setTimeout(play, 1000 / 480);
  }

  /**
   * Renders the initial full-canvas fill and background trail layers.
   */
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
