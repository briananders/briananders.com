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

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _classPrivateFieldInitSpec(e, t, a) { _checkPrivateRedeclaration(e, t), t.set(e, a); }
function _checkPrivateRedeclaration(e, t) { if (t.has(e)) throw new TypeError("Cannot initialize the same private elements twice on an object"); }
function _classPrivateFieldSet(s, a, r) { return s.set(_assertClassBrand(s, a), r), r; }
function _classPrivateFieldGet(s, a) { return s.get(_assertClassBrand(s, a)); }
function _assertClassBrand(e, t, n) { if ("function" == typeof e ? e === t : e.has(t)) return arguments.length < 3 ? t : n; throw new TypeError("Private element is not present on this object"); }
var ready = require('../_modules/document-ready');

/**
 * Calculates the total number of days in a specific month and year.
 *
 * @param {number} month - The month number (1-12).
 * @param {number} year - The full four-digit year.
 * @returns {number} The number of days in the specified month.
 */
function daysInMonth(month, year) {
  // Day 0 of the following month gives the last day of the target month
  return new Date(year, month, 0).getDate();
}

/**
 * Represents an SVG circular path used as a progress ring in the polar clock.
 */
var _element = /*#__PURE__*/new WeakMap();
var _circumference = /*#__PURE__*/new WeakMap();
var CirclePath = /*#__PURE__*/function () {
  /**
   * Creates a new CirclePath instance and configures its strokeDasharray.
   *
   * @param {string} elementId - The DOM ID of the SVG circle element.
   */
  function CirclePath(elementId) {
    _classCallCheck(this, CirclePath);
    _classPrivateFieldInitSpec(this, _element, void 0);
    _classPrivateFieldInitSpec(this, _circumference, void 0);
    _defineProperty(this, "id", void 0);
    this.id = elementId;
    _classPrivateFieldSet(_element, this, document.getElementById(elementId));
    var radius = Number(_classPrivateFieldGet(_element, this).getAttribute('r'));
    _classPrivateFieldSet(_circumference, this, Math.PI * (2 * radius));
    _classPrivateFieldGet(_element, this).style.strokeDasharray = _classPrivateFieldGet(_circumference, this);
    this.setPosition(0);
  }
  return _createClass(CirclePath, [{
    key: "setPosition",
    value:
    /**
     * Sets the stroke offset of the circle based on completion percentage.
     *
     * @param {number} percent - Progress fraction between 0 and 1.
     * @returns {void}
     */
    function setPosition(percent) {
      _classPrivateFieldGet(_element, this).style.strokeDashoffset = _classPrivateFieldGet(_circumference, this) * (1 - percent);
    }
  }]);
}();
/**
 * Formats a number into a zero-padded string of a minimum character length.
 *
 * @param {number} num - The number to format.
 * @param {number} length - The required minimum number of digits.
 * @returns {string} Zero-padded string representation of the number.
 */
function minCharacters(num, length) {
  // Pad with leading zeroes by appending to a zero-filled array and taking the suffix
  var arr = new Array(10).fill(0);
  arr.push(num);
  var arrString = arr.join('');
  return arrString.substring(arrString.length - length);
}

/**
 * Extracts and returns current date and time components.
 *
 * @returns {{ seconds: number, minutes: number, hours: number, days: number, months: number, years: number }}
 *   Object containing current time and date parts.
 */
function getDate() {
  var date = new Date();
  return {
    seconds: date.getSeconds(),
    minutes: date.getMinutes(),
    hours: date.getHours(),
    days: date.getDate(),
    months: date.getMonth() + 1,
    years: date.getFullYear()
  };
}

/**
 * Updates stroke offsets and text readouts for all time unit rings.
 *
 * @param {CirclePath[]} polarClockInstances - Array of CirclePath ring instances.
 * @param {Object.<string, NodeList>} displayInstances - Map of time unit keys to corresponding DOM text elements.
 * @returns {void}
 */
function updateTimes(polarClockInstances, displayInstances) {
  var _getDate = getDate(),
    seconds = _getDate.seconds,
    minutes = _getDate.minutes,
    hours = _getDate.hours,
    days = _getDate.days,
    months = _getDate.months,
    years = _getDate.years;
  polarClockInstances.forEach(function (instance) {
    if (instance.id === 'seconds') {
      instance.setPosition(seconds / 60);
      displayInstances[instance.id].forEach(function (el) {
        el.innerHTML = minCharacters(seconds % 60, 2);
      });
    }
    if (instance.id === 'minutes') {
      instance.setPosition(minutes / 60);
      displayInstances[instance.id].forEach(function (el) {
        el.innerHTML = minCharacters(minutes % 60, 2);
      });
    }
    if (instance.id === 'hours') {
      instance.setPosition(hours / 24);
      displayInstances[instance.id].forEach(function (el) {
        el.innerHTML = minCharacters(hours % 24, 2);
      });
    }
    if (instance.id === 'days') {
      instance.setPosition(days / daysInMonth(months, years));
      displayInstances[instance.id].forEach(function (el) {
        el.innerHTML = minCharacters(days, 2);
      });
    }
    if (instance.id === 'months') {
      instance.setPosition(months / 12);
      displayInstances[instance.id].forEach(function (el) {
        el.innerHTML = minCharacters(months, 2);
      });
    }
    if (instance.id === 'years') {
      instance.setPosition(years / 10000);
      displayInstances[instance.id].forEach(function (el) {
        el.innerHTML = years;
      });
    }
  });
}

/**
 * Starts a recurring interval timer to update clock displays.
 *
 * @param {CirclePath[]} polarClockInstances - Array of CirclePath instances.
 * @param {Object.<string, NodeList>} displayInstances - Map of time unit keys to DOM elements.
 * @returns {void}
 */
function startClocking(polarClockInstances, displayInstances) {
  setInterval(updateTimes.bind(this, polarClockInstances, displayInstances), 200);
}
ready.document(function () {
  var ids = ['years', 'months', 'days', 'hours', 'minutes', 'seconds'];
  var polarClockInstances = ids.map(function (id) {
    return new CirclePath(id);
  });
  var displayInstances = {};
  ids.forEach(function (id) {
    displayInstances[id] = document.querySelectorAll("[data-time=\"".concat(id, "\"]"));
  });
  startClocking(polarClockInstances, displayInstances);
});

},{"../_modules/document-ready":1}]},{},[2]);
