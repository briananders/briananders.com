const ready = require('../_modules/document-ready');

ready.document(() => {
  function setupCanvas(query) {
    const canvas = document.querySelector(query);
    canvas.width = 1000;
    canvas.height = 1000;
    const context = canvas.getContext('2d');
    return [canvas, context];
  }

  const axLine = document.querySelector('.ax-line');
  const ayLine = document.querySelector('.ay-line');
  const aStepElement = document.querySelector('#a-step');
  const bxLine = document.querySelector('.bx-line');
  const byLine = document.querySelector('.by-line');
  const bStepElement = document.querySelector('#b-step');

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

  let axCache = null;
  let ayCache = null;
  let bxCache = null;
  let byCache = null;

  const FILL_STYLE = '#ffffff';

  function moneyRound(num) {
    return Math.ceil(num * 100) / 100;
  }

  function degreesToRadians(deg = 0) {
    return (deg * (2 * Math.PI)) / 360;
  }

  // function radiansToDegrees(radians = 0) {
  //   return (radians * 360) / (2 * Math.PI);
  // }

  function reset() {
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

  function getCirclePoints(degrees, radius) {
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

  function getWithOffset(xValue, yValue, xOffset, yOffset) {
    return [moneyRound(xValue + xOffset), moneyRound(yValue + yOffset)];
  }

  function drawLine(x1, y1, x2, y2) {
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

  function runLoop() {
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

    if (axCache != null) {
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
