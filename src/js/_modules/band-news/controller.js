/**
 * @fileoverview Controller for the Music News post.
 *
 * Loads the latest feed and the history catalog, renders the update list, and
 * keeps the view state (snapshot, tag, artist, new-only) in the URL so any
 * view, including an archived feed, can be shared and reloaded.
 */

const {
  LATEST_PATH,
  CATALOG_PATH,
  LATEST_KEY,
  createLoader,
  normalizeFeed,
  buildSnapshots,
  markNew,
  filterArticles,
  facetCounts,
  parseState,
  serializeState,
} = require('./data');
const {
  renderArticle,
  renderFilterChips,
  renderSnapshotOptions,
  renderMeta,
  renderFilterStatus,
} = require('./render');

const EMPTY_FEED_MESSAGE = 'No matches found at this time.';
const EMPTY_FILTER_MESSAGE = 'No updates match these filters.';
const LOAD_ERROR_MESSAGE = 'That feed snapshot could not be loaded. Try again, or pick another date.';

/**
 * Wires up the page.
 *
 * @param {Object} options - Options.
 * @param {Object<string, HTMLElement>} options.elements - Page elements (see music-news.ejs):
 *   root, meta, list, empty, historyWrap, historySelect, historyPrev, historyNext,
 *   historyLatest, newWrap, newOnly, tagsWrap, tags, bandsWrap, bands, filterStatus.
 * @param {Function} [options.fetchImpl] - `fetch` replacement for tests.
 * @param {Location} [options.location] - Defaults to `window.location`.
 * @param {History} [options.history] - Defaults to `window.history`.
 * @param {function(Object): void} [options.onFeedChange] - Called with each normalized
 *   feed put on screen (the page uses it to refresh the artist marquee).
 * @returns {{ready: Promise<void>, showSnapshot: function(string): Promise<void>,
 *   getState: function(): Object}} Controller handle.
 */
function createMusicNews({
  elements,
  fetchImpl,
  location = window.location,
  history = window.history,
  onFeedChange = () => {},
}) {
  const el = elements;
  const load = createLoader(fetchImpl);
  const initial = parseState(location.search);
  const filters = {
    tag: initial.tag,
    bands: initial.bands || (initial.band ? [initial.band] : []),
    newOnly: initial.newOnly,
  };

  let latestFeed = null;
  let snapshots = [];
  // The snapshot on screen: its entry, feed, articles (with `isNew` once known)
  // and the comparison with the snapshot before it.
  let view = null;
  // Incremented per snapshot request so a slow response can't overwrite a newer pick.
  let requestId = 0;

  function syncUrl() {
    if (!view) return;
    const query = serializeState(location.search, { snapshot: view.snapshot.key, ...filters });
    history.replaceState(history.state, '', `${location.pathname}${query}${location.hash}`);
  }

  function setEmpty(message) {
    el.empty.textContent = '';
    if (message) {
      const p = document.createElement('p');
      p.textContent = message;
      el.empty.appendChild(p);
    }
    el.empty.style.display = message ? 'block' : 'none';
  }

  function renderHistory() {
    if (!el.historyWrap) return;
    el.historyWrap.hidden = snapshots.length < 2;
    if (el.historyWrap.hidden) return;
    const index = snapshots.indexOf(view.snapshot);
    // Options are built once in bindEvents(); rebuilding them here would reset
    // an open picker whenever the comparison finishes loading.
    el.historySelect.value = view.snapshot.key;
    el.historyPrev.disabled = index >= snapshots.length - 1;
    el.historyNext.disabled = index <= 0;
    el.historyLatest.hidden = view.snapshot.isLatest;
    el.newWrap.hidden = !view.comparison || view.comparison.newCount === 0;
    el.newOnly.checked = filters.newOnly;
  }

  /**
   * "New only" applies once the comparison has loaded and found something new;
   * until then (or for the oldest snapshot) it is ignored rather than hiding
   * everything.
   *
   * @returns {{tag: string|null, band: string|null, newOnly: boolean}} Filters to apply.
   */
  function effectiveFilters() {
    const canFilterNew = Boolean(view.comparison && view.comparison.newCount > 0);
    return { ...filters, newOnly: filters.newOnly && canFilterNew };
  }

  function render() {
    if (!view) return;
    const active = effectiveFilters();
    const { articles } = view;
    const shown = filterArticles(articles, active);
    const facets = facetCounts(articles, active);

    el.meta.innerHTML = articles.length ? renderMeta(view.feed, view.snapshot, view.comparison) : '';
    renderHistory();

    el.tagsWrap.hidden = facets.tags.length === 0;
    el.tags.innerHTML = renderFilterChips('tag', facets.tags, active.tag);

    const bandsContainer = el.bandsSelect || el.bands;
    if (el.bandsWrap) {
      el.bandsWrap.hidden = facets.bands.length === 0;
    }

    if (bandsContainer && typeof bandsContainer.setOptions === 'function') {
      const availableBandValues = new Set(facets.bands.map((b) => b.value));
      filters.bands = filters.bands.filter((b) => availableBandValues.has(b));
      bandsContainer.setOptions(facets.bands);
      bandsContainer.setSelected(filters.bands);
    } else if (el.bands) {
      el.bands.innerHTML = renderFilterChips('band', facets.bands, active.bands && active.bands[0]);
    }

    const filtering = Boolean(active.tag || (active.bands && active.bands.length > 0) || active.newOnly);
    el.filterStatus.hidden = !filtering || articles.length === 0;
    el.filterStatus.innerHTML = el.filterStatus.hidden ? '' : renderFilterStatus(shown.length, articles.length, active);

    el.list.innerHTML = shown.map((article) => renderArticle(article, active)).join('');
    if (articles.length === 0) setEmpty(EMPTY_FEED_MESSAGE);
    else if (shown.length === 0) setEmpty(EMPTY_FILTER_MESSAGE);
    else setEmpty(null);
  }

  /**
   * Loads the snapshot before `snapshot` and flags what's new since then.
   *
   * @param {number} id - Request id the result belongs to.
   * @param {Object} snapshot - Snapshot on screen.
   * @returns {Promise<void>} Resolves once the comparison is rendered (or skipped).
   */
  function loadComparison(id, snapshot) {
    const previous = snapshots[snapshots.indexOf(snapshot) + 1];
    if (!previous) return Promise.resolve();
    return load(previous.path)
      .then((raw) => {
        if (id !== requestId) return;
        const articles = markNew(view.feed.articles, normalizeFeed(raw).articles);
        view = {
          ...view,
          articles,
          comparison: { snapshot: previous, newCount: articles.filter((article) => article.isNew).length },
        };
        render();
      })
      // The comparison is an extra; without it the snapshot still renders.
      .catch((error) => console.error(error));
  }

  /**
   * Puts a snapshot on screen. Unknown keys fall back to the latest feed.
   *
   * @param {string} key - Snapshot key ('latest' or yyyy-mm-dd).
   * @returns {Promise<void>} Resolves once the snapshot and its comparison are rendered.
   */
  function showSnapshot(key) {
    const snapshot = snapshots.find((entry) => entry.key === key) || snapshots[0];
    requestId += 1;
    const id = requestId;
    // The picker stays enabled while loading: disabling it would drop keyboard
    // focus mid-selection. `requestId` already discards superseded responses.
    el.list.setAttribute('aria-busy', 'true');

    const feedPromise = snapshot.isLatest
      ? Promise.resolve(latestFeed)
      : load(snapshot.path).then(normalizeFeed);

    return feedPromise
      .then((feed) => {
        if (id !== requestId) return null;
        view = {
          snapshot, feed, articles: feed.articles, comparison: null,
        };
        onFeedChange(feed);
        render();
        syncUrl();
        el.list.removeAttribute('aria-busy');
        return loadComparison(id, snapshot);
      })
      .catch((error) => {
        console.error(error);
        if (id !== requestId) return;
        el.list.removeAttribute('aria-busy');
        // Keep the snapshot that was on screen and point the picker back at it.
        if (view) {
          render();
          el.filterStatus.hidden = false;
          el.filterStatus.textContent = LOAD_ERROR_MESSAGE;
        } else {
          setEmpty(EMPTY_FEED_MESSAGE);
        }
      });
  }

  function step(offset) {
    const index = snapshots.indexOf(view.snapshot) + offset;
    if (snapshots[index]) showSnapshot(snapshots[index].key);
  }

  /**
   * Re-rendering replaces the pressed button, so focus moves to its
   * counterpart in the filter row (the persistent control for that facet).
   *
   * @param {string} kind - Facet.
   * @param {string} value - Facet value.
   */
  function restoreFocus(kind, value) {
    if (kind === 'tag') {
      const match = [...el.tags.querySelectorAll('[data-filter]')]
        .find((button) => button.dataset.value === value);
      if (match) match.focus();
    } else if (kind === 'band') {
      const bandsContainer = el.bandsSelect || el.bands;
      if (bandsContainer && bandsContainer.triggerEl) {
        bandsContainer.triggerEl.focus();
      } else if (el.bands) {
        const match = [...el.bands.querySelectorAll('[data-filter]')]
          .find((button) => button.dataset.value === value);
        if (match) match.focus();
      }
    }
  }

  function onClick(event) {
    const clear = event.target.closest('[data-action="clear-filters"]');
    if (clear) {
      filters.tag = null;
      filters.bands = [];
      filters.newOnly = false;
      const bandsContainer = el.bandsSelect || el.bands;
      if (bandsContainer && typeof bandsContainer.clear === 'function') {
        bandsContainer.clear();
      }
      render();
      syncUrl();
      return;
    }

    const button = event.target.closest('[data-filter]');
    if (!button || !el.root.contains(button)) return;
    const kind = button.dataset.filter;
    if (kind !== 'tag' && kind !== 'band') return;
    const { value } = button.dataset;

    if (kind === 'tag') {
      filters.tag = filters.tag === value ? null : value;
      render();
      syncUrl();
      restoreFocus(kind, value);
    } else if (kind === 'band') {
      const index = filters.bands.indexOf(value);
      if (index >= 0) {
        filters.bands.splice(index, 1);
      } else {
        filters.bands.push(value);
      }
      render();
      syncUrl();
      const bandsContainer = el.bandsSelect || el.bands;
      if (bandsContainer && typeof bandsContainer.setSelected === 'function') {
        bandsContainer.setSelected(filters.bands);
      } else {
        restoreFocus(kind, value);
      }
    }
  }

  function bindEvents() {
    el.root.addEventListener('click', onClick);
    const bandsContainer = el.bandsSelect || el.bands;
    if (bandsContainer && typeof bandsContainer.addEventListener === 'function') {
      bandsContainer.addEventListener('change', (event) => {
        const selectedValues = event.detail && Array.isArray(event.detail.values)
          ? event.detail.values
          : bandsContainer.value;
        filters.bands = [...(selectedValues || [])];
        render();
        syncUrl();
      });
    }
    if (!el.historySelect) return;
    el.historySelect.innerHTML = renderSnapshotOptions(snapshots, initial.snapshot);
    el.historySelect.addEventListener('change', () => showSnapshot(el.historySelect.value));
    el.historyPrev.addEventListener('click', () => step(1));
    el.historyNext.addEventListener('click', () => step(-1));
    el.historyLatest.addEventListener('click', () => showSnapshot(LATEST_KEY));
    el.newOnly.addEventListener('change', () => {
      filters.newOnly = el.newOnly.checked;
      render();
      syncUrl();
    });
  }

  const ready = Promise.all([
    load(LATEST_PATH).then(normalizeFeed),
    // History is optional: without a catalog the page shows the latest feed only.
    load(CATALOG_PATH).catch(() => null)
  ])
    .then(([feed, catalog]) => {
      latestFeed = feed;
      snapshots = buildSnapshots(feed, catalog);
      bindEvents();
      return showSnapshot(initial.snapshot);
    })
    .catch((error) => {
      console.error(error);
      setEmpty(EMPTY_FEED_MESSAGE);
    });

  return {
    ready,
    showSnapshot,
    getState: () => ({
      snapshot: view ? view.snapshot.key : null,
      tag: filters.tag,
      bands: [...filters.bands],
      band: filters.bands[0] || null,
      newOnly: filters.newOnly,
    }),
  };
}

module.exports = { createMusicNews };
