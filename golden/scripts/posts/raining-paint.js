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

var urlParams = new URLSearchParams(window.location.search);
module.exports = {
  /**
   * Adds the 'no-animations' CSS class to the body if the 'disable-animations' query parameter is present.
   *
   * @returns {void}
   */
  initBodyClass: function initBodyClass() {
    if (urlParams.get('disable-animations') !== null) {
      document.body.classList.add('no-animations');
    }
  },
  /**
   * Indicates whether animations are disabled via the 'disable-animations' URL query parameter.
   *
   * @type {boolean}
   */
  areAnimationsDisabled: urlParams.get('disable-animations') !== null
};

},{}],3:[function(require,module,exports){
"use strict";

var ready = require('../_modules/document-ready');
var noAnimations = require('../_modules/no-animations');
var canvas = document.getElementById('canvas');
var canvasContext = canvas.getContext('2d');
var colorCheckbox = document.querySelector('input[name=color]');
var worldColor = true;
var circleArray = [];

/**
 * Generates a random integer value for an RGB color channel (0-255).
 *
 * @returns {number} Integer between 0 and 255.
 */
function randomColor() {
  return Math.floor(Math.random() * 256);
}

/**
 * Updates canvas element width and height to match client dimensions.
 *
 * @returns {void}
 */
function setCanvasSize() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}

/**
 * Represents an individual falling paint circle with random size, speed, and color.
 *
 * @constructor
 */
function PaintCircle() {
  var _this = this;
  var r = randomColor();
  var g = randomColor();
  var b = randomColor();
  var rgbAverage = (r + g + b) / 3;
  var color = "rgb(".concat(r, ", ").concat(g, ", ").concat(b, ")");
  var grey = "rgb(".concat(rgbAverage, ", ").concat(rgbAverage, ", ").concat(rgbAverage, ")");
  this.color = worldColor ? color : grey;
  this.radius = Math.random() * 45 + 5;
  this.speed = Math.random() * 6;
  this.x = Math.random() * canvas.width;
  this.y = -50;

  /**
   * Advances circle position downward and renders it on canvas.
   *
   * @returns {void}
   */
  this.update = function () {
    _this.y += _this.speed;
    _this.draw();
  };

  /**
   * Renders the circle path to the 2D canvas context.
   *
   * @returns {void}
   */
  this.draw = function () {
    canvasContext.beginPath();
    canvasContext.arc(_this.x, _this.y, _this.radius, 0, 2 * Math.PI, false);
    canvasContext.fillStyle = _this.color;
    canvasContext.fill();
    canvasContext.closePath();
  };
}

/**
 * Toggles color mode flag based on the state of the UI color checkbox.
 *
 * @returns {void}
 */
function toggleColor() {
  worldColor = colorCheckbox.checked;
}

/**
 * Sets up DOM event listeners for checkbox clicks and window resizing.
 *
 * @returns {void}
 */
function setupEventListeners() {
  colorCheckbox.addEventListener('click', toggleColor);
  window.addEventListener('resize', setCanvasSize);
}

/**
 * Cleans up and removes circles that have fallen past the bottom of the canvas viewport.
 *
 * @returns {void}
 */
function maintenance() {
  for (var i = circleArray.length - 1; i >= 0; i--) {
    var circle = circleArray[i];
    if (circle.y - circle.radius > canvas.height) {
      circleArray.splice(i, 1);
    }
  }
}

/**
 * Main animation frame callback that updates and draws circles, and removes off-screen elements.
 *
 * @returns {void}
 */
function draw() {
  circleArray.forEach(function (circle) {
    circle.update();
  });
  maintenance();
  window.requestAnimationFrame(draw);
}

/**
 * Starts periodic interval to instantiate new PaintCircle objects within capacity limits.
 *
 * @returns {void}
 */
function run() {
  setInterval(function () {
    if (circleArray.length < canvas.width / 5) {
      circleArray.push(new PaintCircle());
    }
  }, 500);
}
ready.all(function () {
  setupEventListeners();
  setCanvasSize();
  run();
  if (!noAnimations.areAnimationsDisabled) draw();
});

},{"../_modules/document-ready":1,"../_modules/no-animations":2}]},{},[3]);
