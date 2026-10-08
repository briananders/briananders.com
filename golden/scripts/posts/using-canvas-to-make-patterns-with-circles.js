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
var canvasContext;
var canvas;
var circles = [];
var borderStyle;
var alphaBorder;
var fillStyle;
var alphaFill;
var fastSlow;
var clearButton;
var eraseButton;
var paused = true;
var pauseButton;

/**
 * Color generator helper for randomized RGB color values and transparency handling.
 *
 * @constructor
 */
function ColorObject() {
  var _this = this;
  /**
   * Generates a random color component in the brighter range (128-255).
   *
   * @returns {number} Color channel byte value.
   */
  function randomColor() {
    var color = Math.floor(Math.random() * 128);
    return color + 128;
  }
  var alpha = Math.random();
  var red = randomColor();
  var green = randomColor();
  var blue = randomColor();
  var average = Math.floor((red + green + blue) / 3);
  this.alpha = alpha;

  /**
   * Returns an RGBA string with the base random color.
   *
   * @returns {string} RGBA color string.
   */
  this.rgb = function () {
    return "rgba(".concat(red, ",").concat(green, ",").concat(blue, ",").concat(_this.alpha, ")");
  };

  /**
   * Returns an RGBA grayscale string with averaged color channels.
   *
   * @returns {string} RGBA grayscale color string.
   */
  this.gray = function () {
    return "rgba(".concat(average, ",").concat(average, ",").concat(average, ",").concat(_this.alpha, ")");
  };

  /**
   * Returns an RGBA string with freshly randomized color channels on each call.
   *
   * @returns {string} RGBA color string.
   */
  this.random = function () {
    return "rgba(".concat(randomColor(), ",").concat(randomColor(), ",").concat(randomColor(), ",").concat(_this.alpha, ")");
  };

  /**
   * Resets the alpha value back to its original initial random value.
   *
   * @returns {void}
   */
  this.resetAlpha = function () {
    _this.alpha = alpha;
  };
}

/**
 * Represents a moving, bouncing circle particle that draws pattern trails on the canvas.
 *
 * @constructor
 * @param {number} [x=1] - Initial X coordinate.
 * @param {number} [y=1] - Initial Y coordinate.
 */
function Circle() {
  var x = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
  var y = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
  // size
  var radius = Math.floor(5 + Math.random() * 100);

  // color
  var fill = new ColorObject();
  var border = new ColorObject();

  // speed
  var speed = Math.random() * 100 + 100;
  var xVelocity = (Math.random() - 0.5) * speed;
  var yVelocity = (Math.random() - 0.5) * speed;

  /**
   * Draws the circle onto the canvas context according to current fill and border settings.
   *
   * @returns {void}
   */
  this.draw = function () {
    canvasContext.beginPath();
    canvasContext.arc(x, y, radius, 0, 2 * Math.PI, false);
    switch (fillStyle.value) {
      case 'no-fill':
        canvasContext.fillStyle = 'rgba(0,0,0,0)';
        break;
      case 'fill-gray':
        canvasContext.fillStyle = fill.gray();
        break;
      case 'fill-color':
        canvasContext.fillStyle = fill.rgb();
        break;
      case 'epileptic':
        canvasContext.fillStyle = fill.random();
        break;
      default:
    }
    canvasContext.fill();
    if (borderStyle.value !== 'no-border') {
      canvasContext.lineWidth = '1px';
      switch (borderStyle.value) {
        case 'border-white':
          canvasContext.strokeStyle = "rgba(255,255,255,".concat(border.alpha, ")");
          break;
        case 'border-gray':
          canvasContext.strokeStyle = border.gray();
          break;
        case 'border-color':
          canvasContext.strokeStyle = border.rgb();
          break;
        case 'epileptic':
          canvasContext.strokeStyle = border.random();
          break;
        default:
      }
      canvasContext.stroke();
    }
    canvasContext.closePath();
  };

  /**
   * Updates particle coordinates and handles boundary collision reflection.
   *
   * @returns {void}
   */
  this.update = function () {
    if (y + yVelocity < radius) {
      yVelocity = Math.abs(yVelocity);
    } else if (y + yVelocity > canvas.height - radius) {
      yVelocity = 0 - Math.abs(yVelocity);
    }
    if (x + xVelocity < radius) {
      xVelocity = Math.abs(xVelocity);
    } else if (x + xVelocity > canvas.width - radius) {
      xVelocity = 0 - Math.abs(xVelocity);
    }
    y += yVelocity;
    x += xVelocity;
  };

  /**
   * Updates border opacity setting based on the UI checkbox.
   *
   * @returns {void}
   */
  this.updateAlphaBorder = function () {
    if (alphaBorder.checked) {
      border.resetAlpha();
    } else {
      border.alpha = 1;
    }
  };

  /**
   * Updates fill opacity setting based on the UI checkbox.
   *
   * @returns {void}
   */
  this.updateAlphaFill = function () {
    if (alphaFill.checked) {
      fill.resetAlpha();
    } else {
      fill.alpha = 1;
    }
  };
  this.updateAlphaBorder();
  this.updateAlphaFill();
}

// //////////////////////////////////////////////////////////////////////////////
// //////////////////////////////////////////////////////////////////////////////
// //////////////////////////// PRIVATE FUNCTIONS ///////////////////////////////
// //////////////////////////////////////////////////////////////////////////////
// //////////////////////////////////////////////////////////////////////////////

/**
 * Updates the border alpha setting across all active circle instances.
 *
 * @returns {void}
 */
function updateAlphaBorder() {
  var i = circles.length;
  while (i) {
    circles[--i].updateAlphaBorder();
  }
}

/**
 * Updates the fill alpha setting across all active circle instances.
 *
 * @returns {void}
 */
function updateAlphaFill() {
  var i = circles.length;
  while (i) {
    circles[--i].updateAlphaFill();
  }
}

/**
 * Adjusts canvas width and height for high-DPI (retina) displays.
 *
 * @returns {void}
 */
function setCanvasDimensions() {
  canvas.width = canvas.clientWidth * 2; // x2 for retina displays
  canvas.height = canvas.clientHeight * 2; // x2 for retina displays
}

/**
 * Iterates through all circles and invokes their update methods.
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
 * Renders all circles to the 2D canvas context.
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
 * Animation loop step function that performs physics updates and rendering passes.
 *
 * @returns {void}
 */
function draw() {
  var i = 2;
  while (i--) {
    update();
    drawCanvas();
  }
  if (!paused) {
    if (fastSlow.checked) {
      window.setTimeout(draw, 0);
    } else {
      window.setTimeout(draw, 1000 / 60);
    }
  }
}

/**
 * Toggles the running/paused animation state and updates button style.
 *
 * @returns {void}
 */
function pauseUnpause() {
  var pauseCache = paused;
  if (circles.length < 1) {
    paused = true;
    return;
  }
  paused = !paused;
  if (!paused) {
    if (fastSlow.checked) {
      window.setTimeout(draw, 0);
    } else {
      window.setTimeout(draw, 1000 / 60);
    }
  }
  if (pauseCache !== paused) {
    if (paused) {
      pauseButton.classList.add('paused');
    } else {
      pauseButton.classList.remove('paused');
    }
  }
}

/**
 * Click handler that spawns a new Circle particle at the clicked canvas coordinate.
 *
 * @param {MouseEvent} e - The mouse click event.
 * @returns {void}
 */
function createCircle(e) {
  circles.push(new Circle(e.offsetX * 2, e.offsetY * 2)); // x2 for retina displays

  if (circles.length === 1) {
    pauseUnpause();
  }
}

/**
 * Clears and resets the canvas surface while maintaining active circle particles.
 *
 * @returns {void}
 */
function erase() {
  setCanvasDimensions();
  drawCanvas();
}

/**
 * Wipes the canvas clear, removes all circles, and pauses animation.
 *
 * @returns {void}
 */
function clear() {
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  circles = [];
  pauseUnpause();
}

/**
 * Binds DOM event listeners for canvas interaction, shortcuts, and form controls.
 *
 * @returns {void}
 */
function addEventListeners() {
  windowResize(erase.bind(this));
  document.addEventListener('keydown', function (evt) {
    if (evt.key === 'Escape') {
      clear();
    } else if (evt.key === ' ') {
      evt.preventDefault();
      pauseUnpause();
    }
  });
  alphaBorder.addEventListener('change', updateAlphaBorder, false);
  alphaFill.addEventListener('change', updateAlphaFill, false);
  canvas.addEventListener('click', createCircle, false);
  pauseButton.addEventListener('click', pauseUnpause, false);
  clearButton.addEventListener('click', clear, false);
  eraseButton.addEventListener('click', erase, false);
}

/**
 * Initializes DOM element references, binds events, and configures canvas dimensions.
 *
 * @returns {void}
 */
function initialize() {
  fastSlow = document.getElementById('fast-slow');
  borderStyle = document.getElementById('border-style');
  alphaBorder = document.getElementById('alpha-border');
  fillStyle = document.getElementById('fill-style');
  alphaFill = document.getElementById('alpha-fill');
  pauseButton = document.getElementById('pause-button');
  clearButton = document.getElementById('clear-button');
  eraseButton = document.getElementById('erase-button');
  canvas = document.getElementById('canvas');
  canvasContext = canvas.getContext('2d');
  addEventListeners();
  setCanvasDimensions();
}
ready.all(initialize.bind(void 0));

},{"../_modules/document-ready":1,"../_modules/window-resize":2}]},{},[3]);
