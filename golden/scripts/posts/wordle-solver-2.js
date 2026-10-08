(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

var deselectCurrent = require("toggle-selection");

var clipboardToIE11Formatting = {
  "text/plain": "Text",
  "text/html": "Url",
  "default": "Text"
}

var defaultMessage = "Copy to clipboard: #{key}, Enter";

function format(message) {
  var copyKey = (/mac os x/i.test(navigator.userAgent) ? "⌘" : "Ctrl") + "+C";
  return message.replace(/#{\s*key\s*}/g, copyKey);
}

function copy(text, options) {
  var debug,
    message,
    reselectPrevious,
    range,
    selection,
    mark,
    success = false;
  if (!options) {
    options = {};
  }
  debug = options.debug || false;
  try {
    reselectPrevious = deselectCurrent();

    range = document.createRange();
    selection = document.getSelection();

    mark = document.createElement("span");
    mark.textContent = text;
    // avoid screen readers from reading out loud the text
    mark.ariaHidden = "true"
    // reset user styles for span element
    mark.style.all = "unset";
    // prevents scrolling to the end of the page
    mark.style.position = "fixed";
    mark.style.top = 0;
    mark.style.clip = "rect(0, 0, 0, 0)";
    // used to preserve spaces and line breaks
    mark.style.whiteSpace = "pre";
    // do not inherit user-select (it may be `none`)
    mark.style.webkitUserSelect = "text";
    mark.style.MozUserSelect = "text";
    mark.style.msUserSelect = "text";
    mark.style.userSelect = "text";
    mark.addEventListener("copy", function(e) {
      e.stopPropagation();
      if (options.format) {
        e.preventDefault();
        if (typeof e.clipboardData === "undefined") { // IE 11
          debug && console.warn("unable to use e.clipboardData");
          debug && console.warn("trying IE specific stuff");
          window.clipboardData.clearData();
          var format = clipboardToIE11Formatting[options.format] || clipboardToIE11Formatting["default"]
          window.clipboardData.setData(format, text);
        } else { // all other browsers
          e.clipboardData.clearData();
          e.clipboardData.setData(options.format, text);
        }
      }
      if (options.onCopy) {
        e.preventDefault();
        options.onCopy(e.clipboardData);
      }
    });

    document.body.appendChild(mark);

    range.selectNodeContents(mark);
    selection.addRange(range);

    var successful = document.execCommand("copy");
    if (!successful) {
      throw new Error("copy command was unsuccessful");
    }
    success = true;
  } catch (err) {
    debug && console.error("unable to copy using execCommand: ", err);
    debug && console.warn("trying IE specific stuff");
    try {
      window.clipboardData.setData(options.format || "text", text);
      options.onCopy && options.onCopy(window.clipboardData);
      success = true;
    } catch (err) {
      debug && console.error("unable to copy using clipboardData: ", err);
      debug && console.error("falling back to prompt");
      message = format("message" in options ? options.message : defaultMessage);
      window.prompt(message, text);
    }
  } finally {
    if (selection) {
      if (typeof selection.removeRange == "function") {
        selection.removeRange(range);
      } else {
        selection.removeAllRanges();
      }
    }

    if (mark) {
      document.body.removeChild(mark);
    }
    reselectPrevious();
  }

  return success;
}

module.exports = copy;

},{"toggle-selection":2}],2:[function(require,module,exports){

module.exports = function () {
  var selection = document.getSelection();
  if (!selection.rangeCount) {
    return function () {};
  }
  var active = document.activeElement;

  var ranges = [];
  for (var i = 0; i < selection.rangeCount; i++) {
    ranges.push(selection.getRangeAt(i));
  }

  switch (active.tagName.toUpperCase()) { // .toUpperCase handles XHTML
    case 'INPUT':
    case 'TEXTAREA':
      active.blur();
      break;

    default:
      active = null;
      break;
  }

  selection.removeAllRanges();
  return function () {
    selection.type === 'Caret' &&
    selection.removeAllRanges();

    if (!selection.rangeCount) {
      ranges.forEach(function(range) {
        selection.addRange(range);
      });
    }

    active &&
    active.focus();
  };
};

},{}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){
"use strict";

/**
 * Evaluates whether the current environment is production based on the window hostname.
 *
 * @type {boolean}
 */
module.exports.isProduction = function () {
  return window.location.hostname === 'briananders.com';
}();

},{}],5:[function(require,module,exports){
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

},{"./environment":4}],6:[function(require,module,exports){
"use strict";

function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
var ready = require('../_modules/document-ready');
ready.document(function () {
  var copy = require('copy-to-clipboard');
  var _require = require('../_modules/log'),
    table = _require.table;
  var Matcher = require('./wordle-solver/matcher');
  var boardElement = document.getElementById('board');
  var answersElement = document.getElementById('options');
  var resultsElement = document.getElementById('results-count');
  var lines = Array.from(boardElement.querySelectorAll('.line'));
  var textInputs = Array.from(boardElement.querySelectorAll('input[type=text]'));
  var checkboxes = Array.from(boardElement.querySelectorAll('input[type=radio]'));
  var submitButton = document.getElementById('submit');
  var clearButton = document.getElementById('clear');
  var toastNotification = document.querySelector('toast-notification');
  var letterFrequencyElement = document.getElementById('letter-frequency');
  var unusedLetterElement = document.getElementById('untried-letters');
  var untriedResultsElement = document.getElementById('untried-results-count');
  var breakpoint = matchMedia('(max-width: 500px)');

  /// //////////////////////// CONSTANTS

  var STATES = {
    CLOSE: 'close',
    CORRECT: 'correct',
    WRONG: 'wrong'
  };
  var EVENTS = {
    KEYDOWN: 'keydown',
    KEYUP: 'keyup',
    CLICK: 'click',
    CHANGE: 'change',
    INPUT: 'input'
  };
  var KEYS = {
    BACKSPACE: 'Backspace',
    ARROW_LEFT: 'ArrowLeft',
    TAB: 'Tab',
    ARROW_RIGHT: 'ArrowRight'
  };
  var EMPTY = '';
  var SPACE = ' ';
  var DASH = '-';

  /**
   * Tests if a character is an alphabetical letter.
   *
   * @param {string} value - Character to test.
   * @returns {boolean} True if character is a-z or A-Z.
   */
  var isLetter = function isLetter(value) {
    return /[a-zA-Z]/.test(value);
  };

  /// ////////////// get dictionary

  var dictionary;

  /**
   * Parses and loads the 5-letter word dictionary from the XMLHttpRequest response.
   *
   * @returns {void}
   */
  function reqListener() {
    dictionary = JSON.parse(this.responseText);
  }
  var req = new XMLHttpRequest();
  req.addEventListener('load', reqListener);
  req.open('GET', '/data/five-letter-words.json');
  req.send();

  /// ////////////// functions

  /**
   * Inspects all word lines on the board to adjust the visible board height
   * based on the last row containing entries.
   *
   * @returns {void}
   */
  function checkLinesFull() {
    var lineFull = new Array(6);
    var lastFullLine = 0;
    lines.forEach(function (lineElement) {
      var inputs = Array.from(lineElement.querySelectorAll('input[type=text]'));
      var _lineElement$id$split = lineElement.id.split(DASH),
        _lineElement$id$split2 = _slicedToArray(_lineElement$id$split, 2),
        lineNumber = _lineElement$id$split2[1];
      var isFull = inputs.filter(function (input) {
        return input.value.length;
      }).length === 5;
      lineFull[Number(lineNumber)] = isFull;
    });
    for (var i = lineFull.length - 1; i >= 0; i--) {
      if (lineFull[i]) {
        lastFullLine = i + 1;
        break;
      }
    }
    if (lastFullLine > 5) lastFullLine = 5;
    var lastFullLineElement = lines.filter(function (line) {
      return Number(line.id.split('-')[1]) === lastFullLine;
    })[0];
    boardElement.style.height = "".concat(lastFullLineElement.offsetHeight * (lastFullLine + 1), "px");
  }

  /**
   * Populates the next available empty row with characters from the selected candidate word.
   *
   * @param {string} word - Five-letter word string.
   * @returns {void}
   */
  function fillFirstEmptyLine(word) {
    var firstEmpty;
    var emptyLineElements;
    lines.forEach(function (lineElement, index) {
      var lineInputs = Array.from(lineElement.querySelectorAll('input[type=text]'));
      var lineValue = lineInputs.map(function (input) {
        return input.value;
      }).join('');
      if (lineValue === '' && firstEmpty === undefined) {
        firstEmpty = index;
        emptyLineElements = lineInputs;
      }
    });
    emptyLineElements.forEach(function (input, index) {
      input.value = word.charAt(index).toUpperCase();
    });
  }

  /**
   * Aggregates tile states (correct, close, wrong, position exclusions, and all entered letters) from the board inputs.
   *
   * @returns {{ closeLetters: string[], wrongLetters: string[],
   *   correctLetters: Array<string|undefined>, cannotBeLetters: string[][],
   *   allLetters: string[] }} Constraint object used for dictionary filtering
   *   and letter exclusion.
   */
  function getLetters() {
    var closeLetters = [];
    var wrongLetters = [];
    var correctLetters = new Array(5);
    var cannotBeLetters = [[], [], [], [], []];
    var allLetters = [];
    textInputs.forEach(function (inputElement) {
      var _inputElement$dataset = inputElement.dataset,
        state = _inputElement$dataset.state,
        letterNumber = _inputElement$dataset.letterNumber;
      var letterIndex = Number(letterNumber);
      var value = inputElement.value;
      if (value === EMPTY) return;
      if (state === STATES.WRONG && !closeLetters.includes(value)) {
        wrongLetters.push(value);
      } else if (state === STATES.CLOSE) {
        closeLetters.push(value);
        cannotBeLetters[letterIndex].push(value);
      } else if (state === STATES.CORRECT) {
        closeLetters.push(value);
        if (correctLetters[letterIndex] && correctLetters[letterIndex] !== value) {
          /* eslint-disable */
          alert("It looks like you have two letters marked for the same position: ".concat(value, " and ").concat(correctLetters[letterIndex]));
          /* eslint-enable */
        }
        correctLetters[letterIndex] = value;
      }
      if (allLetters.indexOf(value.toUpperCase()) < 0) allLetters.push(value.toUpperCase());
    });
    return {
      closeLetters: closeLetters,
      wrongLetters: wrongLetters,
      correctLetters: correctLetters,
      cannotBeLetters: cannotBeLetters,
      allLetters: allLetters
    };
  }

  /**
   * Resets an individual letter input cell to blank and its radio button state to 'wrong'.
   *
   * @param {HTMLInputElement} textInput - The letter input element to reset.
   * @returns {void}
   */
  function resetLetter(textInput) {
    var _textInput$id$split = textInput.id.split(DASH),
      _textInput$id$split2 = _slicedToArray(_textInput$id$split, 3),
      lineNumber = _textInput$id$split2[1],
      letterNumber = _textInput$id$split2[2];
    var closeCheckbox = document.getElementById("".concat(STATES.CLOSE, "-").concat(lineNumber, "-").concat(letterNumber));
    var correctCheckbox = document.getElementById("".concat(STATES.CORRECT, "-").concat(lineNumber, "-").concat(letterNumber));
    var wrongCheckbox = document.getElementById("".concat(STATES.WRONG, "-").concat(lineNumber, "-").concat(letterNumber));
    textInput.value = EMPTY;
    textInput.dataset.state = STATES.WRONG;
    wrongCheckbox.checked = true;
    closeCheckbox.checked = false;
    correctCheckbox.checked = false;
  }

  /**
   * Clears all letter inputs across the entire board.
   *
   * @returns {void}
   */
  function clear() {
    var inputs = Array.from(boardElement.querySelectorAll('input[type=text]'));
    inputs.forEach(resetLetter);
    checkLinesFull();
  }

  /**
   * Converts a word string to title case (capital first letter, lowercase remainder).
   *
   * @param {string} word - Word string to convert.
   * @returns {string} Title-cased word.
   */
  function titleCase(word) {
    return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
  }

  /**
   * Updates the DOM section displaying weighted candidate words in descending score order.
   *
   * @param {Object} options - Options object.
   * @param {Array<[string, number]>} options.weightedDictionary - Array of [word, score] tuples.
   * @returns {void}
   */
  function updateResultSection(_ref) {
    var weightedDictionary = _ref.weightedDictionary;
    var wordElements = weightedDictionary.sort(function (a, b) {
      return a[1] > b[1] ? -1 : 1;
    }).map(function (wordTuple) {
      return "<span>".concat(titleCase(wordTuple[0]), " (").concat(wordTuple[1], ")</span>");
    });
    answersElement.innerHTML = wordElements.join(SPACE);
    resultsElement.innerText = wordElements.length;
  }

  /**
   * Maps letter frequency rankings into relative weight scores.
   *
   * @param {Array<[string, number]>} letterFrequency - Sorted array of [letter, frequencyCount] pairs.
   * @returns {Object.<string, number>} Map of uppercase letter characters to numeric score weights.
   */
  function getLetterValues(letterFrequency) {
    var indexValue = 0;
    var lastValue = 0;
    var returnObject = {};
    for (var i = letterFrequency.length - 1; i >= 0; i--) {
      var _letterFrequency$i = _slicedToArray(letterFrequency[i], 2),
        letter = _letterFrequency$i[0],
        currentValue = _letterFrequency$i[1];
      if (lastValue < currentValue) {
        indexValue++;
      }
      returnObject[letter] = indexValue;
      lastValue = indexValue;
    }
    return returnObject;
  }

  /**
   * Computes an information-density score for each candidate word based on letter weights,
   * penalizing repeated letters and adding a bonus for words with all distinct letters.
   *
   * @param {Object} options - Weighting options.
   * @param {string[]} options.filteredDictionary - Array of candidate words.
   * @param {Object.<string, number>} options.letterValues - Map of letter score values.
   * @returns {Array<[string, number]>} Array of [word, score] tuples.
   */
  function getWeightedDictionary(_ref2) {
    var filteredDictionary = _ref2.filteredDictionary,
      letterValues = _ref2.letterValues;
    return filteredDictionary.map(function (word) {
      var wordLetterValues = word.toUpperCase().split('').map(function (letter) {
        return letterValues[letter];
      });
      var filteredValues = wordLetterValues.map(function (value, index) {
        return wordLetterValues.indexOf(value) !== index ? -1 : value;
      });
      if (filteredValues.indexOf(-1) === -1) filteredValues.push(100);
      var score = filteredValues.reduce(function (partialSum, letterValue) {
        return partialSum + letterValue;
      }, 0);
      return [word, score];
    });
  }

  /**
   * Finds candidate words composed exclusively of untried letters to maximize information gain.
   *
   * @returns {void}
   */
  function updateUnusedLetterWords() {
    var _getLetters = getLetters(),
      allLetters = _getLetters.allLetters;
    var alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    var unusedLetters = alphabet.filter(function (letter) {
      if (allLetters.includes(letter.toUpperCase())) {
        return false;
      }
      return true;
    });
    var unusedLetterDictionary = dictionary.filter(function (word) {
      var letters = word.split('');
      for (var i = 0; i < letters.length; i++) {
        if (!unusedLetters.includes(letters[i].toUpperCase())) {
          return false;
        }
      }
      return true;
    });
    var letterFrequency = getLetterFrequency({
      filteredDictionary: unusedLetterDictionary
    });
    var letterValues = getLetterValues(letterFrequency);
    var weightedDictionary = getWeightedDictionary({
      filteredDictionary: unusedLetterDictionary,
      letterValues: letterValues
    });
    var wordElements = weightedDictionary.sort(function (a, b) {
      return a[1] > b[1] ? -1 : 1;
    }).map(function (wordTuple) {
      return "<span>".concat(titleCase(wordTuple[0]), " (").concat(wordTuple[1], ")</span>");
    });
    unusedLetterElement.innerHTML = wordElements.join(SPACE);
    untriedResultsElement.innerHTML = unusedLetterDictionary.length.toString();
  }

  /**
   * Filters the dictionary against current game board constraints using Matcher.
   *
   * @returns {string[]} Array of matching uppercase candidate words.
   */
  function getFilteredDictionary() {
    var _getLetters2 = getLetters(),
      closeLetters = _getLetters2.closeLetters,
      wrongLetters = _getLetters2.wrongLetters,
      correctLetters = _getLetters2.correctLetters,
      cannotBeLetters = _getLetters2.cannotBeLetters;
    var potentialMatches = [];
    var matcher = new Matcher({
      closeLetters: closeLetters,
      wrongLetters: wrongLetters,
      correctLetters: correctLetters,
      cannotBeLetters: cannotBeLetters
    });
    dictionary.forEach(function (word) {
      var upperCaseWord = word.toUpperCase();
      if (matcher.matches(upperCaseWord)) potentialMatches.push(word.toUpperCase());
    });
    table({
      closeLetters: closeLetters.toString(),
      wrongLetters: wrongLetters.toString(),
      correctLetters: correctLetters.toString(),
      cannotBeLetters: cannotBeLetters.toString()
    });
    return potentialMatches;
  }

  /**
   * Renders the frequency count breakdown of letters appearing in the candidate set.
   *
   * @param {Object} options - Options object.
   * @param {Array<[string, number]>} options.letterFrequency - Array of [letter, count] pairs.
   * @returns {Array<[string, number]>} The input letter frequency array.
   */
  function updateLetterFrequencySection(_ref3) {
    var letterFrequency = _ref3.letterFrequency;
    letterFrequencyElement.innerHTML = letterFrequency.map(function (pairs) {
      return "<span>".concat(pairs[0].toUpperCase(), ": ").concat(pairs[1], "</span>");
    }).join(', ');
    return letterFrequency;
  }

  /**
   * Counts occurrences of each unique letter across candidate words and returns pairs sorted descending.
   *
   * @param {Object} options - Options object.
   * @param {string[]} options.filteredDictionary - Candidate words list.
   * @returns {Array<[string, number]>} Sorted array of [letter, count] tuples.
   */
  function getLetterFrequency(_ref4) {
    var filteredDictionary = _ref4.filteredDictionary;
    /**
     * Converts letter count object to sorted pair array.
     *
     * @param {Object.<string, number>} lets - Map of letter to count.
     * @returns {Array<[string, number]>} Descending sorted array of [letter, count].
     */
    function sortLetters(lets) {
      var keys = Object.keys(lets);
      var unsortedLetters = [];
      keys.forEach(function (key) {
        unsortedLetters.push([key, lets[key]]);
      });
      return unsortedLetters.sort(function (a, b) {
        if (a[1] < b[1]) return 1;
        return -1;
      });
    }
    var letters = {};
    filteredDictionary.forEach(function (word) {
      word.split('').forEach(function (letter, index) {
        if (word.indexOf(letter) !== index) {
          // console.log(word);
        } else if (letters[letter]) {
          letters[letter]++;
        } else {
          letters[letter] = 1;
        }
      });
    });
    return sortLetters(letters);
  }

  /**
   * Radio button change handler that syncs the selected state (correct/close/wrong) to the text input dataset.
   *
   * @param {Object} event - The change event payload.
   * @param {HTMLInputElement} event.srcElement - The changed radio input.
   * @returns {void}
   */
  function checkboxUpdated(_ref5) {
    var srcElement = _ref5.srcElement;
    if (!srcElement.checked) return;
    var _srcElement$id$split = srcElement.id.split(DASH),
      _srcElement$id$split2 = _slicedToArray(_srcElement$id$split, 3),
      state = _srcElement$id$split2[0],
      lineNumber = _srcElement$id$split2[1],
      letterNumber = _srcElement$id$split2[2];
    var letterInput = document.getElementById("letter-".concat(lineNumber, "-").concat(letterNumber));
    letterInput.dataset.state = state;
  }

  /**
   * Shifts focus to the preceding letter input in the current word row.
   *
   * @param {HTMLInputElement} srcElement - Current active letter input.
   * @returns {void}
   */
  function previousInput(srcElement) {
    var _srcElement$id$split3 = srcElement.id.split(DASH),
      _srcElement$id$split4 = _slicedToArray(_srcElement$id$split3, 3),
      letterWord = _srcElement$id$split4[0],
      lineNumber = _srcElement$id$split4[1],
      letterNumber = _srcElement$id$split4[2];
    var nextInputElement = document.getElementById("".concat(letterWord, "-").concat(lineNumber, "-").concat(Number(letterNumber) - 1));
    if (nextInputElement) {
      nextInputElement.focus();
    }
  }

  /**
   * Shifts focus to the succeeding letter input in the current word row.
   *
   * @param {HTMLInputElement} srcElement - Current active letter input.
   * @returns {void}
   */
  function nextInput(srcElement) {
    var _srcElement$id$split5 = srcElement.id.split(DASH),
      _srcElement$id$split6 = _slicedToArray(_srcElement$id$split5, 3),
      letterWord = _srcElement$id$split6[0],
      lineNumber = _srcElement$id$split6[1],
      letterNumber = _srcElement$id$split6[2];
    var nextInputElement = document.getElementById("".concat(letterWord, "-").concat(lineNumber, "-").concat(Number(letterNumber) + 1));
    if (nextInputElement) {
      nextInputElement.focus();
    }
  }

  /**
   * Keydown event handler for letter typing, arrow key navigation, and backspace clearing.
   *
   * @param {KeyboardEvent} evt - Keyboard event.
   * @returns {void}
   */
  function inputKeydown(evt) {
    var srcElement = evt.srcElement,
      key = evt.key;
    var _char = key.toUpperCase();
    switch (key) {
      case KEYS.BACKSPACE:
        resetLetter(srcElement);
      // eslint-disable-next-line no-fallthrough
      case KEYS.ARROW_LEFT:
        previousInput(srcElement);
        evt.preventDefault();
        return;
      case KEYS.ARROW_RIGHT:
        nextInput(srcElement);
        // evt.preventDefault();
        return;
      default:
    }
    if (isLetter(_char) && _char.length === 1) {
      resetLetter(srcElement);
      srcElement.value = _char;
      nextInput(srcElement);
      evt.preventDefault();
    } else {
      resetLetter(srcElement);
    }
    checkLinesFull();
  }

  /**
   * Executes the full Wordle solver pipeline and updates all recommendation and stats panels.
   *
   * @returns {void}
   */
  function calculate() {
    checkLinesFull();
    var filteredDictionary = getFilteredDictionary();
    var letterFrequency = getLetterFrequency({
      filteredDictionary: filteredDictionary
    });
    var letterValues = getLetterValues(letterFrequency);
    var weightedDictionary = getWeightedDictionary({
      filteredDictionary: filteredDictionary,
      letterValues: letterValues
    });
    updateLetterFrequencySection({
      letterFrequency: letterFrequency
    });
    updateResultSection({
      weightedDictionary: weightedDictionary
    });
    updateUnusedLetterWords();
  }

  /**
   * Registers all DOM event listeners for keyboard navigation, buttons, and radio controls.
   *
   * @returns {void}
   */
  function initEventListeners() {
    textInputs.forEach(function (input) {
      input.addEventListener(EVENTS.KEYDOWN, inputKeydown);
    });
    submitButton.addEventListener(EVENTS.CLICK, calculate);
    clearButton.addEventListener(EVENTS.CLICK, clear);
    checkboxes.forEach(function (box) {
      box.addEventListener(EVENTS.CHANGE, checkboxUpdated);
    });
    [answersElement, unusedLetterElement].forEach(function (element) {
      element.addEventListener(EVENTS.CLICK, function (_ref6) {
        var target = _ref6.target;
        if (target.tagName !== 'SPAN') return;
        copy(target.innerText);
        toastNotification.classList.add('animate');
        fillFirstEmptyLine(target.innerText);
        setTimeout(function () {
          toastNotification.classList.remove('animate');
        }, 1500);
      });
    });
    breakpoint.addEventListener('change', checkLinesFull);
  }
  initEventListeners();
  checkLinesFull();
});

},{"../_modules/document-ready":3,"../_modules/log":5,"./wordle-solver/matcher":7,"copy-to-clipboard":1}],7:[function(require,module,exports){
"use strict";

/**
 * Constructs a Wordle word constraint matcher to test candidate words.
 *
 * @constructor
 * @param {Object} options - Matcher constraints.
 * @param {string[]} options.closeLetters - Yellow letters that must be present somewhere in the word.
 * @param {string[]} options.wrongLetters - Gray letters that must not appear in the word.
 * @param {Array<string|undefined>} options.correctLetters - Green letters fixed at specific 0-based indices.
 * @param {string[][]} options.cannotBeLetters - 2D array of disallowed letters per 0-based character index.
 */
module.exports = function Matcher(_ref) {
  var closeLetters = _ref.closeLetters,
    wrongLetters = _ref.wrongLetters,
    correctLetters = _ref.correctLetters,
    cannotBeLetters = _ref.cannotBeLetters;
  /**
   * Checks if at least one letter from the provided array appears in the candidate word.
   *
   * @param {string} word - The candidate word.
   * @param {string[]} letters - Array of test letters.
   * @returns {boolean} True if any letter exists in word.
   */
  function any(word, letters) {
    for (var i = 0; i < letters.length; i++) {
      var letter = letters[i];
      if (word.includes(letter)) return true;
    }
    return false;
  }

  /**
   * Checks if every letter from the provided array appears in the candidate word.
   *
   * @param {string} word - The candidate word.
   * @param {string[]} letters - Array of required letters.
   * @returns {boolean} True if all letters are present in word.
   */
  function all(word, letters) {
    for (var i = 0; i < letters.length; i++) {
      var letter = letters[i];
      if (!word.includes(letter)) return false;
    }
    return true;
  }

  /**
   * Validates that fixed-position green letters match the characters of the candidate word.
   *
   * @param {string} word - The candidate word.
   * @param {Array<string|undefined>} letters - Positional array of known correct letters.
   * @returns {boolean} True if candidate matches all known exact letters.
   */
  function correctLettersMatch(word, letters) {
    for (var i = 0; i < letters.length; i++) {
      var letter = letters[i];
      if (letter !== undefined && word[i] !== letter) return false;
    }
    return true;
  }

  /**
   * Confirms that close (yellow) letters do not appear at positions where they were marked yellow.
   *
   * @param {string} word - The candidate word.
   * @param {string[][]} letters2DArray - Array of disallowed letter arrays per character position.
   * @returns {boolean} True if no character violates position exclusion rules.
   */
  function cannotBeLettersMatch(word, letters2DArray) {
    // letters is a 2D array
    for (var i = 0; i < letters2DArray.length; i++) {
      var letters = letters2DArray[i];
      for (var j = 0; j < letters.length; j++) {
        var letter = letters[j];
        if (word[i] === letter) return false;
      }
    }
    return true;
  }

  /**
   * Tests whether a given uppercase word satisfies all Wordle game board constraints.
   *
   * @param {string} word - The 5-letter candidate word to validate.
   * @returns {boolean} True if candidate word satisfies all constraints.
   */
  this.matches = function (word) {
    if (!correctLettersMatch(word, correctLetters)) return false;
    if (any(word, wrongLetters)) return false;
    if (!all(word, closeLetters)) return false;
    if (!cannotBeLettersMatch(word, cannotBeLetters)) return false;
    return true;
  };
};

},{}]},{},[6]);
