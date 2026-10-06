import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const ejs = require('ejs');

// ── Browser globals ───────────────────────────────────────────────────────────
// The dashboard modules touch `document`/`window` only when called, so one
// JSDOM window is installed up front and its document reset per test.

const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://example.com/posts/last-fm-scrobbles/' });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Event = window.Event;
global.URL = window.URL;
global.URLSearchParams = window.URLSearchParams;
window.matchMedia = () => ({ matches: true });

// jsdom has no <dialog> behaviour. Model the parts the dashboard relies on;
// Escape-to-close is native browser behaviour and is not simulated here.
window.HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
window.HTMLDialogElement.prototype.close = function close() {
  if (!this.hasAttribute('open')) return;
  this.removeAttribute('open');
  this.dispatchEvent(new window.Event('close'));
};

const data = require('../src/js/_modules/last-fm/data.js');
const stats = require('../src/js/_modules/last-fm/stats.js');
const format = require('../src/js/_modules/last-fm/format.js');
const { niceScale } = require('../src/js/_modules/last-fm/charts.js');
const dashboard = require('../src/js/_modules/last-fm/dashboard.js');

const partial = readFileSync(new URL('../src/partials/last-fm-dashboard.ejs', import.meta.url), 'utf8');

// ── Fixtures ────────────────────────────────────────────────────────────────────

const artist = (name, count, image = `img-${name}`) => ({ name, count, image });
const album = (artistName, albumName, count) => ({
  artist: artistName, album: albumName, count, artistImage: 'a', albumImage: `cover-${albumName}`,
});

const report = (period, total, artists, albums, extra = {}) => ({
  period, totalScrobbles: total, artists, albums, ...extra,
});

const FIXTURES = {
  'reports/last_updated.json': { datetime: '2024-06-15T12:00:00Z', epoch: 1718452800 },
  'reports/index.json': {
    reports: {
      'all-time': [{ filename: 'all_time.json', type: 'all-time', label: 'All Time' }],
      rolling: data.ROLLING_WINDOWS.map((w, i) => ({ filename: `rolling_${w.key}.json`, type: 'rolling', label: w.label, sortOrder: i })),
      year: [2024, 2023, 2022].map((y) => ({ filename: `year_${y}.json`, type: 'year', year: y, label: String(y) })),
      month: ['2024-06', '2024-05'].map((m) => ({ filename: `month_${m}.json`, type: 'month', label: format.monthLabel(m, true) })),
    },
  },
  'reports/year_totals.json': { years: [{ year: 2024, total: 150 }, { year: 2022, total: 90 }, { year: 2023, total: 120 }] },
  'reports/all_time.json': report('all-time', 360, [artist('Coheed and Cambria', 120), artist('The Mars Volta', 60)], [album('Coheed and Cambria', 'In Keeping Secrets', 50)]),
  'reports/year_2024.json': report('2024', 150, [artist('Underoath', 50), artist('Coheed and Cambria', 30)], [album('Underoath', 'Define the Great Line', 25)]),
  'reports/year_2023.json': report('2023', 120, [artist('Coheed and Cambria', 60), artist('Paul Simon', 20)], [album('Paul Simon', 'Graceland', 18)]),
  'reports/year_2022.json': report('2022', 90, [artist('Paul Simon', 45)], [album('Paul Simon', 'Graceland', 30)]),
  'reports/month_2024-06.json': report('2024-06', 40, [artist('Nine Inch Nails', 20)], [album('Nine Inch Nails', 'The Fragile', 12)]),
  'reports/month_2024-05.json': report('2024-05', 31, [artist('Underoath', 10)], [album('Underoath', 'Erase Me', 9)]),
  'trends/years/2022.json': { year: 2022, months: [{ month: '2022-03', count: 90 }] },
  'trends/years/2023.json': { year: 2023, months: [{ month: '2023-01', count: 70 }, { month: '2023-07', count: 50 }] },
  'trends/years/2024.json': { year: 2024, months: [{ month: '2024-05', count: 31 }, { month: '2024-06', count: 40 }] },
  'trends/artists/underoath.json': { artist: 'Underoath', months: [{ month: '2023-02', count: 5 }, { month: '2024-05', count: 10 }], totalScrobbles: 15 },
};
data.ROLLING_WINDOWS.forEach((w) => {
  FIXTURES[`reports/rolling_${w.key}.json`] = report(w.key, 100, [artist('Underoath', 40), artist('The Beatles', 10)], [album('Underoath', 'Voyeurist', 20)], {
    // A real year for the 30-day window's baseline, so pace scaling is exercised.
    startDate: w.key === 'last-12-months' ? '2023-06-16' : '2024-05-16', endDate: '2024-06-15', label: w.label,
  });
});

let requests = [];
global.fetch = (url) => {
  requests.push(url);
  const key = url.replace(data.BASE_URL, '');
  if (!(key in FIXTURES)) return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error('404')) });
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(FIXTURES[key]))) });
};

/** Lets queued fetch promises and their render callbacks run. */
const settle = async (rounds = 12) => {
  for (let i = 0; i < rounds; i++) await new Promise((resolve) => { setTimeout(resolve, 0); });
};

/**
 * Renders the real dashboard partial into the page and boots it.
 *
 * @param {string} mode - 'recent' or 'history'.
 * @param {string} [search=''] - Initial query string.
 */
const mount = async (mode, search = '') => {
  window.history.replaceState(null, '', `/posts/test/${search}`);
  document.body.innerHTML = ejs.render(partial, { mode });
  data.clearCache();
  requests = [];
  dashboard.init();
  await settle();
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

// ── data.js ─────────────────────────────────────────────────────────────────────

describe('last-fm data', () => {
  test('slugify matches the pipeline’s trend file names', () => {
    // Every pair below was checked against the live /last-fm-history/trends/ files.
    const cases = {
      'Paul McCartney & Wings': 'paul-mccartney-wings',
      'Panic! at the Disco': 'panic-at-the-disco',
      'blink-182': 'blink-182',
      'Simon & Garfunkel': 'simon-garfunkel',
      'Heaven :x: Hell': 'heaven-x-hell',
      'The Beatles (The White Album)': 'the-beatles-the-white-album',
      "All's Well That Ends Well": 'alls-well-that-ends-well',
      'Everything You’ve Come To Expect': 'everything-youve-come-to-expect',
      'Folie à deux': 'folie-deux',
      '…Like Clockwork': 'like-clockwork',
      'Brilliant Adventure (1992 – 2001)': 'brilliant-adventure-1992-2001',
      'The 7” Singles': 'the-7-singles',
    };
    Object.entries(cases).forEach(([name, slug]) => assert.equal(data.slugify(name), slug, name));
  });

  test('trendPath builds artist, album, and year paths', () => {
    assert.equal(data.trendPath({ kind: 'artist', artist: 'Coheed and Cambria' }), 'artists/coheed-and-cambria');
    assert.equal(data.trendPath({ kind: 'album', artist: 'Tool', album: 'Ænima' }), 'albums/tool/nima');
    assert.equal(data.trendPath({ kind: 'year', year: 2024 }), 'years/2024');
  });

  test('parseTrendPath accepts the three trend shapes and rejects anything else', () => {
    assert.deepEqual(data.parseTrendPath('years/2023'), { kind: 'year', path: 'years/2023', year: 2023 });
    assert.equal(data.parseTrendPath('/artists/the-beatles').path, 'artists/the-beatles');
    assert.equal(data.parseTrendPath('albums/tool/nima').kind, 'album');
    assert.equal(data.parseTrendPath('../../etc/passwd'), null);
    assert.equal(data.parseTrendPath('albums/only-one-part'), null);
    assert.equal(data.parseTrendPath('years/99'), null);
    assert.equal(data.parseTrendPath(null), null);
  });

  test('periodSpan derives calendar spans and clips the period in progress', () => {
    const asOf = new Date('2026-09-29T19:00:00Z');
    const week = data.periodSpan({ period: '2026-W39' }, 'week', asOf);
    assert.equal(week.start.toISOString().slice(0, 10), '2026-09-21');
    assert.equal(week.end.toISOString().slice(0, 10), '2026-09-27');
    assert.equal(week.days, 7);
    assert.equal(week.partial, false, 'a finished week');
    assert.equal(data.periodSpan({ period: '2026-W40' }, 'week', asOf).partial, true, 'the week in progress');
    assert.equal(data.periodSpan({ period: '2026' }, 'year', asOf).partial, true);
    assert.equal(data.periodSpan({ startDate: '2026-08-30', endDate: '2026-09-29' }, 'rolling', asOf).partial, false, 'rolling windows are always whole');
    assert.equal(data.isoWeekStart(2021, 1).toISOString().slice(0, 10), '2021-01-04');
    assert.equal(data.isoWeekStart(2020, 53).toISOString().slice(0, 10), '2020-12-28');
    assert.equal(data.periodSpan({ period: '2026-09' }, 'month', asOf).days, 29, 'current month counts elapsed days');
    assert.equal(data.periodSpan({ period: '2024-02' }, 'month', asOf).days, 29, 'leap February');
    assert.equal(data.periodSpan({ period: '2025-Q4' }, 'quarter', asOf).days, 92);
    assert.equal(data.periodSpan({ period: '2025' }, 'year', asOf).days, 365);
    assert.equal(data.periodSpan({ startDate: '2026-08-30', endDate: '2026-09-29' }, 'rolling', asOf).days, 30);
    assert.equal(data.periodSpan({ period: 'all-time' }, 'all-time', asOf), null);
  });

  test('comparisonFor picks the previous period, the longer rolling window, or nothing', () => {
    const index = FIXTURES['reports/index.json'];
    assert.deepEqual(data.comparisonFor(index, 'year', '2024'), { filename: 'year_2023.json', label: '2023', type: 'year' });
    assert.equal(data.comparisonFor(index, 'year', '2022'), null, 'oldest period has nothing earlier');
    assert.equal(data.comparisonFor(index, 'rolling', 'last-30-days').filename, 'rolling_last-12-months.json');
    assert.equal(data.comparisonFor(index, 'rolling', 'last-30-days').label, 'last 12 months');
    assert.equal(data.comparisonFor(index, 'rolling', 'last-2-years').type, 'all-time');
    assert.equal(data.comparisonFor(index, 'all-time', 'all-time'), null);
  });

  test('periodSlug strips type prefixes and extensions', () => {
    assert.equal(data.periodSlug('week_2026-W39.json', 'week'), '2026-W39');
    assert.equal(data.periodSlug('rolling_last-7-days.json', 'rolling'), 'last-7-days');
    assert.equal(data.periodSlug('all_time.json', 'all-time'), 'all-time');
  });
});

// ── stats.js ────────────────────────────────────────────────────────────────────

describe('last-fm stats', () => {
  test('focusBands splits every scrobble into ordered bands', () => {
    const artists = Array.from({ length: 42 }, (_, i) => artist(`A${i}`, 50 - i));
    const r = report('x', 2000, artists, []);
    const bands = stats.focusBands(r, 'artists');
    assert.deepEqual(bands.map((b) => b.key), ['top1', 'top5', 'top10', 'top50', 'rest']);
    assert.equal(bands[0].value, 50);
    assert.equal(bands.reduce((sum, b) => sum + b.value, 0), 2000);
    assert.ok(Math.abs(bands.reduce((sum, b) => sum + b.share, 0) - 1) < 1e-9);
    assert.equal(stats.focusBands(report('x', 0, [], []), 'albums').every((b) => b.share === 0), true);
  });

  test('movers ranks risers then fallers by change in share and flags entries/exits', () => {
    const now = report('now', 100, [artist('Up', 40), artist('Steady', 20), artist('Fresh', 10)], []);
    const before = report('before', 200, [artist('Steady', 40), artist('Up', 20), artist('Gone', 60)], []);
    const rows = stats.movers(now, before, 8);
    // Steady holds 20% in both periods: no change, so not a mover.
    assert.deepEqual(rows.map((r) => r.name), ['Up', 'Fresh', 'Gone']);
    assert.ok(Math.abs(rows[0].delta - 0.3) < 1e-9, 'Up: 10% → 40%');
    assert.equal(rows.find((r) => r.name === 'Fresh').isNew, true);
    assert.equal(rows.find((r) => r.name === 'Gone').dropped, true);
    assert.equal(rows.find((r) => r.name === 'Gone').now, 0);
    assert.equal(stats.movers(now, before, 2).length, 2);
  });

  test('newAlbums counts albums absent from the comparison list', () => {
    const now = report('n', 1, [], [album('Paul Simon', 'Graceland', 5), album('Underoath', 'Lost in the Sound of Separation', 4)]);
    const before = report('b', 1, [], [album('paul simon', 'GRACELAND', 9)]);
    assert.equal(stats.newAlbums(now, before), 1);
  });

  test('compareCounts pairs each item with its comparison count, or null outside the top list', () => {
    const now = report('n', 1, [artist('Blink-182', 500), artist('Pixies', 40)], [album('Paul Simon', 'Graceland', 5)]);
    const before = report('b', 1, [artist('blink-182', 480)], [album('PAUL SIMON', 'graceland', 9)]);
    assert.deepEqual(stats.compareCounts(now, before), [480, null], 'names match case-insensitively');
    assert.deepEqual(stats.compareCounts(now, before, 'albums'), [9]);
    // Rolling windows read the longer window as a pace: 480 over 365 days ≈ 39 per 30.
    assert.deepEqual(stats.compareCounts(now, before, 'artists', 30 / 365), [39, null]);
  });

  test('fillMonths, trendFacts, and byYear build continuous series', () => {
    const series = stats.fillMonths([{ month: '2023-11', count: 4 }, { month: '2024-02', count: 9 }], undefined, '2024-03');
    assert.deepEqual(series.map((r) => r.month), ['2023-11', '2023-12', '2024-01', '2024-02', '2024-03']);
    assert.deepEqual(series.map((r) => r.value), [4, 0, 0, 9, 0]);
    assert.deepEqual(stats.trendFacts(series), {
      total: 13, peak: { month: '2024-02', value: 9 }, first: '2023-11', activeMonths: 2,
    });
    assert.deepEqual(stats.byYear(series), [{ year: 2023, value: 4 }, { year: 2024, value: 9 }]);
    assert.equal(stats.monthKey(new Date('2024-01-15T00:00:00Z'), -1), '2023-12');
    assert.equal(stats.monthKey(new Date('2024-01-15T00:00:00Z'), 23), '2025-12');
  });
});

// ── format.js + chart scale ──────────────────────────────────────────────────

describe('last-fm formatting', () => {
  test('numbers, deltas, and date ranges', () => {
    assert.equal(format.number(268699), '268,699');
    assert.equal(format.compact(950), '950');
    assert.equal(format.compact(37568), '37.6K');
    assert.equal(format.compact(268699), '269K');
    assert.equal(format.signedPercent(1.16), '+116%');
    assert.equal(format.signedPercent(-0.04), '−4%');
    assert.equal(format.signedPercent(0.001), '±0%');
    assert.equal(format.signedPoints(-0.174), '−17.4 pts');
    const span = { start: new Date('2025-12-29T00:00:00Z'), end: new Date('2026-01-04T00:00:00Z') };
    assert.equal(format.dateRange(span), 'Dec 29, 2025 – Jan 4, 2026');
  });

  test('niceScale lands on whole-number ticks for counts and fine ticks for shares', () => {
    const counts = { integers: true };
    assert.deepEqual(niceScale(1, 4, counts).ticks, [0, 1]);
    assert.deepEqual(niceScale(382, 4, counts), { max: 400, ticks: [0, 100, 200, 300, 400] });
    assert.deepEqual(niceScale(37568, 4, counts).ticks, [0, 10000, 20000, 30000, 40000]);
    // Shares of plays (the movers axis) must not be forced to whole numbers.
    assert.deepEqual(niceScale(0.076), { max: 0.08, ticks: [0, 0.02, 0.04, 0.06, 0.08] });
    [3, 7, 38, 5963, 268699].forEach((max) => {
      const scale = niceScale(max, 4, counts);
      assert.ok(scale.max >= max);
      assert.ok(scale.ticks.every(Number.isInteger), `integer ticks for ${max}`);
    });
  });

  test('monthPosition maps a date to a fractional month slot', () => {
    assert.equal(dashboard.monthPosition(new Date('2024-06-01T00:00:00Z'), '2024-05'), 1);
    assert.equal(dashboard.monthPosition(new Date('2024-06-30T00:00:00Z'), '2024-05', true), 2);
  });
});

// ── Dashboard integration ────────────────────────────────────────────────────

describe('listening dashboard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('history mode renders every panel for all time, including the long view', async () => {
    await mount('history');
    assert.equal($('[data-lfm="range"]').textContent, 'Mar 2022 – Jun 2024');
    assert.equal($$('.lfm-kpi').length, 4);
    assert.equal($('.lfm-kpi__value').textContent, '360');
    assert.equal($('.lfm-album__title').textContent, 'In Keeping Secrets');
    assert.equal($('.lfm-bars__name').textContent, 'Coheed and Cambria');
    assert.equal($$('.lfm-stack').length, 2, 'artist and album focus bars');
    // All time has no earlier period, so momentum compares the last 12 months with it.
    assert.match($('[data-lfm="movers-note"]').textContent, /Last 12 months vs all time/);
    assert.deepEqual($$('.lfm-cols__col').map((col) => col.dataset.key), ['2022', '2023', '2024']);
    assert.equal($$('.lfm-heat__row').length, 4, 'header + one row per year');
    assert.equal($('.lfm-heat__cell[data-month="2022-01"]'), null, 'months before the first scrobble are untracked');
    assert.equal($('.lfm-heat__cell[data-month="2024-07"]'), null, 'months after the data date are untracked');
    assert.ok($('.lfm-heat__cell[data-month="2023-02"]').classList.contains('is-zero'));
    assert.equal($$('.is-skeleton').length, 0);
    assert.equal($('[data-lfm="grid"]').getAttribute('aria-busy'), 'false');
  });

  test('selecting a year column loads that year against the one before it', async () => {
    await mount('history');
    $('.lfm-cols__col[data-key="2023"]').click();
    await settle();
    assert.equal(window.location.search, '?type=year&period=2023');
    assert.ok(requests.includes('/last-fm-history/reports/year_2023.json'));
    assert.ok(requests.includes('/last-fm-history/reports/year_2022.json'));
    assert.match($('[data-lfm="range"]').textContent, /Jan 1 – Dec 31, 2023 · 365 days · compared with 2022/);
    assert.equal($('.lfm-cols__col[data-key="2023"]').getAttribute('aria-pressed'), 'true');
    assert.ok($('.lfm-cols__col[data-key="2024"]').classList.contains('is-muted'));
    assert.equal($$('.lfm-heat__cell.is-selected').length, 12, 'every month of 2023');
    assert.equal($('.lfm-segment[aria-pressed="true"]').getAttribute('aria-label'), 'Year');
    assert.equal($('.lfm-stepper__select').value, '2023');
  });

  test('a heatmap cell loads its month', async () => {
    await mount('history');
    $('.lfm-heat__cell[data-month="2024-05"]').click();
    await settle();
    assert.equal(window.location.search, '?type=month&period=2024-05');
    assert.equal($('.lfm-kpi__value').textContent, '31');
  });

  test('changing period while a deep link is open keeps the trends slashes readable', async () => {
    await mount('history', '?type=year&period=1999&trends=artists/underoath');
    assert.equal(window.location.search, '?type=year&period=2024&trends=artists/underoath');
  });

  test('?trends=years/YYYY opens the year dialog; closing it clears the parameter', async () => {
    await mount('history', '?trends=years/2023');
    const dialog = $('dialog.lfm-dialog');
    assert.equal(dialog.hasAttribute('open'), true);
    assert.ok(requests.includes('/last-fm-history/trends/years/2023.json'));
    assert.equal($('.lfm-dialog__title').textContent, '2023');
    assert.equal(dialog.querySelectorAll('.lfm-cols__col').length, 12);
    assert.equal(dialog.querySelector('.lfm-facts dd').textContent, '120');
    dialog.close();
    assert.equal(window.location.search, '');
  });

  test('selecting an artist opens its history and records a readable URL', async () => {
    await mount('history', '?type=year&period=2024');
    $('.lfm-bars__row').click();
    await settle();
    assert.equal(window.location.search, '?type=year&period=2024&trends=artists/underoath');
    assert.ok(requests.includes('/last-fm-history/trends/artists/underoath.json'));
    assert.equal($('.lfm-dialog__title').textContent, 'Underoath');
    assert.equal($$('.lfm-dialog .lfm-facts dd')[0].textContent, '15');
  });

  test('recent mode defaults to 30 days and switches windows with their baseline', async () => {
    await mount('recent');
    assert.equal($('.lfm-segment[aria-pressed="true"]').getAttribute('aria-label'), 'Last 30 days');
    assert.ok(requests.includes('/last-fm-history/reports/rolling_last-30-days.json'));
    assert.ok(requests.includes('/last-fm-history/reports/rolling_last-12-months.json'));
    assert.equal($('.lfm-area__band') !== null, true, 'the selected window is shaded on the timeline');
    assert.equal($('[data-lfm="years"]'), null, 'no long-view panels on the recent page');

    $$('.lfm-segment')[0].click();
    await settle();
    assert.equal(window.location.search, '?period=last-7-days');
    assert.ok(requests.includes('/last-fm-history/reports/rolling_last-90-days.json'));
    assert.match($('[data-lfm="timeline-note"]').textContent, /Shaded: last 7 days/);
  });

  test('top lists compare each item with the previous period', async () => {
    await mount('history', '?type=year&period=2024');
    // 2024 is in progress on the data date (June 15), so it reads "so far".
    assert.equal($('[data-lfm="artists-note"]').textContent, 'Plays in 2024 so far, compared with 2023.');
    assert.equal($('[data-lfm="albums-note"]').hidden, false);
    assert.deepEqual($$('[data-lfm="artists"] .lfm-key li').map((li) => li.textContent), ['2024 so far', '2023']);
    const [underoath, coheed] = $$('.lfm-bars__row');
    assert.equal(underoath.getAttribute('aria-label'), '1. Underoath: 50 scrobbles in 2024 so far. Not in 2023’s top 2.');
    assert.equal(underoath.querySelector('.lfm-bars__was .lfm-badge').textContent, 'New');
    assert.equal(underoath.querySelector('.lfm-bars__then'), null, 'no tick without a count to mark');
    assert.equal(coheed.getAttribute('aria-label'), '2. Coheed and Cambria: 30 scrobbles in 2024 so far, compared with 60 in 2023.');
    assert.equal(coheed.querySelector('.lfm-bars__was').textContent, 'was 60');
    // The tick shares the bar scale: 60 is the largest value on screen.
    assert.equal(coheed.querySelector('.lfm-bars__then').style.getPropertyValue('--value'), '100%');
    assert.equal(coheed.querySelector('.lfm-bars__fill').style.getPropertyValue('--value'), '50%');
    assert.equal($('.lfm-album__count').textContent, '25 plays New', 'album outside the 2023 top list');

    $('.lfm-cols__col[data-key="2023"]').click();
    await settle();
    assert.equal($('[data-lfm="artists-note"]').textContent, 'Plays in 2023, compared with 2022.', 'a finished year');
    assert.equal($('.lfm-album__count').textContent, '18 plays · was 30');
  });

  test('rolling windows compare with the usual pace, and all time compares with nothing', async () => {
    await mount('recent');
    // 30 days against a 365-day baseline: 40 plays there is a usual 3 per 30 days.
    assert.equal($('[data-lfm="artists-note"]').textContent, 'Plays in the last 30 days. “Usual” is your pace over the last 12 months, scaled to 30 days.');
    assert.deepEqual($$('[data-lfm="artists"] .lfm-key li').map((li) => li.textContent), ['Last 30 days', 'Usual pace (last 12 months)']);
    assert.equal($('.lfm-bars__row').getAttribute('aria-label'), '1. Underoath: 40 scrobbles in the last 30 days, compared with a usual 3 at your pace over the last 12 months.');
    assert.equal($('.lfm-bars__was').textContent, 'usual 3');
    assert.equal($('.lfm-album__count').textContent, '20 plays · usual 2');

    await mount('history');
    assert.equal($('[data-lfm="artists-note"]').hidden, true);
    assert.equal($('.lfm-bars.has-compare'), null);
    assert.equal($('.lfm-bars__was'), null);
    assert.equal($('.lfm-bars__row').hasAttribute('aria-label'), false);
  });

  test('an unknown period in the URL falls back instead of breaking', async () => {
    await mount('history', '?type=year&period=1999');
    assert.equal(window.location.search, '?type=year&period=2024');
    await mount('recent', '?period=forever');
    assert.equal(window.location.search, '');
    assert.equal($('.lfm-segment[aria-pressed="true"]').getAttribute('aria-label'), 'Last 30 days');
  });
});
