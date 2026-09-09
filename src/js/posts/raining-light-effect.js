const ready = require('../_modules/document-ready');
const windowResize = require('../_modules/window-resize');

/**
 * Returns a CSS rgba color string for white with the specified alpha opacity.
 *
 * @param {number} a - Opacity value between 0 and 1.
 * @returns {string} RGBA color string.
 */
const COLOR = (a) => `rgba(255,255,255,${a})`;
const RADIUS = 6;
const PADDING = 2;
const TAIL_LENGTH = 13;
const FPS = 1000 / 30;
const lanes = [];
let extraPadding = 0;
let maxHeight = 0;

/**
 * Generates a random integer fall distance between 5 and maxHeight steps.
 *
 * @returns {number} Random length in grid steps.
 */
function randomLength() {
  return Math.floor(Math.random() * maxHeight) + 5;
}

/**
 * Manages the lifecycle and rendering of an individual raining light droplet.
 *
 * @param {Object} options - Droplet configuration options.
 * @param {number} options.LANE - Column index for the drop.
 * @param {HTMLCanvasElement} options.canvas - Target canvas element.
 * @param {CanvasRenderingContext2D} options.context - 2D context for drawing.
 * @returns {void}
 */
function RainDrop({
  LANE,
  canvas,
  context,
}) {
  let index = 0;
  let finishIndex = 0;
  const length = randomLength();
  const radius = RADIUS;
  const lane = LANE;
  const middleOfTheLane = ((((RADIUS * 2) + PADDING) * (lane + 1)) - RADIUS) + (extraPadding / 2);
  const clearX = middleOfTheLane - RADIUS;
  const clearY = 0;

  /**
   * Clears the rectangular column bounds on the canvas for this raindrop's lane.
   *
   * @returns {void}
   */
  function clearLane() {
    context.beginPath();
    context.clearRect(clearX, clearY, RADIUS * 2, canvas.height);
    context.closePath();
  }

  /**
   * Calculates the Y pixel coordinate for a given vertical step index.
   *
   * @param {number} yIndex - Vertical grid step index.
   * @returns {number} Y coordinate in pixels.
   */
  function dropY(yIndex) {
    return ((((RADIUS * 2) + PADDING) * yIndex) - RADIUS) + (extraPadding / 2);
  }

  /**
   * Renders the light droplet and its fading tail segments on canvas.
   *
   * @param {Object} options - Draw parameters.
   * @param {number} options.lane - Lane column index.
   * @param {number} options.drawIndex - Current leading step index.
   * @param {number} [options.fade=0] - Additional alpha fade reduction.
   * @returns {void}
   */
  function draw({
    lane,
    drawIndex,
    fade = 0,
  }) {
    clearLane();

    context.beginPath();

    for (let i = 0; i < TAIL_LENGTH; i++) {
      const y = dropY(drawIndex - i);
      context.arc(middleOfTheLane, y - i, RADIUS, 0, 2 * Math.PI, false);
      context.fillStyle = COLOR(1 - ((1 / TAIL_LENGTH) * i) - fade);
      context.fill();
    }

    context.closePath();
  }

  /**
   * Animates the fading dissipation of the tail after the drop stops advancing.
   *
   * @returns {void}
   */
  function finish() {
    finishIndex++;

    draw({
      lane,
      drawIndex: index,
      fade: (1 / TAIL_LENGTH) * finishIndex,
    });

    if (finishIndex >= TAIL_LENGTH) {
      lanes[lane] = undefined;
      clearLane();
    } else {
      setTimeout(finish, FPS);
    }
  }

  /**
   * Advances the droplet down the lane frame-by-frame until reaching its target length.
   *
   * @returns {void}
   */
  function animate() {
    index++;
    draw({ lane, drawIndex: index });

    if (index >= length) {
      finish();
    } else {
      setTimeout(animate, FPS);
    }
  }

  animate();
}

ready.document(() => {
  const canvas = document.getElementById('canvas');
  const context = canvas.getContext('2d');

  canvas.width = canvas.clientWidth * 2;
  canvas.height = canvas.clientHeight * 2;

  let dropLanes = ((canvas.width - PADDING) / ((RADIUS * 2) + PADDING)) - 1;
  extraPadding = (canvas.width - PADDING) % ((RADIUS * 2) + PADDING);
  maxHeight = ((canvas.height - extraPadding - PADDING) / ((RADIUS * 2) + PADDING)) - 1;

  /**
   * Spawns new raindrops in available lanes at regular intervals.
   */
  function loop() {
    const randomLane = Math.floor(Math.random() * dropLanes);
    if (lanes[randomLane] === undefined) {
      lanes[randomLane] = true;
      RainDrop({
        LANE: randomLane,
        canvas,
        context,
      });
    }

    setTimeout(loop, FPS);
  }

  windowResize(() => {
    canvas.width = canvas.clientWidth * 2;
    canvas.height = canvas.clientHeight * 2;

    dropLanes = ((canvas.width - PADDING) / ((RADIUS * 2) + PADDING)) - 1;
    extraPadding = (canvas.width - PADDING) % ((RADIUS * 2) + PADDING);
    maxHeight = ((canvas.height - extraPadding - PADDING) / ((RADIUS * 2) + PADDING)) - 1;
  });

  loop();
});
