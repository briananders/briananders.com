/**
 * @fileoverview HTML rendering for the Music News post.
 *
 * Pure string builders over the normalized data from `./data.js`. Every value
 * from the feed passes through `escapeHTML`, because the feed is built from
 * scraped third-party RSS.
 */

import type {
  BandNewsFilters,
  FacetCountItem,
  NormalizedArticle,
  NormalizedFeed,
  NormalizedSource,
  SnapshotComparison,
  SnapshotEntry
} from './data.ts';

// Sources listed before the rest collapse behind a "Show N more" disclosure.
// Merged updates can cite 30+ articles; three keeps cards scannable.
const VISIBLE_SOURCES = 3;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes a value for use in HTML text or a quoted attribute.
 *
 * @param {unknown} value - Value to escape (null/undefined become '').
 * @returns {string} Escaped string.
 */
function escapeHTML(value: unknown): string {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] || char);
}

/**
 * Pluralizes a count: `plural(1, 'update')` → "1 update".
 *
 * @param {number} count - Count.
 * @param {string} singular - Singular noun.
 * @param {string} [pluralForm] - Plural noun (defaults to singular + 's').
 * @returns {string} Count with its noun.
 */
function plural(count: number, singular: string, pluralForm: string = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Formats an ISO timestamp in the reader's locale and time zone.
 *
 * @param {string|null} iso - ISO 8601 timestamp.
 * @param {Intl.DateTimeFormatOptions} [options] - `Intl.DateTimeFormat` options.
 * @returns {string} Formatted date, or '' when invalid.
 */
function formatDate(
  iso: string | null,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, options);
}

/**
 * @param {string|null} iso - ISO 8601 timestamp.
 * @returns {string} Date and time, e.g. "Nov 12, 2026, 6:00 AM".
 */
function formatDateTime(iso: string | null): string {
  return formatDate(iso, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/**
 * @param {string} href - Already-validated http(s) URL.
 * @param {string} content - Inner HTML (already escaped).
 * @param {string} [classes] - Class names.
 * @param {string} [attributes] - Extra attributes (already escaped).
 * @returns {string} External link markup.
 */
function externalLink(href: string, content: string, classes: string = '', attributes: string = ''): string {
  return `<a href="${escapeHTML(href)}" class="${classes}" target="_blank" rel="noopener"${attributes}>${content}</a>`;
}

/**
 * A filter toggle. One click handler serves every one of these, on the filter
 * rows and on the cards, through `data-filter` / `data-value`.
 *
 * @param {'tag'|'band'} kind - Facet the button filters by.
 * @param {string} value - Facet value.
 * @param {boolean} selected - Whether the filter is active.
 * @param {string} classes - Class names.
 * @param {string} content - Inner HTML (already escaped).
 * @returns {string} Button markup.
 */
function filterButton(
  kind: 'tag' | 'band',
  value: string,
  selected: boolean,
  classes: string,
  content: string
): string {
  return `<button type="button" class="${classes}" data-filter="${kind}" data-value="${escapeHTML(value)}" `
    + `aria-pressed="${selected}">${content}</button>`;
}

/**
 * Chips for one filter row, each with its faceted count. Values with no
 * matching articles are left out unless selected (so they can be cleared).
 *
 * @param {'tag'|'band'} kind - Facet.
 * @param {FacetCountItem[]} items - Values with counts.
 * @param {string|null|undefined} selected - Selected value.
 * @returns {string} Button markup.
 */
function renderFilterChips(kind: 'tag' | 'band', items: FacetCountItem[], selected: string | null | undefined): string {
  return items
    .filter((item) => item.count > 0 || item.value === selected)
    .map((item) => {
      const isSelected = item.value === selected;
      const classes = `band-filter ${kind}-filter${isSelected ? ' band-filter--selected' : ''}`;
      return filterButton(kind, item.value, isSelected, classes, `
        <span class="band-filter__name">${escapeHTML(item.value)}</span>
        <span class="band-filter__count">${item.count}</span>`);
    })
    .join('');
}

/**
 * @param {NormalizedSource} source - Normalized source.
 * @returns {string} One source list item.
 */
function renderSourceItem(source: NormalizedSource): string {
  const date = formatDate(source.published);
  const byline = [
    source.source ? `<span class="article-source-publisher">${escapeHTML(source.source)}</span>` : '',
    date ? `<time datetime="${escapeHTML(source.published)}">${escapeHTML(date)}</time>` : ''
  ].filter(Boolean).join(' · ');

  return `
    <li class="article-source-item">
      ${externalLink(source.link, escapeHTML(source.title), 'article-source-link')}
      ${byline ? `<span class="article-source-byline">${byline}</span>` : ''}
    </li>`;
}

/**
 * Every article an update was synthesized from, in feed order (oldest first:
 * the first entry is the outlet that broke the story).
 *
 * @param {NormalizedSource[]} sources - Normalized sources.
 * @returns {string} Sources block markup.
 */
function renderSources(sources: NormalizedSource[]): string {
  if (!sources.length) return '';
  const visible = sources.slice(0, VISIBLE_SOURCES).map(renderSourceItem).join('');
  const rest = sources.slice(VISIBLE_SOURCES);
  const more = rest.length ? `
    <details class="article-sources-more">
      <summary class="article-sources-summary">Show ${plural(rest.length, 'more source', 'more sources')}</summary>
      <ul class="article-sources-list article-sources-list--more">${rest.map(renderSourceItem).join('')}</ul>
    </details>` : '';

  return `
    <div class="article-sources">
      <h3 class="article-sources-heading">${sources.length === 1 ? 'Source' : 'Sources'}</h3>
      <ul class="article-sources-list">${visible}</ul>
      ${more}
    </div>`;
}

/**
 * Renders one update card.
 *
 * @param {NormalizedArticle} article - Normalized article (see data.normalizeArticle).
 * @param {BandNewsFilters} filters - Active filters, to mark pressed chips.
 * @returns {string} Card markup.
 */
function renderArticle(article: NormalizedArticle, filters: BandNewsFilters): string {
  let selectedBands: string[] = [];
  if (Array.isArray(filters.bands)) {
    selectedBands = filters.bands;
  } else if (filters.band) {
    selectedBands = [filters.band];
  }
  const tagHtml = article.tag
    ? filterButton(
      'tag',
      article.tag,
      filters.tag === article.tag,
      `article-tag${filters.tag === article.tag ? ' article-tag--selected' : ''}`,
      `<span class="sr-only">Filter by tag: </span>${escapeHTML(article.tag)}`
    )
    : '';
  const bandsHtml = article.bands
    .map((band) => {
      const isSelected = selectedBands.includes(band);
      return filterButton(
        'band',
        band,
        isSelected,
        `band-tag band-tag--interactive${isSelected ? ' band-tag--selected' : ''}`,
        `<span class="sr-only">Filter by artist: </span>${escapeHTML(band)}`
      );
    })
    .join('');
  const imageHtml = article.imageUrl
    ? externalLink(
      article.link,
      `<img loading="lazy" decoding="async" src="${escapeHTML(article.imageUrl)}" alt="${escapeHTML(article.title)}" `
        + 'class="article-image" />',
      'article-image-link'
    )
    : '';
  const published = article.publishedFormatted || formatDateTime(article.published);
  const metadata = [
    article.source ? `<span class="article-source" itemprop="publisher">${escapeHTML(article.source)}</span>` : '',
    published
      ? `<time datetime="${escapeHTML(article.published)}" itemprop="datePublished">${escapeHTML(published)}</time>`
      : '',
    article.sources.length > 1
      ? `<span class="article-source-count">${plural(article.sources.length, 'source')}</span>`
      : ''
  ].filter(Boolean).join('<span aria-hidden="true">·</span>');

  return `
    <div class="article-card${article.isNew ? ' article-card--new' : ''}" role="listitem" itemscope
      itemtype="https://schema.org/Article">
      ${imageHtml}
      <div class="article-taxonomy">
        ${article.isNew ? '<span class="article-new">New</span>' : ''}
        ${tagHtml}
        ${bandsHtml}
      </div>
      <h2 class="article-title" itemprop="headline">
        ${externalLink(article.link, escapeHTML(article.title), 'article-title-link', ' itemprop="url"')}
      </h2>
      <div class="article-metadata">${metadata}</div>
      ${article.summary ? `<p class="article-summary" itemprop="description">${escapeHTML(article.summary)}</p>` : ''}
      ${renderSources(article.sources)}
    </div>`;
}

/**
 * @param {SnapshotEntry} snapshot - Entry from data.buildSnapshots.
 * @returns {string} Option label, e.g. "Latest · Nov 12, 2026, 6:00 AM · 77 updates".
 */
function snapshotLabel(snapshot: SnapshotEntry): string {
  const when = formatDateTime(snapshot.generatedAt) || snapshot.key;
  return [snapshot.isLatest ? 'Latest' : '', when, plural(snapshot.articleCount, 'update')]
    .filter(Boolean)
    .join(' · ');
}

/**
 * @param {SnapshotEntry[]} snapshots - Entries from data.buildSnapshots.
 * @param {string} selectedKey - Key of the snapshot on screen.
 * @returns {string} `<option>` markup.
 */
function renderSnapshotOptions(snapshots: SnapshotEntry[], selectedKey: string): string {
  return snapshots
    .map((snapshot) => `<option value="${escapeHTML(snapshot.key)}"${snapshot.key === selectedKey ? ' selected' : ''}>`
      + `${escapeHTML(snapshotLabel(snapshot))}</option>`)
    .join('');
}

/**
 * The line under "Last updated": which feed is on screen and what it covers.
 *
 * @param {NormalizedFeed} feed - Normalized feed on screen.
 * @param {SnapshotEntry} snapshot - Its snapshot entry.
 * @param {SnapshotComparison|null} comparison - The previous snapshot and
 *   how many updates are new since it, once known.
 * @returns {string} Meta markup.
 */
function renderMeta(
  feed: NormalizedFeed,
  snapshot: SnapshotEntry,
  comparison: SnapshotComparison | null
): string {
  const parts: string[] = [];
  if (!snapshot.isLatest) {
    parts.push(`Archived feed from ${escapeHTML(formatDateTime(feed.generatedAt) || snapshot.key)}`);
  }
  parts.push(`Tracking ${feed.bandsTracked} bands across ${feed.feedsChecked} feeds`);
  if (comparison) {
    parts.push(`${plural(comparison.newCount, 'new update')} since `
      + `${escapeHTML(formatDateTime(comparison.snapshot.generatedAt) || comparison.snapshot.key)}`);
  }
  return parts.join(' · ');
}

/**
 * @param {number} shown - Articles after filtering.
 * @param {number} total - Articles in the snapshot.
 * @param {BandNewsFilters} filters - Active filters.
 * @returns {string} Filter summary markup with a "Clear filters" button.
 */
function renderFilterStatus(shown: number, total: number, filters: BandNewsFilters): string {
  let selectedBands: string[] = [];
  if (Array.isArray(filters.bands)) {
    selectedBands = filters.bands;
  } else if (filters.band) {
    selectedBands = [filters.band];
  }
  let artistText = '';
  if (selectedBands.length === 1) {
    artistText = `artist <strong>${escapeHTML(selectedBands[0])}</strong>`;
  } else if (selectedBands.length > 1) {
    artistText = `artists <strong>${escapeHTML(selectedBands.join(', '))}</strong>`;
  }
  const active = [
    filters.tag ? `tag <strong>${escapeHTML(filters.tag)}</strong>` : '',
    artistText,
    filters.newOnly ? '<strong>new</strong> updates only' : ''
  ].filter(Boolean).join(', ');

  return `
    <p class="music-news-filter-status__text">Showing ${shown} of ${plural(total, 'update')} · ${active}</p>
    <button type="button" class="button ghost music-news-clear-filters" data-action="clear-filters">
      Clear filters
    </button>`;
}

module.exports = {
  VISIBLE_SOURCES,
  escapeHTML,
  formatDate,
  formatDateTime,
  renderFilterChips,
  renderSources,
  renderArticle,
  renderSnapshotOptions,
  renderMeta,
  renderFilterStatus,
};
