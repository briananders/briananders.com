module.exports = function Matcher({
  closeLetters,
  wrongLetters,
  correctLetters,
  cannotBeLetters,
}) {
  function any(word, letters) {
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];
      if (word.includes(letter)) return true;
    }
    return false;
  }

  function all(word, letters) {
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];
      if (!word.includes(letter)) return false;
    }
    return true;
  }

  function none(word, letter) {
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];
      if (word.includes(letter)) return false;
    }
    return true;
  }

  function correctLettersMatch(word, letters) {
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];
      if (letter !== undefined && word[i] !== letter) return false;
    }
    return true;
  }

  // confirms that the close letters do not appear in the same positions
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

  this.matches = (word) => {
    if (!correctLettersMatch(word, correctLetters)) return false;
    if (any(word, wrongLetters)) return false;
    if (!all(word, closeLetters)) return false;
    if (!cannotBeLettersMatch(word, cannotBeLetters)) return false;
    return true;
  };
};
