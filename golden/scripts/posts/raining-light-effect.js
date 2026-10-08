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

/**
 * Binds a callback function to both window resize and orientationchange events.
 *
 * @param {Function} callback - The event listener function to trigger on window resizing or orientation changes.
 * @returns {void}
 */
module.exports = function (callback) {
  window.addEventListener('resize', callback);
  window.addEventListener('orientationchange', callback);
};

},{}],3:[function(require,module,exports){
"use strict";

var ready = require('../_modules/document-ready');
var windowResize = require('../_modules/window-resize');

/**
 * Returns a CSS rgba color string for white with the specified alpha opacity.
 *
 * @param {number} a - Opacity value between 0 and 1.
 * @returns {string} RGBA color string.
 */
var COLOR = function COLOR(a) {
  return "rgba(255,255,255,".concat(a, ")");
};
var RADIUS = 6;
var PADDING = 2;
var TAIL_LENGTH = 13;
var FPS = 1000 / 30;
var lanes = [];
var extraPadding = 0;
var maxHeight = 0;

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
function RainDrop(_ref) {
  var LANE = _ref.LANE,
    canvas = _ref.canvas,
    context = _ref.context;
  var index = 0;
  var finishIndex = 0;
  var length = randomLength();
  var lane = LANE;
  var middleOfTheLane = (RADIUS * 2 + PADDING) * (lane + 1) - RADIUS + extraPadding / 2;
  var clearX = middleOfTheLane - RADIUS;
  var clearY = 0;

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
    return (RADIUS * 2 + PADDING) * yIndex - RADIUS + extraPadding / 2;
  }

  /**
   * Renders the light droplet and its fading tail segments on canvas.
   *
   * @param {Object} options - Draw parameters.
   * @param {number} options.drawIndex - Current leading step index.
   * @param {number} [options.fade=0] - Additional alpha fade reduction.
   * @returns {void}
   */
  function draw(_ref2) {
    var drawIndex = _ref2.drawIndex,
      _ref2$fade = _ref2.fade,
      fade = _ref2$fade === void 0 ? 0 : _ref2$fade;
    clearLane();
    context.beginPath();
    for (var i = 0; i < TAIL_LENGTH; i++) {
      var y = dropY(drawIndex - i);
      context.arc(middleOfTheLane, y - i, RADIUS, 0, 2 * Math.PI, false);
      context.fillStyle = COLOR(1 - 1 / TAIL_LENGTH * i - fade);
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
      drawIndex: index,
      fade: 1 / TAIL_LENGTH * finishIndex
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
    draw({
      drawIndex: index
    });
    if (index >= length) {
      finish();
    } else {
      setTimeout(animate, FPS);
    }
  }
  animate();
}
ready.document(function () {
  var canvas = document.getElementById('canvas');
  var context = canvas.getContext('2d');
  canvas.width = canvas.clientWidth * 2;
  canvas.height = canvas.clientHeight * 2;
  var dropLanes = (canvas.width - PADDING) / (RADIUS * 2 + PADDING) - 1;
  extraPadding = (canvas.width - PADDING) % (RADIUS * 2 + PADDING);
  maxHeight = (canvas.height - extraPadding - PADDING) / (RADIUS * 2 + PADDING) - 1;

  /**
   * Spawns new raindrops in available lanes at regular intervals.
   */
  function loop() {
    var randomLane = Math.floor(Math.random() * dropLanes);
    if (lanes[randomLane] === undefined) {
      lanes[randomLane] = true;
      RainDrop({
        LANE: randomLane,
        canvas: canvas,
        context: context
      });
    }
    setTimeout(loop, FPS);
  }
  windowResize(function () {
    canvas.width = canvas.clientWidth * 2;
    canvas.height = canvas.clientHeight * 2;
    dropLanes = (canvas.width - PADDING) / (RADIUS * 2 + PADDING) - 1;
    extraPadding = (canvas.width - PADDING) % (RADIUS * 2 + PADDING);
    maxHeight = (canvas.height - extraPadding - PADDING) / (RADIUS * 2 + PADDING) - 1;
  });
  loop();
});

},{"../_modules/document-ready":1,"../_modules/window-resize":2}]},{},[3]);
