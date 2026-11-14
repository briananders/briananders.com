/**
 * @fileoverview Data layer for the Music News post.
 *
 * Reads the feeds that the band-news repo (github.com/briananders/band-news)
 * publishes to `/band-news/` on S3:
 *
 *   articles.json                       latest feed     (schema/articles.schema.json)
 *   catalog.json                        archive index   (schema/catalog.schema.json)
 *   history/YYYY-MM-DD-articles.json    archived feeds  (same schema as articles.json)
 *
 * Everything here is DOM-free so it can be unit tested in node. Feeds are
 * normalized into one internal shape, so older snapshots that predate the
 * optional `tag` and `sources` fields render through the same code as new ones.
 */

const BASE_URL = '/band-news/';
const LATEST_PATH = 'articles.json';
const CATALOG_PATH = 'catalog.json';
const LATEST_KEY = 'latest';

// Catalog paths are relative to the band-news root. Anything else is ignored,
// so a malformed catalog can't point the page at an arbitrary URL.
const HISTORY_PATH_PATTERN = /^history\/\d{4}-\d{2}-\d{2}-articles\.json$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Creates a memoizing JSON loader for paths under the band-news root, so
 * stepping back and forth through history never refetches a snapshot.
 * Failed requests are evicted so a later attempt can retry.
 *
 * @param {Function} [fetchImpl] - `fetch`-compatible function (injectable for tests).
 * @returns {function(string): Promise<Object>} Loads `BASE_URL + path` as JSON.
 */
function createLoader(fetchImpl = (...args) => fetch(...args)) {
  const cache = new Map();
  return function load(path) {
    if (!cache.has(path)) {
      const request = Promise.resolve(fetchImpl(`${BASE_URL}${path}`)).then((response) => {
        if (!response.ok) throw new Error(`${BASE_URL}${path}: HTTP ${response.status}`);
        return response.json();
      });
      request.catch(() => cache.delete(path));
      cache.set(path, request);
    }
    return cache.get(path);
  };
}

/**
 * Returns the string trimmed, or '' for anything that isn't a string.
 *
 * @param {*} value - Raw value from the feed.
 * @returns {string} Trimmed string.
 */
function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Returns the URL if it is an absolute http(s) URL, else null. Feed links come
 * from scraped RSS, so `javascript:` and other schemes are never rendered.
 *
 * @param {*} value - Raw URL from the feed.
 * @returns {string|null} The URL, or null when unusable.
 */
function safeUrl(value) {
  const url = text(value);
  return /^https?:\/\//i.test(url) ? url : null;
}

/**
 * Publisher names scraped from page titles sometimes keep a dangling
 * separator ("The Guide Liverpool |", "Distorted Sound Magazine -").
 *
 * @param {*} value - Raw publisher name.
 * @returns {string} The name without a trailing separator.
 */
function cleanSourceName(value) {
  const name = text(value);
  return name.replace(/\s+[|\-–—:·]+$/, '').trim() || name;
}

/**
 * Milliseconds since the epoch, or -Infinity for a missing or invalid date so
 * undated items sort last.
 *
 * @param {string|null} iso - ISO 8601 timestamp.
 * @returns {number} Sortable time value.
 */
function timeValue(iso) {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? -Infinity : ms;
}

/**
 * Normalizes one source entry; returns null when it has no usable link.
 *
 * @param {Object} raw - `sources[]` entry (or the article itself for old feeds).
 * @returns {{title: string, link: string, source: string, published: string|null}|null}
 */
function normalizeSource(raw) {
  const link = safeUrl(raw && raw.link);
  if (!link) return null;
  return {
    title: text(raw.title) || link,
    link,
    source: cleanSourceName(raw.source),
    published: text(raw.published) || null,
  };
}

/**
 * Normalizes one article into the shape the renderer uses. Feeds published
 * before the band-news API added `sources` get a one-entry list built from
 * the article's own `link`/`source`, and a missing `tag` becomes null.
 *
 * @param {Object} raw - Entry from a feed's `articles` array.
 * @returns {Object|null} Normalized article, or null when it can't be rendered.
 */
function normalizeArticle(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = text(raw.title);
  const rawSources = Array.isArray(raw.sources) && raw.sources.length ? raw.sources : [raw];
  const sources = rawSources.map(normalizeSource).filter(Boolean);
  const link = safeUrl(raw.link) || (sources[0] && sources[0].link);
  if (!title || !link) return null;

  return {
    title,
    link,
    summary: text(raw.summary),
    published: text(raw.published) || null,
    publishedFormatted: text(raw.published_formatted),
    source: cleanSourceName(raw.source) || (sources[0] && sources[0].source) || '',
    bands: [...new Set((Array.isArray(raw.matched_bands) ? raw.matched_bands : []).map(text).filter(Boolean))],
    imageUrl: safeUrl(raw.image_url),
    tag: text(raw.tag) || null,
    sources,
    isNew: false,
  };
}

/**
 * Normalizes a whole feed (articles.json or a history snapshot). Articles are
 * sorted newest first; the sort is stable so same-time items keep feed order.
 *
 * @param {Object} raw - Parsed feed JSON.
 * @returns {{generatedAt: string|null, bandsTracked: number, feedsChecked: number,
 *   bandsList: string[], articles: Object[]}} Normalized feed.
 */
function normalizeFeed(raw) {
  const feed = raw && typeof raw === 'object' ? raw : {};
  const articles = (Array.isArray(feed.articles) ? feed.articles : [])
    .map(normalizeArticle)
    .filter(Boolean)
    .sort((a, b) => timeValue(b.published) - timeValue(a.published));

  return {
    generatedAt: text(feed.generated_at) || null,
    bandsTracked: Number(feed.bands_tracked) || 0,
    feedsChecked: Number(feed.feeds_checked) || 0,
    bandsList: (Array.isArray(feed.bands_list) ? feed.bands_list : []).map(text).filter(Boolean),
    articles,
  };
}

/**
 * Builds the list of viewable snapshots, newest first: the latest feed, then
 * every valid catalog entry. `key` is what the `?snapshot=` URL param holds:
 * 'latest', or the entry's yyyy-mm-dd date (unique per catalog).
 *
 * @param {Object} latestFeed - Normalized latest feed.
 * @param {Object|null} catalog - Parsed catalog.json, or null when unavailable.
 * @returns {Array<{key: string, path: string, generatedAt: string|null,
 *   articleCount: number, isLatest: boolean}>} Snapshots, newest first.
 */
function buildSnapshots(latestFeed, catalog) {
  const latest = {
    key: LATEST_KEY,
    path: LATEST_PATH,
    generatedAt: latestFeed.generatedAt,
    articleCount: latestFeed.articles.length,
    isLatest: true,
  };
  const seen = new Set([LATEST_KEY]);
  const entries = (catalog && Array.isArray(catalog.history) ? catalog.history : [])
    .filter((entry) => entry
      && DATE_KEY_PATTERN.test(entry.date)
      && HISTORY_PATH_PATTERN.test(entry.path)
      // An archive of the feed that is still live adds nothing to step back to.
      && !(latest.generatedAt && entry.generated_at === latest.generatedAt))
    .map((entry) => ({
      key: entry.date,
      path: entry.path,
      generatedAt: text(entry.generated_at) || null,
      articleCount: Number(entry.article_count) || 0,
      isLatest: false,
    }))
    .sort((a, b) => b.key.localeCompare(a.key))
    .filter((entry) => !seen.has(entry.key) && seen.add(entry.key));

  return [latest, ...entries];
}

/**
 * Every link an article cites: its primary link plus each source's.
 *
 * @param {Object} article - Normalized article.
 * @returns {string[]} Links.
 */
function articleLinks(article) {
  return [article.link, ...article.sources.map((source) => source.link)];
}

/**
 * Flags the articles that weren't in the previous snapshot. An update counts as
 * seen when any link it cites appeared in the previous feed, so a story that
 * merely gained another source since then isn't reported as new.
 *
 * @param {Object[]} articles - Normalized articles of the snapshot on screen.
 * @param {Object[]|null} previousArticles - Normalized articles of the snapshot before it.
 * @returns {Object[]} Copies of `articles` with `isNew` set.
 */
function markNew(articles, previousArticles) {
  if (!Array.isArray(previousArticles)) return articles.map((article) => ({ ...article, isNew: false }));
  const seen = new Set(previousArticles.flatMap(articleLinks));
  return articles.map((article) => ({
    ...article,
    isNew: !articleLinks(article).some((link) => seen.has(link)),
  }));
}

/**
 * Resolves the active selected bands array from a filters object.
 *
 * @param {Object} filters - Active filters.
 * @returns {string[]} Array of selected band names.
 */
function getSelectedBands(filters) {
  if (Array.isArray(filters.bands)) return filters.bands;
  if (filters.band) return [filters.band];
  return [];
}

/**
 * Whether an article passes the active filters. `skip` leaves one facet out,
 * which is how each filter row counts against the *other* active filters.
 *
 * @param {Object} article - Normalized article.
 * @param {{tag: string|null, band?: string|null, bands?: string[], newOnly: boolean}} filters - Active filters.
 * @param {'tag'|'band'} [skip] - Facet to ignore.
 * @returns {boolean} True when the article matches.
 */
function matchesFilters(article, filters, skip) {
  if (skip !== 'tag' && filters.tag && article.tag !== filters.tag) return false;
  const bands = getSelectedBands(filters);
  if (skip !== 'band' && bands.length > 0) {
    if (!bands.some((band) => article.bands.includes(band))) return false;
  }
  if (filters.newOnly && !article.isNew) return false;
  return true;
}

/**
 * @param {Object[]} articles - Normalized articles.
 * @param {{tag: string|null, band?: string|null, bands?: string[], newOnly: boolean}} filters - Active filters.
 * @returns {Object[]} Articles matching every active filter.
 */
function filterArticles(articles, filters) {
  return articles.filter((article) => matchesFilters(article, filters));
}

/**
 * Counts each value of one facet across the articles, alphabetically.
 * The selected value is always listed (count 0 if needed) so it can be
 * deselected after switching to a snapshot that doesn't contain it.
 *
 * @param {Object[]} articles - Articles to count.
 * @param {function(Object): string[]} valuesOf - Facet values of one article.
 * @param {string|null} [selected] - Currently selected value.
 * @returns {Array<{value: string, count: number}>} Facet values with counts.
 */
function countValues(articles, valuesOf, selected = null) {
  const counts = new Map();
  articles.forEach((article) => {
    valuesOf(article).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  });
  if (selected && !counts.has(selected)) counts.set(selected, 0);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

/**
 * Faceted counts for the filter rows. Tags and bands are read from the data,
 * so additions in the API show up as filters without manual updates.
 *
 * @param {Object[]} articles - Normalized articles of the snapshot on screen.
 * @param {{tag: string|null, band?: string|null, bands?: string[], newOnly: boolean}} filters - Active filters.
 * @returns {{tags: Array<{value: string, count: number}>, bands: Array<{value: string, count: number}>}}
 */
function facetCounts(articles, filters) {
  return {
    tags: countValues(
      articles.filter((article) => matchesFilters(article, filters, 'tag')),
      (article) => (article.tag ? [article.tag] : []),
      filters.tag
    ),
    bands: countValues(
      articles.filter((article) => matchesFilters(article, filters, 'band')),
      (article) => article.bands,
      null
    ),
  };
}

/**
 * Reads the view state from a query string.
 *
 * @param {string} search - `location.search`.
 * @returns {{snapshot: string, tag: string|null, bands: string[], band: string|null, newOnly: boolean}} View state.
 */
function parseState(search) {
  const params = new URLSearchParams(search);
  const rawBands = params.get('bands') || params.get('band');
  const bands = rawBands
    ? rawBands.split(',').map((s) => text(s)).filter(Boolean)
    : [];
  return {
    snapshot: text(params.get('snapshot')) || LATEST_KEY,
    tag: text(params.get('tag')) || null,
    bands: [...new Set(bands)],
    band: bands[0] || null,
    newOnly: params.get('new') === '1',
  };
}

/**
 * Writes the view state to a query string, leaving unrelated params alone.
 * Defaults are omitted so the plain page URL stays clean.
 *
 * @param {string} search - Current `location.search`.
 * @param {Object} state - View state.
 * @param {string} state.snapshot - Snapshot key.
 * @param {string|null} [state.tag] - Active category tag.
 * @param {string[]} [state.bands] - Active band names.
 * @param {boolean} [state.newOnly] - Show new updates only.
 * @returns {string} Query string including the leading '?', or ''.
 */
function serializeState(search, state) {
  const params = new URLSearchParams(search);
  const set = (name, value) => (value ? params.set(name, value) : params.delete(name));
  set('snapshot', state.snapshot !== LATEST_KEY ? state.snapshot : null);
  set('tag', state.tag);
  params.delete('band');
  const bands = getSelectedBands(state);
  set('bands', bands.length ? bands.join(',') : null);
  set('new', state.newOnly ? '1' : null);
  const query = params.toString();
  return query ? `?${query}` : '';
}

module.exports = {
  BASE_URL,
  LATEST_PATH,
  CATALOG_PATH,
  LATEST_KEY,
  createLoader,
  safeUrl,
  cleanSourceName,
  normalizeArticle,
  normalizeFeed,
  buildSnapshots,
  markNew,
  filterArticles,
  facetCounts,
  parseState,
  serializeState,
};
