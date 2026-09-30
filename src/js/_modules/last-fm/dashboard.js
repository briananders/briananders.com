// -----------------------------------------------------------------------------
// Last.fm listening dashboard controller.
//
// One controller drives both music pages; the template's `data-mode` picks
// which period controls and panels exist:
//
//   recent  — rolling windows (7D … 2Y), plus a 24-month context chart with
//             the selected window shaded.
//   history — every published period (all time, rolling, year, quarter,
//             month, week), plus year columns and a year × month heatmap
//             that double as period pickers.
//
// Every panel re-renders against the same selected period so the numbers
// always agree. URL state: ?type=&period= for the period, ?trends= for the
// drill-down dialog (both kept compatible with the previous pages' links).
// -----------------------------------------------------------------------------

const charts = require('./charts');
const createDetailDialog = require('./detail-dialog');
const data = require('./data');
const { h, replace } = require('./dom');
const format = require('./format');
const stats = require('./stats');

const DEFAULT_WINDOW = 'last-30-days';
const LIMITS = { albums: [9, 25], artists: [10, 25] };

/**
 * Upper-cases the first character.
 *
 * @param {string} text - Input.
 * @returns {string} Capitalised text.
 */
function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Month index of a date relative to a "YYYY-MM" origin, with the day as a
 * fraction so a 7-day window shades a sliver rather than a whole month.
 *
 * @param {Date} date - UTC date.
 * @param {string} origin - First month of the series.
 * @param {boolean} [endOfDay=false] - Measure to the end of the day.
 * @returns {number} Fractional month index.
 */
function monthPosition(date, origin, endOfDay = false) {
  const [oy, om] = origin.split('-').map(Number);
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const day = date.getUTCDate() - (endOfDay ? 0 : 1);
  return (y * 12 + m) - (oy * 12 + (om - 1)) + day / daysInMonth;
}

/**
 * Writes a URL to history with the slashes in `?trends=artists/…` left
 * readable (URLSearchParams encodes them as %2F; they're legal in a query).
 *
 * @param {URL} url - Target URL.
 * @param {'push'|'replace'} how - History method.
 * @param {Object|null} historyState - State object to store.
 */
function writeUrl(url, how, historyState) {
  url.search = url.search.replace(/%2F/gi, '/');
  window.history[`${how}State`](historyState, '', url);
}

/**
 * Re-renders a container, then puts focus back on the element that had it
 * (matched by data-key / data-month) so clicking a chart mark to change the
 * period doesn't throw keyboard users back to the top of the page.
 *
 * @param {HTMLElement} container - Region being re-rendered.
 * @param {function(): void} render - Render callback.
 */
function preserveFocus(container, render) {
  const active = document.activeElement;
  const key = active && container.contains(active) && (active.dataset.key || active.dataset.month);
  render();
  if (!key) return;
  const next = container.querySelector(`[data-key="${key}"], [data-month="${key}"]`);
  if (next) {
    next.tabIndex = 0;
    next.focus({ preventScroll: true });
  }
}

/**
 * Boots a dashboard root element.
 *
 * @param {HTMLElement} root - Element with `data-lfm-dashboard`.
 */
function initDashboard(root) {
  const mode = root.dataset.mode === 'history' ? 'history' : 'recent';
  const $ = (name) => root.querySelector(`[data-lfm="${name}"]`);
  const els = {
    grid: $('grid'),
    periods: $('periods'),
    stepper: $('stepper'),
    range: $('range'),
    kpis: $('kpis'),
    albums: $('albums'),
    albumsToggle: $('albums-toggle'),
    artists: $('artists'),
    artistsToggle: $('artists-toggle'),
    focus: $('focus'),
    focusNote: $('focus-note'),
    movers: $('movers'),
    moversNote: $('movers-note'),
    timeline: $('timeline'),
    timelineNote: $('timeline-note'),
    years: $('years'),
    heatmap: $('heatmap'),
  };

  const state = {
    type: mode === 'recent' ? 'rolling' : 'all-time',
    slug: mode === 'recent' ? DEFAULT_WINDOW : 'all-time',
    index: null,
    asOf: new Date(),
    token: 0,
    limits: { albums: LIMITS.albums[0], artists: LIMITS.artists[0] },
    report: null,
    span: null,
    yearTotals: null,
    heatRows: null,
    timelineSeries: null,
  };

  // -- Drill-down dialog + ?trends= URL sync ----------------------------------

  const dialog = createDetailDialog({
    asOf: () => state.asOf,
    onClose: () => {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('trends')) return;
      if (window.history.state && window.history.state.lfmTrend) {
        window.history.back();
      } else {
        url.searchParams.delete('trends');
        writeUrl(url, 'replace', window.history.state);
      }
    },
  });

  /**
   * Opens the dialog for an artist, album, or year and records it in the URL.
   *
   * @param {Object} item - Trend descriptor (kind + names/year).
   */
  const openTrend = (item) => {
    const path = data.trendPath(item);
    const url = new URL(window.location.href);
    url.searchParams.set('trends', path);
    writeUrl(url, 'push', { lfmTrend: path });
    dialog.open({ ...item, path });
  };

  const syncDialogToUrl = () => {
    const trend = data.parseTrendPath(new URLSearchParams(window.location.search).get('trends'));
    if (!trend) {
      dialog.close();
      return;
    }
    if (!dialog.isOpenFor(trend.path)) dialog.open(trend);
  };
  window.addEventListener('popstate', syncDialogToUrl);

  // -- Period model -------------------------------------------------------------

  const filenameFor = (type, slug) => (type === 'all-time' ? 'all_time.json' : `${type}_${slug}.json`);

  const periodsOf = (type) => {
    if (type === 'rolling') {
      return data.ROLLING_WINDOWS.map((w) => ({ slug: w.key, label: w.label, short: w.short }));
    }
    return data.reportsOfType(state.index, type).map((entry) => ({
      slug: data.periodSlug(entry.filename, type),
      label: entry.label,
    }));
  };

  const labelFor = (type, slug) => {
    if (type === 'all-time') return 'All time';
    const match = periodsOf(type).find((p) => p.slug === slug);
    return match ? match.label : slug;
  };

  let allTimeSpanPromise = null;
  /**
   * All-time reports carry no dates; derive the span from the first month
   * with scrobbles in the earliest year's trend file.
   *
   * @returns {Promise<{start: Date, end: Date, days: number}|null>} Span.
   */
  const allTimeSpan = () => {
    if (!allTimeSpanPromise) {
      allTimeSpanPromise = data.getYearTotals()
        .then((totals) => data.getTrend(`years/${Math.min(...totals.years.map((y) => y.year))}`))
        .then((trend) => {
          const first = stats.fillMonths(trend.months).find((row) => row.value > 0);
          const [y, m] = first.month.split('-').map(Number);
          const start = new Date(Date.UTC(y, m - 1, 1));
          const end = state.asOf;
          return { start, end, days: Math.max(1, Math.round((end - start) / 86400000)) };
        })
        .catch(() => null);
    }
    return allTimeSpanPromise;
  };

  const spanFor = (report, type) => (type === 'all-time'
    ? allTimeSpan()
    : Promise.resolve(data.periodSpan(report, type, state.asOf)));

  // -- URL <-> period ---------------------------------------------------------

  const writePeriodToUrl = () => {
    const url = new URL(window.location.href);
    if (mode === 'history') {
      if (state.type === 'all-time') {
        url.searchParams.delete('type');
        url.searchParams.delete('period');
      } else {
        url.searchParams.set('type', state.type);
        url.searchParams.set('period', state.slug);
      }
    } else if (state.slug === DEFAULT_WINDOW) {
      url.searchParams.delete('period');
    } else {
      url.searchParams.set('period', state.slug);
    }
    writeUrl(url, 'replace', window.history.state);
  };

  /**
   * Resolves the requested period against what the data actually offers,
   * falling back to the newest period of a type (or the default window).
   *
   * @param {string} type - Requested type.
   * @param {string|null} slug - Requested slug.
   * @returns {{type: string, slug: string}} Valid period.
   */
  const resolvePeriod = (type, slug) => {
    if (mode === 'recent') {
      const ok = data.ROLLING_WINDOWS.some((w) => w.key === slug);
      return { type: 'rolling', slug: ok ? slug : DEFAULT_WINDOW };
    }
    if (!data.PERIOD_TYPES.some((t) => t.key === type) || type === 'all-time') return { type: 'all-time', slug: 'all-time' };
    const options = periodsOf(type);
    if (!options.length) return { type: 'all-time', slug: 'all-time' };
    return { type, slug: options.some((p) => p.slug === slug) ? slug : options[0].slug };
  };

  // -- Toolbar ------------------------------------------------------------------

  const renderToolbar = () => {
    const segments = mode === 'recent'
      ? data.ROLLING_WINDOWS.map((w) => ({
        key: w.key, long: w.label.replace('Last ', ''), short: w.short, pressed: state.slug === w.key, label: w.label,
      }))
      : data.PERIOD_TYPES.map((t) => ({
        key: t.key, long: t.label, short: t.label, pressed: state.type === t.key, label: t.label,
      }));
    replace(els.periods, segments.map((seg) => h('button', {
      type: 'button',
      class: 'lfm-segment',
      'aria-pressed': String(seg.pressed),
      'aria-label': seg.label,
      onclick: () => {
        if (mode === 'recent') selectPeriod('rolling', seg.key);
        else if (seg.key !== state.type) selectPeriod(seg.key, null);
      },
    }, [
      h('span', { class: 'lfm-segment__long', text: seg.long }),
      h('span', { class: 'lfm-segment__short', text: seg.short })
    ])));

    if (!els.stepper) return;
    els.stepper.hidden = state.type === 'all-time';
    if (state.type === 'all-time') return;
    const options = periodsOf(state.type);
    const at = options.findIndex((p) => p.slug === state.slug);
    const select = h('select', {
      class: 'lfm-stepper__select',
      id: 'lfm-period',
      'aria-label': `${capitalize(state.type)} to show`,
      onchange: (event) => selectPeriod(state.type, event.target.value),
    }, options.map((p) => h('option', { value: p.slug, selected: p.slug === state.slug, text: p.label })));
    replace(els.stepper, [
      h('button', {
        type: 'button',
        class: 'button lfm-stepper__step',
        'aria-label': 'Previous period',
        disabled: at >= options.length - 1,
        onclick: () => selectPeriod(state.type, options[at + 1].slug),
      }, '‹'),
      select,
      h('button', {
        type: 'button',
        class: 'button lfm-stepper__step',
        'aria-label': 'Next period',
        disabled: at <= 0,
        onclick: () => selectPeriod(state.type, options[at - 1].slug),
      }, '›')
    ]);
  };

  // -- Panels -------------------------------------------------------------------

  const renderKpis = (report, span, comparison, compSpan, comp) => {
    const now = stats.summarize(report, span);
    const before = comparison ? stats.summarize(comparison, compSpan) : null;
    const vs = comp ? `vs ${comp.label}` : '';
    const direction = (value) => {
      if (Math.abs(value) < 0.005) return 'flat';
      return value > 0 ? 'up' : 'down';
    };
    const tiles = [
      {
        label: 'Scrobbles',
        value: format.number(now.total),
        sub: span ? `over ${format.number(span.days)} days` : null,
      },
      {
        label: 'Per day',
        value: now.perDay === null ? '—' : format.number(now.perDay),
        delta: before && before.perDay && now.perDay !== null ? {
          dir: direction(now.perDay / before.perDay - 1),
          text: format.signedPercent(now.perDay / before.perDay - 1),
          note: vs,
        } : null,
        sub: before ? null : 'average scrobbles',
      },
      {
        label: 'Top 10 artists',
        value: format.percent(now.top10Share),
        delta: before ? {
          dir: direction(now.top10Share - before.top10Share),
          text: format.signedPoints(now.top10Share - before.top10Share),
          note: vs,
        } : null,
        sub: before ? null : 'share of all plays',
      }
    ];
    if (comparison) {
      tiles.push({
        label: 'New albums',
        value: String(stats.newAlbums(report, comparison)),
        sub: `of the top ${(report.albums || []).length} are new ${vs}`,
      });
    } else {
      tiles.push({
        label: 'Years tracked',
        value: span ? (span.days / 365.25).toFixed(1) : '—',
        sub: span ? `since ${format.monthLabel(stats.monthKey(span.start), true)}` : null,
      });
    }
    charts.kpiTiles(els.kpis, tiles);
  };

  const renderAlbums = (report) => {
    charts.albumGrid(els.albums, report.albums || [], {
      limit: state.limits.albums,
      onSelect: (album) => openTrend({
        kind: 'album', artist: album.artist, album: album.album, image: album.albumImage,
      }),
    });
    const [few, many] = LIMITS.albums;
    els.albumsToggle.hidden = (report.albums || []).length <= few;
    els.albumsToggle.textContent = state.limits.albums === few ? `Show top ${many}` : `Show top ${few}`;
    els.albumsToggle.setAttribute('aria-expanded', String(state.limits.albums !== few));
  };

  const renderArtists = (report) => {
    charts.artistBars(els.artists, report.artists || [], {
      limit: state.limits.artists,
      onSelect: (artist) => openTrend({ kind: 'artist', artist: artist.name, image: artist.image }),
    });
    const [few, many] = LIMITS.artists;
    els.artistsToggle.hidden = (report.artists || []).length <= few;
    els.artistsToggle.textContent = state.limits.artists === few ? `Show top ${many}` : `Show top ${few}`;
    els.artistsToggle.setAttribute('aria-expanded', String(state.limits.artists !== few));
  };

  /**
   * Movers compare the period with its comparison. All time has nothing
   * earlier, so it flips the question: the last 12 months against the
   * lifetime baseline.
   *
   * @param {Object} report - Selected report.
   * @param {Object|null} comparison - Comparison report.
   * @param {Object|null} comp - Comparison descriptor.
   * @param {Object|null} recent - Last-12-months report (all time only).
   */
  const renderMovers = (report, comparison, comp, recent) => {
    let now = report;
    let before = comparison;
    let nowLabel = labelFor(state.type, state.slug);
    let vsLabel = comp ? comp.label : '';
    if (!comparison && recent) {
      now = recent;
      before = report;
      nowLabel = 'Last 12 months';
      vsLabel = 'all time';
    }
    if (!before) {
      els.moversNote.textContent = '';
      replace(els.movers, h('p', { class: 'lfm-status', text: 'Nothing to compare this period with.' }));
      return;
    }
    const rows = stats.movers(now, before, 8);
    els.moversNote.textContent = `Change in share of plays: ${nowLabel} vs ${vsLabel}.`;
    if (!rows.length) {
      replace(els.movers, h('p', { class: 'lfm-status', text: 'No change worth charting.' }));
      return;
    }
    charts.dumbbell(els.movers, rows, { nowLabel, beforeLabel: capitalize(vsLabel) });
  };

  /**
   * Period picks from the long-view charts happen at the bottom of the page;
   * bring the toolbar back into view so the reader sees what loaded.
   *
   * @param {string} type - Report type.
   * @param {string} slug - Period slug.
   */
  const selectFromChart = (type, slug) => {
    selectPeriod(type, slug);
    const toolbar = root.querySelector('.lfm-toolbar');
    if (toolbar && toolbar.getBoundingClientRect().top < 0) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      toolbar.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  };

  const renderYears = (span) => {
    if (!els.years || !state.yearTotals) return;
    const first = span ? span.start.getUTCFullYear() : null;
    const last = span ? span.end.getUTCFullYear() : null;
    const currentYear = state.asOf.getUTCFullYear();
    const rows = state.yearTotals.map((row) => ({
      key: String(row.year),
      label: String(row.year),
      short: `’${String(row.year).slice(2)}`,
      value: row.total,
      note: row.year === currentYear ? 'Year to date' : null,
    }));
    preserveFocus(els.years, () => {
      charts.columns(els.years, rows, {
        isEmphasized: state.type === 'all-time' ? null : (d) => Number(d.key) >= first && Number(d.key) <= last,
        onSelect: (d) => selectFromChart('year', d.key),
        labelHeader: 'Year',
      });
      els.years.querySelectorAll('.lfm-cols__col').forEach((col, i) => { col.dataset.key = rows[i].key; });
    });
  };

  const renderHeatmap = (span) => {
    if (!els.heatmap || !state.heatRows) return;
    const from = span && state.type !== 'all-time' ? stats.monthKey(span.start) : null;
    const to = span && state.type !== 'all-time' ? stats.monthKey(span.end) : null;
    const monthExists = new Set(periodsOf('month').map((p) => p.slug));
    preserveFocus(els.heatmap, () => {
      charts.heatmap(els.heatmap, state.heatRows, {
        isSelected: (key) => !!from && key >= from && key <= to,
        onSelect: (key) => { if (monthExists.has(key)) selectFromChart('month', key); },
        onSelectYear: (year) => selectFromChart('year', String(year)),
      });
    });
  };

  const renderTimeline = (span) => {
    if (!els.timeline || !state.timelineSeries) return;
    const series = state.timelineSeries;
    const origin = series[0].month;
    const band = span
      ? { from: monthPosition(span.start, origin), to: monthPosition(span.end, origin, true) }
      : null;
    const label = labelFor(state.type, state.slug);
    els.timelineNote.textContent = `Scrobbles per month. Shaded: ${label.toLowerCase()}.`;
    charts.areaChart(els.timeline, series, { band, bandLabel: label });
  };

  const renderRange = (span, comp) => {
    const parts = [];
    if (state.type === 'all-time') {
      if (span) parts.push(`${format.monthLabel(stats.monthKey(span.start))} – ${format.monthLabel(stats.monthKey(span.end))}`);
    } else if (span) {
      parts.push(format.dateRange(span));
      parts.push(`${format.number(span.days)} days`);
    }
    if (comp) parts.push(`compared with ${comp.label}`);
    els.range.textContent = parts.join(' · ');
  };

  /**
   * Loads a period (plus its comparison) and re-renders every panel.
   *
   * @param {string} type - Report type.
   * @param {string|null} slug - Period slug (null = newest of that type).
   */
  const selectPeriod = async (type, slug) => {
    ({ type: state.type, slug: state.slug } = resolvePeriod(type, slug));
    const request = ++state.token;
    writePeriodToUrl();
    renderToolbar();
    const comp = data.comparisonFor(state.index, state.type, state.slug);
    els.grid.classList.add('is-refreshing');
    els.grid.setAttribute('aria-busy', 'true');
    try {
      const [report, comparison, recent] = await Promise.all([
        data.getReport(filenameFor(state.type, state.slug)),
        comp ? data.getReport(comp.filename).catch(() => null) : null,
        state.type === 'all-time' ? data.getReport('rolling_last-12-months.json').catch(() => null) : null
      ]);
      const [span, compSpan] = await Promise.all([
        spanFor(report, state.type),
        comparison ? spanFor(comparison, comp.type) : null
      ]);
      if (request !== state.token) return;
      state.report = report;
      state.span = span;
      renderRange(span, comparison ? comp : null);
      renderKpis(report, span, comparison, compSpan, comparison ? comp : null);
      renderAlbums(report);
      renderArtists(report);
      els.focusNote.textContent = `Share of ${format.number(report.totalScrobbles)} scrobbles, by chart position.`;
      charts.focusBars(els.focus, [
        { label: 'Artists', bands: stats.focusBands(report, 'artists') },
        { label: 'Albums', bands: stats.focusBands(report, 'albums') }
      ]);
      renderMovers(report, comparison, comparison ? comp : null, recent);
      renderYears(span);
      renderHeatmap(span);
      renderTimeline(span);
      root.querySelectorAll('.is-skeleton').forEach((el) => el.classList.remove('is-skeleton'));
    } catch (error) {
      if (request !== state.token) return;
      els.range.textContent = 'That period couldn’t be loaded. Try another one.';
    } finally {
      if (request === state.token) {
        els.grid.classList.remove('is-refreshing');
        els.grid.setAttribute('aria-busy', 'false');
      }
    }
  };

  // -- Long-view data (loaded once) -------------------------------------------------

  const loadHistoryPanels = async () => {
    const totals = await data.getYearTotals();
    state.yearTotals = totals.years.slice().sort((a, b) => a.year - b.year);
    renderYears(state.span);
    const lastMonth = stats.monthKey(state.asOf);
    const trends = await Promise.all(state.yearTotals.map((row) => data.getTrend(`years/${row.year}`)
      .catch(() => ({ months: [] }))));
    const series = trends.map((trend, i) => stats.fillMonths(trend.months, `${state.yearTotals[i].year}-01`, `${state.yearTotals[i].year}-12`));
    // Months before the first scrobble and after the data's freshness date are
    // "not tracked" (null), which is different from a tracked month of zero.
    const first = (series.flat().find((m) => m.value > 0) || {}).month || '0000-00';
    state.heatRows = state.yearTotals.map((row, i) => ({
      year: row.year,
      months: series[i].map((m) => (m.month < first || m.month > lastMonth ? null : m.value)),
    })).reverse();
    renderHeatmap(state.span);
  };

  const loadTimeline = async () => {
    const end = stats.monthKey(state.asOf);
    const start = stats.monthKey(state.asOf, -23);
    const years = [];
    for (let y = Number(start.slice(0, 4)); y <= Number(end.slice(0, 4)); y++) years.push(y);
    const trends = await Promise.all(years.map((y) => data.getTrend(`years/${y}`).catch(() => ({ months: [] }))));
    state.timelineSeries = stats.fillMonths(trends.flatMap((t) => t.months || []), start, end);
    renderTimeline(state.span);
  };

  // -- Boot ---------------------------------------------------------------------

  els.albumsToggle.addEventListener('click', () => {
    const [few, many] = LIMITS.albums;
    state.limits.albums = state.limits.albums === few ? many : few;
    if (state.report) renderAlbums(state.report);
  });
  els.artistsToggle.addEventListener('click', () => {
    const [few, many] = LIMITS.artists;
    state.limits.artists = state.limits.artists === few ? many : few;
    if (state.report) renderArtists(state.report);
  });

  const boot = async () => {
    const lastUpdated = await data.getLastUpdated().catch(() => null);
    if (lastUpdated && lastUpdated.datetime) state.asOf = new Date(lastUpdated.datetime);
    if (mode === 'history') state.index = await data.getIndex().catch(() => null);
    const params = new URLSearchParams(window.location.search);
    selectPeriod(params.get('type') || state.type, params.get('period'));
    if (mode === 'history') loadHistoryPanels().catch(() => {});
    else loadTimeline().catch(() => {});
    syncDialogToUrl();
  };
  renderToolbar();
  boot();
}

module.exports = {
  init() {
    document.querySelectorAll('[data-lfm-dashboard]').forEach(initDashboard);
  },
  monthPosition,
};
