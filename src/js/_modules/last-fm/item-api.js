const handlebars = require('handlebars');

const lazyLoader = require('../lazy-loader');
// const { log } = require('../log');

const config = require('./config');
const template = require('./template');

let period = '1month'; // default
const cache = {};

module.exports = {
  init(opts) {
    const containerElement = document.querySelector(opts.scope);
    opts.description = opts.description || false; // defaults
    opts.count = opts.count || 4; // defaults

    function getURL() {
      return `https://ws.audioscrobbler.com/2.0/?method=${opts.method}&user=${
        config.user
      }&period=${
        period
      }&api_key=${
        config.apiKey
      }&format=json&limit=${
        config.limit
      }`;
    }

    function render() {
      const url = getURL();
      const data = cache[url];
      const handlebarsData = { ...opts, items: data };

      const compiledHandlebars = handlebars.compile(template);
      const outputHTML = compiledHandlebars(handlebarsData);
      containerElement.innerHTML = outputHTML;

      lazyLoader.init('.last-fm-module');
    }

    function serialize(data) {
      data.defaultImage = containerElement ? containerElement.getAttribute('src') : '';
      const items = opts.customSerialize(data);
      const maxPlayCount = Math.max(...items.map((item) => Number(item.playcount)));
      items.forEach((item) => {
        const playCount = Number(item.playcount);
        item.percent = (playCount / maxPlayCount) * 100;
      });
      const shortenedItem = items.filter((item, index) => index < opts.count);
      return shortenedItem;
    }

    function getData() {
      const url = getURL();
      if (cache[url]) {
        render();
      } else {
        const request = new XMLHttpRequest();
        request.open('GET', url, true);

        request.onload = () => {
          if (request.status >= 200 && request.status < 400) {
            // Success!
            const data = JSON.parse(request.response);
            cache[url] = serialize(data);
            render();
          } else {
            // We reached our target server, but it returned an error
            // log(`${url} returned ${request.status}`);
          }
        };

        request.onerror = () => {
          // There was a connection error of some sort
        };

        request.send();
      }
    }

    function watchPeriod() {
      const periodElement = document.querySelector('select[name=period]');
      if (periodElement !== null) {
        period = periodElement.value;
        periodElement.addEventListener('change', () => {
          period = periodElement.value;
          getData();
        });
      }
    }

    watchPeriod();
    getData();
  },
};
