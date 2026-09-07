const config = require('./config');

let period = '30day'; // default
const rawCache = {};
const pendingRequests = {};

const PERIOD_MAP = {
  '7day': 'rolling_last-7-days.json',
  '30day': 'rolling_last-30-days.json',
  '90day': 'rolling_last-90-days.json',
  '6month': 'rolling_last-6-months.json',
  '12month': 'rolling_last-12-months.json',
  '2year': 'rolling_last-2-years.json',
};

module.exports = {
  init(opts) {
    const containerElement = document.querySelector(opts.scope);
    if (!containerElement) {
      return;
    }
    opts.description = opts.description || false; // defaults
    opts.count = opts.count || 4; // defaults

    function getURL() {
      const reportFile = PERIOD_MAP[period] || PERIOD_MAP['30day'];
      return `/last-fm-history/reports/${reportFile}`;
    }

    function render() {
      const url = getURL();
      const rawData = rawCache[url];
      const items = serialize(rawData);

      containerElement.innerHTML = '';
      opts.renderItems(items, containerElement);
    }

    function serialize(data) {
      if (!data) return [];
      const defaultImage = containerElement.getAttribute('src');
      const dataWithDefault = { ...data, defaultImage };
      const items = opts.customSerialize(dataWithDefault);
      const maxPlayCount = Math.max(...items.map((item) => Number(item.playcount || 0)));
      items.forEach((item) => {
        const playCount = Number(item.playcount || 0);
        item.percent = maxPlayCount > 0 ? (playCount / maxPlayCount) * 100 : 0;
        item.max = maxPlayCount;
      });
      return items.filter((item, index) => index < opts.count);
    }

    function getData() {
      const url = getURL();
      if (rawCache[url]) {
        render();
      } else if (pendingRequests[url]) {
        pendingRequests[url].push(render);
      } else {
        pendingRequests[url] = [render];
        const request = new XMLHttpRequest();
        request.open('GET', url, true);

        request.onload = () => {
          if (request.status >= 200 && request.status < 400) {
            try {
              const data = JSON.parse(request.response);
              rawCache[url] = data;
              const callbacks = pendingRequests[url];
              delete pendingRequests[url];
              if (callbacks) {
                callbacks.forEach((cb) => cb());
              }
            } catch (err) {
              console.error(`Failed to parse response from ${url}:`, err);
              delete pendingRequests[url];
            }
          }
        };

        request.onerror = () => {};

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
