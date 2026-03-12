const ready = require('../../_modules/document-ready');

ready.document(() => {
  const copy = require('copy-to-clipboard');

  const { table } = require('../../_modules/log');

  const Matcher = require('./matcher');

  const boardElement = document.getElementById('board');
  const answersElement = document.getElementById('options');
  const resultsElement = document.getElementById('results-count');
  const lines = Array.from(boardElement.querySelectorAll('.line'));
  const textInputs = Array.from(boardElement.querySelectorAll('input[type=text'));
  const checkboxes = Array.from(boardElement.querySelectorAll('input[type=radio]'));
  const submitButton = document.getElementById('submit');
  const clearButton = document.getElementById('clear');
  const toastNotification = document.querySelector('toast-notification');

  const breakpoint = matchMedia('(max-width: 500px)');

  /// //////////////////////// CONSTANTS

  const STATES = {
    CLOSE: 'close',
    CORRECT: 'correct',
    WRONG: 'wrong',
  };

  const EVENTS = {
    KEYDOWN: 'keydown',
    KEYUP: 'keyup',
    CLICK: 'click',
    CHANGE: 'change',
    INPUT: 'input',
  };

  const KEYS = {
    BACKSPACE: 'Backspace',
    ARROW_LEFT: 'ArrowLeft',
    TAB: 'Tab',
    ARROW_RIGHT: 'ArrowRight',
  };

  const EMPTY = '';
  const SPACE = ' ';
  const DASH = '-';

  const isLetter = (value) => /[a-zA-Z]/.test(value);

  /// ////////////// get dictionary

  let dictionary;

  function reqListener() {
    dictionary = JSON.parse(this.responseText);
  }

  const req = new XMLHttpRequest();
  req.addEventListener('load', reqListener);
  req.open('GET', '/data/five-letter-words.json');
  req.send();

  /// ////////////// functions

  function checkLinesFull() {
    const lineFull = new Array(6);
    let lastFullLine = 0;

    lines.forEach((lineElement) => {
      const inputs = Array.from(lineElement.querySelectorAll('input[type=text]'));
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
    boardElement.style.height = `${lastFullLineElement.offsetHeight * (lastFullLine + 1)}px`;
  }

  function fillFirstEmptyLine(word) {
    let firstEmpty;
    let emptyLineElements;

    lines.forEach((lineElement, index) => {
      const lineInputs = Array.from(lineElement.querySelectorAll('input[type=text]'));
      const lineValue = lineInputs.map((input) => input.value).join('');

      if (lineValue === '' && firstEmpty === undefined) {
        firstEmpty = index;
        emptyLineElements = lineInputs;
      }
    });

    emptyLineElements.forEach((input, index) => {
      input.value = word.charAt(index).toUpperCase();
    });
  }

  function hasDoubleLetter(word) {
    for (let i = 0; i < word.length; i++) {
      if (word.indexOf(word.charAt(i)) !== i) return true;
    }
    return false;
  }

  function getLetters() {
    const closeLetters = [];
    const wrongLetters = [];
    const correctLetters = new Array(5);
    const cannotBeLetters = [[], [], [], [], []];

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
          // eslint-disable-next-line no-alert
          alert(`It looks like you have two letters marked for the same position: ${value} and ${correctLetters[letterIndex]}`);
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

  function resetLetter(textInput) {
    const [, lineNumber, letterNumber] = textInput.id.split(DASH);

    const closeCheckbox = document.getElementById(`${STATES.CLOSE}-${lineNumber}-${letterNumber}`);
    const correctCheckbox = document.getElementById(`${STATES.CORRECT}-${lineNumber}-${letterNumber}`);
    const wrongCheckbox = document.getElementById(`${STATES.WRONG}-${lineNumber}-${letterNumber}`);

    textInput.value = EMPTY;
    textInput.dataset.state = STATES.WRONG;

    wrongCheckbox.checked = true;
    closeCheckbox.checked = false;
    correctCheckbox.checked = false;
  }

  function clear() {
    const inputs = Array.from(boardElement.querySelectorAll('input[type=text]'));

    inputs.forEach(resetLetter);

    checkLinesFull();
  }

  function calculate() {
    checkLinesFull();

    const {
      closeLetters,
      wrongLetters,
      correctLetters,
      cannotBeLetters,
    } = getLetters();

    const potentialMatches = [];

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

    const wordElements = potentialMatches.sort((a, b) => (hasDoubleLetter(b) ? -1 : 1)).map((word) => `<span>${word}</span>`);
    answersElement.innerHTML = wordElements.join(SPACE);

    resultsElement.innerText = wordElements.length;
  }

  function checkboxUpdated({ srcElement }) {
    if (!srcElement.checked) return;
    const [state, lineNumber, letterNumber] = srcElement.id.split(DASH);
    const letterInput = document.getElementById(`letter-${lineNumber}-${letterNumber}`);
    letterInput.dataset.state = state;
  }

  function previousInput(srcElement) {
    const [letterWord, lineNumber, letterNumber] = srcElement.id.split(DASH);

    const nextInputElement = document.getElementById(`${letterWord}-${lineNumber}-${Number(letterNumber) - 1}`);
    if (nextInputElement) {
      nextInputElement.focus();
    }
  }

  function nextInput(srcElement) {
    const [letterWord, lineNumber, letterNumber] = srcElement.id.split(DASH);

    const nextInputElement = document.getElementById(`${letterWord}-${lineNumber}-${Number(letterNumber) + 1}`);
    if (nextInputElement) {
      nextInputElement.focus();
    }
  }

  function inputKeydown(evt) {
    const { srcElement, key } = evt;
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

  function initEventListeners() {
    textInputs.forEach((input) => {
      input.addEventListener(EVENTS.KEYDOWN, inputKeydown);
    });
    submitButton.addEventListener(EVENTS.CLICK, calculate);
    clearButton.addEventListener(EVENTS.CLICK, clear);
    checkboxes.forEach((box) => {
      box.addEventListener(EVENTS.CHANGE, checkboxUpdated);
    });
    answersElement.addEventListener(EVENTS.CLICK, ({ target }) => {
      if (target.tagName !== 'SPAN') return;
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
