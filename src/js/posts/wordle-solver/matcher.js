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
module.exports = function Matcher({
  closeLetters,
  wrongLetters,
  correctLetters,
  cannotBeLetters,
}) {
  /**
   * Checks if at least one letter from the provided array appears in the candidate word.
   *
   * @param {string} word - The candidate word.
   * @param {string[]} letters - Array of test letters.
   * @returns {boolean} True if any letter exists in word.
   */
  function any(word, letters) {
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];
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
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];
      if (!word.includes(letter)) return false;
    }
    return true;
  }

  /**
   * Confirms that none of the target letters appear in the candidate word.
   *
   * @param {string} word - The candidate word.
   * @param {string[]} letters - The array of disallowed letters.
   * @returns {boolean} True if no letter in letters is found within word.
   */
  function none(word, letters) {
    for (let i = 0; i < letters.length; i++) {
      const currentLetter = letters[i];
      if (word.includes(currentLetter)) return false;
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
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];
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
  function cannotBeLettersMatch(word, letters2DArray) { // letters is a 2D array
    for (let i = 0; i < letters2DArray.length; i++) {
      const letters = letters2DArray[i];
      for (let j = 0; j < letters.length; j++) {
        const letter = letters[j];
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
  this.matches = (word) => {
    if (!correctLettersMatch(word, correctLetters)) return false;
    if (any(word, wrongLetters)) return false;
    if (!all(word, closeLetters)) return false;
    if (!cannotBeLettersMatch(word, cannotBeLetters)) return false;
    return true;
  };
};
