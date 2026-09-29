const ready = require('../_modules/document-ready');
const windowResize = require('../_modules/window-resize');

const WIDTH = 1000;
const HEIGHT = 1000;
const PIVOT_Y = 50;
const T_CYCLE = 60;
const N_BASE = 20;
const THETA_MAX = Math.PI / 4;
const CENTER_X = WIDTH / 2;

// A major scale frequencies across octaves (A2–A6)
// A, B, C#, D, E, F#, G#
const A_MAJOR_TONES = [
  110.00,  // A2
  123.47,  // B2
  138.59,  // C#3
  146.83,  // D3
  164.81,  // E3
  185.00,  // F#3
  207.65,  // G#3
  220.00,  // A3
  246.94,  // B3
  277.18,  // C#4
  293.66,  // D4
  329.63,  // E4
  369.99,  // F#4
  415.30,  // G#4
  440.00,  // A4
  493.88,  // B4
  554.37,  // C#5
  587.33,  // D5
  659.26,  // E5
  739.99,  // F#5
  830.61,  // G#5
  880.00,  // A5
  987.77,  // B5
  1108.73, // C#6
  1174.66, // D6
  1318.51, // E6
  1479.98, // F#6
  1661.22, // G#6
  1760.00, // A6
];

let canvas;
let ctx;
let paused = false;
let time = 0;
let lastTimestamp = null;
let speed = 0.2;
let numPendulums = 15;
let trails = false;
let animationId = null;
let audioCtx = null;
let reverbSend = null;
let dryBus = null;
let compressor = null;

let startButton;
let pauseButton;
let resetButton;
let countSlider;
let countOutput;
let speedSlider;
let speedOutput;
let trailsCheckbox;

// Track previous bob X positions for crossing detection
let prevBobX = [];

/**
 * Returns the tone frequency for pendulum i.
 * Longest pendulum (i=0) gets the lowest tone; shortest gets the highest.
 *
 * @param {number} i - Pendulum index (0-based).
 * @returns {number} Frequency in Hz.
 */
function getTone(i) {
  const toneCount = A_MAJOR_TONES.length;
  // Map pendulum index across available tones
  const toneIndex = Math.round((i / (numPendulums - 1 || 1)) * (toneCount - 1));
  return A_MAJOR_TONES[toneIndex];
}

/**
 * Builds the persistent audio graph: shared convolver reverb, dry/wet buses,
 * and a compressor to prevent clipping when many tones overlap.
 */
function buildAudioGraph() {
  var sampleRate = audioCtx.sampleRate;
  var length = sampleRate * 8;
  var impulse = audioCtx.createBuffer(2, length, sampleRate);

  for (var ch = 0; ch < 2; ch++) {
    var data = impulse.getChannelData(ch);
    for (var s = 0; s < length; s++) {
      data[s] = ((Math.random() * 2) - 1) * Math.pow(1 - (s / length), 2);
    }
  }

  var convolver = audioCtx.createConvolver();
  convolver.buffer = impulse;

  // Wet bus: convolver → wet gain → compressor
  var wetGain = audioCtx.createGain();
  wetGain.gain.value = 0.55;
  convolver.connect(wetGain);

  // Dry bus → compressor
  dryBus = audioCtx.createGain();
  dryBus.gain.value = 0.45;

  // Compressor prevents clipping when many tones fire at once
  compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 12;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  dryBus.connect(compressor);
  wetGain.connect(compressor);
  compressor.connect(audioCtx.destination);

  // reverbSend is where individual tones route their wet signal
  reverbSend = convolver;
}

/**
 * Plays a vibraphone-like tone at the given frequency.
 * Routes through the shared reverb and compressor buses.
 *
 * @param {number} frequency - Tone frequency in Hz.
 * @param {number} pendulumIndex - Index for panning position.
 */
function playTone(frequency, pendulumIndex) {
  if (!audioCtx || !dryBus) return;

  // Resume if iOS suspended the context
  if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
    audioCtx.resume();
  }

  var now = audioCtx.currentTime;
  var stopTime = now + 6;

  // Fundamental (sine — vibraphone base)
  var osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = frequency;

  // Second partial for shimmer
  var osc2 = audioCtx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = frequency * 2;

  // Gain envelopes — fast attack, long decay
  var gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 5);

  var gain2 = audioCtx.createGain();
  gain2.gain.setValueAtTime(0, now);
  gain2.gain.linearRampToValueAtTime(0.025, now + 0.003);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 3);

  // Merge oscillators into a single output node
  var merge = audioCtx.createGain();
  merge.gain.value = 1;
  osc.connect(gain);
  osc2.connect(gain2);
  gain.connect(merge);
  gain2.connect(merge);

  // Stereo panning — fallback to plain gain if StereoPanner unavailable
  var output = merge;
  if (audioCtx.createStereoPanner) {
    var panner = audioCtx.createStereoPanner();
    var pan = ((pendulumIndex / (numPendulums - 1 || 1)) * 1.4) - 0.7;
    panner.pan.value = pan;
    merge.connect(panner);
    output = panner;
  }

  // Route to shared dry bus + reverb send
  output.connect(dryBus);
  output.connect(reverbSend);

  osc.start(now);
  osc2.start(now);
  osc.stop(stopTime);
  osc2.stop(stopTime);

  // Disconnect after tones finish to free resources
  osc.onended = function () {
    osc.disconnect();
    osc2.disconnect();
    gain.disconnect();
    gain2.disconnect();
    merge.disconnect();
    if (output !== merge) output.disconnect();
  };
}

/**
 * Computes HSL color string for a pendulum based on its index.
 *
 * @param {number} i - Pendulum index.
 * @param {number} total - Total number of pendulums.
 * @returns {string} HSL color string.
 */
function pendulumColor(i, total) {
  const hue = (i / total) * 280;
  return `hsl(${hue}, 80%, 55%)`;
}

/**
 * Calculates the string length for pendulum i.
 *
 * @param {number} i - Pendulum index (0-based).
 * @returns {number} Effective string length in canvas units.
 */
function pendulumLength(i) {
  const maxLength = HEIGHT - PIVOT_Y - 60;
  const minLength = maxLength * 0.3;
  const fraction = i / (numPendulums - 1 || 1);
  return maxLength - (fraction * (maxLength - minLength));
}

/**
 * Calculates the period for pendulum i.
 *
 * @param {number} i - Pendulum index (0-based).
 * @returns {number} Period in seconds.
 */
function pendulumPeriod(i) {
  return T_CYCLE / (N_BASE + i);
}

/**
 * Computes the bob X position for pendulum i at the current time.
 *
 * @param {number} i - Pendulum index.
 * @returns {number} Bob X coordinate.
 */
function getBobX(i) {
  const period = pendulumPeriod(i);
  const length = pendulumLength(i);
  const theta = THETA_MAX * Math.cos((2 * Math.PI * time) / period);
  return CENTER_X + (length * Math.sin(theta));
}

/**
 * Draws the vertical center line.
 */
function drawCenterLine() {
  ctx.beginPath();
  ctx.moveTo(CENTER_X, PIVOT_Y);
  ctx.lineTo(CENTER_X, HEIGHT);
  ctx.strokeStyle = 'rgba(150, 150, 150, 0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Draws a single pendulum at the current time.
 *
 * @param {number} i - Pendulum index.
 */
function drawPendulum(i) {
  const period = pendulumPeriod(i);
  const length = pendulumLength(i);
  const theta = THETA_MAX * Math.cos((2 * Math.PI * time) / period);

  const pivotX = CENTER_X;
  const bobX = pivotX + (length * Math.sin(theta));
  const bobY = PIVOT_Y + (length * Math.cos(theta));
  const bobRadius = 14;

  const color = pendulumColor(i, numPendulums);

  // Draw string
  ctx.beginPath();
  ctx.moveTo(pivotX, PIVOT_Y);
  ctx.lineTo(bobX, bobY);
  ctx.strokeStyle = 'rgba(150, 150, 150, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Draw bob
  ctx.beginPath();
  ctx.arc(bobX, bobY, bobRadius, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * Draws the pivot bar at the top.
 */
function drawPivot() {
  const barWidth = WIDTH * 0.6;
  const barX = (WIDTH - barWidth) / 2;

  ctx.beginPath();
  ctx.rect(barX, PIVOT_Y - 8, barWidth, 8);
  ctx.fillStyle = 'rgba(120, 120, 120, 0.8)';
  ctx.fill();
}

/**
 * Checks each pendulum for center-line crossings and plays tones.
 */
function checkCrossings() {
  for (let i = 0; i < numPendulums; i++) {
    const currentX = getBobX(i);
    const prev = prevBobX[i];

    if (prev !== undefined) {
      // Crossed center line if previous and current are on opposite sides
      if ((prev < CENTER_X && currentX >= CENTER_X)
        || (prev > CENTER_X && currentX <= CENTER_X)) {
        playTone(getTone(i), i);
      }
    }

    prevBobX[i] = currentX;
  }
}

/**
 * Main render function — clears canvas and draws all pendulums.
 */
function render() {
  if (trails) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  } else {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
  }

  drawPivot();
  drawCenterLine();

  for (let i = 0; i < numPendulums; i++) {
    drawPendulum(i);
  }
}

/**
 * Animation loop driven by requestAnimationFrame.
 *
 * @param {number} timestamp - DOMHighResTimeStamp from rAF.
 */
function animate(timestamp) {
  if (lastTimestamp === null) {
    lastTimestamp = timestamp;
  }

  const dt = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  time += dt * speed;

  checkCrossings();
  render();

  if (!paused) {
    animationId = window.requestAnimationFrame(animate);
  }
}

/**
 * Starts or resumes the animation loop.
 */
function startAnimation() {
  if (animationId) return;
  lastTimestamp = null;
  animationId = window.requestAnimationFrame(animate);
}

/**
 * Stops the animation loop.
 */
function stopAnimation() {
  if (animationId) {
    window.cancelAnimationFrame(animationId);
    animationId = null;
  }
}

/**
 * Toggles play/pause state.
 */
function togglePause() {
  paused = !paused;

  if (paused) {
    stopAnimation();
    pauseButton.textContent = 'Play';
  } else {
    // Resume audio context if iOS suspended it
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    startAnimation();
    pauseButton.textContent = 'Pause';
  }
}

/**
 * Resets the simulation to t=0.
 */
function resetSimulation() {
  time = 0;
  lastTimestamp = null;
  prevBobX = [];

  if (paused) {
    render();
  }
}

/**
 * Resizes canvas dimensions.
 */
function setCanvasDimensions() {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
}

/**
 * Initializes Web Audio API context and reverb buffer, then starts animation.
 */
function startWithAudio() {
  var AudioContextClass = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContextClass();

  // Build graph synchronously — do not gate on resume() promise
  // which may never resolve on some iOS versions
  buildAudioGraph();

  // iOS Safari: play a silent buffer to unlock, then resume
  var unlock = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
  var src = audioCtx.createBufferSource();
  src.buffer = unlock;
  src.connect(audioCtx.destination);
  src.start(0);
  if (audioCtx.state !== 'running') {
    audioCtx.resume();
  }

  startButton.style.display = 'none';
  startAnimation();
}

/**
 * Binds UI event listeners for controls.
 */
function addEventListeners() {
  startButton.addEventListener('click', startWithAudio);
  pauseButton.addEventListener('click', togglePause);
  resetButton.addEventListener('click', resetSimulation);

  countSlider.addEventListener('input', () => {
    numPendulums = parseInt(countSlider.value, 10);
    countOutput.textContent = numPendulums;
    prevBobX = [];
  });

  speedSlider.addEventListener('input', () => {
    speed = parseFloat(speedSlider.value);
    speedOutput.textContent = `${speed}x`;
  });

  trailsCheckbox.addEventListener('change', () => {
    trails = trailsCheckbox.checked;
  });

  windowResize(() => {
    setCanvasDimensions();
    if (paused) render();
  });
}

/**
 * Initializes DOM references, canvas, event listeners, and renders initial frame.
 */
function initialize() {
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');
  startButton = document.getElementById('start-button');
  pauseButton = document.getElementById('pause-button');
  resetButton = document.getElementById('reset-button');
  countSlider = document.getElementById('pendulum-count');
  countOutput = document.getElementById('pendulum-count-value');
  speedSlider = document.getElementById('speed');
  speedOutput = document.getElementById('speed-value');
  trailsCheckbox = document.getElementById('trails');

  setCanvasDimensions();
  addEventListeners();

  // Render initial static frame; animation starts on Start click
  render();
}

ready.document(initialize);
