// -----------------------------------------------------------------------------
// Pure calculations behind the Last.fm dashboards. No DOM access, so every
// function here is unit-testable in Node.
// -----------------------------------------------------------------------------

import type {
  LastFmAlbum,
  LastFmArtist,
  LastFmReport,
  TrendMonthRow
} from './data.ts';

export interface FocusBandDefinition {
  key: string;
  label: string;
  from: number;
  to: number;
}

export interface FocusBand {
  key: string;
  label: string;
  value: number;
  share: number;
}

export interface ReportSummary {
  total: number;
  perDay: number | null;
  top10Share: number;
  topArtist: LastFmArtist | null;
}

export interface MoverRow {
  name: string;
  image?: string | null;
  now: number;
  before: number;
  delta: number;
  isNew: boolean;
  dropped: boolean;
}

export interface MonthlySeriesRow {
  month: string;
  value: number;
}

export interface TrendFacts {
  total: number;
  peak: MonthlySeriesRow | null;
  first: string | null;
  activeMonths: number;
}

export interface YearlyTotalRow {
  year: number;
  value: number;
}

export interface YearlyReportInput {
  year: number;
  report: LastFmReport;
}

export interface YearlyTopBandPlacement {
  year: number;
  position: number;
  count: number;
}

export interface YearlyTopBand {
  name: string;
  image?: string | null;
  yearsCount: number;
  averagePosition: number;
  bestPosition: number;
  allTimeScrobbles: number | null;
  placements: YearlyTopBandPlacement[];
}

export interface YearlyTopAlbum {
  artist: string;
  album: string;
  image?: string | null;
  yearsCount: number;
  averagePosition: number;
  bestPosition: number;
  allTimeScrobbles: number | null;
  placements: YearlyTopBandPlacement[];
}

export type YearlyTopBandSortKey = 'years' | 'average' | 'allTime' | 'name';
export type SortDirection = 'ascending' | 'descending';

const YEARLY_TOP_LIMIT = 15;
const bandNameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/**
 * Rank bands for the "where the plays went" part-to-whole bars. Ordered, so
 * they take the ordinal ramp (lightest = the band that matters most).
 */
const FOCUS_BANDS: readonly FocusBandDefinition[] = [
  {
    key: 'top1', label: '#1', from: 0, to: 1,
  },
  {
    key: 'top5', label: '#2–5', from: 1, to: 5,
  },
  {
    key: 'top10', label: '#6–10', from: 5, to: 10,
  },
  {
    key: 'top50', label: '#11–50', from: 10, to: 50,
  }
];

/**
 * @param {Array<{count: number}>} list - Ranked items.
 * @param {number} [from=0] - Start index (inclusive).
 * @param {number} [to=list.length] - End index (exclusive).
 * @returns {number} Summed counts.
 */
function sumCounts(list: Array<{ count: number }>, from: number = 0, to: number = list.length): number {
  return list.slice(from, to).reduce((sum, item) => sum + (Number(item.count) || 0), 0);
}

/**
 * Splits a report's scrobbles into rank bands (by artist or by album) plus
 * the long tail beyond the top 50.
 *
 * @param {LastFmReport} report - Report JSON with `totalScrobbles` and ranked lists.
 * @param {'artists'|'albums'} [list='artists'] - Which ranking to band.
 * @returns {FocusBand[]} Always every band, in order (zero-value bands included).
 */
function focusBands(report: LastFmReport, list: 'artists' | 'albums' = 'artists'): FocusBand[] {
  const total = Number(report.totalScrobbles) || 0;
  const ranked: Array<{ count: number }> = report[list] || [];
  const bands = FOCUS_BANDS.map((band) => ({
    key: band.key,
    label: band.label,
    value: sumCounts(ranked, band.from, band.to),
  }));
  const counted = bands.reduce((sum, band) => sum + band.value, 0);
  bands.push({ key: 'rest', label: 'Everything else', value: Math.max(0, total - counted) });
  return bands.map((band) => ({ ...band, share: total ? band.value / total : 0 }));
}

/**
 * Headline numbers for a report.
 *
 * @param {LastFmReport} report - Report JSON.
 * @param {{days: number}|null} span - Period span (null for all time).
 * @returns {ReportSummary}
 */
function summarize(report: LastFmReport, span: { days: number } | null): ReportSummary {
  const total = Number(report.totalScrobbles) || 0;
  const artists = report.artists || [];
  return {
    total,
    perDay: span ? total / span.days : null,
    top10Share: total ? sumCounts(artists, 0, 10) / total : 0,
    topArtist: artists[0] || null,
  };
}

/**
 * Stable identity for an album across reports.
 *
 * @param {Pick<LastFmAlbum, 'artist' | 'album'>} album - Album entry.
 * @returns {string} Lowercased "artist\u0000album" key.
 */
function albumKey(album: Pick<LastFmAlbum, 'artist' | 'album'>): string {
  return `${String(album.artist).toLowerCase()}\u0000${String(album.album).toLowerCase()}`;
}

/**
 * Albums in the current top list that were absent from the comparison list.
 *
 * @param {LastFmReport} current - Current report.
 * @param {LastFmReport} previous - Comparison report.
 * @returns {number} Count of newly charting albums.
 */
function newAlbums(current: LastFmReport, previous: LastFmReport): number {
  const before = new Set((previous.albums || []).map(albumKey));
  return (current.albums || []).filter((album) => !before.has(albumKey(album))).length;
}

/**
 * Each ranked item's count in the comparison report, aligned with the current
 * list. An item outside the comparison's top list is null: the report only
 * says its count was at most the list's cutoff (see `cutoff`).
 *
 * @param {LastFmReport} current - Current report.
 * @param {LastFmReport} previous - Comparison report.
 * @param {'artists'|'albums'} [list='artists'] - Which ranking to pair.
 * @param {number} [scale=1] - Multiplier for comparison counts. Rolling windows
 *   pass (current days ÷ comparison days) to read the longer window as a pace.
 * @returns {Array<number|null>} Comparison counts, rounded to whole plays.
 */
function compareCounts(
  current: LastFmReport,
  previous: LastFmReport,
  list: 'artists' | 'albums' = 'artists',
  scale: number = 1
): Array<number | null> {
  if (list === 'albums') {
    const before = new Map<string, number>((previous.albums || [])
      .map((item) => [albumKey(item), Number(item.count) || 0]));
    return (current.albums || []).map((item) => {
      const prev = before.get(albumKey(item));
      return prev !== undefined ? Math.round(prev * scale) : null;
    });
  }
  const before = new Map<string, number>((previous.artists || [])
    .map((item) => [String(item.name).toLowerCase(), Number(item.count) || 0]));
  return (current.artists || []).map((item) => {
    const prev = before.get(String(item.name).toLowerCase());
    return prev !== undefined ? Math.round(prev * scale) : null;
  });
}

/**
 * Smallest count in a report's top list: anything outside the list had at
 * most this many plays.
 *
 * @param {LastFmReport} report - Report JSON.
 * @param {'artists'|'albums'} [list='artists'] - Which ranking.
 * @returns {number} The cutoff count (0 for an empty list).
 */
function cutoff(report: LastFmReport, list: 'artists' | 'albums' = 'artists'): number {
  const items: Array<{ count: number }> = report[list] || [];
  const counts = items.map((item) => Number(item.count) || 0);
  return counts.length ? Math.min(...counts) : 0;
}

/**
 * Plays across an inclusive range of months, from a sparse trend series.
 *
 * @param {TrendMonthRow[] | undefined} months - Sparse monthly rows.
 * @param {string} from - First month ("YYYY-MM").
 * @param {string} to - Last month ("YYYY-MM").
 * @returns {number} Total plays (0 when the item has none in range).
 */
function sumMonths(months: TrendMonthRow[] | undefined, from: string, to: string): number {
  return (months || [])
    .filter((row) => row && row.month >= from && row.month <= to)
    .reduce((sum, row) => sum + (Number(row.count) || 0), 0);
}

/**
 * Biggest changes in share of plays between two reports. Share (not raw
 * count) keeps periods of different lengths comparable. Artists missing from
 * a report's top 50 count as 0 there and are flagged.
 *
 * @param {LastFmReport} current - Current report.
 * @param {LastFmReport} previous - Comparison report.
 * @param {number} [limit=8] - Rows to return.
 * @returns {MoverRow[]} Risers first (largest gain down), then fallers.
 */
function movers(current: LastFmReport, previous: LastFmReport, limit: number = 8): MoverRow[] {
  const nowTotal = Number(current.totalScrobbles) || 1;
  const beforeTotal = Number(previous.totalScrobbles) || 1;
  const rows = new Map<string, Omit<MoverRow, 'delta'>>();
  (previous.artists || []).forEach((artist) => {
    rows.set(artist.name.toLowerCase(), {
      name: artist.name,
      image: artist.image,
      now: 0,
      before: artist.count / beforeTotal,
      isNew: false,
      dropped: true,
    });
  });
  (current.artists || []).forEach((artist) => {
    const key = artist.name.toLowerCase();
    const row = rows.get(key) || {
      name: artist.name, image: artist.image, now: 0, before: 0, isNew: true, dropped: false,
    };
    row.now = artist.count / nowTotal;
    row.dropped = false;
    row.image = artist.image || row.image;
    rows.set(key, row);
  });
  const all: MoverRow[] = [...rows.values()].map((row) => ({ ...row, delta: row.now - row.before }));
  const risers = all.filter((row) => row.delta > 0).sort((a, b) => b.delta - a.delta);
  const fallers = all.filter((row) => row.delta < 0).sort((a, b) => a.delta - b.delta);
  // Half risers, half fallers; if one side runs short the other fills in.
  const upCount = Math.min(risers.length, Math.max(Math.ceil(limit / 2), limit - fallers.length));
  const up = risers.slice(0, upCount);
  const down = fallers.slice(0, limit - up.length);
  return [...up, ...down].sort((a, b) => b.delta - a.delta);
}

/**
 * Expands sparse `{ month: 'YYYY-MM', count }` rows into a continuous series,
 * filling gaps with zero.
 *
 * @param {TrendMonthRow[] | undefined} months - Sparse monthly rows.
 * @param {string} [from] - First month (defaults to the earliest row).
 * @param {string} [to] - Last month (defaults to the latest row).
 * @returns {MonthlySeriesRow[]} Continuous monthly series.
 */
function fillMonths(
  months: TrendMonthRow[] | undefined,
  from?: string,
  to?: string
): MonthlySeriesRow[] {
  const rows = (months || []).filter((row) => row && /^\d{4}-\d{2}$/.test(row.month));
  if (!rows.length && !(from && to)) return [];
  const sorted = rows.map((row) => row.month).sort();
  const start = from || sorted[0];
  const end = to || sorted[sorted.length - 1];
  const lookup = new Map<string, number>(rows.map((row) => [row.month, Number(row.count) || 0]));
  const out: MonthlySeriesRow[] = [];
  let [y, m] = start.split('-').map(Number);
  const [endY, endM] = end.split('-').map(Number);
  while (y < endY || (y === endY && m <= endM)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push({ month: key, value: lookup.get(key) || 0 });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

/**
 * Month key ("YYYY-MM") offset from a date.
 *
 * @param {Date} date - Reference date (UTC).
 * @param {number} [offset=0] - Months to add (negative for earlier).
 * @returns {string} Month key.
 */
function monthKey(date: Date, offset: number = 0): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Summary facts for an artist/album/year monthly trend.
 *
 * @param {MonthlySeriesRow[]} series - Continuous monthly series.
 * @returns {TrendFacts}
 */
function trendFacts(series: MonthlySeriesRow[]): TrendFacts {
  let total = 0;
  let peak: MonthlySeriesRow | null = null;
  let first: string | null = null;
  let activeMonths = 0;
  series.forEach((row) => {
    total += row.value;
    if (row.value > 0) {
      activeMonths += 1;
      if (!first) first = row.month;
      if (!peak || row.value > peak.value) peak = row;
    }
  });
  return {
    total, peak, first, activeMonths,
  };
}

/**
 * Rolls a monthly series up to calendar-year totals.
 *
 * @param {MonthlySeriesRow[]} series - Monthly series.
 * @returns {YearlyTotalRow[]} Year totals, ascending.
 */
function byYear(series: MonthlySeriesRow[]): YearlyTotalRow[] {
  const totals = new Map<number, number>();
  series.forEach((row) => {
    const year = Number(row.month.slice(0, 4));
    totals.set(year, (totals.get(year) || 0) + row.value);
  });
  return [...totals.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, value]) => ({ year, value }));
}

/**
 * Compares two nullable all-time scrobble totals, always placing known numbers
 * before unknown (`null`) entries while applying `factor` to known values.
 *
 * @param {number|null} countA - First item's all-time listens.
 * @param {number|null} countB - Second item's all-time listens.
 * @param {number} factor - Direction multiplier (`1` ascending, `-1` descending).
 * @returns {number} Comparator result.
 */
function compareAllTimeCounts(countA: number | null, countB: number | null, factor: number): number {
  if (countA === null && countB === null) return 0;
  if (countA === null) return 1;
  if (countB === null) return -1;
  if (countA === countB) return 0;
  return factor * (countA - countB);
}

/**
 * Shared comparator for sorting yearly top bands or albums by years,
 * average position, all-time listens, or display label.
 *
 * @param {T[]} entries - Items to sort.
 * @param {(entry: T) => string} getLabel - Extracts the label for alphabetical sorting/tiebreaks.
 * @param {YearlyTopBandSortKey} [sortKey='years'] - Primary field to sort by.
 * @param {SortDirection} [direction='descending'] - Sort direction for the primary field.
 * @returns {T[]} Sorted copy of the entries.
 */
function sortYearlyTopEntries<T extends {
  yearsCount: number;
  averagePosition: number;
  allTimeScrobbles: number | null;
}>(
  entries: T[],
  getLabel: (entry: T) => string,
  sortKey: YearlyTopBandSortKey = 'years',
  direction: SortDirection = 'descending'
): T[] {
  let factor = -1;
  if (direction === 'ascending') {
    factor = 1;
  }
  return entries.slice().sort((entryA, entryB) => {
    if (sortKey === 'name') {
      const nameDiff = bandNameCollator.compare(getLabel(entryA), getLabel(entryB));
      if (nameDiff !== 0) return factor * nameDiff;
      if (entryA.yearsCount !== entryB.yearsCount) return entryB.yearsCount - entryA.yearsCount;
      return entryA.averagePosition - entryB.averagePosition;
    }
    if (sortKey === 'average') {
      const avgDiff = entryA.averagePosition - entryB.averagePosition;
      if (Math.abs(avgDiff) > 1e-9) return factor * avgDiff;
      if (entryA.yearsCount !== entryB.yearsCount) return entryB.yearsCount - entryA.yearsCount;
      return bandNameCollator.compare(getLabel(entryA), getLabel(entryB));
    }
    if (sortKey === 'allTime') {
      const allTimeDiff = compareAllTimeCounts(entryA.allTimeScrobbles, entryB.allTimeScrobbles, factor);
      if (allTimeDiff !== 0) return allTimeDiff;
      if (entryA.yearsCount !== entryB.yearsCount) return entryB.yearsCount - entryA.yearsCount;
      const avgDiff = entryA.averagePosition - entryB.averagePosition;
      if (Math.abs(avgDiff) > 1e-9) return avgDiff;
      return bandNameCollator.compare(getLabel(entryA), getLabel(entryB));
    }
    const yearsDiff = entryA.yearsCount - entryB.yearsCount;
    if (yearsDiff !== 0) return factor * yearsDiff;
    const avgDiff = entryA.averagePosition - entryB.averagePosition;
    if (Math.abs(avgDiff) > 1e-9) return avgDiff;
    return bandNameCollator.compare(getLabel(entryA), getLabel(entryB));
  });
}

/**
 * Sorts yearly top bands by the chosen column with deterministic tiebreakers.
 * Default ordering ranks bands by most years in the top list first, then by the
 * lowest (best) average position across those years, and finally by band name.
 *
 * @param {YearlyTopBand[]} bands - Bands to sort.
 * @param {YearlyTopBandSortKey} [sortKey='years'] - Primary field to sort by.
 * @param {SortDirection} [direction='descending'] - Sort direction for the primary field.
 * @returns {YearlyTopBand[]} Sorted copy of the band list.
 */
function sortYearlyTopBands(
  bands: YearlyTopBand[],
  sortKey: YearlyTopBandSortKey = 'years',
  direction: SortDirection = 'descending'
): YearlyTopBand[] {
  return sortYearlyTopEntries(bands, (band) => band.name, sortKey, direction);
}

/**
 * Sorts yearly top albums by the chosen column with deterministic tiebreakers.
 * Default ordering ranks albums by most years in the top list first, then by the
 * lowest (best) average position across those years, and finally by album title.
 *
 * @param {YearlyTopAlbum[]} albums - Albums to sort.
 * @param {YearlyTopBandSortKey} [sortKey='years'] - Primary field to sort by.
 * @param {SortDirection} [direction='descending'] - Sort direction for the primary field.
 * @returns {YearlyTopAlbum[]} Sorted copy of the album list.
 */
function sortYearlyTopAlbums(
  albums: YearlyTopAlbum[],
  sortKey: YearlyTopBandSortKey = 'years',
  direction: SortDirection = 'descending'
): YearlyTopAlbum[] {
  return sortYearlyTopEntries(albums, (item) => `${item.album} ${item.artist}`, sortKey, direction);
}

/**
 * Aggregates every band that finished in the top N of any calendar-year report,
 * tracking each qualifying year and chart position plus any known all-time play
 * count from `allTimeReport`, then sorts by years count (descending) followed
 * by average position (ascending).
 *
 * @param {YearlyReportInput[]} yearReports - Calendar-year reports.
 * @param {number} [topLimit=YEARLY_TOP_LIMIT] - Maximum yearly rank included.
 * @param {LastFmReport | null} [allTimeReport=null] - Optional all-time report for initial listen totals.
 * @returns {YearlyTopBand[]} Aggregated and default-sorted top bands.
 */
function yearlyTopBands(
  yearReports: YearlyReportInput[],
  topLimit: number = YEARLY_TOP_LIMIT,
  allTimeReport: LastFmReport | null = null
): YearlyTopBand[] {
  const orderedReports = yearReports.slice().sort((a, b) => a.year - b.year);
  const allTimeLookup = new Map<string, number>();
  if (allTimeReport && allTimeReport.artists) {
    allTimeReport.artists.forEach((artist) => {
      const key = String(artist.name || '').trim().toLowerCase();
      if (key) {
        allTimeLookup.set(key, Number(artist.count) || 0);
      }
    });
  }

  const grouped = new Map<string, {
    key: string;
    name: string;
    image: string | null;
    byYear: Map<number, YearlyTopBandPlacement>;
  }>();

  orderedReports.forEach(({ year, report }) => {
    const topArtists = (report.artists || []).slice(0, topLimit);
    topArtists.forEach((artist, index) => {
      const position = index + 1;
      const key = String(artist.name || '').trim().toLowerCase();
      if (!key) return;
      let entry = grouped.get(key);
      if (!entry) {
        entry = {
          key,
          name: artist.name,
          image: artist.image || null,
          byYear: new Map<number, YearlyTopBandPlacement>(),
        };
        grouped.set(key, entry);
      } else {
        // Prefer the newest year's capitalization and image when available.
        entry.name = artist.name;
        if (artist.image) {
          entry.image = artist.image;
        }
      }
      const existingYear = entry.byYear.get(year);
      if (!existingYear || position < existingYear.position) {
        entry.byYear.set(year, {
          year,
          position,
          count: Number(artist.count) || 0,
        });
      }
    });
  });

  const rows: YearlyTopBand[] = [...grouped.values()].map((entry) => {
    const placements = [...entry.byYear.values()].sort((a, b) => a.year - b.year);
    const totalPosition = placements.reduce((sum, item) => sum + item.position, 0);
    const bestPosition = placements.reduce(
      (best, item) => Math.min(best, item.position),
      placements[0].position
    );
    const knownAllTime = allTimeLookup.get(entry.key);
    let allTimeScrobbles: number | null = null;
    if (knownAllTime !== undefined) {
      allTimeScrobbles = knownAllTime;
    }
    return {
      name: entry.name,
      image: entry.image,
      yearsCount: placements.length,
      averagePosition: totalPosition / placements.length,
      bestPosition,
      allTimeScrobbles,
      placements,
    };
  });

  return sortYearlyTopBands(rows, 'years', 'descending');
}

/**
 * Aggregates every album that finished in the top N of any calendar-year report,
 * tracking each qualifying year and chart position plus any known all-time play
 * count from `allTimeReport`, then sorts by years count (descending) followed
 * by average position (ascending).
 *
 * @param {YearlyReportInput[]} yearReports - Calendar-year reports.
 * @param {number} [topLimit=YEARLY_TOP_LIMIT] - Maximum yearly rank included.
 * @param {LastFmReport | null} [allTimeReport=null] - Optional all-time report for initial listen totals.
 * @returns {YearlyTopAlbum[]} Aggregated and default-sorted top albums.
 */
function yearlyTopAlbums(
  yearReports: YearlyReportInput[],
  topLimit: number = YEARLY_TOP_LIMIT,
  allTimeReport: LastFmReport | null = null
): YearlyTopAlbum[] {
  const orderedReports = yearReports.slice().sort((a, b) => a.year - b.year);
  const allTimeLookup = new Map<string, number>();
  if (allTimeReport && allTimeReport.albums) {
    allTimeReport.albums.forEach((album) => {
      allTimeLookup.set(albumKey(album), Number(album.count) || 0);
    });
  }

  const grouped = new Map<string, {
    key: string;
    artist: string;
    album: string;
    image: string | null;
    byYear: Map<number, YearlyTopBandPlacement>;
  }>();

  orderedReports.forEach(({ year, report }) => {
    const topAlbums = (report.albums || []).slice(0, topLimit);
    topAlbums.forEach((albumItem, index) => {
      const position = index + 1;
      const artistName = String(albumItem.artist || '').trim();
      const albumTitle = String(albumItem.album || '').trim();
      if (!artistName || !albumTitle) return;
      const key = albumKey(albumItem);
      let entry = grouped.get(key);
      if (!entry) {
        entry = {
          key,
          artist: albumItem.artist,
          album: albumItem.album,
          image: albumItem.albumImage || null,
          byYear: new Map<number, YearlyTopBandPlacement>(),
        };
        grouped.set(key, entry);
      } else {
        // Prefer the newest year's capitalization and cover art when available.
        entry.artist = albumItem.artist;
        entry.album = albumItem.album;
        if (albumItem.albumImage) {
          entry.image = albumItem.albumImage;
        }
      }
      const existingYear = entry.byYear.get(year);
      if (!existingYear || position < existingYear.position) {
        entry.byYear.set(year, {
          year,
          position,
          count: Number(albumItem.count) || 0,
        });
      }
    });
  });

  const rows: YearlyTopAlbum[] = [...grouped.values()].map((entry) => {
    const placements = [...entry.byYear.values()].sort((a, b) => a.year - b.year);
    const totalPosition = placements.reduce((sum, item) => sum + item.position, 0);
    const bestPosition = placements.reduce(
      (best, item) => Math.min(best, item.position),
      placements[0].position
    );
    const knownAllTime = allTimeLookup.get(entry.key);
    let allTimeScrobbles: number | null = null;
    if (knownAllTime !== undefined) {
      allTimeScrobbles = knownAllTime;
    }
    return {
      artist: entry.artist,
      album: entry.album,
      image: entry.image,
      yearsCount: placements.length,
      averagePosition: totalPosition / placements.length,
      bestPosition,
      allTimeScrobbles,
      placements,
    };
  });

  return sortYearlyTopAlbums(rows, 'years', 'descending');
}

module.exports = {
  FOCUS_BANDS,
  YEARLY_TOP_LIMIT,
  byYear,
  compareCounts,
  cutoff,
  fillMonths,
  focusBands,
  monthKey,
  movers,
  newAlbums,
  sortYearlyTopAlbums,
  sortYearlyTopBands,
  sumMonths,
  summarize,
  trendFacts,
  yearlyTopAlbums,
  yearlyTopBands,
};
