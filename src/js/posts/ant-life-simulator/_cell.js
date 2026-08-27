const {
  ANT,
  ANT_EATER,
} = require('./_constants');

class Cell {
  constructor(element) {
    this.element = element;
    /*
      Public Variables
    */
    this.x = Number(element.dataset.x);
    this.y = Number(element.dataset.y);
    this.value = undefined;
    this.procreated = false;
    this.toDie = false;
    this.hungryCount = 0;
  }

  /*
    Public Computed Properties
  */

  isEmpty() { return this.value === '' || this.value === null || this.value === undefined; }

  isAnt() { return this.value === ANT; }

  isAntEater() { return this.value === ANT_EATER; }

  /*
    Public Functions
  */

  render() {
    this.element.dataset.value = (this.value) ? this.value.toString() : '';
    this.procreated = false;
  }
}

module.exports = Cell;
