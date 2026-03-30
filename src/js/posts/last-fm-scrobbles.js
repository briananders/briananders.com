const ready = require('../_modules/document-ready');
const TrendsBarChart = require('../_modules/trends-bar-chart');
require('../_components/album-listing').init();
require('../_components/artist-listing').init();
require('../_components/year-listing').init();

const lastFmHistoryUrl = '/last-fm-history/';
const imageUrl = `${lastFmHistoryUrl}images/`;
const LIST_LENGTH = 20;

let reportsData;
let typeSelector;
let selectorContainer;
let artistsContainer;
let albumsContainer;
let yearContainer;

const EVENTS = {
  locationChange: 'ba:locationchange',
  trendsChange: 'ba:lastfm:trendschange',
};

function sentenceCase(string) {
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

function formatNumber(number) {
  return number.toLocaleString();
}

function getImageUrl(name, extension) {
  return `${imageUrl}${name}.${extension}`;
}

function getData(fileName, callback, { _cacheBusted = false } = {}) {
  const request = new XMLHttpRequest();
  const url = `${lastFmHistoryUrl}${fileName}`;

  request.open('GET', url, true);
  // Encourage fresh responses (some servers return 304s that provide no body to XHR).
  try {
    request.setRequestHeader('Cache-Control', 'no-cache');
    request.setRequestHeader('Pragma', 'no-cache');
  } catch (e) {
    // ignore
  }

  request.onload = () => {
    if (request.status >= 200 && request.status < 400) {
      // Success!
      try {
        const raw = (request.response || '').toString();
        if (!raw.trim()) {
          if (!_cacheBusted) {
            const sep = fileName.includes('?') ? '&' : '?';
            getData(`${fileName}${sep}cb=${Date.now()}`, callback, { _cacheBusted: true });
            return;
          }
          if (callback) callback(null);
          return;
        }
        const data = JSON.parse(request.response);
        if (callback) callback(data);
      } catch (e) {
        if (!_cacheBusted) {
          const sep = fileName.includes('?') ? '&' : '?';
          getData(`${fileName}${sep}cb=${Date.now()}`, callback, { _cacheBusted: true });
          return;
        }
        if (callback) callback(null);
      }
    } else {
      // We reached our target server, but it returned an error
      // log(`${url} returned ${request.status}`);
      if (callback) callback(null);
    }
  };

  request.onerror = () => {
    // There was a connection error of some sort
    if (callback) callback(null);
  };

  request.send();
}

function getTrendsParamValue() {
  return new URLSearchParams(window.location.search).get('trends');
}

function sanitizeTrendsValue(trendsValue) {
  if (!trendsValue) return null;
  // We only support "artists/<slug>" and "albums/<artistSlug>/<albumSlug>"
  const clean = String(trendsValue)
    .trim()
    .replace(/^\//, '')
    .replace(/\.\./g, '')
    .replace(/\/{2,}/g, '/');

  if (clean.startsWith('artists/')) return clean;
  if (clean.startsWith('albums/')) return clean;
  return null;
}

function installLocationChangeEvent() {
  // Emit a synthetic event for history API updates, plus back/forward.
  const emit = () => window.dispatchEvent(new Event(EVENTS.locationChange));

  ['pushState', 'replaceState'].forEach((method) => {
    const original = history[method];
    if (typeof original !== 'function') return;
    history[method] = function (...args) {
      const result = original.apply(this, args);
      emit();
      return result;
    };
  });

  window.addEventListener('popstate', emit);
}

const TrendsModal = (() => {
  const state = {
    isOpen: false,
    trendsValue: null,
    overlay: null,
    overlayUi: null,
    container: null,
    content: null,
    closeButton: null,
    titleEl: null,
    totalEl: null,
    chartEl: null,
    statusEl: null,
    keydownHandler: null,
  };

  const OVERLAY_STYLE = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    z-index: 10000;
  `;

  const OVERLAY_UI_STYLE = `
    position: fixed;
    inset: 0;
    background: transparent;
    z-index: 10002;
    pointer-events: none;
  `;

  const CONTAINER_STYLE = `
    position: fixed;
    inset: 0;
    z-index: 10001;
    display: grid;
    place-items: center;
  `;

  const CONTENT_STYLE = `
    position: relative;
    width: min(960px, calc(100vw - 40px));
    max-height: calc(100vh - 40px);
    overflow: auto;
    background: var(--palette--primary-grey);
    border-radius: 6px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.4);
    box-sizing: border-box;
    padding: 20px 0;
  `;

  const CLOSE_STYLE = `
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 10002;
    pointer-events: auto;
  `;

  const buildDom = () => {
    state.overlay = document.createElement('div');
    state.overlay.style.cssText = OVERLAY_STYLE;

    state.overlayUi = document.createElement('div');
    state.overlayUi.style.cssText = OVERLAY_UI_STYLE;

    state.container = document.createElement('div');
    state.container.style.cssText = CONTAINER_STYLE;

    state.content = document.createElement('div');
    state.content.style.cssText = CONTENT_STYLE;

    state.closeButton = document.createElement('button');
    state.closeButton.style.cssText = CLOSE_STYLE;
    state.closeButton.type = 'button';
    state.closeButton.innerText = 'Close';

    state.titleEl = document.createElement('h2');
    state.titleEl.innerText = 'Trends';
    state.titleEl.style.padding = '0 20px';

    state.totalEl = document.createElement('div');
    state.totalEl.innerHTML = `Total Scrobbles: <span class="total-scrobbles"></span>`;
    state.totalEl.style.padding = '0 20px';

    state.statusEl = document.createElement('div');
    state.statusEl.style.marginBottom = '10px';

    state.chartEl = document.createElement('div');

    state.overlayUi.appendChild(state.closeButton);
    state.content.appendChild(state.titleEl);
    state.content.appendChild(state.totalEl);
    state.content.appendChild(state.statusEl);
    state.content.appendChild(state.chartEl);
    state.container.appendChild(state.content);
  };

  const setUrlWithoutTrends = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('trends');
    history.replaceState(history.state, '', url.toString());
    // Close immediately (and also keep URL-change listeners in sync).
    close();
    window.dispatchEvent(new Event(EVENTS.locationChange));
  };

  const close = () => {
    if (!state.isOpen) return;
    state.isOpen = false;
    state.trendsValue = null;

    if (state.keydownHandler) {
      document.removeEventListener('keydown', state.keydownHandler);
      state.keydownHandler = null;
    }

    state.overlay?.remove();
    state.container?.remove();
    state.overlayUi?.remove();
  };

  const open = () => {
    if (!state.overlay) buildDom();

    document.body.appendChild(state.overlay);
    document.body.appendChild(state.container);
    document.body.appendChild(state.overlayUi);

    state.closeButton.onclick = () => setUrlWithoutTrends();
    // Clicking outside the content area should close the modal.
    state.container.onclick = (evt) => {
      if (evt.target === state.container) setUrlWithoutTrends();
    };
    // Prevent clicks inside the content from bubbling to the container.
    state.content.onclick = (evt) => evt.stopPropagation();
    state.keydownHandler = (evt) => {
      if (evt.key === 'Escape') setUrlWithoutTrends();
    };
    document.addEventListener('keydown', state.keydownHandler);

    state.isOpen = true;
  };

  const setLoading = (msg = 'Loading…') => {
    state.statusEl.innerText = msg;
  };

  const setError = (msg = 'Unable to load trends data.') => {
    state.statusEl.innerText = msg;
  };

  const normalizeMonths = (months) => {
    if (!months) return [];
    if (Array.isArray(months)) {
      // Already in expected format: [{ month: 'YYYY-MM', count: N }, ...]
      if (months.length && typeof months[0] === 'object' && months[0] !== null) {
        if ('month' in months[0] && ('count' in months[0] || 'value' in months[0])) {
          return months.map((m) => ({
            month: m.month,
            count: ('count' in m) ? m.count : m.value,
          })).filter((m) => m.month);
        }
      }
      // Tuple format: [['YYYY-MM', N], ...]
      if (months.length && Array.isArray(months[0]) && months[0].length >= 2) {
        return months.map(([month, count]) => ({ month, count }));
      }
      return months;
    }
    // Object map format: { 'YYYY-MM': N, ... }
    if (typeof months === 'object') {
      return Object.entries(months).map(([month, count]) => ({ month, count }));
    }
    return [];
  };

  const render = (trendsValue) => {
    const clean = sanitizeTrendsValue(trendsValue);
    if (!clean) return;

    // Avoid re-rendering if already open for this item.
    if (state.isOpen && state.trendsValue === clean) return;
    state.trendsValue = clean;

    open();
    setLoading();
    state.chartEl.innerHTML = '';
    state.titleEl.innerText = 'Trends';
    state.totalEl.querySelector('.total-scrobbles').innerText = '';

    getData(`trends/${clean}.json`, (data) => {
      const months = normalizeMonths(data && data.months);
      if (!data || months.length === 0) {
        setError('history data retrieval error');
        return;
      }

      if (data.album && data.artist) {
        state.titleEl.innerText = `History: ${data.album} by ${data.artist}`;
      } else if (data.artist) {
        state.titleEl.innerText = `History: ${data.artist}`;
      }

      if (typeof data.totalScrobbles !== 'undefined') {
        state.totalEl.querySelector('.total-scrobbles').innerText = formatNumber(Number(data.totalScrobbles));
      }

      state.statusEl.innerText = '';

      const chartContainer = document.createElement('div');
      state.chartEl.appendChild(chartContainer);
      new TrendsBarChart(chartContainer, months, { openInModal: false });
    });
  };

  const syncToUrl = () => {
    const trendsValue = getTrendsParamValue();
    if (!trendsValue) {
      close();
      return;
    }
    render(trendsValue);
  };

  return { syncToUrl };
})();

function installTrendsLinkInterceptor() {
  // Intercept clicks on "?trends=..." links (including inside shadow DOM)
  // and convert them to history updates so we can open the modal without reload.
  document.addEventListener('click', (evt) => {
    if (evt.defaultPrevented) return;
    if (evt.button !== 0) return; // left click only
    if (evt.metaKey || evt.ctrlKey || evt.shiftKey || evt.altKey) return;

    const path = (typeof evt.composedPath === 'function') ? evt.composedPath() : [];
    const anchor = path.find((node) => node && node.nodeType === 1 && node.tagName === 'A');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname !== window.location.pathname) return;
    if (!url.searchParams.has('trends')) return;

    evt.preventDefault();
    history.pushState(history.state, '', url.toString());
  }, { capture: true });
}

function initSelects() {
  Object.keys(reportsData).sort(customPeriodSort).forEach((type) => {
    if (type !== 'all-time') {
      typeSelector.innerHTML += `<option value="${type}">${sentenceCase(type)} (${reportsData[type].length})</option>`;
    }
  });
  typeSelector.addEventListener('change', updateSelects.bind(this));
  updateSelects();
}

function customPeriodSort(a, b) {
  // 0. all-time
  // 1. year
  // 2. quarter
  // 3. month
  // 4. week
  if (a.type === 'all-time') return -1;
  if (b.type === 'all-time') return 1;

  if (a.type === 'year') return -1;
  if (b.type === 'year') return 1;

  if (a.type === 'quarter') return -1;
  if (b.type === 'quarter') return 1;

  if (a.type === 'month') return -1;
  if (b.type === 'month') return 1;

  if (a.type === 'week') return -1;
  if (b.type === 'week') return 1;

  return 0;
}

function updateSelects() {
  const type = typeSelector.value;
  const reports = reportsData[type].sort((a,b) => a.filename < b.filename ? 1 : -1);
  let select;

  if (selectorContainer.dataset.type !== type) {
    selectorContainer.dataset.type = type;
    selectorContainer.innerHTML = '';

    if (type === 'all-time') {
      renderReport('all_time.json');
      return;
    }
    
    select = document.createElement('select');
    select.setAttribute('name', type);
    select.setAttribute('id', 'period-selector');
    reports.forEach((report, index) => {
      const option = document.createElement('option');
      option.value = report.filename;
      if (index === 0) {
        option.selected = 'selected';
        selectorContainer.dataset.filename = report.filename;
      }
      option.innerHTML = report.label;
      select.appendChild(option);
    });

    selectorContainer.innerHTML = '<label for="period-selector">Time Period</label>';
    select.addEventListener('change', updateSelects.bind(this));
    selectorContainer.appendChild(select);
  } else {
    select = selectorContainer.querySelector(`select[name=${type}]`);
  }

  renderReport(select.value);
}

function renderReport(fileName) {
  getData(`reports/${fileName}`, (data) => {

    artistsContainer.innerHTML = '';
    albumsContainer.innerHTML = '';

    const artistMax = Math.max(...data.artists.map((artist) => Number(artist.count)).sort((a,b) => a > b));
    const albumMax = Math.max(...data.albums.map(album => Number(album.count)).sort((a,b) => a > b));

    data.artists.forEach((artist, index) => {
      if (index >= LIST_LENGTH) return;

      const artistElement = document.createElement('artist-listing');
      // ['name', 'count', 'max', 'img'];

      artistElement.innerHTML = artist.name;
      artistElement.setAttribute('name', artist.name);
      artistElement.setAttribute('count', artist.count);
      artistElement.setAttribute('img', getImageUrl(artist.image, 'webp'));
      artistElement.setAttribute('max', artistMax);

      artistsContainer.appendChild(artistElement);
    });

    data.albums.forEach((album, index) => {
      if (index >= LIST_LENGTH) return;

      const albumElement = document.createElement('album-listing');
      // ['name', 'artist', 'count', 'max', 'img'];

      albumElement.innerHTML = album.album;
      albumElement.setAttribute('name', album.album);
      albumElement.setAttribute('artist', album.artist);
      albumElement.setAttribute('count', album.count);
      albumElement.setAttribute('max', albumMax);
      albumElement.setAttribute('img', getImageUrl(album.albumImage, 'webp'));

      albumsContainer.appendChild(albumElement);
    });
  });
}

function updateTrends() {
  /* <div class="container" id="artist-trends-container" data-artist="the-beatles">
    <h2>Trends For <span class="trend-name"></span></h2>
    <h3>Total Scrobbles: <span class="total-scrobbles"></span></h3>
    <div class="trend-list-container">
      <div class="trend-list"></div>
    </div>
  </div>

  <div class="container" id="album-trends-container" data-album="the-beatles/1">
    <h2>Trends For <span class="trend-name"></span></h2>
    <h3>Total Scrobbles: <span class="total-scrobbles"></span></h3>
    <div class="trend-list-container">
      <div class="trend-list"></div>
    </div>
  </div> */
  const artistTrendsContainer = document.getElementById('artist-trends-container');
  const albumTrendsContainer = document.getElementById('album-trends-container');

  const artist = artistTrendsContainer.dataset.artist;
  const album = albumTrendsContainer.dataset.album;

  console.log(artist, album);

  getData(`trends/artists/${artist}.json`, (data) => {
    artistTrendsContainer.querySelector('.trend-name').innerText = data.artist;
    artistTrendsContainer.querySelector('.total-scrobbles').innerText = formatNumber(data.totalScrobbles);
    new TrendsBarChart(artistTrendsContainer.querySelector('.trend-list'), data.months);
  });

  getData(`trends/albums/${album}.json`, (data) => {
    albumTrendsContainer.querySelector('.trend-name').innerText = `${data.album} by ${data.artist}`;
    albumTrendsContainer.querySelector('.total-scrobbles').innerText = formatNumber(data.totalScrobbles);
    new TrendsBarChart(albumTrendsContainer.querySelector('.trend-list'), data.months);
  });
}

ready.document(() => {
  typeSelector = document.getElementById('type-selector');
  selectorContainer = document.getElementById('selector-container');
  artistsContainer = document.getElementById('artists');
  albumsContainer = document.getElementById('albums');
  yearContainer = document.getElementById('yearly-scrobbles');

  installLocationChangeEvent();
  installTrendsLinkInterceptor();

  window.addEventListener(EVENTS.locationChange, () => {
    const trendsValue = sanitizeTrendsValue(getTrendsParamValue());
    if (trendsValue) {
      window.dispatchEvent(new CustomEvent(EVENTS.trendsChange, { detail: { trendsValue } }));
    } else {
      window.dispatchEvent(new CustomEvent(EVENTS.trendsChange, { detail: { trendsValue: null } }));
    }
  });

  window.addEventListener(EVENTS.trendsChange, () => {
    TrendsModal.syncToUrl();
  });

  // Initial sync (in case the page loads with ?trends=...)
  window.dispatchEvent(new Event(EVENTS.locationChange));

  getData('reports/index.json', (data) => {
    if (!data) return;
    reportsData = data.reports;
    initSelects();
  });

  getData('reports/year_totals.json', (data) => {
    if (!data) return;
    const years = data.years.sort((a,b) => a.year > b.year);
    const yearMax = Math.max(...years.map(year => Number(year.total)));

    years.forEach((year) => {
      const yearElement = document.createElement('year-listing');
      // ["year", "value", "maximum"];

      yearElement.innerHTML = formatNumber(year.total);
      yearElement.setAttribute('year', year.year);
      yearElement.setAttribute('value', year.total);
      yearElement.setAttribute('maximum', yearMax);
      yearContainer.appendChild(yearElement);
    });
  });
});
