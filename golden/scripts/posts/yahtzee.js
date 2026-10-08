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

function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
var ready = require('../_modules/document-ready');
ready.document(function () {
  var rollElement = document.getElementById('roll');
  var diceElement = document.getElementById('dice');
  var die0Element = document.getElementById('die-0');
  var die1Element = document.getElementById('die-1');
  var die2Element = document.getElementById('die-2');
  var die3Element = document.getElementById('die-3');
  var die4Element = document.getElementById('die-4');
  var scoreBoardElement = document.getElementById('score-board');
  var onesElement = document.getElementById('ones');
  var twosElement = document.getElementById('twos');
  var threesElement = document.getElementById('threes');
  var foursElement = document.getElementById('fours');
  var fivesElement = document.getElementById('fives');
  var sixesElement = document.getElementById('sixes');
  var kindTotalElement = document.getElementById('kind-total');
  var bonusElement = document.getElementById('bonus');
  var threeKindElement = document.getElementById('three-kind');
  var fourKindElement = document.getElementById('four-kind');
  var smallStraightElement = document.getElementById('small-straight');
  var largeStraightElement = document.getElementById('large-straight');
  var fullHouseElement = document.getElementById('full-house');
  var wildElement = document.getElementById('wild');
  var yahtzeeElement = document.getElementById('yahtzee');
  var totalElement = document.getElementById('total');
  var rollCount = 0;
  var ROLL_DURATION = 1000;
  var updateScoreEvent = new Event('update');
  var lockedScores = {
    ones: false,
    twos: false,
    threes: false,
    fours: false,
    fives: false,
    sixes: false,
    bonus: false,
    threeKind: false,
    fourKind: false,
    smallStraight: false,
    largeStraight: false,
    fullHouse: false,
    wild: false,
    yahtzee: false
  };
  var diceElementArray = [die0Element, die1Element, die2Element, die3Element, die4Element];

  /**
   * Disables passed DOM element by adding the 'locked' class.
   *
   * @param {HTMLElement} element - DOM element to be disabled.
   * @returns {void}
   */
  function disable(element) {
    element.classList.add('locked');
  }

  /**
   * Removes disabled state from passed DOM element by removing the 'locked' class.
   *
   * @param {HTMLElement} element - DOM element to be re-enabled.
   * @returns {void}
   */
  function reenable(element) {
    element.classList.remove('locked');
  }

  /**
   * Determines if the passed DOM element is disabled/locked.
   *
   * @param {HTMLElement} element - Element to test.
   * @returns {boolean} True if element contains the 'locked' class.
   */
  function isDisabled(element) {
    return element.classList.contains('locked');
  }

  /**
   * Determines if the passed DOM element is active/unlocked.
   *
   * @param {HTMLElement} element - Element to test.
   * @returns {boolean} True if element is not locked.
   */
  function isEnabled(element) {
    return !isDisabled(element);
  }

  /**
   * Returns an array of dice elements that are not currently held/locked.
   *
   * @returns {HTMLElement[]} Array of rollable dice elements.
   */
  function getRollableDice() {
    return diceElementArray.filter(function (element) {
      return isEnabled(element);
    });
  }

  /**
   * Rolls a single die and sets a new random integer value between 1 and 6.
   *
   * @param {HTMLElement} dieElement - The die element to update.
   * @returns {void}
   */
  function rollADie(dieElement) {
    dieElement.value = Math.floor(Math.random() * 6) + 1;
  }

  /**
   * Executes the animated dice rolling sequence over a duration, then triggers score recalculation.
   *
   * @returns {void}
   */
  function roll() {
    var rollableDice = getRollableDice();
    var rollTimeOut = Date.now() + ROLL_DURATION;

    /**
     * Animation frame handler that randomizes unlocked dice values.
     */
    var _oneRoll2 = function _oneRoll() {
      rollableDice.forEach(function (dieElement) {
        rollADie(dieElement);
      });
      diceElementArray.forEach(function (die) {
        die.innerText = die.value;
      });
      if (Date.now() < rollTimeOut) {
        window.requestAnimationFrame(_oneRoll2);
      } else {
        scoreBoardElement.dispatchEvent(updateScoreEvent);
        updateRollCounter();
        updateScoreBoard();
      }
    };
    window.requestAnimationFrame(_oneRoll2);
  }

  /**
   * Determines if all values in `valuesArray` are present in `mainArray`.
   *
   * @param {number[]} mainArray - Haystack array of dice numbers.
   * @param {number[]} valuesArray - Needle array of target values.
   * @returns {boolean} True if all target values are present.
   */
  function hasAll(mainArray, valuesArray) {
    return !valuesArray.map(function (value) {
      return mainArray.includes(value);
    }).includes(false);
  }

  /**
   * Calculates the grand total score across all locked score categories plus upper section bonus.
   *
   * @returns {number} Grand total score.
   */
  function getGrandTotal() {
    var bonusScore = getBonus();
    return Object.keys(lockedScores).map(function (key) {
      return lockedScores[key];
    }).reduce(function () {
      var sum = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
      var value = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
      return sum + value;
    }, 0) + bonusScore;
  }

  /**
   * Calculates the sum total of all five currently rolled dice values.
   *
   * @returns {number} Sum of all dice.
   */
  function getDiceTotal() {
    return diceElementArray.reduce(function (sum, element) {
      return sum + Number(element.value);
    }, 0);
  }

  /**
   * Returns a deduplicated array of face values present among the dice.
   *
   * @returns {number[]} Array of unique dice face values.
   */
  function uniqueDice() {
    var arr = diceElementArray.map(function (element) {
      return Number(element.value);
    });
    return arr.filter(function (value, index) {
      return arr.indexOf(value) === index;
    });
  }

  /**
   * Counts the number of distinct face values present in the current roll.
   *
   * @returns {number} Count of unique dice values.
   */
  function getDiceVariety() {
    return uniqueDice().length;
  }

  /**
   * Counts how many dice show the specified number face value.
   *
   * @param {number} num - The die face number (1-6).
   * @returns {number} Number of matching dice.
   */
  function countDiceOfNumber(num) {
    return diceElementArray.filter(function (element) {
      return Number(element.value) === num;
    }).length;
  }

  /**
   * Checks if at least 3 dice share the same face value.
   *
   * @returns {boolean} True if roll contains 3 of a kind or better.
   */
  function isThreeOfAKind() {
    var diceNumbers = uniqueDice();
    return diceNumbers.map(function (value) {
      return countDiceOfNumber(value);
    }).some(function (value) {
      return value >= 3;
    });
  }

  /**
   * Calculates the three of a kind score (sum of all dice if valid, 0 otherwise).
   *
   * @returns {number} Score for 3 of a kind.
   */
  function getThreeOfAKindTotal() {
    return isThreeOfAKind() ? getDiceTotal() : 0;
  }

  /**
   * Checks if at least 4 dice share the same face value.
   *
   * @returns {boolean} True if roll contains 4 of a kind or better.
   */
  function isFourOfAKind() {
    var diceNumbers = uniqueDice();
    return diceNumbers.map(function (value) {
      return countDiceOfNumber(value);
    }).some(function (value) {
      return value >= 4;
    });
  }

  /**
   * Calculates the four of a kind score (sum of all dice if valid, 0 otherwise).
   *
   * @returns {number} Score for 4 of a kind.
   */
  function getFourOfAKindTotal() {
    return isFourOfAKind() ? getDiceTotal() : 0;
  }

  /**
   * Checks if the dice configuration forms a full house (3 of one number and 2 of another).
   *
   * @returns {boolean} True if roll is a valid full house.
   */
  function isFullHouse() {
    var diceNumbers = uniqueDice();
    if (diceNumbers.length !== 2) return false;
    return countDiceOfNumber(diceNumbers[0]) === 2 || countDiceOfNumber(diceNumbers[1]) === 2;
  }

  /**
   * Calculates the score for a full house (fixed 25 points).
   *
   * @returns {number} 25 if valid full house, 0 otherwise.
   */
  function getFullHouseTotal() {
    return isFullHouse() ? 25 : 0;
  }

  /**
   * Checks if all 5 dice have the identical face value.
   *
   * @returns {boolean} True if roll is a Yahtzee.
   */
  function isYahtzee() {
    return getDiceVariety() === 1;
  }

  /**
   * Calculates the score for a Yahtzee (fixed 50 points).
   *
   * @returns {number} 50 if valid Yahtzee, 0 otherwise.
   */
  function getYahtzeeTotal() {
    return isYahtzee() ? 50 : 0;
  }

  /**
   * Checks if the dice contain a sequence of 4 consecutive numbers.
   *
   * @returns {number} Number of matching small straight patterns (0 or positive).
   */
  function isSmallStraight() {
    var diceNumbers = uniqueDice();
    return [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]].filter(function (valueArray) {
      return hasAll(diceNumbers, valueArray);
    }).length;
  }

  /**
   * Calculates the score for a small straight (fixed 30 points).
   *
   * @returns {number} 30 if valid small straight, 0 otherwise.
   */
  function getSmallStraightTotal() {
    return isSmallStraight() ? 30 : 0;
  }

  /**
   * Checks if the dice contain a sequence of 5 consecutive numbers.
   *
   * @returns {number} Number of matching large straight patterns (0 or positive).
   */
  function isLargeStraight() {
    var diceNumbers = uniqueDice();
    return [[1, 2, 3, 4, 5], [2, 3, 4, 5, 6]].filter(function (valueArray) {
      return hasAll(diceNumbers, valueArray);
    }).length;
  }

  /**
   * Calculates the score for a large straight (fixed 40 points).
   *
   * @returns {number} 40 if valid large straight, 0 otherwise.
   */
  function getLargeStraightTotal() {
    return isLargeStraight() ? 40 : 0;
  }

  /**
   * Calculates the sum of all dice with face value 1.
   *
   * @returns {number} Total points for ones.
   */
  function getOnesTotal() {
    return countDiceOfNumber(1) * 1;
  }

  /**
   * Calculates the sum of all dice with face value 2.
   *
   * @returns {number} Total points for twos.
   */
  function getTwosTotal() {
    return countDiceOfNumber(2) * 2;
  }

  /**
   * Calculates the sum of all dice with face value 3.
   *
   * @returns {number} Total points for threes.
   */
  function getThreesTotal() {
    return countDiceOfNumber(3) * 3;
  }

  /**
   * Calculates the sum of all dice with face value 4.
   *
   * @returns {number} Total points for fours.
   */
  function getFoursTotal() {
    return countDiceOfNumber(4) * 4;
  }

  /**
   * Calculates the sum of all dice with face value 5.
   *
   * @returns {number} Total points for fives.
   */
  function getFivesTotal() {
    return countDiceOfNumber(5) * 5;
  }

  /**
   * Calculates the sum of all dice with face value 6.
   *
   * @returns {number} Total points for sixes.
   */
  function getSixesTotal() {
    return countDiceOfNumber(6) * 6;
  }

  /**
   * Calculates the cumulative total value of the locked upper section categories (1s through 6s).
   *
   * @returns {number} Upper section total score.
   */
  function getKindTotal() {
    return ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'].reduce(function (sum, key) {
      return sum + Number(lockedScores[key]);
    }, 0);
  }

  /**
   * Calculates the bonus score. If the 1-6s add up to 63 or higher,
   * the player receives an extra 35 points.
   *
   * @returns {number} 35 if upper section total is 63+, 0 otherwise.
   */
  function getBonus() {
    return getKindTotal() > 62 ? 35 : 0;
  }

  /**
   * Synchronizes data-rolls-left attributes across roll button, scoreboard, and dice containers.
   *
   * @returns {void}
   */
  function updateRollCounter() {
    rollElement.setAttribute('data-rolls-left', 3 - rollCount);
    scoreBoardElement.setAttribute('data-rolls-left', 3 - rollCount);
    diceElement.setAttribute('data-rolls-left', 3 - rollCount);
    if (rollCount >= 3) {
      disable(rollElement);
    } else {
      reenable(rollElement);
    }
  }

  /**
   * Resets the turn roll counter back to zero and updates UI counter indicators.
   *
   * @returns {void}
   */
  function resetRollCount() {
    rollCount = 0;
    updateRollCounter();
  }

  /**
   * Updates display score for a single row, preserving locked values or displaying projected score.
   *
   * @param {HTMLElement} element - The score row element.
   * @param {string|undefined} lockId - Key in lockedScores or undefined if calculated summary row.
   * @param {Function} scoringFunction - Function computing the category score.
   * @returns {void}
   */
  function updateSingleScore(element, lockId, scoringFunction) {
    var scoreElement = element.querySelector('.score');
    var lock = lockedScores[lockId];
    if (lockId !== undefined && lock !== false) {
      element.value = lock;
      scoreElement.innerText = lock;
    } else {
      element.value = scoringFunction();
      scoreElement.innerText = scoringFunction();
    }
  }

  /**
   * Updates and synchronizes all score values and totals across the scoreboard.
   *
   * @returns {void}
   */
  function updateScoreBoard() {
    updateSingleScore(onesElement, 'ones', getOnesTotal);
    updateSingleScore(twosElement, 'twos', getTwosTotal);
    updateSingleScore(threesElement, 'threes', getThreesTotal);
    updateSingleScore(foursElement, 'fours', getFoursTotal);
    updateSingleScore(fivesElement, 'fives', getFivesTotal);
    updateSingleScore(sixesElement, 'sixes', getSixesTotal);
    updateSingleScore(kindTotalElement, undefined, getKindTotal);
    updateSingleScore(bonusElement, undefined, getBonus);
    updateSingleScore(threeKindElement, 'threeKind', getThreeOfAKindTotal);
    updateSingleScore(fourKindElement, 'fourKind', getFourOfAKindTotal);
    updateSingleScore(smallStraightElement, 'smallStraight', getSmallStraightTotal);
    updateSingleScore(largeStraightElement, 'largeStraight', getLargeStraightTotal);
    updateSingleScore(fullHouseElement, 'fullHouse', getFullHouseTotal);
    updateSingleScore(wildElement, 'wild', getDiceTotal);
    updateSingleScore(yahtzeeElement, 'yahtzee', getYahtzeeTotal);
    updateSingleScore(totalElement, undefined, getGrandTotal);
  }

  /**
   * Registers user click handlers for rolling dice, holding dice, and locking scoreboard boxes.
   *
   * @returns {void}
   */
  function attachEventListeners() {
    rollElement.addEventListener('click', function () {
      if (rollCount < 3 && getRollableDice().length) {
        roll();
        rollCount++;
      }
    });
    diceElementArray.forEach(function (dieElement) {
      dieElement.addEventListener('click', function () {
        if (isEnabled(dieElement)) disable(dieElement);else reenable(dieElement);
      });
    });
    scoreBoardElement.addEventListener('update', updateScoreBoard);
    [[onesElement, 'ones', getOnesTotal], [twosElement, 'twos', getTwosTotal], [threesElement, 'threes', getThreesTotal], [foursElement, 'fours', getFoursTotal], [fivesElement, 'fives', getFivesTotal], [sixesElement, 'sixes', getSixesTotal], [threeKindElement, 'threeKind', getThreeOfAKindTotal], [fourKindElement, 'fourKind', getFourOfAKindTotal], [smallStraightElement, 'smallStraight', getSmallStraightTotal], [largeStraightElement, 'largeStraight', getLargeStraightTotal], [fullHouseElement, 'fullHouse', getFullHouseTotal], [wildElement, 'wild', getDiceTotal], [yahtzeeElement, 'yahtzee', getYahtzeeTotal]].forEach(function (_ref) {
      var _ref2 = _slicedToArray(_ref, 3),
        element = _ref2[0],
        lockId = _ref2[1],
        scoreFunction = _ref2[2];
      element.addEventListener('click', function () {
        // Prevent recording score if dice were not rolled or if this box is already locked.
        if (rollCount === 0 || lockedScores[lockId] !== false) {
          return;
        }
        disable(element);
        lockedScores[lockId] = scoreFunction();
        updateScoreBoard();
        resetRollCount();
        reenable(rollElement);
        diceElementArray.forEach(function (diceEl) {
          reenable(diceEl);
        });
      });
    });
  }
  attachEventListeners();
  resetRollCount();
});

},{"../_modules/document-ready":1}]},{},[2]);
