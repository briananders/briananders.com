import type { MatcherInstance, MatcherOptions } from './wordle-solver/matcher.ts';

type MatcherConstructor = new (options: MatcherOptions) => MatcherInstance;

interface LettersState extends MatcherOptions {
  allLetters: string[];
}

type WordScoreTuple = [string, number];
type LetterFrequencyTuple = [string, number];

const ready = require('../_modules/document-ready.ts');

ready.document(() => {
  const { default: copy } = require('copy-to-clipboard');

  const { table } = require('../_modules/log.ts');

  const Matcher = require('./wordle-solver/matcher.ts') as MatcherConstructor;

  const boardEl = document.getElementById('board');
  const answersEl = document.getElementById('options');
  const resultsEl = document.getElementById('results-count');
  const submitButtonEl = document.getElementById('submit');
  const clearButtonEl = document.getElementById('clear');
  const toastNotificationEl = document.querySelector('toast-notification');
  const letterFrequencyEl = document.getElementById('letter-frequency');
  const unusedLetterEl = document.getElementById('untried-letters');
  const untriedResultsEl = document.getElementById('untried-results-count');

  if (
    !boardEl
    || !answersEl
    || !resultsEl
    || !submitButtonEl
    || !clearButtonEl
    || !toastNotificationEl
    || !letterFrequencyEl
    || !unusedLetterEl
    || !untriedResultsEl
  ) {
    return;
  }

  const boardElement = boardEl;
  const answersElement = answersEl;
  const resultsElement = resultsEl;
  const submitButton = submitButtonEl;
  const clearButton = clearButtonEl;
  const toastNotification = toastNotificationEl;
  const letterFrequencyElement = letterFrequencyEl;
  const unusedLetterElement = unusedLetterEl;
  const untriedResultsElement = untriedResultsEl;

  const lines = Array.from(boardElement.querySelectorAll<HTMLElement>('.line'));
  const textInputs = Array.from(boardElement.querySelectorAll<HTMLInputElement>('input[type=text]'));
  const checkboxes = Array.from(boardElement.querySelectorAll<HTMLInputElement>('input[type=radio]'));

  const breakpoint = matchMedia('(max-width: 500px)');

  /// //////////////////////// CONSTANTS

  const STATES = {
    CLOSE: 'close',
    CORRECT: 'correct',
    WRONG: 'wrong',
  } as const;

  const EVENTS = {
    KEYDOWN: 'keydown',
    KEYUP: 'keyup',
    CLICK: 'click',
    CHANGE: 'change',
    INPUT: 'input',
  } as const;

  const KEYS = {
    BACKSPACE: 'Backspace',
    ARROW_LEFT: 'ArrowLeft',
    TAB: 'Tab',
    ARROW_RIGHT: 'ArrowRight',
  } as const;

  const EMPTY = '';
  const SPACE = ' ';
  const DASH = '-';

  /**
   * Tests if a character is an alphabetical letter.
   *
   * @param {string} value - Character to test.
   * @returns {boolean} True if character is a-z or A-Z.
   */
  const isLetter = (value: string): boolean => /[a-zA-Z]/.test(value);

  /// ////////////// get dictionary

  let dictionary: string[] = [];

  /**
   * Parses and loads the 5-letter word dictionary from the XMLHttpRequest response.
   *
   * @returns {void}
   */
  function reqListener(this: XMLHttpRequest): void {
    dictionary = JSON.parse(this.responseText) as string[];
  }

  const req = new XMLHttpRequest();
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
  function checkLinesFull(): void {
    const lineFull = new Array<boolean>(6);
    let lastFullLine = 0;

    lines.forEach((lineElement) => {
      const inputs = Array.from(lineElement.querySelectorAll<HTMLInputElement>('input[type=text]'));
      const [, lineNumber] = lineElement.id.split(DASH);

      const isFull = (inputs.filter((input) => input.value.length).length === 5);
      lineFull[Number(lineNumber)] = isFull;
    });

    for (let i = lineFull.length - 1; i >= 0; i--) {
      if (lineFull[i]) {
        lastFullLine = i + 1;
        break;
      }
    }

    if (lastFullLine > 5) lastFullLine = 5;

    const lastFullLineElement = lines.filter((line) => Number(line.id.split('-')[1]) === lastFullLine)[0];
    if (lastFullLineElement) {
      boardElement.style.height = `${lastFullLineElement.offsetHeight * (lastFullLine + 1)}px`;
    }
  }

  /**
   * Populates the next available empty row with characters from the selected candidate word.
   *
   * @param {string} word - Five-letter word string.
   * @returns {void}
   */
  function fillFirstEmptyLine(word: string): void {
    let firstEmpty: number | undefined;
    let emptyLineElements: HTMLInputElement[] | undefined;

    lines.forEach((lineElement, index) => {
      const lineInputs = Array.from(lineElement.querySelectorAll<HTMLInputElement>('input[type=text]'));
      const lineValue = lineInputs.map((input) => input.value).join('');

      if (lineValue === '' && firstEmpty === undefined) {
        firstEmpty = index;
        emptyLineElements = lineInputs;
      }
    });

    if (emptyLineElements) {
      emptyLineElements.forEach((input, index) => {
        input.value = word.charAt(index).toUpperCase();
      });
    }
  }

  /**
   * Aggregates tile states (correct, close, wrong, position exclusions, and all entered letters) from the board inputs.
   *
   * @returns {{ closeLetters: string[], wrongLetters: string[],
   *   correctLetters: Array<string|undefined>, cannotBeLetters: string[][],
   *   allLetters: string[] }} Constraint object used for dictionary filtering
   *   and letter exclusion.
   */
  function getLetters(): LettersState {
    const closeLetters: string[] = [];
    const wrongLetters: string[] = [];
    const correctLetters: Array<string | undefined> = new Array(5);
    const cannotBeLetters: string[][] = [[], [], [], [], []];
    const allLetters: string[] = [];

    textInputs.forEach((inputElement) => {
      const { state, letterNumber } = inputElement.dataset;
      const letterIndex = Number(letterNumber);
      const { value } = inputElement;
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
          alert(`It looks like you have two letters marked for the same position: ${value} and ${correctLetters[letterIndex]}`);
          /* eslint-enable */
        }
        correctLetters[letterIndex] = value;
      }

      if (allLetters.indexOf(value.toUpperCase()) < 0) allLetters.push(value.toUpperCase());
    });

    return {
      closeLetters,
      wrongLetters,
      correctLetters,
      cannotBeLetters,
      allLetters,
    };
  }

  /**
   * Resets an individual letter input cell to blank and its radio button state to 'wrong'.
   *
   * @param {HTMLInputElement} textInput - The letter input element to reset.
   * @returns {void}
   */
  function resetLetter(textInput: HTMLInputElement): void {
    const [, lineNumber, letterNumber] = textInput.id.split(DASH);

    const closeCheckbox = document.getElementById(
      `${STATES.CLOSE}-${lineNumber}-${letterNumber}`,
    ) as HTMLInputElement | null;
    const correctCheckbox = document.getElementById(
      `${STATES.CORRECT}-${lineNumber}-${letterNumber}`,
    ) as HTMLInputElement | null;
    const wrongCheckbox = document.getElementById(
      `${STATES.WRONG}-${lineNumber}-${letterNumber}`,
    ) as HTMLInputElement | null;

    textInput.value = EMPTY;
    textInput.dataset.state = STATES.WRONG;

    if (wrongCheckbox) wrongCheckbox.checked = true;
    if (closeCheckbox) closeCheckbox.checked = false;
    if (correctCheckbox) correctCheckbox.checked = false;
  }

  /**
   * Clears all letter inputs across the entire board.
   *
   * @returns {void}
   */
  function clear(): void {
    const inputs = Array.from(boardElement.querySelectorAll<HTMLInputElement>('input[type=text]'));

    inputs.forEach(resetLetter);

    checkLinesFull();
  }

  /**
   * Converts a word string to title case (capital first letter, lowercase remainder).
   *
   * @param {string} word - Word string to convert.
   * @returns {string} Title-cased word.
   */
  function titleCase(word: string): string {
    return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
  }

  /**
   * Updates the DOM section displaying weighted candidate words in descending score order.
   *
   * @param {Object} options - Options object.
   * @param {Array<[string, number]>} options.weightedDictionary - Array of [word, score] tuples.
   * @returns {void}
   */
  function updateResultSection({ weightedDictionary }: { weightedDictionary: WordScoreTuple[] }): void {
    const wordElements = weightedDictionary
      .sort((a, b) => (a[1] > b[1] ? -1 : 1))
      .map((wordTuple) => `<span>${titleCase(wordTuple[0])} (${wordTuple[1]})</span>`);
    answersElement.innerHTML = wordElements.join(SPACE);

    resultsElement.innerText = String(wordElements.length);
  }

  /**
   * Maps letter frequency rankings into relative weight scores.
   *
   * @param {Array<[string, number]>} letterFrequency - Sorted array of [letter, frequencyCount] pairs.
   * @returns {Object.<string, number>} Map of uppercase letter characters to numeric score weights.
   */
  function getLetterValues(letterFrequency: LetterFrequencyTuple[]): Record<string, number> {
    let indexValue = 0;
    let lastValue = 0;
    const returnObject: Record<string, number> = {};

    for (let i = letterFrequency.length - 1; i >= 0; i--) {
      const [letter, currentValue] = letterFrequency[i];
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
  function getWeightedDictionary({
    filteredDictionary,
    letterValues,
  }: {
    filteredDictionary: string[];
    letterValues: Record<string, number>;
  }): WordScoreTuple[] {
    return filteredDictionary.map((word) => {
      const wordLetterValues = word.toUpperCase().split('')
        .map((letter) => letterValues[letter]);
      const filteredValues = wordLetterValues.map(
        (value, index) => ((wordLetterValues.indexOf(value) !== index ? -1 : value))
      );
      if (filteredValues.indexOf(-1) === -1) filteredValues.push(100);
      const score = filteredValues.reduce((partialSum, letterValue) => partialSum + letterValue, 0);
      return [word, score];
    });
  }

  /**
   * Finds candidate words composed exclusively of untried letters to maximize information gain.
   *
   * @returns {void}
   */
  function updateUnusedLetterWords(): void {
    const { allLetters } = getLetters();

    const alphabet = [
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
    ];
    const unusedLetters = alphabet.filter((letter) => {
      if (allLetters.includes(letter.toUpperCase())) {
        return false;
      }
      return true;
    });

    const unusedLetterDictionary = dictionary.filter((word) => {
      const letters = word.split('');
      for (let i = 0; i < letters.length; i++) {
        if (!unusedLetters.includes(letters[i].toUpperCase())) {
          return false;
        }
      }
      return true;
    });

    const letterFrequency = getLetterFrequency({ filteredDictionary: unusedLetterDictionary });
    const letterValues = getLetterValues(letterFrequency);
    const weightedDictionary = getWeightedDictionary({
      filteredDictionary: unusedLetterDictionary, letterValues,
    });

    const wordElements = weightedDictionary
      .sort((a, b) => (a[1] > b[1] ? -1 : 1))
      .map((wordTuple) => `<span>${titleCase(wordTuple[0])} (${wordTuple[1]})</span>`);

    unusedLetterElement.innerHTML = wordElements.join(SPACE);

    untriedResultsElement.innerHTML = unusedLetterDictionary.length.toString();
  }

  /**
   * Filters the dictionary against current game board constraints using Matcher.
   *
   * @returns {string[]} Array of matching uppercase candidate words.
   */
  function getFilteredDictionary(): string[] {
    const {
      closeLetters,
      wrongLetters,
      correctLetters,
      cannotBeLetters,
    } = getLetters();

    const potentialMatches: string[] = [];

    const matcher = new Matcher({
      closeLetters,
      wrongLetters,
      correctLetters,
      cannotBeLetters,
    });

    dictionary.forEach((word) => {
      const upperCaseWord = word.toUpperCase();
      if (matcher.matches(upperCaseWord)) potentialMatches.push(word.toUpperCase());
    });

    table({
      closeLetters: closeLetters.toString(),
      wrongLetters: wrongLetters.toString(),
      correctLetters: correctLetters.toString(),
      cannotBeLetters: cannotBeLetters.toString(),
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
  function updateLetterFrequencySection({
    letterFrequency,
  }: {
    letterFrequency: LetterFrequencyTuple[];
  }): LetterFrequencyTuple[] {
    letterFrequencyElement.innerHTML = letterFrequency
      .map((pairs) => `<span>${pairs[0].toUpperCase()}: ${pairs[1]}</span>`)
      .join(', ');

    return letterFrequency;
  }

  /**
   * Counts occurrences of each unique letter across candidate words and returns pairs sorted descending.
   *
   * @param {Object} options - Options object.
   * @param {string[]} options.filteredDictionary - Candidate words list.
   * @returns {Array<[string, number]>} Sorted array of [letter, count] tuples.
   */
  function getLetterFrequency({
    filteredDictionary,
  }: {
    filteredDictionary: string[];
  }): LetterFrequencyTuple[] {
    /**
     * Converts letter count object to sorted pair array.
     *
     * @param {Object.<string, number>} lets - Map of letter to count.
     * @returns {Array<[string, number]>} Descending sorted array of [letter, count].
     */
    function sortLetters(lets: Record<string, number>): LetterFrequencyTuple[] {
      const keys = Object.keys(lets);

      const unsortedLetters: LetterFrequencyTuple[] = [];
      keys.forEach((key) => {
        unsortedLetters.push([key, lets[key]]);
      });

      return unsortedLetters.sort((a, b) => {
        if (a[1] < b[1]) return 1;
        return -1;
      });
    }

    const letters: Record<string, number> = {};

    filteredDictionary.forEach((word) => {
      word.split('').forEach((letter, index) => {
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
   * @param {Event} evt - The change event payload.
   * @returns {void}
   */
  function checkboxUpdated(evt: Event): void {
    const srcElement = (evt.srcElement || evt.target) as HTMLInputElement | null;
    if (!srcElement || !srcElement.checked) return;
    const [state, lineNumber, letterNumber] = srcElement.id.split(DASH);
    const letterInput = document.getElementById(`letter-${lineNumber}-${letterNumber}`);
    if (letterInput) {
      letterInput.dataset.state = state;
    }
  }

  /**
   * Shifts focus to the preceding letter input in the current word row.
   *
   * @param {HTMLInputElement} srcElement - Current active letter input.
   * @returns {void}
   */
  function previousInput(srcElement: HTMLInputElement): void {
    const [letterWord, lineNumber, letterNumber] = srcElement.id.split(DASH);

    const nextInputElement = document.getElementById(`${letterWord}-${lineNumber}-${Number(letterNumber) - 1}`);
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
  function nextInput(srcElement: HTMLInputElement): void {
    const [letterWord, lineNumber, letterNumber] = srcElement.id.split(DASH);

    const nextInputElement = document.getElementById(`${letterWord}-${lineNumber}-${Number(letterNumber) + 1}`);
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
  function inputKeydown(evt: KeyboardEvent): void {
    const srcElement = (evt.srcElement || evt.target) as HTMLInputElement | null;
    if (!srcElement) return;
    const { key } = evt;
    const char = key.toUpperCase();

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

    if (isLetter(char) && char.length === 1) {
      resetLetter(srcElement);
      srcElement.value = char;
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
  function calculate(): void {
    checkLinesFull();

    const filteredDictionary = getFilteredDictionary();
    const letterFrequency = getLetterFrequency({ filteredDictionary });
    const letterValues = getLetterValues(letterFrequency);
    const weightedDictionary = getWeightedDictionary({ filteredDictionary, letterValues });

    updateLetterFrequencySection({ letterFrequency });
    updateResultSection({ weightedDictionary });
    updateUnusedLetterWords();
  }

  /**
   * Registers all DOM event listeners for keyboard navigation, buttons, and radio controls.
   *
   * @returns {void}
   */
  function initEventListeners(): void {
    textInputs.forEach((input) => {
      input.addEventListener(EVENTS.KEYDOWN, inputKeydown);
    });
    submitButton.addEventListener(EVENTS.CLICK, calculate);
    clearButton.addEventListener(EVENTS.CLICK, clear);
    checkboxes.forEach((box) => {
      box.addEventListener(EVENTS.CHANGE, checkboxUpdated);
    });
    [answersElement, unusedLetterElement].forEach((element) => {
      element.addEventListener(EVENTS.CLICK, (evt) => {
        const target = evt.target as HTMLElement | null;
        if (!target || target.tagName !== 'SPAN') return;
        copy(target.innerText);

        toastNotification.classList.add('animate');
        fillFirstEmptyLine(target.innerText);
        setTimeout(() => {
          toastNotification.classList.remove('animate');
        }, 1500);
      });
    });
    breakpoint.addEventListener('change', checkLinesFull);
  }

  initEventListeners();
  checkLinesFull();
});
