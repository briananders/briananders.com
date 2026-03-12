const ready = require('../_modules/document-ready');
const windowResize = require('../_modules/window-resize');

let canvasContext;
let canvas;
let playButton;

const circles = [];
const WIDTH = 1000;
const numberOfCircles = 20;
const tones = [
  65.40639, // C2
  82.40689, // E2
  97.99886, // G2
  110.0000, // A2
  130.8128, // C3
  164.8138, // E3
  195.9977, // G3
  220.0000, // A3
  261.6256, // C4
  329.6276, // E4
  391.9954, // G4
  440.0000, // A4
  523.2511, // C5
  659.2551, // E5
  783.9909, // G5
  880.0000, // A5
  1046.502, // C6
  1318.510, // E6
  1567.982, // G6
  1760.000 // A6
];

let AudioContext;
let audioCtx;

function ColorObject(position) {
  // rgb(205 72 0) dark
  // rgb(245 127 23) light
  const red = (x) => 205 + (((245 - 205) / numberOfCircles) * x);
  const green = (x) => 72 + (((127 - 72) / numberOfCircles) * x);
  const blue = (x) => 0 + (((23 - 0) / numberOfCircles) * x);

  const whiteRed = (x, step) => {
    const white = 255;
    const noWhite = red(x);
    const delta = white - noWhite;

    return noWhite + (delta * step);
  };
  const whiteGreen = (x, step) => {
    const white = 255;
    const noWhite = green(x);
    const delta = white - noWhite;

    return noWhite + (delta * step);
  };
  const whiteBlue = (x, step) => {
    const white = 255;
    const noWhite = blue(x);
    const delta = white - noWhite;

    return noWhite + (delta * step);
  };

  this.rgb = (white) => `rgba(${whiteRed(position, white)},${whiteGreen(position, white)},${whiteBlue(position, white)},1)`;
}

function velocityFunction(x, width) {
  const min = (WIDTH - width) / (numberOfCircles * 100);
  return min + ((min / 19) * x);
}

// Circle Class
function Circle(position = 0) {
  const numberOfGaps = numberOfCircles + 1;

  const spaceSize = (WIDTH * 0.1) / numberOfGaps;
  const circleWidth = (WIDTH * 0.9) / numberOfCircles;

  let velocity = velocityFunction(position, circleWidth);

  // size
  const radius = circleWidth / 2;
  const x = radius + (circleWidth * position) + (spaceSize * (position + 1));
  let y = radius;

  // color
  const fill = new ColorObject(position);
  const border = new ColorObject(position);

  function ballTransparency(lastDing) {
    const now = Date.now();
    const timeDelta = now - lastDing;

    if (timeDelta > 1000) {
      return 0;
    }
    return 1 - (timeDelta / 1000);
  }

  this.draw = () => {
    canvasContext.beginPath();
    canvasContext.arc(x, y, radius, 0, 2 * Math.PI, false);

    // canvasContext.fillStyle = `rgba(255, 255, 255, ${ballTransparency(this.ding)})`;
    canvasContext.fillStyle = 'transparent';
    canvasContext.fill();

    canvasContext.lineWidth = 3;
    canvasContext.strokeStyle = border.rgb(ballTransparency(this.ding));
    canvasContext.stroke();

    canvasContext.closePath();
  };

  this.update = () => {
    if ((y + velocity) - radius < 0) {
      y = Math.abs(y + velocity - radius) + radius;
      velocity = Math.abs(velocity);
      this.ding = Date.now();
      ding(position);
    } else if ((y + velocity + radius) > canvas.height) {
      y = (canvas.height - radius) - ((radius + y + velocity) % canvas.height);
      // math
      velocity = 0 - Math.abs(velocity);
      this.ding = Date.now();
      ding(position);
    } else {
      y += velocity;
    }
  };

  this.ding = Date.now() - 100000;
}

// //////////////////////////////////////////////////////////////////////////////
// //////////////////////////////////////////////////////////////////////////////
// //////////////////////////// PRIVATE FUNCTIONS ///////////////////////////////
// //////////////////////////////////////////////////////////////////////////////
// //////////////////////////////////////////////////////////////////////////////

function setCanvasDimensions() {
  canvas.width = WIDTH;
  canvas.height = WIDTH;
}

function update() {
  let i = circles.length;

  while (i) {
    circles[--i].update();
  }
}

function drawCanvas() {
  canvasContext.save();

  let i = circles.length;

  while (i) {
    circles[--i].draw(canvasContext);
  }

  canvasContext.restore();
}

function draw() {
  clear();

  update();
  drawCanvas();

  window.setTimeout(draw, 1000 / 240);

  // document.querySelector('debug').innerText += audioCtx.state.toString();
}

function createCircle(position, velocity) {
  circles.push(new Circle(position, velocity));
}

function createCircles() {
  for (let i = 0; i < numberOfCircles; i++) {
    createCircle(i);
  }
}

function ding(position) {
  const frequency = tones[position];

  const oscillator = audioCtx.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  const gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // Initial volume

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();

  // Fade out the tone over 2 seconds
  gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2);

  setTimeout(() => {
    oscillator.stop();
  }, 2100); // 2 seconds fade-out + 100ms buffer
}

function clear() {
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
}

function setUpEvents() {
  playButton.addEventListener('click', () => {
    AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    draw();
    // audioCtx.resume().then(() => {
    // console.log('Playback resumed successfully');
    // }).catch(error => {
    // document.querySelector('debug').innerText += `\n\n${error.toString()}`;
    // });

    playButton.style.display = 'none';
  });
}

function initialize() {
  canvas = document.getElementById('canvas');
  canvasContext = canvas.getContext('2d');
  playButton = document.getElementById('play');

  setCanvasDimensions();

  createCircles();

  setUpEvents();
}

ready.all(initialize.bind(this));
