const ready = require('../_modules/document-ready');

ready.document(() => {
  const formElement = document.getElementById('form');
  const inputElement = document.getElementById('input');
  // const buttonElement = document.getElementById('button');
  const resultsElement = document.getElementById('results');

  let dictionary;

  /**
   * Parses and stores the Wordscapes word dictionary from the XMLHttpRequest response.
   *
   * @returns {void}
   */
  function reqListener() {
    dictionary = JSON.parse(this.responseText);
  }

  const req = new XMLHttpRequest();
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
    const inputLetters = inputElement.value.split('');

    const matches = [];

    dictionary.forEach((word) => {
      let testWord = word;

      inputLetters.forEach((letter) => {
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
    const resultsByLength = results.sort((a, b) => ((a.length > b.length) ? -1 : 1));
    // get the longest result length
    const longestLength = resultsByLength[0].length;
    // HTML formatting
    const htmlSections = [];
    // setup splitting data
    const splitResults = {};

    // init empty arrays for each length
    for (let i = longestLength; i >= 3; i--) {
      splitResults[i] = [];
    }

    // split the data by length
    resultsByLength.forEach((word) => {
      splitResults[word.length].push(word);
    });

    // sort the data & format HTML
    for (let i = longestLength; i >= 3; i--) {
      splitResults[i] = splitResults[i].sort();

      htmlSections.push(`
        <h3>${i} Letter Words</h3>
        <p>
          ${splitResults[i].join(', ')}
        <p>
      `);
    }

    resultsElement.innerHTML = `<div>${htmlSections.join('</div><div>')}</div>`;
  }

  /**
   * Registers form submit and Enter key event listeners for the input element.
   *
   * @returns {void}
   */
  function initEventListeners() {
    formElement.addEventListener('submit', calculateResults);
    inputElement.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') {
        calculateResults();
      }
    });
  }

  initEventListeners();
});
