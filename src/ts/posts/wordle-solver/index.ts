import type { MatcherInstance, MatcherOptions } from './matcher.ts';

type MatcherConstructor = new (options: MatcherOptions) => MatcherInstance;

const ready = require('../../_modules/document-ready.ts');

ready.document(() => {
  const { default: copy } = require('copy-to-clipboard');

  const { table } = require('../../_modules/log.ts');

  const Matcher = require('./matcher.ts') as MatcherConstructor;

  const boardEl = document.getElementById('board');
  const answersEl = document.getElementById('options');
  const resultsEl = document.getElementById('results-count');
  const submitButtonEl = document.getElementById('submit');
  const clearButtonEl = document.getElementById('clear');
  const toastNotificationEl = document.querySelector('toast-notification');

  if (
    !boardEl
    || !answersEl
    || !resultsEl
    || !submitButtonEl
    || !clearButtonEl
    || !toastNotificationEl
  ) {
    return;
  }

  const boardElement = boardEl;
  const answersElement = answersEl;
  const resultsElement = resultsEl;
  const submitButton = submitButtonEl;
  const clearButton = clearButtonEl;
  const toastNotification = toastNotificationEl;

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
   * Checks whether a word contains any repeated letters.
   *
   * @param {string} word - Word to test.
   * @returns {boolean} True if the word contains duplicate characters.
   */
  function hasDoubleLetter(word: string): boolean {
    for (let i = 0; i < word.length; i++) {
      if (word.indexOf(word.charAt(i)) !== i) return true;
    }
    return false;
  }

  /**
   * Aggregates tile states (correct, close, wrong, position exclusions) from the board inputs.
   *
   * @returns {{ closeLetters: string[], wrongLetters: string[],
   *   correctLetters: Array<string|undefined>,
   *   cannotBeLetters: string[][] }} Constraint object used for dictionary
   *   filtering.
   */
  function getLetters(): MatcherOptions {
    const closeLetters: string[] = [];
    const wrongLetters: string[] = [];
    const correctLetters: Array<string | undefined> = new Array(5);
    const cannotBeLetters: string[][] = [[], [], [], [], []];

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
    });

    return {
      closeLetters,
      wrongLetters,
      correctLetters,
      cannotBeLetters,
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
   * Evaluates current board constraints, filters dictionary words, and displays potential matches.
   *
   * @returns {void}
   */
  function calculate(): void {
    checkLinesFull();

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
      if (matcher.matches(upperCaseWord)) potentialMatches.push(word);
    });

    table({
      closeLetters: closeLetters.toString(),
      wrongLetters: wrongLetters.toString(),
      correctLetters: correctLetters.toString(),
      cannotBeLetters: cannotBeLetters.toString(),
    });

    const wordElements = potentialMatches
      .sort((a, b) => (hasDoubleLetter(b) ? -1 : 1))
      .map((word) => `<span>${word}</span>`);
    answersElement.innerHTML = wordElements.join(SPACE);

    resultsElement.innerText = String(wordElements.length);
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
    answersElement.addEventListener(EVENTS.CLICK, (evt) => {
      const target = evt.target as HTMLElement | null;
      if (!target || target.tagName !== 'SPAN') return;
      copy(target.innerText);

      toastNotification.classList.add('animate');
      fillFirstEmptyLine(target.innerText);
      setTimeout(() => {
        toastNotification.classList.remove('animate');
      }, 1500);
    });
    breakpoint.addEventListener('change', checkLinesFull);
  }

  initEventListeners();
  checkLinesFull();
});
