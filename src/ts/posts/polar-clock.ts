const ready = require('../_modules/document-ready.ts');

type TimeUnitId = 'years' | 'months' | 'days' | 'hours' | 'minutes' | 'seconds';

interface DateParts {
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
  months: number;
  years: number;
}

type DisplayInstances = Partial<Record<TimeUnitId, NodeListOf<Element>>>;

/**
 * Calculates the total number of days in a specific month and year.
 *
 * @param {number} month - The month number (1-12).
 * @param {number} year - The full four-digit year.
 * @returns {number} The number of days in the specified month.
 */
function daysInMonth(month: number, year: number): number {
  // Day 0 of the following month gives the last day of the target month
  return new Date(year, month, 0).getDate();
}

/**
 * Represents an SVG circular path used as a progress ring in the polar clock.
 */
class CirclePath {
  #element: HTMLElement;

  #circumference: number;

  id: TimeUnitId;

  /**
   * Sets the stroke offset of the circle based on completion percentage.
   *
   * @param {number} percent - Progress fraction between 0 and 1.
   * @returns {void}
   */
  setPosition(percent: number): void {
    this.#element.style.strokeDashoffset = String(this.#circumference * (1 - percent));
  }

  /**
   * Creates a new CirclePath instance and configures its strokeDasharray.
   *
   * @param {string} elementId - The DOM ID of the SVG circle element.
   */
  constructor(elementId: TimeUnitId) {
    this.id = elementId;
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Missing polar clock element: ${elementId}`);
    }
    this.#element = element;

    const radius = Number(this.#element.getAttribute('r'));
    this.#circumference = Math.PI * (2 * radius);
    this.#element.style.strokeDasharray = String(this.#circumference);

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
function minCharacters(num: number, length: number): string {
  // Pad with leading zeroes by appending to a zero-filled array and taking the suffix
  const arr = new Array<number>(10).fill(0);
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
function getDate(): DateParts {
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
function updateTimes(polarClockInstances: CirclePath[], displayInstances: DisplayInstances): void {
  const {
    seconds,
    minutes,
    hours,
    days,
    months,
    years,
  } = getDate();

  polarClockInstances.forEach((instance) => {
    const displays = displayInstances[instance.id];
    if (!displays) {
      return;
    }

    if (instance.id === 'seconds') {
      instance.setPosition(seconds / 60);
      displays.forEach((el) => {
        el.innerHTML = minCharacters(seconds % 60, 2);
      });
    }
    if (instance.id === 'minutes') {
      instance.setPosition(minutes / 60);
      displays.forEach((el) => {
        el.innerHTML = minCharacters(minutes % 60, 2);
      });
    }
    if (instance.id === 'hours') {
      instance.setPosition(hours / 24);
      displays.forEach((el) => {
        el.innerHTML = minCharacters(hours % 24, 2);
      });
    }
    if (instance.id === 'days') {
      instance.setPosition(days / daysInMonth(months, years));
      displays.forEach((el) => {
        el.innerHTML = minCharacters(days, 2);
      });
    }
    if (instance.id === 'months') {
      instance.setPosition(months / 12);
      displays.forEach((el) => {
        el.innerHTML = minCharacters(months, 2);
      });
    }
    if (instance.id === 'years') {
      instance.setPosition(years / 10000);
      displays.forEach((el) => {
        el.innerHTML = String(years);
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
function startClocking(polarClockInstances: CirclePath[], displayInstances: DisplayInstances): void {
  setInterval(() => updateTimes(polarClockInstances, displayInstances), 200);
}

ready.document(() => {
  const ids: TimeUnitId[] = [
    'years',
    'months',
    'days',
    'hours',
    'minutes',
    'seconds'
  ];

  const polarClockInstances = ids.map((id) => new CirclePath(id));
  const displayInstances: DisplayInstances = {};

  ids.forEach((id) => {
    displayInstances[id] = document.querySelectorAll(`[data-time="${id}"]`);
  });

  startClocking(polarClockInstances, displayInstances);
});
