const ready = require('../_modules/document-ready');
const noAnimations = require('../_modules/no-animations');

const canvas = document.getElementById('canvas');
const canvasContext = canvas.getContext('2d');
const colorCheckbox = document.querySelector('input[name=color]');
let worldColor = true;

const circleArray = [];

function randomColor() {
  return Math.floor(Math.random() * 256);
}

function setCanvasSize() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}

function PaintCircle() {
  const r = randomColor();
  const g = randomColor();
  const b = randomColor();
  const rgbAverage = (r + g + b) / 3;
  const color = `rgb(${r}, ${g}, ${b})`;
  const grey = `rgb(${rgbAverage}, ${rgbAverage}, ${rgbAverage})`;

  this.color = worldColor ? color : grey;
  this.radius = (Math.random() * 45) + 5;
  this.speed = Math.random() * 6;
  this.x = Math.random() * canvas.width;
  this.y = -50;

  this.update = () => {
    this.y += this.speed;
    this.draw();
  };

  this.draw = () => {
    canvasContext.beginPath();
    canvasContext.arc(this.x, this.y, this.radius, 0, 2 * Math.PI, false);
    canvasContext.fillStyle = this.color;
    canvasContext.fill();
    canvasContext.closePath();
  };
}

function toggleColor() {
  worldColor = colorCheckbox.checked;
}

function setupEventListeners() {
  colorCheckbox.addEventListener('click', toggleColor);
  window.addEventListener('resize', setCanvasSize);
}

function maintenance() {
  for (let i = circleArray.length - 1; i >= 0; i--) {
    const circle = circleArray[i];
    if (circle.y - circle.radius > canvas.height) {
      circleArray.splice(i, 1);
    }
  }
}

function draw() {
  circleArray.forEach((circle) => {
    circle.update();
  });
  maintenance();
  window.requestAnimationFrame(draw);
}

function run() {
  setInterval(() => {
    if (circleArray.length < canvas.width / 5) {
      circleArray.push(new PaintCircle());
    }
  }, 500);
}

ready.all(() => {
  setupEventListeners();
  setCanvasSize();
  run();
  if (!noAnimations.areAnimationsDisabled) draw();
});
