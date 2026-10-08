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
 * Evaluates whether the current environment is production based on the window hostname.
 *
 * @type {boolean}
 */
module.exports.isProduction = function () {
  return window.location.hostname === 'briananders.com';
}();

},{}],3:[function(require,module,exports){
"use strict";

var _require = require('./environment'),
  isProduction = _require.isProduction;
var _console = console,
  _log = _console.log,
  _table = _console.table;
module.exports = {
  /**
   * Outputs tabular data to the console if the environment is not production.
   *
   * @param {...*} args - Arguments passed directly to `console.table`.
   * @returns {void}
   */
  table: function table() {
    if (!isProduction) _table.apply(void 0, arguments);
  },
  /**
   * Outputs messages or objects to the console if the environment is not production.
   *
   * @param {...*} args - Arguments passed directly to `console.log`.
   * @returns {void}
   */
  log: function log() {
    if (!isProduction) _log.apply(void 0, arguments);
  }
};

},{"./environment":2}],4:[function(require,module,exports){
"use strict";

function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
var _require = require('../_modules/log'),
  log = _require.log;
var ready = require('../_modules/document-ready');
ready.document(function () {
  var nInput = document.getElementById('n');
  var answerTag = document.querySelector('answer');
  var answerArrayTag = document.querySelector('answer-array');
  var arrows = document.querySelectorAll('#up-and-down button');
  var canvas = document.getElementById('star');
  var canvasContext = canvas.getContext('2d');
  canvas.width = 1000;
  canvas.height = 1000;
  var currentConfig;
  var FILL_STYLE = '#ffffff';

  /**
   * Converts degrees into radians.
   *
   * @param {number} [deg=0] - Angle in degrees.
   * @returns {number} Angle in radians.
   */
  function degreesToRadians() {
    var deg = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
    return deg * (2 * Math.PI) / 360;
  }

  // function radiansToDegrees(radians = 0) {
  //   return (radians * 360) / (2 * Math.PI);
  // }

  /**
   * Clears the full canvas drawing surface.
   *
   * @returns {void}
   */
  function clearCanvas() {
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  }

  /**
   * Computes the vertical scroll offset needed to center the canvas on screen.
   *
   * @returns {number} Y scroll offset in pixels.
   */
  function scrollValue() {
    return window.pageYOffset + canvas.getBoundingClientRect().top - 80;
  }

  /**
   * Smoothly scrolls the window to the canvas position.
   *
   * @returns {void}
   */
  function scroll() {
    window.scrollTo({
      top: scrollValue(),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
  }

  /**
   * Computes the [x, y] coordinates of n equally spaced points on the circumference of a circle.
   *
   * @param {number} n - Number of vertices on the outer circle.
   * @returns {Array<[number, number]>} Array of [x, y] vertex coordinate pairs.
   */
  function getStarPoints(n) {
    var points = [];
    var r = canvas.width / 2;
    var cx = r;
    var cy = r;
    var degreeMax = 360;
    var step = degreeMax / n;
    for (var i = 0; i < n; i++) {
      var a = degreesToRadians(step * i);
      /*
        Where r is the radius, cx,cy the origin, and a the angle.
         That’s pretty easy to adapt into any language with basic trig functions.
        Note that most languages will use radians for the angle in trig functions,
        so rather than cycling through 0..360 degrees,
        you're cycling through 0..2PI radians.
      */
      var x = cx + r * Math.cos(a);
      var y = cy + r * Math.sin(a);
      points.push([x, y]);
    }
    return points;
  }

  /**
   * Generates the ordered vertex coordinates connecting points at intervals of `step`.
   *
   * @param {number} n - Total number of vertices.
   * @param {number} step - Step stride between connected vertices.
   * @returns {Array<[number, number]>} Ordered list of vertex coordinates forming the star polygon
   * path.
   */
  function getOrderedPoints(n, step) {
    var points = getStarPoints(n);
    var star = new Array(n).fill(0);
    var index = 0;
    var orderedPoints = [];
    while (star[index] !== 1) {
      orderedPoints.push(points[index]);
      star[index] = 1;
      index = (index + step) % n; // mod for wrapping
    }
    orderedPoints.push(points[0]);
    return orderedPoints;
  }

  /**
   * Animates drawing the connected star lines on the canvas one segment at a time.
   *
   * @param {number} n - Number of vertices.
   * @param {number} step - Step interval for connecting vertices.
   * @returns {void}
   */
  function drawStar(n, step) {
    log("drawStar(".concat(n, ", ").concat(step, ")"));
    var points = getOrderedPoints(n, step);
    var i = 1;

    /**
     * Draws a line segment between points indexed at a and b.
     *
     * @param {number} a - Starting point index.
     * @param {number} b - Ending point index.
     */
    function drawLine(a, b) {
      var _points$a = _slicedToArray(points[a], 2),
        xa = _points$a[0],
        ya = _points$a[1];
      var _points$b = _slicedToArray(points[b], 2),
        xb = _points$b[0],
        yb = _points$b[1];
      canvasContext.beginPath();
      canvasContext.fillStyle = FILL_STYLE;
      canvasContext.strokeStyle = FILL_STYLE;
      canvasContext.moveTo(xa, ya);
      canvasContext.lineTo(xb, yb);
      canvasContext.stroke();
      canvasContext.closePath();
    }
    clearCanvas();

    /**
     * Animation frame handler that incrementally renders each star segment.
     */
    function drawLines() {
      var _currentConfig = currentConfig,
        _currentConfig2 = _slicedToArray(_currentConfig, 2),
        cn = _currentConfig2[0],
        cstep = _currentConfig2[1];
      if (i < points.length && cn === n && cstep === step) {
        drawLine(i - 1, i);
        i++;
        window.requestAnimationFrame(drawLines);
      }
    }
    drawLines();
  }

  /**
   * Tests whether connecting vertices with a step stride visits all vertices (forming a full star
   * polygon).
   *
   * @param {number} length - Number of vertices (n).
   * @param {number} step - Step size between connected vertices.
   * @returns {boolean} True if all vertices are visited without premature closure.
   */
  function calculateStars(length, step) {
    var index = 0;
    var star = new Array(length).fill(0);
    while (star[index] !== 1) {
      star[index] = 1;
      index = (index + step) % length; // mod for wrapping
    }
    return !star.includes(0);
  }

  /**
   * Evaluates valid star configurations for the current N value, updates UI, and triggers
   * rendering.
   *
   * @returns {void}
   */
  function go() {
    var n = Number(nInput.value);
    if (n > 20000) {
      nInput.value = 20000;
      return;
    }
    var answers = [];
    for (var i = 2; i < n / 2; i++) {
      if (calculateStars(n, i)) {
        answers.push(i);
      }
    }
    var starOptions = answers.map(function (step) {
      return "<option value='".concat(step, "'>").concat(step, "</option>");
    });
    answerTag.innerHTML = "".concat(answers.length, " unique star").concat(answers.length === 1 ? '' : 's');
    if (starOptions.length) {
      answerArrayTag.innerHTML = "<select aria-label=\"Star pattern rule\" data-n=\"".concat(n, "\">").concat(starOptions.join(''), "<select>");
      var select = answerArrayTag.querySelector('select');
      select.addEventListener('change', function () {
        var step = select.value;
        var length = select.dataset.n;
        currentConfig = [Number(length), Number(step)];
        drawStar.apply(void 0, _toConsumableArray(currentConfig));
        scroll();
      });
    } else {
      answerArrayTag.innerHTML = '';
    }
    if (answers.length) {
      currentConfig = [n, answers[0]];
      drawStar.apply(void 0, _toConsumableArray(currentConfig));
    } else {
      clearCanvas();
    }
  }

  /**
   * Registers event listeners for input changes and increment/decrement button clicks.
   *
   * @returns {void}
   */
  function addEventListeners() {
    nInput.addEventListener('change', go);
    arrows.forEach(function (arrow) {
      arrow.addEventListener('click', function () {
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

  /**
   * Reads URL hash parameters to restore saved star configuration if provided.
   *
   * @returns {void}
   */
  function checkHash() {
    var hash = window.location.hash;
    if (hash.length) {
      var config = hash.substr(1);
      var _config$split = config.split('/'),
        _config$split2 = _slicedToArray(_config$split, 2),
        step = _config$split2[0],
        length = _config$split2[1];
      nInput.value = Number(length);
      setTimeout(function () {
        currentConfig = [Number(length), Number(step)];
        drawStar.apply(void 0, _toConsumableArray(currentConfig));
        scroll();
      }, 10);
    }
  }
  checkHash();
  addEventListeners();
  go();
});

},{"../_modules/document-ready":1,"../_modules/log":3}]},{},[4]);
