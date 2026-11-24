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

export interface RawSource {
  title?: unknown;
  link?: unknown;
  source?: unknown;
  published?: unknown;
}

export interface NormalizedSource {
  title: string;
  link: string;
  source: string;
  published: string | null;
}

export interface RawArticle {
  title?: unknown;
  link?: unknown;
  summary?: unknown;
  published?: unknown;
  published_formatted?: unknown;
  source?: unknown;
  matched_bands?: unknown;
  image_url?: unknown;
  tag?: unknown;
  sources?: unknown;
}

export interface NormalizedArticle {
  title: string;
  link: string;
  summary: string;
  published: string | null;
  publishedFormatted: string;
  source: string;
  bands: string[];
  imageUrl: string | null;
  tag: string | null;
  sources: NormalizedSource[];
  isNew: boolean;
}

export interface RawFeed {
  generated_at?: unknown;
  bands_tracked?: unknown;
  feeds_checked?: unknown;
  bands_list?: unknown;
  articles?: unknown;
}

export interface NormalizedFeed {
  generatedAt: string | null;
  bandsTracked: number;
  feedsChecked: number;
  bandsList: string[];
  articles: NormalizedArticle[];
}

export interface RawCatalogEntry {
  date?: unknown;
  path?: unknown;
  generated_at?: unknown;
  article_count?: unknown;
}

export interface RawCatalog {
  history?: unknown;
}

export interface SnapshotEntry {
  key: string;
  path: string;
  generatedAt: string | null;
  articleCount: number;
  isLatest: boolean;
}

export interface SnapshotComparison {
  snapshot: SnapshotEntry;
  newCount: number;
}

export interface BandNewsFilters {
  tag: string | null;
  band?: string | null;
  bands?: string[];
  newOnly?: boolean;
}

export interface FacetCountItem {
  value: string;
  count: number;
}

export interface FacetCounts {
  tags: FacetCountItem[];
  bands: FacetCountItem[];
}

export interface BandNewsViewState {
  snapshot: string;
  tag: string | null;
  bands: string[];
  band: string | null;
  newOnly: boolean;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export type FetchLike = (url: string) => Promise<FetchResponseLike> | FetchResponseLike;

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
 * @param {FetchLike} [fetchImpl] - `fetch`-compatible function (injectable for tests).
 * @returns {(path: string) => Promise<unknown>} Loads `BASE_URL + path` as JSON.
 */
function createLoader(fetchImpl: FetchLike = (url: string) => fetch(url)): (path: string) => Promise<unknown> {
  const cache = new Map<string, Promise<unknown>>();
  return function load(path: string): Promise<unknown> {
    if (!cache.has(path)) {
      const request = Promise.resolve(fetchImpl(`${BASE_URL}${path}`)).then((response) => {
        if (!response.ok) throw new Error(`${BASE_URL}${path}: HTTP ${response.status}`);
        return response.json();
      });
      request.catch(() => cache.delete(path));
      cache.set(path, request);
    }
    return cache.get(path)!;
  };
}

/**
 * Returns the string trimmed, or '' for anything that isn't a string.
 *
 * @param {unknown} value - Raw value from the feed.
 * @returns {string} Trimmed string.
 */
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Returns the URL if it is an absolute http(s) URL, else null. Feed links come
 * from scraped RSS, so `javascript:` and other schemes are never rendered.
 *
 * @param {unknown} value - Raw URL from the feed.
 * @returns {string|null} The URL, or null when unusable.
 */
function safeUrl(value: unknown): string | null {
  const url = text(value);
  return /^https?:\/\//i.test(url) ? url : null;
}

/**
 * Publisher names scraped from page titles sometimes keep a dangling
 * separator ("The Guide Liverpool |", "Distorted Sound Magazine -").
 *
 * @param {unknown} value - Raw publisher name.
 * @returns {string} The name without a trailing separator.
 */
function cleanSourceName(value: unknown): string {
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
function timeValue(iso: string | null): number {
  if (!iso) return -Infinity;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? -Infinity : ms;
}

/**
 * Normalizes one source entry; returns null when it has no usable link.
 *
 * @param {unknown} raw - `sources[]` entry (or the article itself for old feeds).
 * @returns {NormalizedSource|null}
 */
function normalizeSource(raw: unknown): NormalizedSource | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as RawSource;
  const link = safeUrl(record.link);
  if (!link) return null;
  return {
    title: text(record.title) || link,
    link,
    source: cleanSourceName(record.source),
    published: text(record.published) || null,
  };
}

/**
 * Normalizes one article into the shape the renderer uses. Feeds published
 * before the band-news API added `sources` get a one-entry list built from
 * the article's own `link`/`source`, and a missing `tag` becomes null.
 *
 * @param {unknown} raw - Entry from a feed's `articles` array.
 * @returns {NormalizedArticle|null} Normalized article, or null when it can't be rendered.
 */
function normalizeArticle(raw: unknown): NormalizedArticle | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as RawArticle;
  const title = text(record.title);
  const rawSources: unknown[] = Array.isArray(record.sources) && record.sources.length ? record.sources : [record];
  const sources = rawSources
    .map(normalizeSource)
    .filter((source): source is NormalizedSource => source !== null);
  const link = safeUrl(record.link) || (sources[0] && sources[0].link);
  if (!title || !link) return null;

  return {
    title,
    link,
    summary: text(record.summary),
    published: text(record.published) || null,
    publishedFormatted: text(record.published_formatted),
    source: cleanSourceName(record.source) || (sources[0] && sources[0].source) || '',
    bands: [...new Set((Array.isArray(record.matched_bands) ? record.matched_bands : []).map(text).filter(Boolean))],
    imageUrl: safeUrl(record.image_url),
    tag: text(record.tag) || null,
    sources,
    isNew: false,
  };
}

/**
 * Normalizes a whole feed (articles.json or a history snapshot). Articles are
 * sorted newest first; the sort is stable so same-time items keep feed order.
 *
 * @param {unknown} raw - Parsed feed JSON.
 * @returns {NormalizedFeed} Normalized feed.
 */
function normalizeFeed(raw: unknown): NormalizedFeed {
  const feed: RawFeed = raw && typeof raw === 'object' ? (raw as RawFeed) : {};
  const articles = (Array.isArray(feed.articles) ? feed.articles : [])
    .map(normalizeArticle)
    .filter((article): article is NormalizedArticle => article !== null)
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
 * @param {NormalizedFeed} latestFeed - Normalized latest feed.
 * @param {unknown} catalog - Parsed catalog.json, or null when unavailable.
 * @returns {SnapshotEntry[]} Snapshots, newest first.
 */
function buildSnapshots(latestFeed: NormalizedFeed, catalog: unknown): SnapshotEntry[] {
  const latest: SnapshotEntry = {
    key: LATEST_KEY,
    path: LATEST_PATH,
    generatedAt: latestFeed.generatedAt,
    articleCount: latestFeed.articles.length,
    isLatest: true,
  };
  const seen = new Set<string>([LATEST_KEY]);
  const rawCatalog: RawCatalog | null = catalog && typeof catalog === 'object' ? (catalog as RawCatalog) : null;
  const rawHistory: unknown[] = rawCatalog && Array.isArray(rawCatalog.history) ? rawCatalog.history : [];
  const entries = rawHistory
    .filter((entry): entry is { date: string; path: string; generated_at?: unknown; article_count?: unknown } => {
      if (!entry || typeof entry !== 'object') return false;
      const item = entry as RawCatalogEntry;
      return typeof item.date === 'string'
        && typeof item.path === 'string'
        && DATE_KEY_PATTERN.test(item.date)
        && HISTORY_PATH_PATTERN.test(item.path)
        // An archive of the feed that is still live adds nothing to step back to.
        && !(latest.generatedAt && item.generated_at === latest.generatedAt);
    })
    .map((entry): SnapshotEntry => ({
      key: entry.date,
      path: entry.path,
      generatedAt: text(entry.generated_at) || null,
      articleCount: Number(entry.article_count) || 0,
      isLatest: false,
    }))
    .sort((a, b) => b.key.localeCompare(a.key))
    .filter((entry) => {
      if (seen.has(entry.key)) return false;
      seen.add(entry.key);
      return true;
    });

  return [latest, ...entries];
}

/**
 * Every link an article cites: its primary link plus each source's.
 *
 * @param {NormalizedArticle} article - Normalized article.
 * @returns {string[]} Links.
 */
function articleLinks(article: NormalizedArticle): string[] {
  return [article.link, ...article.sources.map((source) => source.link)];
}

/**
 * Flags the articles that weren't in the previous snapshot. An update counts as
 * seen when any link it cites appeared in the previous feed, so a story that
 * merely gained another source since then isn't reported as new.
 *
 * @param {NormalizedArticle[]} articles - Normalized articles of the snapshot on screen.
 * @param {NormalizedArticle[]|null} previousArticles - Normalized articles of the snapshot before it.
 * @returns {NormalizedArticle[]} Copies of `articles` with `isNew` set.
 */
function markNew(
  articles: NormalizedArticle[],
  previousArticles: NormalizedArticle[] | null
): NormalizedArticle[] {
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
 * @param {BandNewsFilters} filters - Active filters.
 * @returns {string[]} Array of selected band names.
 */
function getSelectedBands(filters: BandNewsFilters): string[] {
  if (Array.isArray(filters.bands)) return filters.bands;
  if (filters.band) return [filters.band];
  return [];
}

/**
 * Whether an article passes the active filters. `skip` leaves one facet out,
 * which is how each filter row counts against the *other* active filters.
 *
 * @param {NormalizedArticle} article - Normalized article.
 * @param {BandNewsFilters} filters - Active filters.
 * @param {'tag'|'band'} [skip] - Facet to ignore.
 * @returns {boolean} True when the article matches.
 */
function matchesFilters(article: NormalizedArticle, filters: BandNewsFilters, skip?: 'tag' | 'band'): boolean {
  if (skip !== 'tag' && filters.tag && article.tag !== filters.tag) return false;
  const bands = getSelectedBands(filters);
  if (skip !== 'band' && bands.length > 0) {
    if (!bands.some((band) => article.bands.includes(band))) return false;
  }
  if (filters.newOnly && !article.isNew) return false;
  return true;
}

/**
 * @param {NormalizedArticle[]} articles - Normalized articles.
 * @param {BandNewsFilters} filters - Active filters.
 * @returns {NormalizedArticle[]} Articles matching every active filter.
 */
function filterArticles(articles: NormalizedArticle[], filters: BandNewsFilters): NormalizedArticle[] {
  return articles.filter((article) => matchesFilters(article, filters));
}

/**
 * Counts each value of one facet across the articles, alphabetically.
 * The selected value is always listed (count 0 if needed) so it can be
 * deselected after switching to a snapshot that doesn't contain it.
 *
 * @param {NormalizedArticle[]} articles - Articles to count.
 * @param {(article: NormalizedArticle) => string[]} valuesOf - Facet values of one article.
 * @param {string|null} [selected] - Currently selected value.
 * @returns {FacetCountItem[]} Facet values with counts.
 */
function countValues(
  articles: NormalizedArticle[],
  valuesOf: (article: NormalizedArticle) => string[],
  selected: string | null = null
): FacetCountItem[] {
  const counts = new Map<string, number>();
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
 * @param {NormalizedArticle[]} articles - Normalized articles of the snapshot on screen.
 * @param {BandNewsFilters} filters - Active filters.
 * @returns {FacetCounts}
 */
function facetCounts(articles: NormalizedArticle[], filters: BandNewsFilters): FacetCounts {
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
 * @returns {BandNewsViewState} View state.
 */
function parseState(search: string): BandNewsViewState {
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
 * @param {BandNewsFilters & { snapshot: string }} state - View state.
 * @returns {string} Query string including the leading '?', or ''.
 */
function serializeState(search: string, state: BandNewsFilters & { snapshot: string }): string {
  const params = new URLSearchParams(search);
  const set = (name: string, value: string | null | undefined): void => {
    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }
  };
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
