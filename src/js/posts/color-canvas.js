const ready = require('../_modules/document-ready');

ready.document(() => {
  const steps = 256; // squares per color spectrum
  const squareMax = 256;
  const blueSlider = document.getElementById('blue-slider');
  const playButton = document.getElementById('play-pause');
  const canvas = document.getElementById('canvas');
  const context = canvas.getContext('2d');
  let blue;
  let playing = false;
  let direction = 1;

  blueSlider.setAttribute('step', squareMax / steps);
  blueSlider.setAttribute('max', squareMax);

  function setCanvasDimensions() {
    canvas.width = steps;
    canvas.height = steps;
  }

  function draw(r, g, b) { // 0-256 for each
    context.fillStyle = `rgb(${r},${g},${b})`;
    context.fillRect(
      (r / squareMax) * steps,
      (g / squareMax) * steps,
      1,
      1,
      false
    );
  }

  function drawLoop(b) {
    let r = 0;
    let g = 0;

    while (g <= squareMax) {
      r = 0;
      while (r <= squareMax) {
        draw(r, g, b);
        r += Math.floor(squareMax / steps);
      }
      g += Math.floor(squareMax / steps);
    }
  }

  function updateSlider() {
    const newBlue = Number(blueSlider.value);
    if (newBlue !== blue) {
      blue = newBlue;
      drawLoop(blue);
    }
  }

  function play() {
    if (!playing) return;
    const sliderValue = Number(blueSlider.value);

    blueSlider.value = sliderValue + direction;
    updateSlider();

    if (Number(blueSlider.value) <= 0 || Number(blueSlider.value) >= squareMax) {
      direction = 0 - direction;
    }

    window.requestAnimationFrame(play);
  }

  function playPause() {
    playButton.classList.toggle('play');
    playing = !playing;

    play();
  }

  blueSlider.addEventListener('input', updateSlider);
  playButton.addEventListener('click', playPause);

  setCanvasDimensions();
  updateSlider();
});
