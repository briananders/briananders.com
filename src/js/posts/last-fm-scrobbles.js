const ready = require('../_modules/document-ready');
const TrendsBarChart = require('../_modules/trends-bar-chart');
require('../_components/album-listing').init();
require('../_components/artist-listing').init();
require('../_components/year-listing').init();
require('../_components/last-updated').init();

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

/**
 * Capitalizes the first character of a string and converts the remainder to lowercase.
 *
 * @param {string} string - The input string to convert.
 * @returns {string} Sentence-cased string.
 */
function sentenceCase(string) {
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

/**
 * Formats a number with localized thousands separators.
 *
 * @param {number} number - The numerical value to format.
 * @returns {string} Localized string representation of the number.
 */
function formatNumber(number) {
  return number.toLocaleString();
}

/**
 * Constructs the full image asset URL for a given image file name.
 *
 * @param {string} name - The image filename or relative path.
 * @returns {string} Full URL to the image resource.
 */
function getImageUrl(name) {
  return `${imageUrl}${name}`;
}

/**
 * Fetches JSON data from the Last.fm history directory via XMLHttpRequest with optional cache busting.
 *
 * @param {string} fileName - Relative file name/path of the JSON resource.
 * @param {function(?Object): void} callback - Callback receiving parsed JSON or null on error.
 * @param {Object} [options] - Additional options.
 * @param {boolean} [options._cacheBusted=false] - Internal flag to prevent infinite cache-bust retry loops.
 */
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

  /** Parses JSON response and passes data or null to callback. */
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

  /** Handles network error during JSON data fetching. */
  request.onerror = () => {
    // There was a connection error of some sort
    if (callback) callback(null);
  };

  request.send();
}

/**
 * Reads the 'trends' query parameter from the current window location.
 *
 * @returns {string|null} The raw trends query parameter or null if not present.
 */
function getTrendsParamValue() {
  return new URLSearchParams(window.location.search).get('trends');
}

/**
 * Validates and sanitizes a trends path string, ensuring it adheres to expected prefixes and structure.
 *
 * @param {string|null} trendsValue - The raw trends query parameter value.
 * @returns {string|null} Sanitized trend path or null if invalid.
 */
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

/**
 * Patches history.pushState and history.replaceState and listens to popstate to dispatch location change events.
 */
function installLocationChangeEvent() {
  // Emit a synthetic event for history API updates, plus back/forward.
  const emit = () => window.dispatchEvent(new Event(EVENTS.locationChange));

  ['pushState', 'replaceState'].forEach((method) => {
    const original = history[method];
    if (typeof original !== 'function') return;
    /** Wraps history method to emit locationChange event. */
    history[method] = function (...args) {
      const result = original.apply(this, args);
      emit();
      return result;
    };
  });

  window.addEventListener('popstate', emit);
}

/**
 * Modal controller managing trends chart overlay display, state synchronization, and DOM lifecycle.
 */
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

  /**
   * Constructs the DOM hierarchy and elements for the trends modal overlay.
   */
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
    state.totalEl.innerHTML = `Total Plays: <span class="total-scrobbles"></span>`;
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

  /**
   * Removes the 'trends' query parameter from the URL bar and triggers modal closing.
   */
  const setUrlWithoutTrends = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('trends');
    history.replaceState(history.state, '', url.toString());
    // Close immediately (and also keep URL-change listeners in sync).
    close();
    window.dispatchEvent(new Event(EVENTS.locationChange));
  };

  /**
   * Closes the modal, detaches listeners, and removes modal elements from the DOM.
   */
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

  /**
   * Opens the trends modal and attaches event listeners for close button, backdrop click, and Escape key.
   */
  const open = () => {
    if (!state.overlay) buildDom();

    document.body.appendChild(state.overlay);
    document.body.appendChild(state.container);
    document.body.appendChild(state.overlayUi);

    /** Closes modal when close button is clicked. */
    state.closeButton.onclick = () => setUrlWithoutTrends();
    // Clicking outside the content area should close the modal.
    /** Closes modal when clicking backdrop container. */
    state.container.onclick = (evt) => {
      if (evt.target === state.container) setUrlWithoutTrends();
    };
    // Prevent clicks inside the content from bubbling to the container.
    /** Stops click propagation within modal content area. */
    state.content.onclick = (evt) => evt.stopPropagation();
    /** Closes modal on Escape key press. */
    state.keydownHandler = (evt) => {
      if (evt.key === 'Escape') setUrlWithoutTrends();
    };
    document.addEventListener('keydown', state.keydownHandler);

    state.isOpen = true;
  };

  /**
   * Sets the status text inside the modal to indicate loading state.
   *
   * @param {string} [msg='Loading…'] - Status message to display.
   */
  const setLoading = (msg = 'Loading…') => {
    state.statusEl.innerText = msg;
  };

  /**
   * Sets the status text inside the modal to indicate an error state.
   *
   * @param {string} [msg='Unable to load trends data.'] - Error message to display.
   */
  const setError = (msg = 'Unable to load trends data.') => {
    state.statusEl.innerText = msg;
  };

  /**
   * Normalizes various monthly trend data structures into a unified array of `{ month, count }` objects.
   *
   * @param {Array|Object|null} months - Raw month data in array, tuple, or object format.
   * @returns {Array<{month: string, count: number}>} Normalized array of monthly entries.
   */
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

  /**
   * Fetches trend data and renders the trends bar chart inside the modal.
   *
   * @param {string} trendsValue - The cleaned trend resource path.
   */
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

  /**
   * Synchronizes the modal state with the 'trends' query parameter in the current URL.
   */
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

/**
 * Intercepts clicks on links containing '?trends=' to update browser history without full page reload.
 */
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

const EXCLUDED_TYPES = new Set(['all-time', 'listening history']);

/**
 * Checks whether a given report type key is valid and selectable in the UI.
 *
 * @param {string} type - Report category key (e.g., 'year', 'month').
 * @returns {boolean} True if the type exists in reports data and is not excluded.
 */
function isSelectableType(type) {
  return !!reportsData && !!reportsData[type] && !EXCLUDED_TYPES.has(type);
}

/**
 * Extracts the specific period slug from a report JSON filename.
 *
 * @param {string} filename - The filename (e.g., 'month_2023-05.json').
 * @param {string} type - The report category prefix.
 * @returns {string} The stripped slug identifier.
 */
function slugFromFilename(filename, type) {
  if (!filename) return '';
  return filename
    .replace(/\.json$/i, '')
    .replace(new RegExp(`^${type}_`), '');
}

/**
 * Parses current URL query parameters for active filter selections.
 *
 * @returns {{type: string|null, period: string|null}} Object with type and period parameter values.
 */
function getFilterParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    type: params.get('type'),
    period: params.get('period'),
  };
}

/**
 * Updates URL search parameters in the browser history using replaceState without adding new entries.
 *
 * @param {Object.<string, string|null>} updates - Key-value map of parameters to set or remove.
 */
function updateFilterParams(updates) {
  const url = new URL(window.location.href);
  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  });
  // Use replaceState so filter changes don't add browser history entries.
  history.replaceState(history.state, '', url.toString());
}

/**
 * Populates the report type dropdown, attaches change listeners, and applies current URL filters.
 */
function initSelects() {
  Object.keys(reportsData).sort(customPeriodSort).forEach((type) => {
    if (EXCLUDED_TYPES.has(type)) return;
    typeSelector.innerHTML += `<option value="${type}">${sentenceCase(type)} (${reportsData[type].length})</option>`;
  });
  typeSelector.addEventListener('change', handleTypeChange);
  applyFilterParams();
}

/**
 * Reads filter values from URL search parameters and synchronizes the dropdowns and reports view.
 */
function applyFilterParams() {
  const { type, period } = getFilterParams();

  if (type && isSelectableType(type)) {
    typeSelector.value = type;
  }

  buildPeriodSelectAndRender(period);
}

/**
 * Handles user selection changes on the report type dropdown, resetting the period filter.
 */
function handleTypeChange() {
  const type = typeSelector.value;
  // Reset period whenever the type changes.
  updateFilterParams({
    type: type === 'all-time' ? null : type,
    period: null,
  });
  buildPeriodSelectAndRender();
}

/**
 * Handles user selection changes on the period dropdown and fetches the corresponding report.
 *
 * @param {HTMLSelectElement} select - The period select dropdown element.
 */
function handlePeriodChange(select) {
  const type = selectorContainer.dataset.type;
  updateFilterParams({ period: select.value });
  renderReport(`${type}_${select.value}.json`);
}

/**
 * Comparator function to sort report period categories in hierarchical order.
 *
 * @param {string} a - First category name.
 * @param {string} b - Second category name.
 * @returns {number} Comparison result (-1, 0, 1).
 */
function customPeriodSort(a, b) {
  // 0. all-time
  // 1. year
  // 2. quarter
  // 3. month
  // 4. week
  if (a === 'all-time') return -1;
  if (b === 'all-time') return 1;

  if (a === 'year') return -1;
  if (b === 'year') return 1;

  if (a === 'quarter') return -1;
  if (b === 'quarter') return 1;

  if (a === 'month') return -1;
  if (b === 'month') return 1;

  if (a === 'week') return -1;
  if (b === 'week') return 1;

  return 0;
}

/**
 * Constructs the period selector dropdown for the current type and initiates rendering of the report.
 *
 * @param {string} [preferredPeriod] - Optional period slug to select by default.
 */
function buildPeriodSelectAndRender(preferredPeriod) {
  const type = typeSelector.value;
  const reports = (reportsData[type] || []).slice().sort((a, b) => a.filename < b.filename ? 1 : -1);

  selectorContainer.dataset.type = type;
  selectorContainer.innerHTML = '';

  if (type === 'all-time') {
    delete selectorContainer.dataset.filename;
    renderReport('all_time.json');
    return;
  }

  const select = document.createElement('select');
  select.setAttribute('name', type);
  select.setAttribute('id', 'period-selector');

  let selectedIndex = 0;
  if (preferredPeriod) {
    const idx = reports.findIndex((r) => slugFromFilename(r.filename, type) === preferredPeriod);
    if (idx !== -1) selectedIndex = idx;
  }

  reports.forEach((report, index) => {
    const option = document.createElement('option');
    option.value = slugFromFilename(report.filename, type);
    if (index === selectedIndex) {
      option.selected = 'selected';
    }
    option.innerHTML = report.label;
    select.appendChild(option);
  });

  // Correct the URL if the preferred period wasn't found and we fell back.
  if (select.value !== preferredPeriod) {
    updateFilterParams({ period: select.value || null });
  }

  selectorContainer.innerHTML = '<label for="period-selector">Time Period</label>';
  select.addEventListener('change', () => handlePeriodChange(select));
  selectorContainer.appendChild(select);

  renderReport(`${type}_${select.value}.json`);
}

/**
 * Fetches and renders top artist and album listings for a specified report JSON file.
 *
 * @param {string} fileName - Report JSON filename within the reports/ directory.
 */
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
      artistElement.setAttribute('img', getImageUrl(artist.image));
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
      albumElement.setAttribute('img', getImageUrl(album.albumImage));

      albumsContainer.appendChild(albumElement);
    });
  });
}

/**
 * Fetches and renders trends bar charts for inline artist and album trends containers.
 */
function updateTrends() {
  /* <div class="container" id="artist-trends-container" data-artist="the-beatles">
    <h2>Trends For <span class="trend-name"></span></h2>
    <h3>Total Plays: <span class="total-scrobbles"></span></h3>
    <div class="trend-list-container">
      <div class="trend-list"></div>
    </div>
  </div>

  <div class="container" id="album-trends-container" data-album="the-beatles/1">
    <h2>Trends For <span class="trend-name"></span></h2>
    <h3>Total Plays: <span class="total-scrobbles"></span></h3>
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

/**
 * Initializes Last.fm scrobble history views, listeners, routing, and year-by-year totals on DOM ready.
 */
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
