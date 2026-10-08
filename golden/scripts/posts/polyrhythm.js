(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

/**
 * Watches all external stylesheet link tags in the document and invokes the
 * provided callback once all stylesheets are confirmed to be loaded.
 *
 * @param {Function} callback - Function invoked when all stylesheets have loaded.
 * @returns {void}
 */
function stylesReadyWatcher(callback) {
  var styleSheets = Array.from(document.querySelectorAll('link[href*=".css"]'));
  var count = 0;

  /**
   * Checks whether all tracked stylesheet link tags have loaded and fires the callback if so.
   *
   * @returns {void}
   */
  function checkCount() {
    if (count >= styleSheets.length) {
      callback();
    }
  }
  styleSheets.forEach(function (link) {
    // If the stylesheet object is already attached, it is already loaded
    if (link.sheet) count++;else {
      link.addEventListener('load', function () {
        count++;
        checkCount();
      });
    }
    checkCount();
  });
}

/**
 * Invokes the callback once the DOM is interactive or complete.
 * If already ready, schedules execution on the next event loop tick.
 *
 * @param {Function} callback - Function invoked when the DOM is ready.
 * @returns {void}
 */
function documentReadyWatcher(callback) {
  // see if DOM is already available
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    // call on next available tick
    setTimeout(callback, 1);
  } else {
    document.addEventListener('DOMContentLoaded', callback);
  }
}
module.exports = {
  /**
   * Invokes the callback when both the DOM and all CSS stylesheets have completed loading.
   *
   * @param {Function} callback - Function invoked when both DOM and stylesheets are ready.
   * @returns {void}
   */
  all: function all(callback) {
    var documentReady = false;
    var stylesReady = false;
    documentReadyWatcher(function () {
      documentReady = true;
      if (stylesReady) {
        callback();
      }
    });
    stylesReadyWatcher(function () {
      stylesReady = true;
      if (documentReady) {
        callback();
      }
    });
  },
  /**
   * @see documentReadyWatcher
   */
  document: documentReadyWatcher,
  /**
   * @see stylesReadyWatcher
   */
  styles: stylesReadyWatcher
};

},{}],2:[function(require,module,exports){
"use strict";

var ready = require('../_modules/document-ready');
var canvasContext;
var canvas;
var playButton;
var circles = [];
var WIDTH = 1000;
var numberOfCircles = 20;
var tones = [65.40639,
// C2
82.40689,
// E2
97.99886,
// G2
110.0000,
// A2
130.8128,
// C3
164.8138,
// E3
195.9977,
// G3
220.0000,
// A3
261.6256,
// C4
329.6276,
// E4
391.9954,
// G4
440.0000,
// A4
523.2511,
// C5
659.2551,
// E5
783.9909,
// G5
880.0000,
// A5
1046.502,
// C6
1318.510,
// E6
1567.982,
// G6
1760.000 // A6
];
var AudioContext;
var audioCtx;

/**
 * Color generator helper for computing gradient color shades and flash-to-white highlight colors.
 *
 * @constructor
 * @param {number} position - Zero-based index of the circle in the column sequence.
 */
function ColorObject(position) {
  // rgb(205 72 0) dark
  // rgb(245 127 23) light
  /** Computes interpolated red channel value. */
  var red = function red(x) {
    return 205 + (245 - 205) / numberOfCircles * x;
  };
  /** Computes interpolated green channel value. */
  var green = function green(x) {
    return 72 + (127 - 72) / numberOfCircles * x;
  };
  /** Computes interpolated blue channel value. */
  var blue = function blue(x) {
    return 0 + (23 - 0) / numberOfCircles * x;
  };

  /** Blends red channel towards pure white based on flash step. */
  var whiteRed = function whiteRed(x, step) {
    var white = 255;
    var noWhite = red(x);
    var delta = white - noWhite;
    return noWhite + delta * step;
  };
  /** Blends green channel towards pure white based on flash step. */
  var whiteGreen = function whiteGreen(x, step) {
    var white = 255;
    var noWhite = green(x);
    var delta = white - noWhite;
    return noWhite + delta * step;
  };
  /** Blends blue channel towards pure white based on flash step. */
  var whiteBlue = function whiteBlue(x, step) {
    var white = 255;
    var noWhite = blue(x);
    var delta = white - noWhite;
    return noWhite + delta * step;
  };

  /**
   * Computes RGBA color string with optional white highlight flash level.
   *
   * @param {number} white - Flash intensity between 0 (base color) and 1 (fully white).
   * @returns {string} RGBA CSS color string.
   */
  // eslint-disable-next-line max-len
  this.rgb = function (white) {
    return "rgba(".concat(whiteRed(position, white), ",").concat(whiteGreen(position, white), ",").concat(whiteBlue(position, white), ",1)");
  };
}

/**
 * Calculates vertical speed for a given circle index to establish the polyrhythm relationship.
 *
 * @param {number} x - Index of the circle.
 * @param {number} width - Diameter of the circle.
 * @returns {number} Initial vertical velocity in pixels per tick.
 */
function velocityFunction(x, width) {
  var min = (WIDTH - width) / (numberOfCircles * 100);
  return min + min / 19 * x;
}

/**
 * Represents a single oscillating tone circle in the polyrhythmic display.
 *
 * @constructor
 * @param {number} [position=0] - Column index of the circle.
 */
function Circle() {
  var _this = this;
  var position = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
  var numberOfGaps = numberOfCircles + 1;
  var spaceSize = WIDTH * 0.1 / numberOfGaps;
  var circleWidth = WIDTH * 0.9 / numberOfCircles;
  var velocity = velocityFunction(position, circleWidth);

  // size
  var radius = circleWidth / 2;
  var x = radius + circleWidth * position + spaceSize * (position + 1);
  var y = radius;

  // color
  var border = new ColorObject(position);

  /**
   * Calculates fade factor based on time elapsed since last wall collision.
   *
   * @param {number} lastDing - Timestamp of the last collision ding.
   * @returns {number} Opacity / flash weight value from 0 to 1.
   */
  function ballTransparency(lastDing) {
    var now = Date.now();
    var timeDelta = now - lastDing;
    if (timeDelta > 1000) {
      return 0;
    }
    return 1 - timeDelta / 1000;
  }

  /**
   * Renders the circle path and outline to the 2D canvas context.
   *
   * @returns {void}
   */
  this.draw = function () {
    canvasContext.beginPath();
    canvasContext.arc(x, y, radius, 0, 2 * Math.PI, false);

    // canvasContext.fillStyle = `rgba(255, 255, 255, ${ballTransparency(this.ding)})`;
    canvasContext.fillStyle = 'transparent';
    canvasContext.fill();
    canvasContext.lineWidth = 3;
    canvasContext.strokeStyle = border.rgb(ballTransparency(_this.ding));
    canvasContext.stroke();
    canvasContext.closePath();
  };

  /**
   * Updates position, detects top/bottom wall collisions, inverts velocity, and triggers ding tone.
   *
   * @returns {void}
   */
  this.update = function () {
    if (y + velocity - radius < 0) {
      y = Math.abs(y + velocity - radius) + radius;
      velocity = Math.abs(velocity);
      _this.ding = Date.now();
      ding(position);
    } else if (y + velocity + radius > canvas.height) {
      y = canvas.height - radius - (radius + y + velocity) % canvas.height;
      // math
      velocity = 0 - Math.abs(velocity);
      _this.ding = Date.now();
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

/**
 * Sets fixed width and height pixel dimensions on the canvas element.
 *
 * @returns {void}
 */
function setCanvasDimensions() {
  canvas.width = WIDTH;
  canvas.height = WIDTH;
}

/**
 * Updates physics and position of all active circles.
 *
 * @returns {void}
 */
function update() {
  var i = circles.length;
  while (i) {
    circles[--i].update();
  }
}

/**
 * Draws all active circles onto the canvas context.
 *
 * @returns {void}
 */
function drawCanvas() {
  canvasContext.save();
  var i = circles.length;
  while (i) {
    circles[--i].draw(canvasContext);
  }
  canvasContext.restore();
}

/**
 * Main animation loop that clears canvas, updates positions, and repaints.
 *
 * @returns {void}
 */
function draw() {
  clear();
  update();
  drawCanvas();
  window.setTimeout(draw, 1000 / 240);

  // document.querySelector('debug').innerText += audioCtx.state.toString();
}

/**
 * Creates and registers a new Circle instance.
 *
 * @param {number} position - Column index.
 * @param {number} [velocity] - Velocity parameter (unused directly in constructor).
 * @returns {void}
 */
function createCircle(position, velocity) {
  circles.push(new Circle(position, velocity));
}

/**
 * Instantiates all circles across the polyrhythm grid.
 *
 * @returns {void}
 */
function createCircles() {
  for (var i = 0; i < numberOfCircles; i++) {
    createCircle(i);
  }
}

/**
 * Plays a musical tone with decay envelope using Web Audio API when a circle bounces.
 *
 * @param {number} position - Circle tone index mapped to the `tones` array.
 * @returns {void}
 */
function ding(position) {
  var frequency = tones[position];
  var oscillator = audioCtx.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  var gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // Initial volume

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();

  // Fade out the tone over 2 seconds
  gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2);
  setTimeout(function () {
    oscillator.stop();
  }, 2100); // 2 seconds fade-out + 100ms buffer
}

/**
 * Clears the full rectangle area of the canvas.
 *
 * @returns {void}
 */
function clear() {
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Binds UI click event listeners, such as the play button to start audio context.
 *
 * @returns {void}
 */
function setUpEvents() {
  playButton.addEventListener('click', function () {
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

/**
 * Initializes canvas elements, contexts, circles, and user events.
 *
 * @returns {void}
 */
function initialize() {
  canvas = document.getElementById('canvas');
  canvasContext = canvas.getContext('2d');
  playButton = document.getElementById('play');
  setCanvasDimensions();
  createCircles();
  setUpEvents();
}
ready.all(initialize.bind(void 0));

},{"../_modules/document-ready":1}]},{},[2]);
