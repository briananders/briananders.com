/**
 * @fileoverview Controller for the Music News post.
 *
 * Loads the latest feed and the history catalog, renders the update list, and
 * keeps the view state (snapshot, tag, artist, new-only) in the URL so any
 * view, including an archived feed, can be shared and reloaded.
 */

import type {
  BandNewsFilters,
  FacetCountItem,
  FetchLike,
  NormalizedArticle,
  NormalizedFeed,
  SnapshotComparison,
  SnapshotEntry
} from './data.ts';

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
} = require('./data.ts');
const {
  renderArticle,
  renderFilterChips,
  renderSnapshotOptions,
  renderMeta,
  renderFilterStatus,
} = require('./render.ts');

export interface MultiselectElement extends HTMLElement {
  value: string[];
  triggerEl?: HTMLElement;
  setOptions: (items: FacetCountItem[]) => void;
  setSelected: (values: string[]) => void;
  clear: () => void;
}

export interface MusicNewsElements {
  root: HTMLElement;
  meta: HTMLElement;
  list: HTMLElement;
  empty: HTMLElement;
  historyWrap?: HTMLElement | null;
  historySelect?: HTMLSelectElement | null;
  historyPrev?: HTMLButtonElement | null;
  historyNext?: HTMLButtonElement | null;
  historyLatest?: HTMLButtonElement | null;
  newWrap?: HTMLElement | null;
  newOnly?: HTMLInputElement | null;
  tagsWrap: HTMLElement;
  tags: HTMLElement;
  bandsWrap?: HTMLElement | null;
  bands?: HTMLElement | null;
  bandsSelect?: MultiselectElement | null;
  filterStatus: HTMLElement;
}

export interface CreateMusicNewsOptions {
  elements: MusicNewsElements;
  fetchImpl?: FetchLike;
  location?: Location;
  history?: History;
  onFeedChange?: (feed: NormalizedFeed) => void;
}

export interface MusicNewsController {
  ready: Promise<void>;
  showSnapshot: (key: string) => Promise<void>;
  getState: () => {
    snapshot: string | null;
    tag: string | null;
    bands: string[];
    band: string | null;
    newOnly: boolean;
  };
}

interface MusicNewsView {
  snapshot: SnapshotEntry;
  feed: NormalizedFeed;
  articles: NormalizedArticle[];
  comparison: SnapshotComparison | null;
}

const EMPTY_FEED_MESSAGE = 'No matches found at this time.';
const EMPTY_FILTER_MESSAGE = 'No updates match these filters.';
const LOAD_ERROR_MESSAGE = 'That feed snapshot could not be loaded. Try again, or pick another date.';

/**
 * Type guard checking whether an element implements the multiselect-dropdown API.
 *
 * @param {HTMLElement | MultiselectElement | null | undefined} element - Element to check.
 * @returns {boolean} True when element has setOptions/setSelected/clear methods.
 */
function isMultiselect(element: HTMLElement | MultiselectElement | null | undefined): element is MultiselectElement {
  return Boolean(element && 'setOptions' in element && typeof element.setOptions === 'function');
}

/**
 * Wires up the page.
 *
 * @param {CreateMusicNewsOptions} options - Options.
 * @returns {MusicNewsController} Controller handle.
 */
function createMusicNews({
  elements,
  fetchImpl,
  location = window.location,
  history = window.history,
  onFeedChange = () => {},
}: CreateMusicNewsOptions): MusicNewsController {
  const el = elements;
  const load = createLoader(fetchImpl);
  const initial = parseState(location.search);
  const filters: { tag: string | null; bands: string[]; newOnly: boolean } = {
    tag: initial.tag,
    bands: initial.bands || (initial.band ? [initial.band] : []),
    newOnly: initial.newOnly,
  };

  let latestFeed: NormalizedFeed | null = null;
  let snapshots: SnapshotEntry[] = [];
  // The snapshot on screen: its entry, feed, articles (with `isNew` once known)
  // and the comparison with the snapshot before it.
  let view: MusicNewsView | null = null;
  // Incremented per snapshot request so a slow response can't overwrite a newer pick.
  let requestId = 0;

  function syncUrl(): void {
    if (!view) return;
    const query = serializeState(location.search, { snapshot: view.snapshot.key, ...filters });
    history.replaceState(history.state, '', `${location.pathname}${query}${location.hash}`);
  }

  function setEmpty(message: string | null): void {
    el.empty.textContent = '';
    if (message) {
      const p = document.createElement('p');
      p.textContent = message;
      el.empty.appendChild(p);
    }
    el.empty.style.display = message ? 'block' : 'none';
  }

  function renderHistory(): void {
    if (!el.historyWrap || !view) return;
    el.historyWrap.hidden = snapshots.length < 2;
    if (el.historyWrap.hidden) return;
    const index = snapshots.indexOf(view.snapshot);
    // Options are built once in bindEvents(); rebuilding them here would reset
    // an open picker whenever the comparison finishes loading.
    if (el.historySelect) el.historySelect.value = view.snapshot.key;
    if (el.historyPrev) el.historyPrev.disabled = index >= snapshots.length - 1;
    if (el.historyNext) el.historyNext.disabled = index <= 0;
    if (el.historyLatest) el.historyLatest.hidden = view.snapshot.isLatest;
    if (el.newWrap) el.newWrap.hidden = !view.comparison || view.comparison.newCount === 0;
    if (el.newOnly) el.newOnly.checked = filters.newOnly;
  }

  /**
   * "New only" applies once the comparison has loaded and found something new;
   * until then (or for the oldest snapshot) it is ignored rather than hiding
   * everything.
   *
   * @returns {BandNewsFilters} Filters to apply.
   */
  function effectiveFilters(): BandNewsFilters {
    const canFilterNew = Boolean(view && view.comparison && view.comparison.newCount > 0);
    return { ...filters, newOnly: filters.newOnly && canFilterNew };
  }

  function render(): void {
    if (!view) return;
    const active = effectiveFilters();
    const { articles } = view;
    const shown: NormalizedArticle[] = filterArticles(articles, active);
    const facets: { tags: FacetCountItem[]; bands: FacetCountItem[] } = facetCounts(articles, active);

    el.meta.innerHTML = articles.length ? renderMeta(view.feed, view.snapshot, view.comparison) : '';
    renderHistory();

    el.tagsWrap.hidden = facets.tags.length === 0;
    el.tags.innerHTML = renderFilterChips('tag', facets.tags, active.tag);

    const bandsContainer = el.bandsSelect || el.bands;
    if (el.bandsWrap) {
      el.bandsWrap.hidden = facets.bands.length === 0;
    }

    if (isMultiselect(bandsContainer)) {
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
   * @param {SnapshotEntry} snapshot - Snapshot on screen.
   * @returns {Promise<void>} Resolves once the comparison is rendered (or skipped).
   */
  function loadComparison(id: number, snapshot: SnapshotEntry): Promise<void> {
    const previous = snapshots[snapshots.indexOf(snapshot) + 1];
    if (!previous) return Promise.resolve();
    return load(previous.path)
      .then((raw: unknown) => {
        if (id !== requestId || !view) return;
        const articles: NormalizedArticle[] = markNew(view.feed.articles, normalizeFeed(raw).articles);
        view = {
          ...view,
          articles,
          comparison: { snapshot: previous, newCount: articles.filter((article) => article.isNew).length },
        };
        render();
      })
      // The comparison is an extra; without it the snapshot still renders.
      .catch((error: unknown) => console.error(error));
  }

  /**
   * Puts a snapshot on screen. Unknown keys fall back to the latest feed.
   *
   * @param {string} key - Snapshot key ('latest' or yyyy-mm-dd).
   * @returns {Promise<void>} Resolves once the snapshot and its comparison are rendered.
   */
  function showSnapshot(key: string): Promise<void> {
    const snapshot = snapshots.find((entry) => entry.key === key) || snapshots[0];
    requestId += 1;
    const id = requestId;
    // The picker stays enabled while loading: disabling it would drop keyboard
    // focus mid-selection. `requestId` already discards superseded responses.
    el.list.setAttribute('aria-busy', 'true');

    const feedPromise: Promise<NormalizedFeed> = snapshot.isLatest && latestFeed
      ? Promise.resolve(latestFeed)
      : load(snapshot.path).then(normalizeFeed);

    return feedPromise
      .then((feed) => {
        if (id !== requestId) return undefined;
        view = {
          snapshot, feed, articles: feed.articles, comparison: null,
        };
        onFeedChange(feed);
        render();
        syncUrl();
        el.list.removeAttribute('aria-busy');
        return loadComparison(id, snapshot);
      })
      .catch((error: unknown) => {
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

  function step(offset: number): void {
    if (!view) return;
    const index = snapshots.indexOf(view.snapshot) + offset;
    if (snapshots[index]) showSnapshot(snapshots[index].key);
  }

  /**
   * Re-rendering replaces the pressed button, so focus moves to its
   * counterpart in the filter row (the persistent control for that facet).
   *
   * @param {'tag'|'band'} kind - Facet.
   * @param {string} value - Facet value.
   */
  function restoreFocus(kind: 'tag' | 'band', value: string): void {
    if (kind === 'tag') {
      const match = [...el.tags.querySelectorAll<HTMLElement>('[data-filter]')]
        .find((button) => button.dataset.value === value);
      if (match) match.focus();
    } else if (kind === 'band') {
      const bandsContainer = el.bandsSelect || el.bands;
      if (isMultiselect(bandsContainer) && bandsContainer.triggerEl) {
        bandsContainer.triggerEl.focus();
      } else if (el.bands) {
        const match = [...el.bands.querySelectorAll<HTMLElement>('[data-filter]')]
          .find((button) => button.dataset.value === value);
        if (match) match.focus();
      }
    }
  }

  function onClick(event: MouseEvent): void {
    const target = event.target as Element | null;
    if (!target || typeof target.closest !== 'function') return;

    const clear = target.closest('[data-action="clear-filters"]');
    if (clear) {
      filters.tag = null;
      filters.bands = [];
      filters.newOnly = false;
      const bandsContainer = el.bandsSelect || el.bands;
      if (isMultiselect(bandsContainer)) {
        bandsContainer.clear();
      }
      render();
      syncUrl();
      return;
    }

    const button = target.closest<HTMLElement>('[data-filter]');
    if (!button || !el.root.contains(button)) return;
    const kind = button.dataset.filter;
    if (kind !== 'tag' && kind !== 'band') return;
    const { value } = button.dataset;
    if (value === undefined) return;

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
      if (isMultiselect(bandsContainer)) {
        bandsContainer.setSelected(filters.bands);
      } else {
        restoreFocus(kind, value);
      }
    }
  }

  function bindEvents(): void {
    el.root.addEventListener('click', onClick);
    const bandsContainer = el.bandsSelect || el.bands;
    if (bandsContainer && typeof bandsContainer.addEventListener === 'function') {
      bandsContainer.addEventListener('change', (event: Event) => {
        const customEvent = event as CustomEvent<{ values?: string[] }>;
        const containerValue = isMultiselect(bandsContainer) ? bandsContainer.value : [];
        const selectedValues = customEvent.detail && Array.isArray(customEvent.detail.values)
          ? customEvent.detail.values
          : containerValue;
        filters.bands = [...(selectedValues || [])];
        render();
        syncUrl();
      });
    }
    if (!el.historySelect) return;
    const { historySelect } = el;
    historySelect.innerHTML = renderSnapshotOptions(snapshots, initial.snapshot);
    historySelect.addEventListener('change', () => showSnapshot(historySelect.value));
    el.historyPrev?.addEventListener('click', () => step(1));
    el.historyNext?.addEventListener('click', () => step(-1));
    el.historyLatest?.addEventListener('click', () => showSnapshot(LATEST_KEY));
    if (el.newOnly) {
      const { newOnly } = el;
      newOnly.addEventListener('change', () => {
        filters.newOnly = newOnly.checked;
        render();
        syncUrl();
      });
    }
  }

  const ready: Promise<void> = Promise.all([
    load(LATEST_PATH).then(normalizeFeed) as Promise<NormalizedFeed>,
    // History is optional: without a catalog the page shows the latest feed only.
    load(CATALOG_PATH).catch(() => null)
  ])
    .then(([feed, catalog]) => {
      latestFeed = feed;
      snapshots = buildSnapshots(feed, catalog);
      bindEvents();
      return showSnapshot(initial.snapshot);
    })
    .catch((error: unknown) => {
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
