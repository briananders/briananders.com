const ready = require('../_modules/document-ready.ts');

/**
 * Initializes the Lissajous curve animation, canvases, and step controls on DOM ready.
 */
ready.document(() => {
  /**
   * Initializes a canvas element by selector query and configures its resolution.
   *
   * @param {string} query - CSS selector for the canvas element.
   * @returns {[HTMLCanvasElement, CanvasRenderingContext2D]} Array containing the canvas and its 2D context.
   */
  function setupCanvas(query: string): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const canvas = document.querySelector<HTMLCanvasElement>(query)!;
    canvas.width = 1000;
    canvas.height = 1000;
    const context = canvas.getContext('2d')!;
    return [canvas, context];
  }

  const axLine = document.querySelector<HTMLElement>('.ax-line')!;
  const ayLine = document.querySelector<HTMLElement>('.ay-line')!;
  const aStepElement = document.querySelector<HTMLInputElement>('#a-step')!;
  const bxLine = document.querySelector<HTMLElement>('.bx-line')!;
  const byLine = document.querySelector<HTMLElement>('.by-line')!;
  const bStepElement = document.querySelector<HTMLInputElement>('#b-step')!;

  const [, mainContext] = setupCanvas('#lissajous-curve');

  let aCircumferencePosition = 27; // circumference out of 360
  let bCircumferencePosition = 27; // circumference out of 360

  let aStep = Number(aStepElement.value);
  let bStep = Number(bStepElement.value);

  const padding = 50;
  const circleDiameter = 400;
  const circleRadius = circleDiameter / 2;

  const pointDiameter = 5;
  const pointRadius = pointDiameter / 2;

  let axCache: number | null = null;
  let ayCache: number | null = null;
  let bxCache: number | null = null;
  let byCache: number | null = null;

  const FILL_STYLE = '#ffffff';

  /**
   * Rounds a number up to two decimal places.
   *
   * @param {number} num - Value to round.
   * @returns {number} Value rounded to 2 decimal places.
   */
  function moneyRound(num: number): number {
    return Math.ceil(num * 100) / 100;
  }

  /**
   * Converts degrees into radians.
   *
   * @param {number} [deg=0] - Angle in degrees.
   * @returns {number} Angle in radians.
   */
  function degreesToRadians(deg = 0): number {
    return (deg * (2 * Math.PI)) / 360;
  }

  // function radiansToDegrees(radians = 0) {
  //   return (radians * 360) / (2 * Math.PI);
  // }

  /**
   * Clears the drawn curve areas and resets angle positions and cached coordinates.
   */
  function reset(): void {
    mainContext.clearRect(525, 525, 450, 450);
    mainContext.clearRect(25, 25, 450, 450);

    axCache = null;
    ayCache = null;
    bxCache = null;
    byCache = null;

    aCircumferencePosition = 27;
    bCircumferencePosition = 27;

    aStep = Number(aStepElement.value);
    bStep = Number(bStepElement.value);
  }

  /**
   * Calculates the (X, Y) coordinates along a circle perimeter for a given degree and radius.
   *
   * @param {number} degrees - Angle along circumference in degrees.
   * @param {number} radius - Radius of the circle.
   * @returns {[number, number]} Computed [x, y] coordinates.
   */
  function getCirclePoints(degrees: number, radius: number): [number, number] {
    const cx = radius;
    const cy = radius;
    const angle = degreesToRadians(degrees);
    /*
        Where r is the radius, cx,cy the origin, and a the angle.

        That’s pretty easy to adapt into any language with basic trig functions.
        Note that most languages will use radians for the angle in trig functions,
        so rather than cycling through 0..360 degrees,
        you're cycling through 0..2PI radians.
      */
    const returnX = cx + (radius * Math.cos(angle));
    const returnY = cy + (radius * Math.sin(angle));
    return [returnX, returnY];
  }

  /**
   * Offsets coordinate values and rounds them to two decimal places.
   *
   * @param {number} xValue - Base X coordinate.
   * @param {number} yValue - Base Y coordinate.
   * @param {number} xOffset - X translation offset.
   * @param {number} yOffset - Y translation offset.
   * @returns {[number, number]} Offset and rounded [x, y] coordinates.
   */
  function getWithOffset(
    xValue: number,
    yValue: number,
    xOffset: number,
    yOffset: number,
  ): [number, number] {
    return [moneyRound(xValue + xOffset), moneyRound(yValue + yOffset)];
  }

  /**
   * Draws a stroke line segment connecting two points on the main canvas.
   *
   * @param {number} x1 - Starting point X.
   * @param {number} y1 - Starting point Y.
   * @param {number} x2 - Ending point X.
   * @param {number} y2 - Ending point Y.
   */
  function drawLine(x1: number, y1: number, x2: number, y2: number): void {
    mainContext.beginPath();
    mainContext.fillStyle = FILL_STYLE;
    mainContext.strokeStyle = FILL_STYLE;
    mainContext.stroke();
    mainContext.lineWidth = 1;
    mainContext.moveTo(x1, y1);
    mainContext.lineTo(x2, y2);
    mainContext.fillStyle = FILL_STYLE;
    mainContext.strokeStyle = FILL_STYLE;
    mainContext.stroke();
  }

  /**
   * Main animation loop step: advances circle positions, aligns indicator lines, and draws curve segments.
   */
  function runLoop(): void {
    // iterate
    aCircumferencePosition += aStep;
    bCircumferencePosition += bStep;

    // keep it between 0 and 360;
    aCircumferencePosition %= 360;
    bCircumferencePosition %= 360;

    const [ax, ay] = getCirclePoints(aCircumferencePosition, circleRadius);
    const [bx, by] = getCirclePoints(bCircumferencePosition, circleRadius);

    const [axOffset, ayOffset] = getWithOffset(ax, ay, 500 + padding, padding);
    const [bxOffset, byOffset] = getWithOffset(bx, by, padding, 500 + padding);
    const [newAXOffset, newBYOffset] = getWithOffset(ax, by, 500 + padding, 500 + padding);
    const [newBXOffset, newAYOffset] = getWithOffset(bx, ay, padding, padding);

    axLine.style.left = `${axOffset / 10}%`;
    axLine.style.top = `${ayOffset / 10}%`;
    axLine.style.height = `${(byOffset - ayOffset) / 10}%`;

    bxLine.style.left = `${bxOffset / 10}%`;
    bxLine.style.top = `${ayOffset / 10}%`;
    bxLine.style.height = `${(byOffset - ayOffset) / 10}%`;

    byLine.style.top = `${byOffset / 10}%`;
    byLine.style.left = `${bxOffset / 10}%`;
    byLine.style.width = `${(axOffset - bxOffset) / 10}%`;

    ayLine.style.top = `${ayOffset / 10}%`;
    ayLine.style.left = `${bxOffset / 10}%`;
    ayLine.style.width = `${(axOffset - bxOffset) / 10}%`;

    mainContext.clearRect(525, 25, 450, 450);
    mainContext.clearRect(25, 525, 450, 450);

    mainContext.fillRect(
      axOffset - pointRadius,
      ayOffset - pointRadius,
      pointDiameter,
      pointDiameter
    );
    mainContext.fillRect(
      bxOffset - pointRadius,
      byOffset - pointRadius,
      pointDiameter,
      pointDiameter
    );

    if (axCache != null && ayCache != null && bxCache != null && byCache != null) {
      drawLine(
        axCache,
        byCache,
        newAXOffset - pointRadius,
        newBYOffset - pointRadius
      );

      drawLine(
        bxCache,
        ayCache,
        newBXOffset - pointRadius,
        newAYOffset - pointRadius
      );
    }

    axCache = newAXOffset - pointRadius;
    ayCache = newAYOffset - pointRadius;
    bxCache = newBXOffset - pointRadius;
    byCache = newBYOffset - pointRadius;

    window.setTimeout(runLoop, 1000 / 30);
  }

  aStepElement.addEventListener('change', reset);
  bStepElement.addEventListener('change', reset);

  runLoop();
});
