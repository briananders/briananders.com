const { log } = require('../_modules/log');
const ready = require('../_modules/document-ready');

ready.document(() => {
  const scrollTo = require('../_modules/scroll-to');

  const nInput = document.getElementById('n');
  const answerTag = document.querySelector('answer');
  const answerArrayTag = document.querySelector('answer-array');
  const arrows = document.querySelectorAll('#up-and-down button');
  const canvas = document.getElementById('star');
  const canvasContext = canvas.getContext('2d');
  canvas.width = 1000;
  canvas.height = 1000;
  let currentConfig;

  const FILL_STYLE = '#ffffff';

  function degreesToRadians(deg = 0) {
    return (deg * (2 * Math.PI)) / 360;
  }

  // function radiansToDegrees(radians = 0) {
  //   return (radians * 360) / (2 * Math.PI);
  // }

  function clearCanvas() {
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  }

  function scrollValue() {
    return window.pageYOffset + canvas.getBoundingClientRect().top - 80;
  }

  function scroll() {
    scrollTo(scrollValue(), { easing: 'easeInOutQuint', duration: 350 });
  }

  function getStarPoints(n) {
    const points = [];
    const r = canvas.width / 2;
    const cx = r;
    const cy = r;
    const degreeMax = 360;
    const step = degreeMax / n;
    for (let i = 0; i < n; i++) {
      const a = degreesToRadians(step * i);
      /*
        Where r is the radius, cx,cy the origin, and a the angle.

        That’s pretty easy to adapt into any language with basic trig functions.
        Note that most languages will use radians for the angle in trig functions,
        so rather than cycling through 0..360 degrees,
        you're cycling through 0..2PI radians.
      */
      const x = cx + (r * Math.cos(a));
      const y = cy + (r * Math.sin(a));
      points.push([x, y]);
    }
    return points;
  }

  function getOrderedPoints(n, step) {
    const points = getStarPoints(n);
    const star = new Array(n).fill(0);
    let index = 0;
    const orderedPoints = [];

    while (star[index] !== 1) {
      orderedPoints.push(points[index]);
      star[index] = 1;
      index = (index + step) % n; // mod for wrapping
    }

    orderedPoints.push(points[0]);

    return orderedPoints;
  }

  function drawStar(n, step) {
    log(`drawStar(${n}, ${step})`);
    const points = getOrderedPoints(n, step);
    let i = 1;

    function drawLine(a, b) {
      const [xa, ya] = points[a];
      const [xb, yb] = points[b];
      canvasContext.beginPath();
      canvasContext.fillStyle = FILL_STYLE;
      canvasContext.strokeStyle = FILL_STYLE;
      canvasContext.moveTo(xa, ya);
      canvasContext.lineTo(xb, yb);
      canvasContext.stroke();
      canvasContext.closePath();
    }

    clearCanvas();

    function drawLines() {
      const [cn, cstep] = currentConfig;
      if (i < points.length && cn === n && cstep === step) {
        drawLine(i - 1, i);
        i++;
        window.requestAnimationFrame(drawLines);
      }
    }

    drawLines();
  }

  function calculateStars(length, step) {
    let index = 0;
    const star = new Array(length).fill(0);
    while (star[index] !== 1) {
      star[index] = 1;
      index = (index + step) % length; // mod for wrapping
    }
    return !star.includes(0);
  }

  function go() {
    const n = Number(nInput.value);

    if (n > 20000) {
      nInput.value = 20000;
      return;
    }

    const answers = [];
    for (let i = 2; i < n / 2; i++) {
      if (calculateStars(n, i)) {
        answers.push(i);
      }
    }

    const starOptions = answers.map((step) => `<option value='${step}'>${step}</option>`);

    answerTag.innerHTML = `${answers.length} unique star${answers.length === 1 ? '' : 's'}`;
    if (starOptions.length) {
      answerArrayTag.innerHTML = `<select aria-label="Star pattern rule" data-n="${n}">${starOptions.join('')}<select>`;

      const select = answerArrayTag.querySelector('select');
      select.addEventListener('change', () => {
        const step = select.value;
        const length = select.dataset.n;

        currentConfig = [Number(length), Number(step)];

        drawStar(...currentConfig);

        scroll();
      });
    } else {
      answerArrayTag.innerHTML = '';
    }

    if (answers.length) {
      currentConfig = [n, answers[0]];
      drawStar(...currentConfig);
    } else {
      clearCanvas();
    }
  }

  function addEventListeners() {
    nInput.addEventListener('change', go);
    arrows.forEach((arrow) => {
      arrow.addEventListener('click', () => {
        nInput.value = Number(nInput.value) + Number(arrow.value);
        if (Number(nInput.value) > 20000) {
          nInput.value = 20000;
        } else if (Number(nInput.value) < 5) {
          nInput.value = 5;
        }
        go();
      });
    });
  }

  function checkHash() {
    const { hash } = window.location;
    if (hash.length) {
      const config = hash.substr(1);

      const [step, length] = config.split('/');

      nInput.value = Number(length);

      setTimeout(() => {
        currentConfig = [Number(length), Number(step)];
        drawStar(...currentConfig);

        scrollTo(scrollValue());
      }, 10);
    }
  }

  checkHash();

  addEventListeners();
  go();
});
