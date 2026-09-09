const ready = require('../_modules/document-ready');

/**
 * Calculates the total number of days in a specific month and year.
 *
 * @param {number} month - The month number (1-12).
 * @param {number} year - The full four-digit year.
 * @returns {number} The number of days in the specified month.
 */
function daysInMonth(month, year) {
  // Day 0 of the following month gives the last day of the target month
  return new Date(year, month, 0).getDate();
}

/**
 * Represents an SVG circular path used as a progress ring in the polar clock.
 */
class CirclePath {

  #element;
  #circumference;
  id;

  /**
   * Sets the stroke offset of the circle based on completion percentage.
   *
   * @param {number} percent - Progress fraction between 0 and 1.
   * @returns {void}
   */
  setPosition(percent) {
    this.#element.style.strokeDashoffset = this.#circumference * (1 - percent);
  }

  /**
   * Creates a new CirclePath instance and configures its strokeDasharray.
   *
   * @param {string} elementId - The DOM ID of the SVG circle element.
   */
  constructor(elementId) {
    this.id = elementId;
    this.#element = document.getElementById(elementId);

    const radius = Number(this.#element.getAttribute('r'));
    this.#circumference = Math.PI * (2 * radius);
    this.#element.style.strokeDasharray = this.#circumference;

    this.setPosition(0);
  }
}

/**
 * Formats a number into a zero-padded string of a minimum character length.
 *
 * @param {number} num - The number to format.
 * @param {number} length - The required minimum number of digits.
 * @returns {string} Zero-padded string representation of the number.
 */
function minCharacters(num, length) {
  // Pad with leading zeroes by appending to a zero-filled array and taking the suffix
  const arr = new Array(10).fill(0);
  arr.push(num);
  const arrString = arr.join('');
  return arrString.substring(arrString.length - length);
}

/**
 * Extracts and returns current date and time components.
 *
 * @returns {{ seconds: number, minutes: number, hours: number, days: number, months: number, years: number }}
 *   Object containing current time and date parts.
 */
function getDate() {
  const date = new Date();

  return {
    seconds: date.getSeconds(),
    minutes: date.getMinutes(),
    hours: date.getHours(),
    days: date.getDate(),
    months: date.getMonth() + 1,
    years: date.getFullYear(),
  };
}

/**
 * Updates stroke offsets and text readouts for all time unit rings.
 *
 * @param {CirclePath[]} polarClockInstances - Array of CirclePath ring instances.
 * @param {Object.<string, NodeList>} displayInstances - Map of time unit keys to corresponding DOM text elements.
 * @returns {void}
 */
function updateTimes(polarClockInstances, displayInstances) {
  const {
    seconds,
    minutes,
    hours,
    days,
    months,
    years,
  } = getDate();

  polarClockInstances.forEach((instance) => {
    if (instance.id === 'seconds') {
      instance.setPosition(seconds / 60);
      displayInstances[instance.id].forEach((el) => {
        el.innerHTML = minCharacters(seconds % 60, 2);
      });
    }
    if (instance.id === 'minutes') {
      instance.setPosition(minutes / 60);
      displayInstances[instance.id].forEach((el) => {
        el.innerHTML = minCharacters(minutes % 60, 2);
      });
    }
    if (instance.id === 'hours') {
      instance.setPosition(hours / 24);
      displayInstances[instance.id].forEach((el) => {
        el.innerHTML = minCharacters(hours % 24, 2);
      });
    }
    if (instance.id === 'days') {
      instance.setPosition(days / daysInMonth(months, years));
      displayInstances[instance.id].forEach((el) => {
        el.innerHTML = minCharacters(days, 2);
      });
    }
    if (instance.id === 'months') {
      instance.setPosition(months / 12);
      displayInstances[instance.id].forEach((el) => {
        el.innerHTML = minCharacters(months, 2);
      });
    }
    if (instance.id === 'years') {
      instance.setPosition(years / 10000);
      displayInstances[instance.id].forEach((el) => {
        el.innerHTML = years;
      });
    }
  });
}

/**
 * Starts a recurring interval timer to update clock displays.
 *
 * @param {CirclePath[]} polarClockInstances - Array of CirclePath instances.
 * @param {Object.<string, NodeList>} displayInstances - Map of time unit keys to DOM elements.
 * @returns {void}
 */
function startClocking(polarClockInstances, displayInstances) {
  setInterval(updateTimes.bind(this, polarClockInstances, displayInstances), 200);
}

ready.document(() => {
  const ids = [
    'years',
    'months',
    'days',
    'hours',
    'minutes',
    'seconds'];

  const polarClockInstances = ids.map((id) => new CirclePath(id));
  const displayInstances = {};

  ids.forEach((id) => {
    displayInstances[id] = document.querySelectorAll(`[data-time="${id}"]`);
  });

  startClocking(polarClockInstances, displayInstances);
});
