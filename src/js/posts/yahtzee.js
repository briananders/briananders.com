const ready = require('../_modules/document-ready');

ready.document(() => {
  const rollElement = document.getElementById('roll');
  const diceElement = document.getElementById('dice');
  const die0Element = document.getElementById('die-0');
  const die1Element = document.getElementById('die-1');
  const die2Element = document.getElementById('die-2');
  const die3Element = document.getElementById('die-3');
  const die4Element = document.getElementById('die-4');
  const scoreBoardElement = document.getElementById('score-board');
  const onesElement = document.getElementById('ones');
  const twosElement = document.getElementById('twos');
  const threesElement = document.getElementById('threes');
  const foursElement = document.getElementById('fours');
  const fivesElement = document.getElementById('fives');
  const sixesElement = document.getElementById('sixes');
  const kindTotalElement = document.getElementById('kind-total');
  const bonusElement = document.getElementById('bonus');
  const threeKindElement = document.getElementById('three-kind');
  const fourKindElement = document.getElementById('four-kind');
  const smallStraightElement = document.getElementById('small-straight');
  const largeStraightElement = document.getElementById('large-straight');
  const fullHouseElement = document.getElementById('full-house');
  const wildElement = document.getElementById('wild');
  const yahtzeeElement = document.getElementById('yahtzee');
  const totalElement = document.getElementById('total');

  let rollCount = 0;
  const ROLL_DURATION = 1000;
  const updateScoreEvent = new Event('update');

  const lockedScores = {
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
    yahtzee: false,
  };

  const diceElementArray = [die0Element, die1Element, die2Element, die3Element, die4Element];

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
    return diceElementArray.filter((element) => isEnabled(element));
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
    const rollableDice = getRollableDice();
    const rollTimeOut = Date.now() + ROLL_DURATION;

    /**
     * Animation frame handler that randomizes unlocked dice values.
     */
    const _oneRoll = () => {
      rollableDice.forEach((dieElement) => {
        rollADie(dieElement);
      });
      diceElementArray.forEach((die) => {
        die.innerText = die.value;
      });

      if (Date.now() < rollTimeOut) {
        window.requestAnimationFrame(_oneRoll);
      } else {
        scoreBoardElement.dispatchEvent(updateScoreEvent);
        updateRollCounter();
        updateScoreBoard();
      }
    };

    window.requestAnimationFrame(_oneRoll);
  }

  /**
   * Determines if all values in `valuesArray` are present in `mainArray`.
   *
   * @param {number[]} mainArray - Haystack array of dice numbers.
   * @param {number[]} valuesArray - Needle array of target values.
   * @returns {boolean} True if all target values are present.
   */
  function hasAll(mainArray, valuesArray) {
    return !valuesArray.map((value) => mainArray.includes(value)).includes(false);
  }

  /**
   * Calculates the grand total score across all locked score categories plus upper section bonus.
   *
   * @returns {number} Grand total score.
   */
  function getGrandTotal() {
    const bonusScore = getBonus();
    return Object.keys(lockedScores)
      .map((key) => lockedScores[key])
      .reduce((sum = 0, value = 0) => sum + value, 0) + bonusScore;
  }

  /**
   * Calculates the sum total of all five currently rolled dice values.
   *
   * @returns {number} Sum of all dice.
   */
  function getDiceTotal() {
    return diceElementArray.reduce((sum, element) => sum + Number(element.value), 0);
  }

  /**
   * Returns a deduplicated array of face values present among the dice.
   *
   * @returns {number[]} Array of unique dice face values.
   */
  function uniqueDice() {
    const arr = diceElementArray.map((element) => Number(element.value));
    return arr.filter((value, index) => arr.indexOf(value) === index);
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
    return diceElementArray.filter((element) => Number(element.value) === num).length;
  }

  /**
   * Checks if at least 3 dice share the same face value.
   *
   * @returns {boolean} True if roll contains 3 of a kind or better.
   */
  function isThreeOfAKind() {
    const diceNumbers = uniqueDice();
    return diceNumbers.map((value) => countDiceOfNumber(value)).some((value) => (value >= 3));
  }

  /**
   * Calculates the three of a kind score (sum of all dice if valid, 0 otherwise).
   *
   * @returns {number} Score for 3 of a kind.
   */
  function getThreeOfAKindTotal() {
    return (isThreeOfAKind()) ? getDiceTotal() : 0;
  }

  /**
   * Checks if at least 4 dice share the same face value.
   *
   * @returns {boolean} True if roll contains 4 of a kind or better.
   */
  function isFourOfAKind() {
    const diceNumbers = uniqueDice();
    return diceNumbers.map((value) => countDiceOfNumber(value)).some((value) => (value >= 4));
  }

  /**
   * Calculates the four of a kind score (sum of all dice if valid, 0 otherwise).
   *
   * @returns {number} Score for 4 of a kind.
   */
  function getFourOfAKindTotal() {
    return (isFourOfAKind()) ? getDiceTotal() : 0;
  }

  /**
   * Checks if the dice configuration forms a full house (3 of one number and 2 of another).
   *
   * @returns {boolean} True if roll is a valid full house.
   */
  function isFullHouse() {
    const diceNumbers = uniqueDice();
    if (diceNumbers.length !== 2) return false;
    return countDiceOfNumber(diceNumbers[0]) === 2 || countDiceOfNumber(diceNumbers[1]) === 2;
  }

  /**
   * Calculates the score for a full house (fixed 25 points).
   *
   * @returns {number} 25 if valid full house, 0 otherwise.
   */
  function getFullHouseTotal() {
    return (isFullHouse()) ? 25 : 0;
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
    return (isYahtzee()) ? 50 : 0;
  }

  /**
   * Checks if the dice contain a sequence of 4 consecutive numbers.
   *
   * @returns {number} Number of matching small straight patterns (0 or positive).
   */
  function isSmallStraight() {
    const diceNumbers = uniqueDice();
    return [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]]
      .filter((valueArray) => hasAll(diceNumbers, valueArray)).length;
  }

  /**
   * Calculates the score for a small straight (fixed 30 points).
   *
   * @returns {number} 30 if valid small straight, 0 otherwise.
   */
  function getSmallStraightTotal() {
    return (isSmallStraight()) ? 30 : 0;
  }

  /**
   * Checks if the dice contain a sequence of 5 consecutive numbers.
   *
   * @returns {number} Number of matching large straight patterns (0 or positive).
   */
  function isLargeStraight() {
    const diceNumbers = uniqueDice();
    return [[1, 2, 3, 4, 5], [2, 3, 4, 5, 6]]
      .filter((valueArray) => hasAll(diceNumbers, valueArray)).length;
  }

  /**
   * Calculates the score for a large straight (fixed 40 points).
   *
   * @returns {number} 40 if valid large straight, 0 otherwise.
   */
  function getLargeStraightTotal() {
    return (isLargeStraight()) ? 40 : 0;
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
    return [
      'ones',
      'twos',
      'threes',
      'fours',
      'fives',
      'sixes'
    ].reduce((sum, key) => sum + Number(lockedScores[key]), 0);
  }

  /**
   * Calculates the bonus score. If the 1-6s add up to 63 or higher,
   * the player receives an extra 35 points.
   *
   * @returns {number} 35 if upper section total is 63+, 0 otherwise.
   */
  function getBonus() {
    return (getKindTotal() > 62) ? 35 : 0;
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
    const scoreElement = element.querySelector('.score');
    const lock = lockedScores[lockId];
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
    rollElement.addEventListener('click', () => {
      if (rollCount < 3 && getRollableDice().length) {
        roll();
        rollCount++;
      }
    });

    diceElementArray.forEach((dieElement) => {
      dieElement.addEventListener('click', () => {
        if (isEnabled(dieElement)) disable(dieElement);
        else reenable(dieElement);
      });
    });

    scoreBoardElement.addEventListener('update', updateScoreBoard);

    [
      [onesElement, 'ones', getOnesTotal],
      [twosElement, 'twos', getTwosTotal],
      [threesElement, 'threes', getThreesTotal],
      [foursElement, 'fours', getFoursTotal],
      [fivesElement, 'fives', getFivesTotal],
      [sixesElement, 'sixes', getSixesTotal],
      [threeKindElement, 'threeKind', getThreeOfAKindTotal],
      [fourKindElement, 'fourKind', getFourOfAKindTotal],
      [smallStraightElement, 'smallStraight', getSmallStraightTotal],
      [largeStraightElement, 'largeStraight', getLargeStraightTotal],
      [fullHouseElement, 'fullHouse', getFullHouseTotal],
      [wildElement, 'wild', getDiceTotal],
      [yahtzeeElement, 'yahtzee', getYahtzeeTotal]
    ].forEach(([element, lockId, scoreFunction]) => {
      element.addEventListener('click', () => {
        // Prevent recording score if dice were not rolled or if this box is already locked.
        if (rollCount === 0 || lockedScores[lockId] !== false) {
          return;
        }
        disable(element);
        lockedScores[lockId] = scoreFunction();
        updateScoreBoard();
        resetRollCount();
        reenable(rollElement);
        diceElementArray.forEach((diceEl) => {
          reenable(diceEl);
        });
      });
    });
  }

  attachEventListeners();
  resetRollCount();
});
