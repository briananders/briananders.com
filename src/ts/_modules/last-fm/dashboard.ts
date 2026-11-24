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

import type {
  ColumnDatum,
  HeatmapRow,
  KpiDirection,
  KpiTile,
  ListComparison
} from './charts.ts';
import type {
  ComparisonEntry,
  LastFmAlbum,
  LastFmArtist,
  LastFmReport,
  LastUpdatedInfo,
  PeriodSpan,
  PeriodTypeKey,
  PeriodTypeOption,
  ReportIndex,
  ReportIndexEntry,
  RollingWindow,
  TrendDescriptor,
  TrendItemInput,
  TrendPayload,
  YearTotalRow,
  YearTotalsPayload
} from './data.ts';
import type { MonthlySeriesRow, MoverRow, ReportSummary } from './stats.ts';

const charts = require('./charts.ts');
const createDetailDialog = require('./detail-dialog.ts');
const data = require('./data.ts');
const { h, replace } = require('./dom.ts');
const format = require('./format.ts');
const stats = require('./stats.ts');

interface PeriodOption {
  slug: string;
  label: string;
  short?: string;
}

interface ResolvedListComparison extends ListComparison {
  months: { from: string; to: string } | null;
}

interface CompareListsResult {
  note: string;
  artists: ResolvedListComparison;
  albums: ResolvedListComparison;
}

interface DashboardState {
  type: PeriodTypeKey;
  slug: string;
  index: ReportIndex | null;
  asOf: Date;
  token: number;
  limits: { albums: number; artists: number };
  report: LastFmReport | null;
  span: PeriodSpan | null;
  compare: CompareListsResult | null;
  yearTotals: YearTotalRow[] | null;
  heatRows: HeatmapRow[] | null;
  timelineSeries: MonthlySeriesRow[] | null;
}

const DEFAULT_WINDOW = 'last-30-days';
const LIMITS = { albums: [9, 25], artists: [10, 25] } as const;

/**
 * Upper-cases the first character.
 *
 * @param {string} text - Input.
 * @returns {string} Capitalised text.
 */
function capitalize(text: string): string {
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
function monthPosition(date: Date, origin: string, endOfDay: boolean = false): number {
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
 * @param {unknown} historyState - State object to store.
 */
function writeUrl(url: URL, how: 'push' | 'replace', historyState: unknown): void {
  url.search = url.search.replace(/%2F/gi, '/');
  if (how === 'push') {
    window.history.pushState(historyState, '', url);
  } else {
    window.history.replaceState(historyState, '', url);
  }
}

/**
 * Re-renders a container, then puts focus back on the element that had it
 * (matched by data-key / data-month) so clicking a chart mark to change the
 * period doesn't throw keyboard users back to the top of the page.
 *
 * @param {HTMLElement} container - Region being re-rendered.
 * @param {() => void} render - Render callback.
 */
function preserveFocus(container: HTMLElement, render: () => void): void {
  const active = document.activeElement as HTMLElement | null;
  const key = active && container.contains(active) && (active.dataset?.key || active.dataset?.month);
  render();
  if (!key) return;
  const next = container.querySelector<HTMLElement>(`[data-key="${key}"], [data-month="${key}"]`);
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
function initDashboard(root: HTMLElement): void {
  const mode = root.dataset.mode === 'history' ? 'history' : 'recent';
  const $ = (name: string): HTMLElement | null => root.querySelector<HTMLElement>(`[data-lfm="${name}"]`);
  const els = {
    grid: $('grid')!,
    periods: $('periods')!,
    stepper: $('stepper'),
    range: $('range')!,
    kpis: $('kpis')!,
    albums: $('albums')!,
    albumsNote: $('albums-note')!,
    albumsToggle: $('albums-toggle')!,
    artists: $('artists')!,
    artistsNote: $('artists-note')!,
    artistsToggle: $('artists-toggle')!,
    focus: $('focus')!,
    focusNote: $('focus-note')!,
    movers: $('movers')!,
    moversNote: $('movers-note')!,
    timeline: $('timeline'),
    timelineNote: $('timeline-note'),
    years: $('years'),
    heatmap: $('heatmap'),
  };

  const state: DashboardState = {
    type: mode === 'recent' ? 'rolling' : 'all-time',
    slug: mode === 'recent' ? DEFAULT_WINDOW : 'all-time',
    index: null,
    asOf: new Date(),
    token: 0,
    limits: { albums: LIMITS.albums[0], artists: LIMITS.artists[0] },
    report: null,
    span: null,
    compare: null,
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
   * @param {TrendItemInput} item - Trend descriptor (kind + names/year).
   */
  const openTrend = (item: TrendItemInput): void => {
    const path: string = data.trendPath(item);
    const url = new URL(window.location.href);
    url.searchParams.set('trends', path);
    writeUrl(url, 'push', { lfmTrend: path });
    dialog.open({ ...item, path });
  };

  const syncDialogToUrl = (): void => {
    const trend: TrendDescriptor | null = data.parseTrendPath(
      new URLSearchParams(window.location.search).get('trends')
    );
    if (!trend) {
      dialog.close();
      return;
    }
    if (!dialog.isOpenFor(trend.path)) dialog.open(trend);
  };
  window.addEventListener('popstate', syncDialogToUrl);

  // -- Period model -------------------------------------------------------------

  const filenameFor = (type: PeriodTypeKey, slug: string): string => (
    type === 'all-time' ? 'all_time.json' : `${type}_${slug}.json`
  );

  const periodsOf = (type: PeriodTypeKey): PeriodOption[] => {
    if (type === 'rolling') {
      return (data.ROLLING_WINDOWS as readonly RollingWindow[]).map((w) => ({
        slug: w.key, label: w.label, short: w.short,
      }));
    }
    return (data.reportsOfType(state.index, type) as ReportIndexEntry[]).map((entry) => ({
      slug: data.periodSlug(entry.filename, type),
      label: entry.label,
    }));
  };

  const labelFor = (type: PeriodTypeKey, slug: string): string => {
    if (type === 'all-time') return 'All time';
    const match = periodsOf(type).find((p) => p.slug === slug);
    return match ? match.label : slug;
  };

  let allTimeSpanPromise: Promise<PeriodSpan | null> | null = null;
  /**
   * All-time reports carry no dates; derive the span from the first month
   * with scrobbles in the earliest year's trend file.
   *
   * @returns {Promise<PeriodSpan | null>} Span.
   */
  const allTimeSpan = (): Promise<PeriodSpan | null> => {
    if (!allTimeSpanPromise) {
      allTimeSpanPromise = (data.getYearTotals() as Promise<YearTotalsPayload>)
        .then((totals) => (
          data.getTrend(`years/${Math.min(...totals.years.map((y) => y.year))}`) as Promise<TrendPayload>
        ))
        .then((trend) => {
          const first = (stats.fillMonths(trend.months) as MonthlySeriesRow[]).find((row) => row.value > 0);
          if (!first) return null;
          const [y, m] = first.month.split('-').map(Number);
          const start = new Date(Date.UTC(y, m - 1, 1));
          const end = state.asOf;
          return { start, end, days: Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000)) };
        })
        .catch(() => null);
    }
    return allTimeSpanPromise;
  };

  const spanFor = (report: LastFmReport, type: PeriodTypeKey): Promise<PeriodSpan | null> => (type === 'all-time'
    ? allTimeSpan()
    : Promise.resolve(data.periodSpan(report, type, state.asOf)));

  // -- URL <-> period ---------------------------------------------------------

  const writePeriodToUrl = (): void => {
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
   * @returns {{type: PeriodTypeKey, slug: string}} Valid period.
   */
  const resolvePeriod = (type: string, slug: string | null): { type: PeriodTypeKey; slug: string } => {
    if (mode === 'recent') {
      const ok = slug !== null && (data.ROLLING_WINDOWS as readonly RollingWindow[]).some((w) => w.key === slug);
      return { type: 'rolling', slug: ok && slug ? slug : DEFAULT_WINDOW };
    }
    const matchedType = (data.PERIOD_TYPES as readonly PeriodTypeOption[]).find((t) => t.key === type);
    if (!matchedType || matchedType.key === 'all-time') {
      return { type: 'all-time', slug: 'all-time' };
    }
    const validType = matchedType.key;
    const options = periodsOf(validType);
    if (!options.length) return { type: 'all-time', slug: 'all-time' };
    const matchedSlug = slug !== null && options.some((p) => p.slug === slug) ? slug : options[0].slug;
    return { type: validType, slug: matchedSlug };
  };

  // -- Toolbar ------------------------------------------------------------------

  const renderToolbar = (): void => {
    const segments = mode === 'recent'
      ? (data.ROLLING_WINDOWS as readonly RollingWindow[]).map((w) => ({
        key: w.key, long: w.label.replace('Last ', ''), short: w.short, pressed: state.slug === w.key, label: w.label,
      }))
      : (data.PERIOD_TYPES as readonly PeriodTypeOption[]).map((t) => ({
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
      onchange: (event: Event) => {
        const target = event.target as HTMLSelectElement;
        selectPeriod(state.type, target.value);
      },
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

  const renderKpis = (
    report: LastFmReport,
    span: PeriodSpan | null,
    comparison: LastFmReport | null,
    compSpan: PeriodSpan | null,
    comp: ComparisonEntry | null
  ): void => {
    const now: ReportSummary = stats.summarize(report, span);
    const before: ReportSummary | null = comparison ? stats.summarize(comparison, compSpan) : null;
    const vs = comp ? `vs ${comp.label}` : '';
    const direction = (value: number): KpiDirection => {
      if (Math.abs(value) < 0.005) return 'flat';
      return value > 0 ? 'up' : 'down';
    };
    const tiles: KpiTile[] = [
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

  /**
   * Item-level comparison for the top lists. Calendar periods show each item's
   * count in the previous period. Rolling windows have no earlier window of the
   * same length, so they show the comparison window's count scaled to this
   * window's days: the "usual" pace the KPI tiles already compare against.
   *
   * An item outside the comparison's top list starts as unknown (shown as
   * "≤ cutoff"); for months, quarters and years `resolveMissing` replaces that
   * with the real count from monthly history.
   *
   * @param {LastFmReport} report - Selected report.
   * @param {LastFmReport|null} comparison - Comparison report.
   * @param {ComparisonEntry|null} comp - Comparison descriptor.
   * @param {PeriodSpan|null} span - Selected span.
   * @param {PeriodSpan|null} compSpan - Comparison span.
   * @returns {CompareListsResult|null} Note plus per-list options; null for all time.
   */
  const compareLists = (
    report: LastFmReport,
    comparison: LastFmReport | null,
    comp: ComparisonEntry | null,
    span: PeriodSpan | null,
    compSpan: PeriodSpan | null
  ): CompareListsResult | null => {
    if (!comparison || !comp) return null;
    const pace = state.type === 'rolling';
    if (pace && !(span && compSpan)) return null;
    const label = labelFor(state.type, state.slug);
    const nowLabel = span && span.partial ? `${label} so far` : label;
    const during = pace ? `in the ${nowLabel.toLowerCase()}` : `in ${nowLabel}`;
    const over = comp.type === 'all-time' ? 'all time' : `the ${comp.label}`;
    const scale = pace && span && compSpan ? span.days / compSpan.days : 1;
    // Calendar months line up with the monthly trend files; weeks don't.
    const months = ['month', 'quarter', 'year'].includes(state.type) && compSpan
      ? { from: stats.monthKey(compSpan.start), to: stats.monthKey(compSpan.end) }
      : null;
    let note = `Plays ${during}, compared with ${comp.label}.`;
    if (pace && span) {
      note = `Plays ${during}. “Usual” is your pace over ${over}, scaled to ${format.number(span.days)} days.`;
    }
    const forList = (list: 'artists' | 'albums'): ResolvedListComparison => {
      const atMost = Math.round(stats.cutoff(comparison, list) * scale);
      const outside = `outside its top ${(comparison[list] || []).length}`;
      return {
        values: stats.compareCounts(report, comparison, list, scale),
        atMost,
        months,
        word: pace ? 'usual' : 'was',
        nowLabel,
        beforeLabel: pace ? `Usual pace (${comp.label})` : comp.label,
        describe: (name: string, count: number, before: number | null): string => {
          const head = `${name}: ${format.number(count)} scrobbles ${during}`;
          if (pace) {
            return before === null
              ? `${head}, compared with a usual of at most ${format.number(atMost)}`
                + ` at your pace over ${over} (${outside}).`
              : `${head}, compared with a usual ${format.number(before)} at your pace over ${over}.`;
          }
          return before === null
            ? `${head}, compared with at most ${format.number(atMost)} in ${comp.label} (${outside}).`
            : `${head}, compared with ${format.number(before)} in ${comp.label}.`;
        },
      };
    };
    return { note, artists: forList('artists'), albums: forList('albums') };
  };

  /**
   * Looks up the real comparison count for on-screen items that fell outside
   * the comparison's top list. Only months, quarters and years line up with
   * the monthly trend files; anything else keeps its "≤ cutoff" bound, as does
   * any item whose trend file can't be loaded.
   *
   * @param {'artists'|'albums'} list - Which top list.
   * @param {number} limit - Items on screen.
   * @returns {Promise<void>} Settles once every lookup has.
   */
  const resolveMissing = (list: 'artists' | 'albums', limit: number): Promise<void> => {
    const compare = state.compare && state.compare[list];
    if (!compare || !compare.months || !state.report) return Promise.resolve();
    const { from, to } = compare.months;
    const lookups = list === 'albums'
      ? (state.report.albums || []).slice(0, limit).map((item, i) => {
        if (compare.values[i] !== null) return null;
        const path: string = data.trendPath({ kind: 'album', artist: item.artist, album: item.album });
        return (data.getTrend(path) as Promise<TrendPayload>)
          .then((trend) => { compare.values[i] = stats.sumMonths(trend.months, from, to); })
          .catch(() => {});
      })
      : (state.report.artists || []).slice(0, limit).map((item, i) => {
        if (compare.values[i] !== null) return null;
        const path: string = data.trendPath({ kind: 'artist', artist: item.name });
        return (data.getTrend(path) as Promise<TrendPayload>)
          .then((trend) => { compare.values[i] = stats.sumMonths(trend.months, from, to); })
          .catch(() => {});
      });
    return Promise.all(lookups).then(() => {});
  };

  const renderAlbums = (report: LastFmReport): void => {
    charts.albumGrid(els.albums, report.albums || [], {
      limit: state.limits.albums,
      compare: state.compare && state.compare.albums,
      onSelect: (album: LastFmAlbum) => openTrend({
        kind: 'album', artist: album.artist, album: album.album, image: album.albumImage,
      }),
    });
    const [few, many] = LIMITS.albums;
    els.albumsToggle.hidden = (report.albums || []).length <= few;
    els.albumsToggle.textContent = state.limits.albums === few ? `Show top ${many}` : `Show top ${few}`;
    els.albumsToggle.setAttribute('aria-expanded', String(state.limits.albums !== few));
  };

  const renderArtists = (report: LastFmReport): void => {
    charts.artistBars(els.artists, report.artists || [], {
      limit: state.limits.artists,
      compare: state.compare && state.compare.artists,
      onSelect: (artist: LastFmArtist) => openTrend({ kind: 'artist', artist: artist.name, image: artist.image }),
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
   * @param {LastFmReport} report - Selected report.
   * @param {LastFmReport|null} comparison - Comparison report.
   * @param {ComparisonEntry|null} comp - Comparison descriptor.
   * @param {LastFmReport|null} recent - Last-12-months report (all time only).
   */
  const renderMovers = (
    report: LastFmReport,
    comparison: LastFmReport | null,
    comp: ComparisonEntry | null,
    recent: LastFmReport | null
  ): void => {
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
    const rows: MoverRow[] = stats.movers(now, before, 8);
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
   * @param {PeriodTypeKey} type - Report type.
   * @param {string} slug - Period slug.
   */
  const selectFromChart = (type: PeriodTypeKey, slug: string): void => {
    selectPeriod(type, slug);
    const toolbar = root.querySelector('.lfm-toolbar');
    if (toolbar && toolbar.getBoundingClientRect().top < 0) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      toolbar.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  };

  const renderYears = (span: PeriodSpan | null): void => {
    if (!els.years || !state.yearTotals) return;
    const yearsEl = els.years;
    const first = span ? span.start.getUTCFullYear() : null;
    const last = span ? span.end.getUTCFullYear() : null;
    const currentYear = state.asOf.getUTCFullYear();
    const rows: ColumnDatum[] = state.yearTotals.map((row) => ({
      key: String(row.year),
      label: String(row.year),
      short: `’${String(row.year).slice(2)}`,
      value: row.total,
      note: row.year === currentYear ? 'Year to date' : null,
    }));
    preserveFocus(yearsEl, () => {
      charts.columns(yearsEl, rows, {
        isEmphasized: state.type === 'all-time' || first === null || last === null
          ? null
          : (d: ColumnDatum) => Number(d.key) >= first && Number(d.key) <= last,
        onSelect: (d: ColumnDatum) => selectFromChart('year', d.key),
        labelHeader: 'Year',
      });
      yearsEl.querySelectorAll<HTMLElement>('.lfm-cols__col').forEach((col, i) => { col.dataset.key = rows[i].key; });
    });
  };

  const renderHeatmap = (span: PeriodSpan | null): void => {
    if (!els.heatmap || !state.heatRows) return;
    const heatmapEl = els.heatmap;
    const { heatRows } = state;
    const from: string | null = span && state.type !== 'all-time' ? stats.monthKey(span.start) : null;
    const to: string | null = span && state.type !== 'all-time' ? stats.monthKey(span.end) : null;
    const monthExists = new Set(periodsOf('month').map((p) => p.slug));
    preserveFocus(heatmapEl, () => {
      charts.heatmap(heatmapEl, heatRows, {
        isSelected: (key: string) => Boolean(from && to && key >= from && key <= to),
        onSelect: (key: string) => { if (monthExists.has(key)) selectFromChart('month', key); },
        onSelectYear: (year: number) => selectFromChart('year', String(year)),
      });
    });
  };

  const renderTimeline = (span: PeriodSpan | null): void => {
    if (!els.timeline || !state.timelineSeries) return;
    const series = state.timelineSeries;
    const origin = series[0].month;
    const band = span
      ? { from: monthPosition(span.start, origin), to: monthPosition(span.end, origin, true) }
      : null;
    const label = labelFor(state.type, state.slug);
    if (els.timelineNote) {
      els.timelineNote.textContent = `Scrobbles per month. Shaded: ${label.toLowerCase()}.`;
    }
    charts.areaChart(els.timeline, series, { band, bandLabel: label });
  };

  const renderRange = (span: PeriodSpan | null, comp: ComparisonEntry | null): void => {
    const parts: string[] = [];
    if (state.type === 'all-time') {
      if (span) {
        parts.push(`${format.monthLabel(stats.monthKey(span.start))} – `
          + `${format.monthLabel(stats.monthKey(span.end))}`);
      }
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
  const selectPeriod = async (type: string, slug: string | null): Promise<void> => {
    ({ type: state.type, slug: state.slug } = resolvePeriod(type, slug));
    const request = ++state.token;
    writePeriodToUrl();
    renderToolbar();
    const comp: ComparisonEntry | null = data.comparisonFor(state.index, state.type, state.slug);
    els.grid.classList.add('is-refreshing');
    els.grid.setAttribute('aria-busy', 'true');
    try {
      const [report, comparison, recent] = await Promise.all([
        data.getReport(filenameFor(state.type, state.slug)) as Promise<LastFmReport>,
        comp ? (data.getReport(comp.filename) as Promise<LastFmReport>).catch(() => null) : null,
        state.type === 'all-time'
          ? (data.getReport('rolling_last-12-months.json') as Promise<LastFmReport>).catch(() => null)
          : null
      ]);
      const [span, compSpan] = await Promise.all([
        spanFor(report, state.type),
        comparison && comp ? spanFor(comparison, comp.type) : null
      ]);
      if (request !== state.token) return;
      state.report = report;
      state.span = span;
      state.compare = compareLists(report, comparison, comp, span, compSpan);
      [els.albumsNote, els.artistsNote].forEach((note) => {
        note.textContent = state.compare ? state.compare.note : '';
        note.hidden = !state.compare;
      });
      renderRange(span, comparison ? comp : null);
      renderKpis(report, span, comparison, compSpan, comparison ? comp : null);
      els.focusNote.textContent = `Share of ${format.number(report.totalScrobbles)} scrobbles, by chart position.`;
      charts.focusBars(els.focus, [
        { label: 'Artists', bands: stats.focusBands(report, 'artists') },
        { label: 'Albums', bands: stats.focusBands(report, 'albums') }
      ]);
      renderMovers(report, comparison, comparison ? comp : null, recent);
      renderYears(span);
      renderHeatmap(span);
      renderTimeline(span);
      // The top lists wait for any history lookups so their numbers don't change after paint.
      await Promise.all([
        resolveMissing('albums', state.limits.albums),
        resolveMissing('artists', state.limits.artists)
      ]);
      if (request !== state.token) return;
      renderAlbums(report);
      renderArtists(report);
      root.querySelectorAll('.is-skeleton').forEach((el) => el.classList.remove('is-skeleton'));
    } catch {
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

  const loadHistoryPanels = async (): Promise<void> => {
    const totals: YearTotalsPayload = await data.getYearTotals();
    const yearTotals = totals.years.slice().sort((a, b) => a.year - b.year);
    state.yearTotals = yearTotals;
    renderYears(state.span);
    const lastMonth: string = stats.monthKey(state.asOf);
    const trends: TrendPayload[] = await Promise.all(
      yearTotals.map((row) => (data.getTrend(`years/${row.year}`) as Promise<TrendPayload>)
        .catch(() => ({ months: [] })))
    );
    const series: MonthlySeriesRow[][] = trends.map((trend, i) => stats.fillMonths(
      trend.months,
      `${yearTotals[i].year}-01`,
      `${yearTotals[i].year}-12`
    ));
    // Months before the first scrobble and after the data's freshness date are
    // "not tracked" (null), which is different from a tracked month of zero.
    const firstRow = series.flat().find((m) => m.value > 0);
    const first = firstRow ? firstRow.month : '0000-00';
    state.heatRows = yearTotals.map((row, i) => ({
      year: row.year,
      months: series[i].map((m) => (m.month < first || m.month > lastMonth ? null : m.value)),
    })).reverse();
    renderHeatmap(state.span);
  };

  const loadTimeline = async (): Promise<void> => {
    const end: string = stats.monthKey(state.asOf);
    const start: string = stats.monthKey(state.asOf, -23);
    const years: number[] = [];
    for (let y = Number(start.slice(0, 4)); y <= Number(end.slice(0, 4)); y++) years.push(y);
    const trends: TrendPayload[] = await Promise.all(
      years.map((y) => (data.getTrend(`years/${y}`) as Promise<TrendPayload>).catch(() => ({ months: [] })))
    );
    state.timelineSeries = stats.fillMonths(trends.flatMap((t) => t.months || []), start, end);
    renderTimeline(state.span);
  };

  // -- Boot ---------------------------------------------------------------------

  // Showing more rows can reveal items whose comparison count needs a lookup.
  els.albumsToggle.addEventListener('click', () => {
    const [few, many] = LIMITS.albums;
    state.limits.albums = state.limits.albums === few ? many : few;
    resolveMissing('albums', state.limits.albums).then(() => { if (state.report) renderAlbums(state.report); });
  });
  els.artistsToggle.addEventListener('click', () => {
    const [few, many] = LIMITS.artists;
    state.limits.artists = state.limits.artists === few ? many : few;
    resolveMissing('artists', state.limits.artists).then(() => { if (state.report) renderArtists(state.report); });
  });

  const boot = async (): Promise<void> => {
    const lastUpdated = await (data.getLastUpdated() as Promise<LastUpdatedInfo>).catch(() => null);
    if (lastUpdated && lastUpdated.datetime) state.asOf = new Date(lastUpdated.datetime);
    if (mode === 'history') state.index = await (data.getIndex() as Promise<ReportIndex>).catch(() => null);
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
  init(): void {
    document.querySelectorAll<HTMLElement>('[data-lfm-dashboard]').forEach(initDashboard);
  },
  monthPosition,
};
