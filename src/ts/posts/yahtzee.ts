interface ValueElement extends HTMLElement {
  value: number;
}

type ScoreKey =
  | 'ones'
  | 'twos'
  | 'threes'
  | 'fours'
  | 'fives'
  | 'sixes'
  | 'bonus'
  | 'threeKind'
  | 'fourKind'
  | 'smallStraight'
  | 'largeStraight'
  | 'fullHouse'
  | 'wild'
  | 'yahtzee';

const ready = require('../_modules/document-ready.ts');

ready.document(() => {
  const rollEl = document.getElementById('roll');
  const diceEl = document.getElementById('dice');
  const die0El = document.getElementById('die-0') as ValueElement | null;
  const die1El = document.getElementById('die-1') as ValueElement | null;
  const die2El = document.getElementById('die-2') as ValueElement | null;
  const die3El = document.getElementById('die-3') as ValueElement | null;
  const die4El = document.getElementById('die-4') as ValueElement | null;
  const scoreBoardEl = document.getElementById('score-board');
  const onesEl = document.getElementById('ones') as ValueElement | null;
  const twosEl = document.getElementById('twos') as ValueElement | null;
  const threesEl = document.getElementById('threes') as ValueElement | null;
  const foursEl = document.getElementById('fours') as ValueElement | null;
  const fivesEl = document.getElementById('fives') as ValueElement | null;
  const sixesEl = document.getElementById('sixes') as ValueElement | null;
  const kindTotalEl = document.getElementById('kind-total') as ValueElement | null;
  const bonusEl = document.getElementById('bonus') as ValueElement | null;
  const threeKindEl = document.getElementById('three-kind') as ValueElement | null;
  const fourKindEl = document.getElementById('four-kind') as ValueElement | null;
  const smallStraightEl = document.getElementById('small-straight') as ValueElement | null;
  const largeStraightEl = document.getElementById('large-straight') as ValueElement | null;
  const fullHouseEl = document.getElementById('full-house') as ValueElement | null;
  const wildEl = document.getElementById('wild') as ValueElement | null;
  const yahtzeeEl = document.getElementById('yahtzee') as ValueElement | null;
  const totalEl = document.getElementById('total') as ValueElement | null;

  if (
    !rollEl
    || !diceEl
    || !die0El
    || !die1El
    || !die2El
    || !die3El
    || !die4El
    || !scoreBoardEl
    || !onesEl
    || !twosEl
    || !threesEl
    || !foursEl
    || !fivesEl
    || !sixesEl
    || !kindTotalEl
    || !bonusEl
    || !threeKindEl
    || !fourKindEl
    || !smallStraightEl
    || !largeStraightEl
    || !fullHouseEl
    || !wildEl
    || !yahtzeeEl
    || !totalEl
  ) {
    return;
  }

  const rollElement = rollEl;
  const diceElement = diceEl;
  const die0Element = die0El;
  const die1Element = die1El;
  const die2Element = die2El;
  const die3Element = die3El;
  const die4Element = die4El;
  const scoreBoardElement = scoreBoardEl;
  const onesElement = onesEl;
  const twosElement = twosEl;
  const threesElement = threesEl;
  const foursElement = foursEl;
  const fivesElement = fivesEl;
  const sixesElement = sixesEl;
  const kindTotalElement = kindTotalEl;
  const bonusElement = bonusEl;
  const threeKindElement = threeKindEl;
  const fourKindElement = fourKindEl;
  const smallStraightElement = smallStraightEl;
  const largeStraightElement = largeStraightEl;
  const fullHouseElement = fullHouseEl;
  const wildElement = wildEl;
  const yahtzeeElement = yahtzeeEl;
  const totalElement = totalEl;

  let rollCount = 0;
  const ROLL_DURATION = 1000;
  const updateScoreEvent = new Event('update');

  const lockedScores: Record<ScoreKey, number | false> = {
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

  const diceElementArray: ValueElement[] = [die0Element, die1Element, die2Element, die3Element, die4Element];

  /**
   * Disables passed DOM element by adding the 'locked' class.
   *
   * @param {HTMLElement} element - DOM element to be disabled.
   * @returns {void}
   */
  function disable(element: HTMLElement): void {
    element.classList.add('locked');
  }

  /**
   * Removes disabled state from passed DOM element by removing the 'locked' class.
   *
   * @param {HTMLElement} element - DOM element to be re-enabled.
   * @returns {void}
   */
  function reenable(element: HTMLElement): void {
    element.classList.remove('locked');
  }

  /**
   * Determines if the passed DOM element is disabled/locked.
   *
   * @param {HTMLElement} element - Element to test.
   * @returns {boolean} True if element contains the 'locked' class.
   */
  function isDisabled(element: HTMLElement): boolean {
    return element.classList.contains('locked');
  }

  /**
   * Determines if the passed DOM element is active/unlocked.
   *
   * @param {HTMLElement} element - Element to test.
   * @returns {boolean} True if element is not locked.
   */
  function isEnabled(element: HTMLElement): boolean {
    return !isDisabled(element);
  }

  /**
   * Returns an array of dice elements that are not currently held/locked.
   *
   * @returns {HTMLElement[]} Array of rollable dice elements.
   */
  function getRollableDice(): ValueElement[] {
    return diceElementArray.filter((element) => isEnabled(element));
  }

  /**
   * Rolls a single die and sets a new random integer value between 1 and 6.
   *
   * @param {HTMLElement} dieElement - The die element to update.
   * @returns {void}
   */
  function rollADie(dieElement: ValueElement): void {
    dieElement.value = Math.floor(Math.random() * 6) + 1;
  }

  /**
   * Executes the animated dice rolling sequence over a duration, then triggers score recalculation.
   *
   * @returns {void}
   */
  function roll(): void {
    const rollableDice = getRollableDice();
    const rollTimeOut = Date.now() + ROLL_DURATION;

    /**
     * Animation frame handler that randomizes unlocked dice values.
     */
    const _oneRoll = (): void => {
      rollableDice.forEach((dieElement) => {
        rollADie(dieElement);
      });
      diceElementArray.forEach((die) => {
        die.innerText = String(die.value);
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
  function hasAll(mainArray: number[], valuesArray: number[]): boolean {
    return !valuesArray.map((value) => mainArray.includes(value)).includes(false);
  }

  /**
   * Calculates the grand total score across all locked score categories plus upper section bonus.
   *
   * @returns {number} Grand total score.
   */
  function getGrandTotal(): number {
    const bonusScore = getBonus();
    return (Object.keys(lockedScores) as ScoreKey[])
      .map((key) => Number(lockedScores[key]))
      .reduce((sum = 0, value = 0) => sum + value, 0) + bonusScore;
  }

  /**
   * Calculates the sum total of all five currently rolled dice values.
   *
   * @returns {number} Sum of all dice.
   */
  function getDiceTotal(): number {
    return diceElementArray.reduce((sum, element) => sum + Number(element.value), 0);
  }

  /**
   * Returns a deduplicated array of face values present among the dice.
   *
   * @returns {number[]} Array of unique dice face values.
   */
  function uniqueDice(): number[] {
    const arr = diceElementArray.map((element) => Number(element.value));
    return arr.filter((value, index) => arr.indexOf(value) === index);
  }

  /**
   * Counts the number of distinct face values present in the current roll.
   *
   * @returns {number} Count of unique dice values.
   */
  function getDiceVariety(): number {
    return uniqueDice().length;
  }

  /**
   * Counts how many dice show the specified number face value.
   *
   * @param {number} num - The die face number (1-6).
   * @returns {number} Number of matching dice.
   */
  function countDiceOfNumber(num: number): number {
    return diceElementArray.filter((element) => Number(element.value) === num).length;
  }

  /**
   * Checks if at least 3 dice share the same face value.
   *
   * @returns {boolean} True if roll contains 3 of a kind or better.
   */
  function isThreeOfAKind(): boolean {
    const diceNumbers = uniqueDice();
    return diceNumbers.map((value) => countDiceOfNumber(value)).some((value) => (value >= 3));
  }

  /**
   * Calculates the three of a kind score (sum of all dice if valid, 0 otherwise).
   *
   * @returns {number} Score for 3 of a kind.
   */
  function getThreeOfAKindTotal(): number {
    return (isThreeOfAKind()) ? getDiceTotal() : 0;
  }

  /**
   * Checks if at least 4 dice share the same face value.
   *
   * @returns {boolean} True if roll contains 4 of a kind or better.
   */
  function isFourOfAKind(): boolean {
    const diceNumbers = uniqueDice();
    return diceNumbers.map((value) => countDiceOfNumber(value)).some((value) => (value >= 4));
  }

  /**
   * Calculates the four of a kind score (sum of all dice if valid, 0 otherwise).
   *
   * @returns {number} Score for 4 of a kind.
   */
  function getFourOfAKindTotal(): number {
    return (isFourOfAKind()) ? getDiceTotal() : 0;
  }

  /**
   * Checks if the dice configuration forms a full house (3 of one number and 2 of another).
   *
   * @returns {boolean} True if roll is a valid full house.
   */
  function isFullHouse(): boolean {
    const diceNumbers = uniqueDice();
    if (diceNumbers.length !== 2) return false;
    return countDiceOfNumber(diceNumbers[0]) === 2 || countDiceOfNumber(diceNumbers[1]) === 2;
  }

  /**
   * Calculates the score for a full house (fixed 25 points).
   *
   * @returns {number} 25 if valid full house, 0 otherwise.
   */
  function getFullHouseTotal(): number {
    return (isFullHouse()) ? 25 : 0;
  }

  /**
   * Checks if all 5 dice have the identical face value.
   *
   * @returns {boolean} True if roll is a Yahtzee.
   */
  function isYahtzee(): boolean {
    return getDiceVariety() === 1;
  }

  /**
   * Calculates the score for a Yahtzee (fixed 50 points).
   *
   * @returns {number} 50 if valid Yahtzee, 0 otherwise.
   */
  function getYahtzeeTotal(): number {
    return (isYahtzee()) ? 50 : 0;
  }

  /**
   * Checks if the dice contain a sequence of 4 consecutive numbers.
   *
   * @returns {number} Number of matching small straight patterns (0 or positive).
   */
  function isSmallStraight(): number {
    const diceNumbers = uniqueDice();
    return [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]]
      .filter((valueArray) => hasAll(diceNumbers, valueArray)).length;
  }

  /**
   * Calculates the score for a small straight (fixed 30 points).
   *
   * @returns {number} 30 if valid small straight, 0 otherwise.
   */
  function getSmallStraightTotal(): number {
    return (isSmallStraight()) ? 30 : 0;
  }

  /**
   * Checks if the dice contain a sequence of 5 consecutive numbers.
   *
   * @returns {number} Number of matching large straight patterns (0 or positive).
   */
  function isLargeStraight(): number {
    const diceNumbers = uniqueDice();
    return [[1, 2, 3, 4, 5], [2, 3, 4, 5, 6]]
      .filter((valueArray) => hasAll(diceNumbers, valueArray)).length;
  }

  /**
   * Calculates the score for a large straight (fixed 40 points).
   *
   * @returns {number} 40 if valid large straight, 0 otherwise.
   */
  function getLargeStraightTotal(): number {
    return (isLargeStraight()) ? 40 : 0;
  }

  /**
   * Calculates the sum of all dice with face value 1.
   *
   * @returns {number} Total points for ones.
   */
  function getOnesTotal(): number {
    return countDiceOfNumber(1) * 1;
  }

  /**
   * Calculates the sum of all dice with face value 2.
   *
   * @returns {number} Total points for twos.
   */
  function getTwosTotal(): number {
    return countDiceOfNumber(2) * 2;
  }

  /**
   * Calculates the sum of all dice with face value 3.
   *
   * @returns {number} Total points for threes.
   */
  function getThreesTotal(): number {
    return countDiceOfNumber(3) * 3;
  }

  /**
   * Calculates the sum of all dice with face value 4.
   *
   * @returns {number} Total points for fours.
   */
  function getFoursTotal(): number {
    return countDiceOfNumber(4) * 4;
  }

  /**
   * Calculates the sum of all dice with face value 5.
   *
   * @returns {number} Total points for fives.
   */
  function getFivesTotal(): number {
    return countDiceOfNumber(5) * 5;
  }

  /**
   * Calculates the sum of all dice with face value 6.
   *
   * @returns {number} Total points for sixes.
   */
  function getSixesTotal(): number {
    return countDiceOfNumber(6) * 6;
  }

  /**
   * Calculates the cumulative total value of the locked upper section categories (1s through 6s).
   *
   * @returns {number} Upper section total score.
   */
  function getKindTotal(): number {
    const upperKeys: ScoreKey[] = [
      'ones',
      'twos',
      'threes',
      'fours',
      'fives',
      'sixes'
    ];
    return upperKeys.reduce((sum, key) => sum + Number(lockedScores[key]), 0);
  }

  /**
   * Calculates the bonus score. If the 1-6s add up to 63 or higher,
   * the player receives an extra 35 points.
   *
   * @returns {number} 35 if upper section total is 63+, 0 otherwise.
   */
  function getBonus(): number {
    return (getKindTotal() > 62) ? 35 : 0;
  }

  /**
   * Synchronizes data-rolls-left attributes across roll button, scoreboard, and dice containers.
   *
   * @returns {void}
   */
  function updateRollCounter(): void {
    const rollsLeft = String(3 - rollCount);
    rollElement.setAttribute('data-rolls-left', rollsLeft);
    scoreBoardElement.setAttribute('data-rolls-left', rollsLeft);
    diceElement.setAttribute('data-rolls-left', rollsLeft);
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
  function resetRollCount(): void {
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
  function updateSingleScore(
    element: ValueElement,
    lockId: ScoreKey | undefined,
    scoringFunction: () => number,
  ): void {
    const scoreElement = element.querySelector<HTMLElement>('.score');
    const lock = lockId !== undefined ? lockedScores[lockId] : false;
    if (lockId !== undefined && lock !== false) {
      element.value = lock;
      if (scoreElement) {
        scoreElement.innerText = String(lock);
      }
    } else {
      element.value = scoringFunction();
      if (scoreElement) {
        scoreElement.innerText = String(scoringFunction());
      }
    }
  }

  /**
   * Updates and synchronizes all score values and totals across the scoreboard.
   *
   * @returns {void}
   */
  function updateScoreBoard(): void {
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
  function attachEventListeners(): void {
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

    const scoreEntries: Array<[ValueElement, ScoreKey, () => number]> = [
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
    ];

    scoreEntries.forEach(([element, lockId, scoreFunction]) => {
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
