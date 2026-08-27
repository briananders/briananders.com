const ready = require('../_modules/document-ready');

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

class CirclePath {

  #element;
  #circumference;
  id;

  setPosition(percent) {
    this.#element.style.strokeDashoffset = this.#circumference * (1 - percent);
  }

  constructor(elementId) {
    this.id = elementId;
    this.#element = document.getElementById(elementId);

    const radius = Number(this.#element.getAttribute('r'));
    this.#circumference = Math.PI * (2 * radius);
    this.#element.style.strokeDasharray = this.#circumference;

    this.setPosition(0);
  }
}

function minCharacters(num, length) {
  const arr = new Array(10).fill(0);
  arr.push(num);
  const arrString = arr.join('');
  return arrString.substring(arrString.length - length);
}

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
