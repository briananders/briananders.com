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
     * Disables passed DOM element
     * @param {HTMLElement} element DOM element to be disabled
     */
  function disable(element) {
    element.classList.add('locked');
  }

  /**
     * Removes disabled attribute from passed DOM element
     * @param {HTMLElement} element DOM element to be re-enabled
     */
  function reenable(element) {
    element.classList.remove('locked');
  }

  /**
     * Determines if the passed DOM element is disabled
     * @param {HTMLElement} element element to test
     * @returns {boolean}
     */
  function isDisabled(element) {
    return element.classList.contains('locked');
  }

  /**
     * Determines if the passed DOM element is not disabled
     * @param {HTMLElement} element element to test
     */
  function isEnabled(element) {
    return !isDisabled(element);
  }

  /**
     * Get array of dice that are not fixed
     * @returns {Array}
     */
  function getRollableDice() {
    return diceElementArray.filter((element) => isEnabled(element));
  }

  /**
     * Rolls a single die and sets the new value.
     * @param {HTMLElement} dieElement
     */
  function rollADie(dieElement) {
    dieElement.value = Math.floor(Math.random() * 6) + 1;
  }

  /**
     * Rolls the dice
     */
  function roll() {
    const rollableDice = getRollableDice();
    const rollTimeOut = Date.now() + ROLL_DURATION;

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
     * Determines if all of the values are present in the rolled dice configuration
     * @returns {boolean}
     */
  function hasAll(mainArray, valuesArray) {
    return !valuesArray.map((value) => mainArray.includes(value)).includes(false);
  }

  /**
     * Calculate the grand total score of the locked/final score values
     * @returns {Number}
     */
  function getGrandTotal() {
    const bonusScore = getBonus();
    return Object.keys(lockedScores)
      .map((key) => lockedScores[key])
      .reduce((sum = 0, value = 0) => sum + value, 0) + bonusScore;
  }

  /**
     * Calculates the total score of the rolled dice configuration
     * @returns {Number}
     */
  function getDiceTotal() {
    return diceElementArray.reduce((sum, element) => sum + Number(element.value), 0);
  }

  /**
     * Simplifies the dice configuration to one of each present number in the rolled configuration
     * @returns {Array}
     */
  function uniqueDice() {
    const arr = diceElementArray.map((element) => Number(element.value));
    return arr.filter((value, index) => arr.indexOf(value) === index);
  }

  /**
     * Determines the number of unique dice numbers that are present in the rolled configuration
     * @returns {Number}
     */
  function getDiceVariety() {
    return uniqueDice().length;
  }

  /**
     * Counts how many dice are present of a certain number in the rolled configuration
     * @returns {Number}
     */
  function countDiceOfNumber(num) {
    return diceElementArray.filter((element) => Number(element.value) === num).length;
  }

  /**
     * Determines if a three of a kind is present in the dice configuration
     * @returns {boolean}
     */
  function isThreeOfAKind() {
    const diceNumbers = uniqueDice();
    return diceNumbers.map((value) => countDiceOfNumber(value)).some((value) => (value >= 3));
  }

  /**
     * Calculates the score for a three of a kind
     * @returns {Number}
     */
  function getThreeOfAKindTotal() {
    return (isThreeOfAKind()) ? getDiceTotal() : 0;
  }

  /**
     * Determines if a four of a kind is present in the dice configuration
     * @returns {boolean}
     */
  function isFourOfAKind() {
    const diceNumbers = uniqueDice();
    return diceNumbers.map((value) => countDiceOfNumber(value)).some((value) => (value >= 4));
  }

  /**
     * Calculates the score for a four of a kind
     * @returns {Number}
     */
  function getFourOfAKindTotal() {
    return (isFourOfAKind()) ? getDiceTotal() : 0;
  }

  /**
     * Determines if a full house is present in the dice configuration
     * @returns {boolean}
     */
  function isFullHouse() {
    const diceNumbers = uniqueDice();
    if (diceNumbers.length !== 2) return false;
    return countDiceOfNumber(diceNumbers[0]) === 2 || countDiceOfNumber(diceNumbers[1]) === 2;
  }

  /**
     * Calculates the score for a full house
     * @returns {Number}
     */
  function getFullHouseTotal() {
    return (isFullHouse()) ? 25 : 0;
  }

  /**
     * Determines if a Yahtzee is present in the dice configuration
     * @returns {boolean}
     */
  function isYahtzee() {
    return getDiceVariety() === 1;
  }

  /**
     * Calculates the score for a Yahtzee
     * @returns {Number}
     */
  function getYahtzeeTotal() {
    return (isYahtzee()) ? 50 : 0;
  }

  /**
     * Determines if a small straight is present in the dice configuration
     * @returns {boolean}
     */
  function isSmallStraight() {
    const diceNumbers = uniqueDice();
    return [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]]
      .filter((valueArray) => hasAll(diceNumbers, valueArray)).length;
  }

  /**
     * Calculates the score for a small straight
     * @returns {Number}
     */
  function getSmallStraightTotal() {
    return (isSmallStraight()) ? 30 : 0;
  }

  /**
     * Determines if a large straight is present in the dice configuration
     * @returns {boolean}
     */
  function isLargeStraight() {
    const diceNumbers = uniqueDice();
    return [[1, 2, 3, 4, 5], [2, 3, 4, 5, 6]]
      .filter((valueArray) => hasAll(diceNumbers, valueArray)).length;
  }

  /**
     * Calculates the score for a large straight
     * @returns {Number}
     */
  function getLargeStraightTotal() {
    return (isLargeStraight()) ? 40 : 0;
  }

  /**
     * Calculates the score for 1s
     * @returns {Number}
     */
  function getOnesTotal() {
    return countDiceOfNumber(1) * 1;
  }

  /**
     * Calculates the score for 2s
     * @returns {Number}
     */
  function getTwosTotal() {
    return countDiceOfNumber(2) * 2;
  }

  /**
     * Calculates the score for 3s
     * @returns {Number}
     */
  function getThreesTotal() {
    return countDiceOfNumber(3) * 3;
  }

  /**
     * Calculates the score for 4s
     * @returns {Number}
     */
  function getFoursTotal() {
    return countDiceOfNumber(4) * 4;
  }

  /**
     * Calculates the score for 5s
     * @returns {Number}
     */
  function getFivesTotal() {
    return countDiceOfNumber(5) * 5;
  }

  /**
     * Calculates the score for 6s
     * @returns {Number}
     */
  function getSixesTotal() {
    return countDiceOfNumber(6) * 6;
  }

  /**
     * Calculates the total value of the 1-6s.
     * @returns {Number}
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
     * @returns {Number}
     */
  function getBonus() {
    return (getKindTotal() > 62) ? 35 : 0;
  }

  /**
     * Update the various roll count locations to be in sync
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
     * Reset the roll count to zero, and update the counters.
     */
  function resetRollCount() {
    rollCount = 0;
    updateRollCounter();
  }

  /**
     * Update one score. Checks for a locked score value before calculating a
     * potential score value based on the current dice
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
     * Update the scores on the scoreboard
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
     * Attach the event listeners
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
        if (rollCount === 0) return;
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
