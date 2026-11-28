// -----------------------------------------------------------------------------
// Chart renderers for the Last.fm dashboards.
//
// Marks are HTML wherever possible (columns, bars, heatmap cells, stacked
// segments) so each one can be a focusable button with a real hit area; the
// line/area chart is the only SVG. Colours come from the --chart-* tokens in
// system/_tokens.scss. Every chart ships a data-table twin so tooltips never
// gate a value.
// -----------------------------------------------------------------------------

import type { LastFmAlbum, LastFmArtist } from './data.ts';
import type {
  FocusBand,
  MonthlySeriesRow,
  MoverRow,
  SortDirection,
  YearlyTopBand,
  YearlyTopBandSortKey
} from './stats.ts';

const {
  bindTooltip, h, hideTooltip, replace, showTooltip, svg,
} = require('./dom.ts');
const format = require('./format.ts');
const { imageUrl } = require('./data.ts');
const stats = require('./stats.ts');

export interface NiceScaleResult {
  max: number;
  ticks: number[];
}

export type KpiDirection = 'up' | 'down' | 'flat';

export interface KpiDelta {
  dir: KpiDirection;
  text: string;
  note: string;
}

export interface KpiTile {
  label: string;
  value: string;
  sub?: string | null;
  delta?: KpiDelta | null;
}

export interface ListComparison {
  values: Array<number | null>;
  atMost: number;
  word: string;
  nowLabel: string;
  beforeLabel: string;
  describe: (name: string, count: number, before: number | null) => string;
}

export interface AlbumGridOptions {
  limit: number;
  onSelect: (album: LastFmAlbum) => void;
  compare?: ListComparison | null;
}

export interface ArtistBarsOptions {
  limit: number;
  onSelect: (artist: LastFmArtist) => void;
  compare?: ListComparison | null;
}

export interface FocusGroup {
  label: string;
  bands: FocusBand[];
}

export interface DumbbellLabels {
  nowLabel: string;
  beforeLabel: string;
}

export interface ColumnDatum {
  key: string;
  label: string;
  short: string;
  value: number;
  note?: string | null;
}

export interface ColumnsOptions {
  isEmphasized?: ((d: ColumnDatum) => boolean) | null;
  onSelect?: ((d: ColumnDatum) => void) | null;
  caption?: string;
  labelHeader?: string;
}

export interface HeatmapRow {
  year: number;
  months: Array<number | null>;
}

export interface HeatmapOptions {
  isSelected: (monthKey: string) => boolean;
  onSelect: (monthKey: string) => void;
  onSelectYear: (year: number) => void;
}

export interface MonthTick {
  index: number;
  text: string;
  minor: boolean;
}

export interface AreaChartBand {
  from: number;
  to: number;
}

export interface AreaChartOptions {
  band?: AreaChartBand | null;
  bandLabel?: string;
  caption?: string;
}

export interface YearlyTopBandsOptions {
  onSelectArtist: (band: YearlyTopBand) => void;
  onSelectYear: (year: number) => void;
}

interface InvokerCommandEvent extends Event {
  command?: string;
  source?: Element | null;
}

/**
 * Rounds an axis maximum up to a clean step (1/2/2.5/5 × 10ⁿ).
 *
 * @param {number} max - Largest data value.
 * @param {number} [count=4] - Target number of intervals.
 * @param {{ integers?: boolean }} [options] - `integers` keeps ticks whole
 *   (scrobble counts); leave it off for shares (0–1).
 * @returns {NiceScaleResult} Axis maximum and tick values.
 */
function niceScale(
  max: number,
  count: number = 4,
  { integers = false }: { integers?: boolean } = {}
): NiceScaleResult {
  if (!(max > 0)) return { max: 1, ticks: [0, 1] };
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / magnitude;
  let step: number;
  if (norm <= 1) step = 1;
  else if (norm <= 2) step = 2;
  else if (norm <= 2.5 && magnitude >= 10) step = 2.5;
  else if (norm <= 5) step = 5;
  else step = 10;
  step *= magnitude;
  // Scrobble counts are whole numbers; never tick at fractions of a play.
  if (integers) step = Math.max(1, step);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= top + step / 2; t += step) ticks.push(Math.round(t * 1000) / 1000);
  return { max: top, ticks };
}

/**
 * `<api-image>` cover/avatar. Decorative: the surrounding text names the item.
 *
 * @param {string | null | undefined} hash - Image hash.
 * @param {number} size - Intrinsic size hint in px.
 * @returns {HTMLElement} Image element.
 */
function cover(hash: string | null | undefined, size: number): HTMLElement {
  return h('api-image', {
    src: imageUrl(hash), alt: '', width: size, height: size, loading: 'lazy', decoding: 'async',
  });
}

/**
 * Collapsible data table — the accessible twin of a chart.
 *
 * @param {string} summary - Disclosure label.
 * @param {string[]} headers - Column headers.
 * @param {string[][]} rows - Cell text.
 * @returns {HTMLElement} `<details>` element.
 */
function dataTable(summary: string, headers: string[], rows: string[][]): HTMLElement {
  return h('details', { class: 'lfm-table' }, [
    h('summary', { text: summary }),
    h('div', { class: 'lfm-table__scroll' }, h('table', {}, [
      h('thead', {}, h('tr', {}, headers.map((text) => h('th', { scope: 'col', text })))),
      h('tbody', {}, rows.map((row) => h('tr', {}, row.map((text, i) => (i === 0
        ? h('th', { scope: 'row', text })
        : h('td', { text }))))))
    ]))
  ]);
}

// -- KPI tiles ----------------------------------------------------------------

/**
 * Renders headline stat tiles into a `<dl>`.
 *
 * @param {HTMLElement} container - `<dl>` element.
 * @param {KpiTile[]} tiles - Tile definitions.
 */
function kpiTiles(container: HTMLElement, tiles: KpiTile[]): void {
  const arrows: Record<KpiDirection, string> = { up: '▲', down: '▼', flat: '●' };
  replace(container, tiles.map((tile) => h('div', { class: 'lfm-kpi' }, [
    h('dt', { class: 'lfm-kpi__label', text: tile.label }),
    h('dd', { class: 'lfm-kpi__value', text: tile.value }),
    tile.delta ? h('dd', { class: `lfm-kpi__delta is-${tile.delta.dir}` }, [
      h('span', { class: 'lfm-kpi__arrow', 'aria-hidden': 'true', text: arrows[tile.delta.dir] }),
      h('span', { text: tile.delta.text }),
      h('span', { class: 'lfm-kpi__vs', text: tile.delta.note })
    ]) : null,
    tile.sub ? h('dd', { class: 'lfm-kpi__sub', text: tile.sub }) : null
  ])));
}

/**
 * Visible comparison figure: "was 73", "was 0", or "was ≤24" when only the
 * bound is known.
 *
 * @param {ListComparison} compare - Comparison.
 * @param {number|null} before - Comparison count, or null if unknown.
 * @returns {string} Short label.
 */
function thenText(compare: ListComparison, before: number | null): string {
  return before === null
    ? `${compare.word} ≤${format.number(compare.atMost)}`
    : `${compare.word} ${format.number(before)}`;
}

// -- Top albums: cover grid ---------------------------------------------------

/**
 * Album cover grid; #1 is featured at double size.
 *
 * @param {HTMLElement} container - Panel body.
 * @param {LastFmAlbum[]} albums - Ranked album entries.
 * @param {AlbumGridOptions} options - Grid display options.
 */
function albumGrid(
  container: HTMLElement,
  albums: LastFmAlbum[],
  { limit, onSelect, compare = null }: AlbumGridOptions
): void {
  replace(container, h('ol', { class: 'lfm-albums' }, albums.slice(0, limit).map((album, i) => {
    const before = compare ? compare.values[i] : null;
    let count = `${format.number(album.count)} plays`;
    if (compare) count += ` · ${thenText(compare, before)}`;
    return h('li', {
      class: i === 0 ? 'lfm-album lfm-album--feature' : 'lfm-album',
    }, h('button', {
      type: 'button',
      class: 'lfm-album__button',
      'aria-label': compare
        ? `${i + 1}. ${compare.describe(`${album.album} by ${album.artist}`, album.count, before)}`
        : null,
      onclick: () => onSelect(album),
    }, [
      h('span', { class: 'lfm-album__art' }, [
        cover(album.albumImage, i === 0 ? 600 : 300),
        h('span', { class: 'lfm-album__rank', text: String(i + 1) })
      ]),
      h('span', { class: 'lfm-album__meta' }, [
        h('span', { class: 'lfm-album__title', text: album.album }),
        h('span', { class: 'lfm-album__artist', text: album.artist }),
        h('span', { class: 'lfm-album__count', text: count })
      ])
    ]));
  })));
}

// -- Top artists: ranked bars -------------------------------------------------

/**
 * Ranked horizontal bars with avatars. Values are always visible, so no
 * tooltip. With a comparison, a muted tick on each bar marks the comparison
 * count (bar = now, tick = then) and both numbers sit in the value column.
 *
 * @param {HTMLElement} container - Panel body.
 * @param {LastFmArtist[]} artists - Ranked artist entries.
 * @param {ArtistBarsOptions} options - Bar display options.
 */
function artistBars(
  container: HTMLElement,
  artists: LastFmArtist[],
  { limit, onSelect, compare = null }: ArtistBarsOptions
): void {
  const shown = artists.slice(0, limit);
  const before: Array<number | null> = compare ? compare.values.slice(0, shown.length) : [];
  // A comparison tick can sit past this period's #1, so ticks share the scale.
  const counted = before.filter((value): value is number => value !== null);
  const max = Math.max(1, ...shown.map((artist) => artist.count), ...counted);
  const pct = (value: number): string => `${(value / max) * 100}%`;
  const list = h('ol', { class: compare ? 'lfm-bars has-compare' : 'lfm-bars' }, shown.map((artist, i) => {
    const then = compare ? before[i] : null;
    return h('li', {}, h('button', {
      type: 'button',
      class: 'lfm-bars__row',
      'aria-label': compare ? `${i + 1}. ${compare.describe(artist.name, artist.count, then)}` : null,
      onclick: () => onSelect(artist),
    }, [
      h('span', { class: 'lfm-bars__rank', text: String(i + 1) }),
      h('span', { class: 'lfm-bars__avatar' }, cover(artist.image, 96)),
      // Name and count share a line of their own, so a wide comparison figure
      // below never squeezes the name.
      h('span', { class: 'lfm-bars__head' }, [
        h('span', { class: 'lfm-bars__name', text: artist.name }),
        h('span', { class: 'lfm-bars__value', text: format.number(artist.count) })
      ]),
      h('span', { class: 'lfm-bars__track' }, [
        h('span', { class: 'lfm-bars__fill', style: { '--value': pct(artist.count) } }),
        // Only a known, non-zero count gets a tick; a bound is not a value, and
        // zero would sit on the bar's origin.
        then ? h('span', { class: 'lfm-bars__then', style: { '--value': pct(then) } }) : null
      ]),
      compare ? h('span', { class: 'lfm-bars__was', text: thenText(compare, then) }) : null
    ]));
  }));
  const legend = compare ? h('ul', { class: 'lfm-key' }, [
    h('li', {}, [h('span', { class: 'lfm-key__bar' }), compare.nowLabel]),
    h('li', {}, [h('span', { class: 'lfm-key__tick' }), compare.beforeLabel])
  ]) : null;
  replace(container, [legend, list]);
}

// -- Listening focus: part-to-whole stacked bars -----------------------------

/**
 * Small multiples of one 100% bar each (artists, albums), split into rank
 * bands. One legend carries every value for both bars. Ordered bands take the
 * ordinal ramp; the long tail is the neutral "other".
 *
 * @param {HTMLElement} container - Panel body.
 * @param {FocusGroup[]} groups - One bar per group; bands come from stats.focusBands().
 */
function focusBars(container: HTMLElement, groups: FocusGroup[]): void {
  const colorFor = (key: string, i: number): string => (
    key === 'rest' ? 'var(--chart-other)' : `var(--chart-ordinal-${i + 1})`
  );
  const keys = groups[0].bands.map((band) => band.key);
  const bars = groups.map((group) => {
    const segments = group.bands.filter((band) => band.value > 0).map((band) => {
      const seg = h('span', {
        class: 'lfm-stack__seg',
        style: { 'flex-grow': String(band.value), '--seg-color': colorFor(band.key, keys.indexOf(band.key)) },
      });
      bindTooltip(seg, () => ({
        value: format.percent(band.share, 1),
        label: `${group.label}: ${band.label}`,
        note: `${format.number(band.value)} plays`,
      }));
      return seg;
    });
    return h('div', { class: 'lfm-stack__group' }, [
      h('span', { class: 'lfm-stack__label', text: group.label }),
      h('div', {
        class: 'lfm-stack',
        role: 'img',
        'aria-label': `${group.label}: ${group.bands
          .map((band) => `${band.label} ${format.percent(band.share)}`).join(', ')}`,
      }, segments)
    ]);
  });
  const shareOf = (group: FocusGroup, key: string): string => {
    const band = group.bands.find((b) => b.key === key);
    return band ? format.percent(band.share) : '—';
  };
  replace(container, [
    h('div', { class: 'lfm-stacks' }, bars),
    h('table', { class: 'lfm-legend' }, [
      h('thead', {}, h('tr', {}, [
        h('th', { scope: 'col' }, h('span', { class: 'sr-only', text: 'Rank band' })),
        ...groups.map((group) => h('th', { scope: 'col', text: group.label }))
      ])),
      h('tbody', {}, groups[0].bands.map((band, i) => h('tr', {}, [
        h('th', { scope: 'row' }, [
          h('span', { class: 'lfm-swatch', style: { '--seg-color': colorFor(band.key, i) } }),
          band.label
        ]),
        ...groups.map((group) => h('td', { text: shareOf(group, band.key) }))
      ])))
    ])
  ]);
}

// -- Movers: dumbbell ---------------------------------------------------------

/**
 * Before → after share of plays per artist. The muted dot is the comparison
 * period, the brand dot is now; the delta is printed at the row end.
 *
 * @param {HTMLElement} container - Panel body.
 * @param {MoverRow[]} rows - Output of stats.movers().
 * @param {DumbbellLabels} labels - Legend text.
 */
function dumbbell(container: HTMLElement, rows: MoverRow[], { nowLabel, beforeLabel }: DumbbellLabels): void {
  const scale = niceScale(Math.max(...rows.map((row) => Math.max(row.now, row.before))), 4);
  const pos = (v: number): string => `${(v / scale.max) * 100}%`;
  const legend = h('ul', { class: 'lfm-key' }, [
    h('li', {}, [h('span', { class: 'lfm-key__dot is-before' }), beforeLabel]),
    h('li', {}, [h('span', { class: 'lfm-key__dot is-now' }), nowLabel])
  ]);
  const list = h('ol', { class: 'lfm-dumbbell' }, rows.map((row) => {
    const lo = Math.min(row.now, row.before);
    const hi = Math.max(row.now, row.before);
    const track = h('span', { class: 'lfm-dumbbell__track' }, [
      h('span', { class: 'lfm-dumbbell__link', style: { left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})` } }),
      h('span', { class: 'lfm-dumbbell__dot is-before', style: { left: pos(row.before) } }),
      h('span', { class: 'lfm-dumbbell__dot is-now', style: { left: pos(row.now) } })
    ]);
    bindTooltip(track, () => ({
      value: `${format.percent(row.before, 1)} → ${format.percent(row.now, 1)}`,
      label: row.name,
      note: format.signedPoints(row.delta),
    }));
    let badge: HTMLElement | null = null;
    if (row.isNew) badge = h('span', { class: 'lfm-badge', text: 'New' });
    else if (row.dropped) badge = h('span', { class: 'lfm-badge is-muted', text: 'Out' });
    return h('li', { class: 'lfm-dumbbell__row' }, [
      h('span', { class: 'lfm-dumbbell__name' }, [h('span', { text: row.name }), badge]),
      track,
      h('span', {
        class: `lfm-dumbbell__delta ${row.delta >= 0 ? 'is-up' : 'is-down'}`,
        text: format.signedPoints(row.delta),
      })
    ]);
  }));
  const axis = h('div', { class: 'lfm-dumbbell__row is-axis', 'aria-hidden': 'true' }, [
    h('span', { class: 'lfm-dumbbell__name' }),
    h('span', { class: 'lfm-dumbbell__track' }, scale.ticks.map((tick) => h('span', {
      class: 'lfm-dumbbell__tick', style: { left: pos(tick) }, text: format.percent(tick),
    }))),
    h('span', { class: 'lfm-dumbbell__delta' })
  ]);
  replace(container, [
    legend,
    list,
    axis,
    dataTable('Show data table', ['Artist', beforeLabel, nowLabel, 'Change'], rows.map((row) => [
      row.name,
      format.percent(row.before, 1),
      format.percent(row.now, 1),
      format.signedPoints(row.delta)
    ]))
  ]);
}

// -- Column chart -------------------------------------------------------------

/**
 * Vertical columns with clean y ticks. Emphasis mode paints selected columns
 * in the brand hue and the rest in the recessive grey.
 *
 * @param {HTMLElement} container - Panel body.
 * @param {ColumnDatum[]} data - Column series.
 * @param {ColumnsOptions} [options] - Rendering options.
 */
function columns(container: HTMLElement, data: ColumnDatum[], {
  isEmphasized, onSelect, caption = 'Show data table', labelHeader = 'Period',
}: ColumnsOptions = {}): void {
  const scale = niceScale(Math.max(...data.map((d) => d.value)), 4, { integers: true });
  const emphasisFn = typeof isEmphasized === 'function' ? isEmphasized : null;
  const emphasisOn = Boolean(emphasisFn && data.some(emphasisFn));
  const peak = data.reduce((best, d) => (d.value > best.value ? d : best), data[0]);
  const labelled = new Set<ColumnDatum>(emphasisOn && emphasisFn ? data.filter(emphasisFn).slice(0, 2) : [peak]);

  const cols = data.map((d) => {
    const muted = Boolean(emphasisOn && emphasisFn && !emphasisFn(d));
    const tag = onSelect ? 'button' : 'span';
    const col = h(tag, {
      class: `lfm-cols__col${muted ? ' is-muted' : ''}`,
      type: onSelect ? 'button' : null,
      'aria-label': onSelect ? `${d.label}: ${format.number(d.value)} scrobbles` : null,
      'aria-pressed': onSelect ? String(emphasisOn && !muted) : null,
      onclick: onSelect ? () => onSelect(d) : null,
    }, h(
      'span',
      { class: 'lfm-cols__bar', style: { '--value': `${(d.value / scale.max) * 100}%` } },
      labelled.has(d) ? h('span', { class: 'lfm-cols__value', text: format.compact(d.value) }) : null
    ));
    col.dataset.key = d.key;
    bindTooltip(col, () => ({ value: format.number(d.value), label: d.label, note: d.note }));
    return col;
  });

  replace(container, [
    h('div', { class: 'lfm-cols' }, [
      h('div', { class: 'lfm-cols__grid', 'aria-hidden': 'true' }, scale.ticks.map((tick) => h('span', {
        class: 'lfm-cols__tick', style: { '--at': `${(tick / scale.max) * 100}%` },
      }, h('span', { text: format.compact(tick) })))),
      h('div', { class: 'lfm-cols__plot', style: { '--count': String(data.length) } }, cols),
      h('div', {
        class: 'lfm-cols__axis',
        'aria-hidden': 'true',
        style: { '--count': String(data.length) },
      }, data.map((d) => h('span', {}, [
        h('span', { class: 'lfm-cols__label-long', text: d.label }),
        h('span', { class: 'lfm-cols__label-short', text: d.short })
      ])))
    ]),
    dataTable(caption, [labelHeader, 'Scrobbles'], data.map((d) => [d.label, format.number(d.value)]))
  ]);
}

// -- Heatmap ------------------------------------------------------------------

/**
 * Sequential colour for a 0..1 intensity: surface-adjacent low → brand mid →
 * pale high (dark mode: more is lighter).
 *
 * @param {number} t - Intensity 0..1.
 * @returns {string} CSS colour expression.
 */
function heatColor(t: number): string {
  if (t <= 0.5) return `color-mix(in oklab, var(--chart-seq-mid) ${Math.round(t * 200)}%, var(--chart-seq-low))`;
  return `color-mix(in oklab, var(--chart-seq-high) ${Math.round((t - 0.5) * 200)}%, var(--chart-seq-mid))`;
}

/**
 * Year × month grid. One tab stop; arrow keys move between cells.
 *
 * @param {HTMLElement} container - Panel body.
 * @param {HeatmapRow[]} rows - Newest year first; null = not tracked.
 * @param {HeatmapOptions} options - Selection and click handlers.
 */
function heatmap(container: HTMLElement, rows: HeatmapRow[], {
  isSelected, onSelect, onSelectYear,
}: HeatmapOptions): void {
  const max = Math.max(
    1,
    ...rows.flatMap((row) => row.months.filter((v): v is number => v !== null))
  );
  const cells: HTMLButtonElement[] = [];
  const grid = h('div', { class: 'lfm-heat', role: 'grid', 'aria-label': 'Scrobbles per month' }, [
    h('div', { class: 'lfm-heat__row lfm-heat__head', role: 'row' }, [
      h('span', { role: 'columnheader', class: 'lfm-heat__corner' }),
      ...format.MONTHS_SHORT.map((name: string) => h('span', { role: 'columnheader', class: 'lfm-heat__month' }, [
        h('span', { class: 'lfm-heat__month-long', text: name }),
        h('span', { class: 'lfm-heat__month-short', text: name[0] })
      ]))
    ]),
    ...rows.map((row) => h('div', { class: 'lfm-heat__row', role: 'row' }, [
      h(
        'span',
        { role: 'rowheader', class: 'lfm-heat__year' },
        h('button', {
          type: 'button', class: 'lfm-heat__year-button', text: String(row.year), onclick: () => onSelectYear(row.year),
        })
      ),
      ...row.months.map((value, m) => {
        const key = `${row.year}-${String(m + 1).padStart(2, '0')}`;
        if (value === null) return h('span', { role: 'gridcell', class: 'lfm-heat__cell is-empty' });
        const label = format.monthLabel(key, true);
        const cell = h('button', {
          type: 'button',
          role: 'gridcell',
          class: `lfm-heat__cell${isSelected(key) ? ' is-selected' : ''}${value === 0 ? ' is-zero' : ''}`,
          tabindex: '-1',
          'aria-label': `${label}: ${format.number(value)} scrobbles`,
          style: { '--cell': heatColor(value / max) },
          dataset: { month: key },
          onclick: () => onSelect(key),
        });
        bindTooltip(cell, () => ({ value: format.number(value), label }));
        cells.push(cell);
        return cell;
      })
    ]))
  ]);

  // Roving tabindex: the selected (or newest) cell is the single tab stop.
  const start = cells.find((cell) => cell.classList.contains('is-selected')) || cells[cells.length - 1];
  if (start) start.tabIndex = 0;
  grid.addEventListener('keydown', (event: KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1, ArrowRight: 1, ArrowUp: 12, ArrowDown: -12,
    };
    const eventTarget = event.target as HTMLElement | null;
    const month = eventTarget?.dataset?.month;
    if (!(event.key in moves) || !month) return;
    const [y, m] = month.split('-').map(Number);
    const index = (y * 12 + (m - 1)) + moves[event.key];
    const target = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
    const next = cells.find((cell) => cell.dataset.month === target);
    if (!next) return;
    event.preventDefault();
    cells.forEach((cell) => { cell.tabIndex = -1; });
    next.tabIndex = 0;
    next.focus();
  });

  replace(container, [
    grid,
    h('div', { class: 'lfm-heat__legend', 'aria-hidden': 'true' }, [
      h('span', { text: '0' }),
      h('span', {
        class: 'lfm-heat__ramp',
        style: {
          '--ramp': `linear-gradient(to right, ${heatColor(0)}, ${heatColor(0.5)}, ${heatColor(1)})`,
        },
      }),
      h('span', { text: format.number(max) })
    ]),
    dataTable('Show data table', ['Year', ...format.MONTHS_SHORT], rows.map((row) => [
      String(row.year), ...row.months.map((v) => (v === null ? '—' : format.number(v)))
    ]))
  ]);
}

// -- Area chart ---------------------------------------------------------------

/**
 * Month ticks for the x-axis: quarters for short series, Januaries for long
 * ones (every other January is marked minor so CSS can thin them on phones).
 *
 * @param {Array<{month: string}>} series - Monthly series.
 * @returns {MonthTick[]} Ticks.
 */
function monthTicks(series: Array<{ month: string }>): MonthTick[] {
  const long = series.length > 36;
  const ticks: MonthTick[] = [];
  series.forEach((row, index) => {
    const [y, m] = row.month.split('-').map(Number);
    if (long && m === 1) {
      ticks.push({ index, text: String(y), minor: (y % 2) === 1 });
    } else if (!long && (m - 1) % 3 === 0) {
      const text = m === 1 ? String(y) : format.MONTHS_SHORT[m - 1];
      ticks.push({ index, text, minor: m !== 1 && m !== 7 });
    }
  });
  return ticks;
}

/**
 * Single-series monthly area chart with a snapping crosshair. The plot is
 * focusable; arrow keys walk the months.
 *
 * @param {HTMLElement} container - Panel body.
 * @param {MonthlySeriesRow[]} series - Continuous monthly series.
 * @param {AreaChartOptions} [options] - Band and table caption options.
 */
function areaChart(
  container: HTMLElement,
  series: MonthlySeriesRow[],
  { band, bandLabel, caption = 'Show data table' }: AreaChartOptions = {}
): void {
  const n = series.length;
  const scale = niceScale(Math.max(...series.map((row) => row.value)), 4, { integers: true });
  const W = 1000;
  const H = 100;
  // Month i owns the slot [i, i + 1) and is plotted mid-slot, so a date range
  // (the shaded band) maps onto the same axis as the monthly points.
  const xAt = (i: number): number => ((i + 0.5) / n) * W;
  const xSlot = (position: number): number => (Math.max(0, Math.min(n, position)) / n) * W;
  const yAt = (v: number): number => H - (v / scale.max) * H;
  const pct = (i: number): string => `${(xAt(i) / W) * 100}%`;

  const plotSvg = svg('svg', {
    class: 'lfm-area__svg', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none',
  });
  scale.ticks.forEach((tick) => {
    plotSvg.append(svg('line', {
      class: 'lfm-area__grid', x1: 0, x2: W, y1: yAt(tick), y2: yAt(tick), 'vector-effect': 'non-scaling-stroke',
    }));
  });
  if (band) {
    const from = xSlot(band.from);
    plotSvg.append(svg('rect', {
      class: 'lfm-area__band', x: from, y: 0, width: Math.max(4, xSlot(band.to) - from), height: H,
    }));
  }
  const points = series.map((row, i) => `${xAt(i).toFixed(2)},${yAt(row.value).toFixed(2)}`);
  plotSvg.append(svg('path', {
    class: 'lfm-area__fill',
    d: `M${xAt(0)},${H} L${points.join(' L')} L${xAt(n - 1)},${H} Z`,
  }));
  plotSvg.append(svg('path', {
    class: 'lfm-area__line',
    d: `M${points.join(' L')}`,
    'vector-effect': 'non-scaling-stroke',
  }));

  const last = series[n - 1];
  const endDot = h('span', { class: 'lfm-area__dot is-end', style: { left: pct(n - 1), top: `${yAt(last.value)}%` } });
  const crosshair = h('span', { class: 'lfm-area__crosshair', hidden: true });
  const focusDot = h('span', { class: 'lfm-area__dot', hidden: true });
  const plot = h('div', {
    class: 'lfm-area__plot',
    tabindex: '0',
    role: 'img',
    'aria-label': `Monthly scrobbles, ${format.monthLabel(series[0].month)} to 
      ${format.monthLabel(last.month)}. 
      Peak ${format.number(Math.max(...series.map((r) => r.value)))}.
      ${bandLabel ? ` Shaded: ${bandLabel}.` : ''} Use arrow keys to read months.`,
  }, [plotSvg, crosshair, focusDot, endDot]);

  let active = n - 1;
  const showIndex = (index: number): void => {
    active = Math.max(0, Math.min(n - 1, index));
    const row = series[active];
    crosshair.hidden = false;
    focusDot.hidden = false;
    crosshair.style.left = pct(active);
    focusDot.style.left = pct(active);
    focusDot.style.top = `${yAt(row.value)}%`;
    const rect = plot.getBoundingClientRect();
    showTooltip(
      {
        x: rect.left + (xAt(active) / W) * rect.width,
        y: rect.top + (yAt(row.value) / H) * rect.height,
      },
      { value: format.number(row.value), label: format.monthLabel(row.month, true) }
    );
  };
  const hide = (): void => {
    crosshair.hidden = true;
    focusDot.hidden = true;
    hideTooltip();
  };
  plot.addEventListener('pointermove', (event: PointerEvent) => {
    const rect = plot.getBoundingClientRect();
    showIndex(Math.floor(((event.clientX - rect.left) / rect.width) * n));
  });
  plot.addEventListener('pointerleave', hide);
  plot.addEventListener('focus', () => showIndex(active));
  plot.addEventListener('blur', hide);
  plot.addEventListener('keydown', (event: KeyboardEvent) => {
    const steps: Record<string, number> = {
      ArrowLeft: -1, ArrowRight: 1, Home: -n, End: n,
    };
    const step = steps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    showIndex(active + step);
  });

  replace(container, [
    h('div', { class: 'lfm-area' }, [
      h('div', { class: 'lfm-area__y', 'aria-hidden': 'true' }, scale.ticks.map((tick) => h('span', {
        style: { top: `${yAt(tick)}%` }, text: format.compact(tick),
      }))),
      plot,
      h('div', { class: 'lfm-area__x', 'aria-hidden': 'true' }, monthTicks(series).map((tick) => h('span', {
        class: tick.minor ? 'is-minor' : null,
        style: { left: pct(tick.index) },
        text: tick.text,
      })))
    ]),
    dataTable(caption, ['Month', 'Scrobbles'], series.map((row) => [
      format.monthLabel(row.month), format.number(row.value)
    ]))
  ]);
}

// -- Yearly top-20 bands: sortable responsive table ---------------------------

/**
 * Picks the initial sort direction when switching to a different column.
 *
 * @param {YearlyTopBandSortKey} sortKey - Target column key.
 * @returns {SortDirection} Default direction for that column.
 */
function defaultDirectionForColumn(sortKey: YearlyTopBandSortKey): SortDirection {
  if (sortKey === 'years') {
    return 'descending';
  }
  return 'ascending';
}

/**
 * Moves existing table rows inside `tbody` without rebuilding them so element
 * identity and interactive state are preserved.
 *
 * @param {HTMLTableSectionElement} tbody - Table body element.
 * @param {HTMLTableRowElement[]} orderedRows - Rows in target order.
 */
function reorderTableRows(tbody: HTMLTableSectionElement, orderedRows: HTMLTableRowElement[]): void {
  orderedRows.forEach((row) => {
    if (typeof tbody.moveBefore === 'function') {
      tbody.moveBefore(row, null);
    } else {
      tbody.append(row);
    }
  });
}

/**
 * Builds one table row for a band that appeared in at least one yearly top 20.
 *
 * @param {YearlyTopBand} band - Aggregated band statistics.
 * @param {YearlyTopBandsOptions} options - Selection callbacks.
 * @returns {HTMLTableRowElement} Table row element.
 */
function buildYearlyTopBandRow(band: YearlyTopBand, options: YearlyTopBandsOptions): HTMLTableRowElement {
  const chips = band.placements.map((placement) => {
    let chipClass = 'lfm-top20__chip';
    if (placement.position === 1) {
      chipClass = 'lfm-top20__chip is-first';
    }
    const chip = h('button', {
      type: 'button',
      class: chipClass,
      'aria-label': `${placement.year}: ranked #${placement.position}`
        + ` (${format.number(placement.count)} plays). Load ${placement.year}.`,
      dataset: { year: String(placement.year), position: String(placement.position) },
      onclick: () => options.onSelectYear(placement.year),
    }, [
      h('span', { class: 'lfm-top20__chip-year', text: String(placement.year) }),
      h('span', { class: 'lfm-top20__chip-rank', text: `#${placement.position}` })
    ]);
    bindTooltip(chip, () => ({
      value: `#${placement.position}`,
      label: `${band.name} · ${placement.year}`,
      note: `${format.number(placement.count)} scrobbles`,
    }));
    return h('li', {}, chip);
  });

  const artistButton = h('button', {
    type: 'button',
    class: 'lfm-top20__artist',
    onclick: () => options.onSelectArtist(band),
  }, [
    h('span', { class: 'lfm-top20__avatar' }, cover(band.image, 64)),
    h('span', { class: 'lfm-top20__name', text: band.name })
  ]);

  return h('tr', { dataset: { bandKey: band.name.toLowerCase() } }, [
    h('th', { scope: 'row', class: 'lfm-top20__band-cell' }, h('span', { class: 'lfm-top20__band' }, [
      h('span', { class: 'lfm-top20__rank', 'aria-hidden': 'true' }),
      artistButton
    ])),
    h('td', {
      class: 'lfm-top20__num',
      dataset: { label: 'Years', value: String(band.yearsCount) },
      text: String(band.yearsCount),
    }),
    h('td', {
      class: 'lfm-top20__num',
      dataset: { label: 'Avg rank', value: band.averagePosition.toFixed(4) },
      text: `#${band.averagePosition.toFixed(1)}`,
    }),
    h('td', { class: 'lfm-top20__years-cell', dataset: { label: 'Top 20 years' } }, [
      h('ul', { class: 'lfm-top20__chips' }, chips)
    ])
  ]);
}

/**
 * Renders the sortable, responsive table of every band that reached a yearly
 * top 20, listing each qualifying year and position held.
 *
 * @param {HTMLElement} container - Panel body element.
 * @param {YearlyTopBand[]} bands - Pre-sorted yearly top-20 bands.
 * @param {YearlyTopBandsOptions} options - Artist and year selection callbacks.
 */
function yearlyTopBandsTable(
  container: HTMLElement,
  bands: YearlyTopBand[],
  options: YearlyTopBandsOptions
): void {
  if (!bands.length) {
    replace(container, h('p', { class: 'lfm-status', text: 'No yearly top-20 data available.' }));
    return;
  }

  const tableId = 'lfm-top20-table';
  const status = h('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });

  const sortableColumns: Array<{
    key: YearlyTopBandSortKey;
    label: string;
    align: 'left' | 'right';
    initialSort: SortDirection | null;
  }> = [
    {
      key: 'name', label: 'Band', align: 'left', initialSort: null,
    },
    {
      key: 'years', label: 'Years', align: 'right', initialSort: 'descending',
    },
    {
      key: 'average', label: 'Avg rank', align: 'right', initialSort: null,
    }
  ];

  const headerCells: HTMLElement[] = sortableColumns.map((col) => {
    let headerClass = 'lfm-top20__col-head';
    if (col.align === 'right') {
      headerClass = 'lfm-top20__col-head is-numeric';
    }
    return h('th', {
      scope: 'col',
      class: headerClass,
      'aria-sort': col.initialSort,
      dataset: { sortKey: col.key },
    }, h('button', {
      type: 'button',
      class: 'lfm-top20__sort-button',
      commandfor: tableId,
      command: '--sort',
    }, [
      h('span', { text: col.label }),
      h('span', { class: 'lfm-top20__sort-icon', 'aria-hidden': 'true' })
    ]));
  });

  headerCells.push(h('th', {
    scope: 'col',
    class: 'lfm-top20__col-head',
    text: 'Top 20 years & positions',
  }));

  const rowByBand = new Map<YearlyTopBand, HTMLTableRowElement>();
  const rows = bands.map((band) => {
    const row = buildYearlyTopBandRow(band, options);
    rowByBand.set(band, row);
    return row;
  });

  const tbody: HTMLTableSectionElement = h('tbody', {}, rows);
  const thead: HTMLTableSectionElement = h('thead', {}, h('tr', {}, headerCells));
  const table: HTMLTableElement = h('table', { id: tableId, class: 'lfm-top20__table' }, [
    h('caption', {
      class: 'sr-only',
      text: 'Bands that finished in a yearly top 20, sorted by number of years and average position.',
    }),
    thead,
    tbody
  ]);

  /**
   * Applies a column sort, updates `aria-sort` on the active header, reorders
   * the existing `<tr>` nodes, and announces the new order for screen readers.
   *
   * @param {HTMLButtonElement} button - Activated column header button.
   */
  const sortByButton = (button: HTMLButtonElement): void => {
    const th = button.closest('th');
    if (!th) return;
    const rawKey = th.dataset.sortKey;
    if (rawKey !== 'years' && rawKey !== 'average' && rawKey !== 'name') return;

    const currentSort = th.getAttribute('aria-sort');
    let nextDirection: SortDirection = defaultDirectionForColumn(rawKey);
    if (currentSort === 'ascending') {
      nextDirection = 'descending';
    } else if (currentSort === 'descending') {
      nextDirection = 'ascending';
    }

    headerCells.forEach((cell) => { cell.removeAttribute('aria-sort'); });
    th.setAttribute('aria-sort', nextDirection);

    const sortedBands: YearlyTopBand[] = stats.sortYearlyTopBands(bands, rawKey, nextDirection);
    const orderedRows = sortedBands
      .map((band) => rowByBand.get(band))
      .filter((row): row is HTMLTableRowElement => row !== undefined);
    reorderTableRows(tbody, orderedRows);

    const labelText = (button.textContent || '').trim();
    status.textContent = `Sorted by ${labelText}, ${nextDirection}, ${orderedRows.length} bands.`;
  };

  table.addEventListener('command', (event: Event) => {
    const commandEvent = event as InvokerCommandEvent;
    if (commandEvent.command === '--sort' && commandEvent.source instanceof HTMLButtonElement) {
      sortByButton(commandEvent.source);
    }
  });

  // Fallback for browsers and test environments without Invoker Commands support.
  const supportsInvokerCommands = typeof HTMLButtonElement !== 'undefined'
    && 'commandForElement' in HTMLButtonElement.prototype;
  if (!supportsInvokerCommands) {
    thead.querySelectorAll<HTMLButtonElement>('button[command="--sort"]').forEach((button) => {
      button.addEventListener('click', () => sortByButton(button));
    });
  }

  replace(container, [
    h('div', { class: 'lfm-top20' }, [table, status])
  ]);
}

module.exports = {
  albumGrid,
  areaChart,
  artistBars,
  columns,
  cover,
  dataTable,
  dumbbell,
  focusBars,
  heatColor,
  heatmap,
  kpiTiles,
  niceScale,
  yearlyTopBandsTable,
};
