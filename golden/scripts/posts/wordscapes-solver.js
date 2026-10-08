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
ready.document(function () {
  var formElement = document.getElementById('form');
  var inputElement = document.getElementById('input');
  // const buttonElement = document.getElementById('button');
  var resultsElement = document.getElementById('results');
  var dictionary;

  /**
   * Parses and stores the Wordscapes word dictionary from the XMLHttpRequest response.
   *
   * @returns {void}
   */
  function reqListener() {
    dictionary = JSON.parse(this.responseText);
  }
  var req = new XMLHttpRequest();
  req.addEventListener('load', reqListener);
  req.open('GET', '/data/wordscapes-words.json');
  req.send();

  /**
   * Evaluates available letters against the dictionary to find valid anagram words of length >= 3.
   *
   * @param {Event} [evt] - Optional form submit or keyboard event.
   * @returns {void}
   */
  function calculateResults(evt) {
    if (evt) evt.preventDefault();
    resultsElement.innerHTML = '';
    var inputLetters = inputElement.value.split('');
    var matches = [];
    dictionary.forEach(function (word) {
      var testWord = word;
      inputLetters.forEach(function (letter) {
        testWord = testWord.replace(letter, '');
      });
      if (testWord.length === 0 && word.length > 2) {
        matches.push(word);
      }
    });
    if (matches.length > 0) {
      formatResults(matches);
    }
  }

  /**
   * Groups matched words by character length, sorts alphabetically, and renders HTML sections.
   *
   * @param {string[]} results - Array of matched candidate words.
   * @returns {void}
   */
  function formatResults(results) {
    // sort results by the length
    var resultsByLength = results.sort(function (a, b) {
      return a.length > b.length ? -1 : 1;
    });
    // get the longest result length
    var longestLength = resultsByLength[0].length;
    // HTML formatting
    var htmlSections = [];
    // setup splitting data
    var splitResults = {};

    // init empty arrays for each length
    for (var i = longestLength; i >= 3; i--) {
      splitResults[i] = [];
    }

    // split the data by length
    resultsByLength.forEach(function (word) {
      splitResults[word.length].push(word);
    });

    // sort the data & format HTML
    for (var _i = longestLength; _i >= 3; _i--) {
      splitResults[_i] = splitResults[_i].sort();
      htmlSections.push("\n        <h3>".concat(_i, " Letter Words</h3>\n        <p>\n          ").concat(splitResults[_i].join(', '), "\n        <p>\n      "));
    }
    resultsElement.innerHTML = "<div>".concat(htmlSections.join('</div><div>'), "</div>");
  }

  /**
   * Registers form submit and Enter key event listeners for the input element.
   *
   * @returns {void}
   */
  function initEventListeners() {
    formElement.addEventListener('submit', calculateResults);
    inputElement.addEventListener('keydown', function (evt) {
      if (evt.key === 'Enter') {
        calculateResults();
      }
    });
  }
  initEventListeners();
});

},{"../_modules/document-ready":1}]},{},[2]);
