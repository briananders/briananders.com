// -----------------------------------------------------------------------------
// Data access for the Last.fm listening dashboards.
//
// Every JSON file lives under /last-fm-history/ (built outside this repo and
// preserved on S3). This module owns the URL scheme, an in-memory cache so a
// report is only requested once per page view, and the period arithmetic the
// dashboards need (date ranges, day counts, comparison periods).
// -----------------------------------------------------------------------------

const BASE_URL = '/last-fm-history/';
const DAY_MS = 24 * 60 * 60 * 1000;

const cache = new Map();

/**
 * Rolling windows published by the data pipeline, in display order. `baseline`
 * names the longer window each one is compared against ("vs your usual").
 */
const ROLLING_WINDOWS = [
  {
    key: 'last-7-days', short: '7D', label: 'Last 7 days', baseline: 'last-90-days',
  },
  {
    key: 'last-30-days', short: '30D', label: 'Last 30 days', baseline: 'last-12-months',
  },
  {
    key: 'last-90-days', short: '90D', label: 'Last 90 days', baseline: 'last-12-months',
  },
  {
    key: 'last-6-months', short: '6M', label: 'Last 6 months', baseline: 'last-2-years',
  },
  {
    key: 'last-12-months', short: '12M', label: 'Last 12 months', baseline: 'last-2-years',
  },
  {
    key: 'last-2-years', short: '2Y', label: 'Last 2 years', baseline: 'all-time',
  }
];

/**
 * Period types in the order the history dashboard offers them.
 */
const PERIOD_TYPES = [
  { key: 'all-time', label: 'All time' },
  { key: 'rolling', label: 'Rolling' },
  { key: 'year', label: 'Year' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'month', label: 'Month' },
  { key: 'week', label: 'Week' }
];

/**
 * Fetches and parses a JSON file under the Last.fm history directory. Results
 * (and in-flight promises) are cached by path, so concurrent callers share one
 * request.
 *
 * @param {string} path - Path relative to /last-fm-history/.
 * @returns {Promise<Object>} Parsed JSON. Rejects on HTTP or parse errors.
 */
function getJSON(path) {
  if (cache.has(path)) return cache.get(path);
  const request = fetch(`${BASE_URL}${path}`, { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(`${path} returned ${response.status}`);
      return response.json();
    })
    .catch((error) => {
      cache.delete(path);
      throw error;
    });
  cache.set(path, request);
  return request;
}

/**
 * Converts an artist or album name into the slug the data pipeline uses for
 * trend file names: lowercase, every character outside [a-z0-9 -] removed
 * (no accent folding — "Folie à deux" becomes "folie-deux"), whitespace and
 * hyphen runs collapsed to one hyphen.
 *
 * @param {string} name - Artist or album name.
 * @returns {string} URL-safe slug.
 */
function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-');
}

/**
 * Builds the trends path (without extension) for an artist, album, or year.
 *
 * @param {{ kind: string, artist?: string, album?: string, year?: number }} item
 * @returns {string} e.g. "artists/the-beatles", "albums/tool/aenima", "years/2024".
 */
function trendPath(item) {
  if (item.kind === 'year') return `years/${item.year}`;
  if (item.kind === 'album') return `albums/${slugify(item.artist)}/${slugify(item.album)}`;
  return `artists/${slugify(item.artist)}`;
}

/**
 * Validates a `?trends=` value and turns it back into a trend descriptor.
 *
 * @param {string|null} value - Raw query parameter.
 * @returns {{ kind: string, path: string, year?: number }|null} Descriptor or null.
 */
function parseTrendPath(value) {
  if (!value) return null;
  const clean = String(value).trim().replace(/^\/+/, '').replace(/\.\./g, '');
  const year = clean.match(/^years\/(\d{4})$/);
  if (year && Number(year[1]) >= 2000) return { kind: 'year', path: clean, year: Number(year[1]) };
  if (/^artists\/[^/]+$/.test(clean)) return { kind: 'artist', path: clean };
  if (/^albums\/[^/]+\/[^/]+$/.test(clean)) return { kind: 'album', path: clean };
  return null;
}

/**
 * Full URL for an artist/album image hash. `api-image` swaps the extension
 * for AVIF/WebP/JPG sources.
 *
 * @param {string} hash - Image hash from a report.
 * @returns {string|null} Image URL or null when no hash is present.
 */
function imageUrl(hash) {
  return hash ? `${BASE_URL}images/${hash}` : null;
}

/**
 * Parses a YYYY-MM-DD string as a UTC date.
 *
 * @param {string} value - ISO calendar date.
 * @returns {Date} UTC midnight of that day.
 */
function utcDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Monday of ISO week `week` in ISO week-year `year`, as UTC midnight.
 *
 * @param {number} year - ISO week-numbering year.
 * @param {number} week - ISO week number (1-53).
 * @returns {Date} Start of the week.
 */
function isoWeekStart(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Weekday = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4.getTime() - (jan4Weekday - 1) * DAY_MS);
  return new Date(week1Monday.getTime() + (week - 1) * 7 * DAY_MS);
}

/**
 * Resolves the calendar span a report covers. Rolling reports carry their own
 * dates; calendar reports only carry a period key, so the span is derived.
 * Spans are clipped to `asOf` so a year/month still in progress is measured
 * by the days that have actually elapsed.
 *
 * @param {Object} report - Report JSON (`period`, optional `startDate`/`endDate`).
 * @param {string} type - Report type (rolling, year, quarter, month, week, all-time).
 * @param {Date} [asOf=new Date()] - Data freshness date.
 * @returns {{ start: Date, end: Date, days: number, partial: boolean }|null} Span,
 *   or null for all-time. `partial` marks a calendar period still in progress.
 */
function periodSpan(report, type, asOf = new Date()) {
  if (!report || type === 'all-time') return null;
  let start;
  let end;
  if (report.startDate && report.endDate) {
    start = utcDate(report.startDate);
    end = utcDate(report.endDate);
    const days = Math.max(1, Math.round((end - start) / DAY_MS));
    return {
      start, end, days, partial: false,
    };
  }
  const key = String(report.period);
  if (type === 'year') {
    const y = Number(key);
    start = new Date(Date.UTC(y, 0, 1));
    end = new Date(Date.UTC(y, 11, 31));
  } else if (type === 'quarter') {
    const [, y, q] = key.match(/^(\d{4})-Q(\d)$/).map(Number);
    start = new Date(Date.UTC(y, (q - 1) * 3, 1));
    end = new Date(Date.UTC(y, q * 3, 0));
  } else if (type === 'month') {
    const [y, m] = key.split('-').map(Number);
    start = new Date(Date.UTC(y, m - 1, 1));
    end = new Date(Date.UTC(y, m, 0));
  } else if (type === 'week') {
    const [, y, w] = key.match(/^(\d{4})-W(\d{1,2})$/).map(Number);
    start = isoWeekStart(y, w);
    end = new Date(start.getTime() + 6 * DAY_MS);
  } else {
    return null;
  }
  const today = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  const partial = end > today;
  if (partial) end = today;
  const days = Math.max(1, Math.round((end - start) / DAY_MS) + 1);
  return {
    start, end, days, partial,
  };
}

/**
 * Period slug used in URLs: the report filename without type prefix or
 * extension ("year_2024.json" → "2024", "all_time.json" → "all-time").
 *
 * @param {string} filename - Report filename from reports/index.json.
 * @param {string} type - Report type.
 * @returns {string} Period slug.
 */
function periodSlug(filename, type) {
  if (type === 'all-time') return 'all-time';
  return String(filename || '').replace(/\.json$/i, '').replace(new RegExp(`^${type}_`), '');
}

/**
 * Report entries for a type, newest first.
 *
 * @param {Object} index - Parsed reports/index.json.
 * @param {string} type - Report type.
 * @returns {Array<Object>} Sorted index entries.
 */
function reportsOfType(index, type) {
  const list = (index && index.reports && index.reports[type]) || [];
  if (type === 'rolling') {
    return list.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }
  return list.slice().sort((a, b) => (a.filename < b.filename ? 1 : -1));
}

/**
 * Picks the report a period is compared against: the previous period of the
 * same type for calendar periods, the longer "usual" window for rolling
 * windows, nothing for all time.
 *
 * @param {Object} index - Parsed reports/index.json (may be null for rolling).
 * @param {string} type - Report type.
 * @param {string} slug - Period slug.
 * @returns {{ filename: string, label: string, type: string }|null} Comparison entry.
 */
function comparisonFor(index, type, slug) {
  if (type === 'all-time') return null;
  if (type === 'rolling') {
    const win = ROLLING_WINDOWS.find((w) => w.key === slug);
    if (!win) return null;
    if (win.baseline === 'all-time') return { filename: 'all_time.json', label: 'all time', type: 'all-time' };
    const base = ROLLING_WINDOWS.find((w) => w.key === win.baseline);
    return { filename: `rolling_${base.key}.json`, label: base.label.toLowerCase(), type: 'rolling' };
  }
  const list = reportsOfType(index, type);
  const at = list.findIndex((entry) => periodSlug(entry.filename, type) === slug);
  if (at === -1 || at === list.length - 1) return null;
  const prev = list[at + 1];
  return { filename: prev.filename, label: prev.label, type };
}

module.exports = {
  BASE_URL,
  PERIOD_TYPES,
  ROLLING_WINDOWS,
  comparisonFor,
  getJSON,
  imageUrl,
  isoWeekStart,
  parseTrendPath,
  periodSlug,
  periodSpan,
  reportsOfType,
  slugify,
  trendPath,
  /** Drops every cached response (a fresh page view; used by tests). */
  clearCache: () => cache.clear(),
  /** @returns {Promise<Object>} reports/index.json */
  getIndex: () => getJSON('reports/index.json'),
  /** @returns {Promise<Object>} reports/year_totals.json */
  getYearTotals: () => getJSON('reports/year_totals.json'),
  /** @returns {Promise<Object>} reports/last_updated.json */
  getLastUpdated: () => getJSON('reports/last_updated.json'),
  /**
   * @param {string} filename - Report filename from the index.
   * @returns {Promise<Object>} Report JSON.
   */
  getReport: (filename) => getJSON(`reports/${filename}`),
  /**
   * @param {string} path - Trends path without extension.
   * @returns {Promise<Object>} Trend JSON with a `months` array.
   */
  getTrend: (path) => getJSON(`trends/${path}.json`),
};
