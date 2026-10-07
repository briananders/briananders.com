// -----------------------------------------------------------------------------
// Drill-down dialog: monthly listening history for one artist, album, or year.
//
// Built on <dialog> + showModal() so focus trapping, Escape, and the inert
// page behind come from the platform. The caller owns URL state; this module
// reports closes through `onClose`.
// -----------------------------------------------------------------------------

const { h, hideTooltip, replace } = require('./dom');
const charts = require('./charts');
const data = require('./data');
const format = require('./format');
const stats = require('./stats');

/**
 * Creates the dialog controller.
 *
 * @param {{ onClose: function(): void, asOf: function(): Date }} options
 *   `asOf` returns the data freshness date (series run up to that month).
 * @returns {{ open: Function, close: Function, isOpenFor: Function }} Controller.
 */
function createDetailDialog({ onClose, asOf }) {
  const title = h('h2', { class: 'lfm-dialog__title', id: 'lfm-dialog-title' });
  const overline = h('p', { class: 'lfm-overline' });
  const subtitle = h('p', { class: 'lfm-dialog__subtitle' });
  const art = h('div', { class: 'lfm-dialog__art' });
  const body = h('div', { class: 'lfm-dialog__body' });
  const closeButton = h('button', {
    type: 'button', class: 'button ghost lfm-dialog__close', 'aria-label': 'Close',
  }, '✕');

  const dialog = h('dialog', { class: 'lfm-dialog', 'aria-labelledby': 'lfm-dialog-title' }, [
    h('div', { class: 'lfm-dialog__sheet' }, [
      h('header', { class: 'lfm-dialog__header' }, [
        art,
        h('div', { class: 'lfm-dialog__heading' }, [overline, title, subtitle]),
        closeButton
      ]),
      body
    ])
  ]);
  document.body.append(dialog);

  let currentPath = null;
  let token = 0;

  closeButton.addEventListener('click', () => dialog.close());
  // A click on the backdrop lands on the <dialog> itself, not the sheet.
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    currentPath = null;
    document.documentElement.classList.remove('lfm-dialog-open');
    hideTooltip();
    onClose();
  });

  /**
   * Stat row shown above the chart.
   *
   * @param {Array<[string, string]>} facts - Label/value pairs.
   * @returns {HTMLElement} Definition list.
   */
  const factList = (facts) => h('dl', { class: 'lfm-facts' }, facts.map(([label, value]) => h('div', {
    class: 'lfm-facts__item',
  }, [
    h('dt', { text: label }),
    h('dd', { text: value })
  ])));

  /**
   * Renders the loaded trend.
   *
   * @param {Object} item - Trend descriptor.
   * @param {Object} trend - Trend JSON.
   */
  const render = (item, trend) => {
    const lastMonth = stats.monthKey(asOf());
    if (item.kind === 'year') {
      const endMonth = item.year === asOf().getUTCFullYear() ? lastMonth : `${item.year}-12`;
      const series = stats.fillMonths(trend.months, `${item.year}-01`, endMonth);
      const facts = stats.trendFacts(series);
      const quietest = series.reduce((low, row) => (row.value < low.value ? row : low), series[0]);
      const monthName = (row) => format.MONTHS_LONG[Number(row.month.slice(5)) - 1];
      const monthHolder = h('div');
      title.textContent = String(item.year);
      replace(body, [
        factList([
          ['Scrobbles', format.number(facts.total)],
          ['Monthly average', format.number(facts.total / series.length)],
          ['Busiest month', facts.peak ? `${monthName(facts.peak)} · ${format.number(facts.peak.value)}` : '—'],
          ['Quietest month', `${monthName(quietest)} · ${format.number(quietest.value)}`]
        ]),
        h('h3', { class: 'lfm-dialog__section', text: 'Scrobbles per month' }),
        monthHolder
      ]);
      charts.columns(monthHolder, series.map((row) => ({
        key: row.month,
        label: monthName(row).slice(0, 3),
        short: monthName(row)[0],
        value: row.value,
      })), { labelHeader: 'Month' });
      return;
    }

    const series = stats.fillMonths(trend.months, undefined, lastMonth);
    const facts = stats.trendFacts(series);
    const total = Number(trend.totalScrobbles) || facts.total;
    const years = stats.byYear(series);
    const lastfmUrl = item.kind === 'album'
      ? `https://www.last.fm/music/${encodeURIComponent(item.artist)}/${encodeURIComponent(item.album)}`
      : `https://www.last.fm/music/${encodeURIComponent(item.artist)}`;

    const areaHolder = h('div');
    const yearHolder = h('div');
    replace(body, [
      factList([
        ['Total plays', format.number(total)],
        ['First scrobbled', facts.first ? format.monthLabel(facts.first) : '—'],
        ['Peak month', facts.peak
          ? `${format.monthLabel(facts.peak.month)} · ${format.number(facts.peak.value)}`
          : '—'],
        ['Active months', format.number(facts.activeMonths)]
      ]),
      h('h3', { class: 'lfm-dialog__section', text: 'Plays per month' }),
      areaHolder,
      h('h3', { class: 'lfm-dialog__section', text: 'Plays per year' }),
      yearHolder,
      h('p', { class: 'lfm-dialog__link' }, h('a', {
        class: 'inline-link', href: lastfmUrl, target: '_blank', rel: 'noopener', text: 'Open on Last.fm',
      }))
    ]);
    if (series.length) {
      charts.areaChart(areaHolder, series);
      charts.columns(yearHolder, years.map((row) => ({
        key: String(row.year), label: String(row.year), short: `’${String(row.year).slice(2)}`, value: row.value,
      })), { labelHeader: 'Year' });
    }
  };

  /**
   * Opens the dialog for a trend and loads its data.
   *
   * @param {Object} item - `{ kind, path, artist?, album?, year?, image? }`.
   */
  const open = (item) => {
    currentPath = item.path;
    const request = ++token;
    overline.textContent = { artist: 'Artist', album: 'Album', year: 'Year in review' }[item.kind];
    title.textContent = item.kind === 'album' ? (item.album || '') : (item.artist || String(item.year || ''));
    subtitle.textContent = item.kind === 'album' ? (item.artist || '') : '';
    subtitle.hidden = !subtitle.textContent;
    replace(art, item.image ? charts.cover(item.image, 240) : null);
    art.hidden = !item.image;
    replace(body, h('p', { class: 'lfm-status', text: 'Loading listening history…' }));
    if (!dialog.open) {
      dialog.showModal();
      document.documentElement.classList.add('lfm-dialog-open');
    }
    data.getTrend(item.path)
      .then((trend) => {
        if (request !== token) return;
        // Deep links arrive with only a slug; the trend file carries real names.
        if (trend.artist) item.artist = item.artist || trend.artist;
        if (trend.album) item.album = item.album || trend.album;
        if (item.kind === 'album') {
          title.textContent = item.album;
          subtitle.textContent = item.artist;
          subtitle.hidden = false;
        } else if (item.kind === 'artist') {
          title.textContent = item.artist;
        }
        render(item, trend);
      })
      .catch(() => {
        if (request !== token) return;
        replace(body, h('p', { class: 'lfm-status is-error', text: 'No listening history was found for this one.' }));
      });
  };

  return {
    open,
    close: () => { if (dialog.open) dialog.close(); },
    isOpenFor: (path) => dialog.open && currentPath === path,
  };
}

module.exports = createDetailDialog;
