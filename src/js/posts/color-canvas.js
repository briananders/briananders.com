const ready = require('../_modules/document-ready');

/**
 * Initializes the interactive color canvas visualization on DOM ready.
 */
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

  /**
   * Sets canvas dimensions according to color step resolution.
   */
  function setCanvasDimensions() {
    canvas.width = steps;
    canvas.height = steps;
  }

  /**
   * Fills a 1x1 square at coordinates corresponding to red (X) and green (Y) channels.
   *
   * @param {number} r - Red channel value (0-256).
   * @param {number} g - Green channel value (0-256).
   * @param {number} b - Blue channel value (0-256).
   */
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

  /**
   * Loops through all red and green channel combinations to render the 2D color slice for a fixed blue value.
   *
   * @param {number} b - Current blue channel value.
   */
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

  /**
   * Checks the blue slider value, updates state, and redraws the canvas if the blue value changed.
   */
  function updateSlider() {
    const newBlue = Number(blueSlider.value);
    if (newBlue !== blue) {
      blue = newBlue;
      drawLoop(blue);
    }
  }

  /**
   * Advances the animation by stepping the blue slider back and forth between 0 and 256.
   */
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

  /**
   * Toggles the play/pause state and triggers the animation loop.
   */
  function playPause() {
    playing = !playing;
    // Class-driven icon: paused → `.play` (▶); playing → `.pause` (⏸).
    playButton.classList.toggle('play', !playing);
    playButton.classList.toggle('pause', playing);
    play();
  }

  blueSlider.addEventListener('input', updateSlider);
  playButton.addEventListener('click', playPause);

  setCanvasDimensions();
  updateSlider();
});
