const ready = require('../_modules/document-ready');
require('../_components/last-updated').init();

/**
 * Escapes HTML characters in a string using a temporary DOM element.
 *
 * @param {string} str - The raw string to escape.
 * @returns {string} The escaped string safe for HTML rendering.
 */
function escapeHTML(str) {
  const tempElement = document.createElement('temp');
  tempElement.innerHTML = str;
  return tempElement.innerText;
}

/**
 * Generates an HTML link markup string with proper attributes and escaping.
 *
 * @param {string} link - The target URL.
 * @param {string} content - The inner HTML or text content of the link.
 * @param {string} [classes=''] - Optional CSS class names to apply to the anchor.
 * @returns {string} The generated HTML anchor string.
 */
function articleLink(link, content, classes = '') {
  return `<a href="${escapeHTML(link)}" class="${classes}" target="_blank" rel="noopener" itemprop="url">${content}</a>`;
}

/**
 * Renders the HTML markup for an article card.
 *
 * @param {Object} article - The article data object.
 * @param {string} [article.image_url] - URL to the article thumbnail image.
 * @param {string} article.link - URL to the original article.
 * @param {string} article.title - Title of the article.
 * @param {string} article.source - Publisher or feed source name.
 * @param {string} article.published - ISO publication date string.
 * @param {string} article.published_formatted - Human-readable formatted date.
 * @param {string[]} [article.matched_bands] - Array of band names matched in this article.
 * @param {string} article.summary - Text summary of the article.
 * @returns {string} HTML markup string for the article card.
 */
function renderArticle(article) {
  const bands = (article.matched_bands || [])
    .map((band) => `<span class="band-tag">${escapeHTML(band)}</span>`)
    .join('');

  return `
    <div
       class="article-card"
       role="listitem"
       itemscope
       itemtype="https://schema.org/Article">
       ${article.image_url ? articleLink(article.link, `<img src="${escapeHTML(article.image_url)}" alt="${escapeHTML(article.title)}" class="article-image" />`, 'article-image-link') : ''}
      <h2 class="article-title" itemprop="headline">${articleLink(article.link, escapeHTML(article.title.toLowerCase()), 'article-title-link')}</h2>
      <div class="article-metadata">
        <span class="article-source" itemprop="publisher">${escapeHTML(article.source)}</span> -
        <time datetime="${escapeHTML(article.published)}" itemprop="datePublished">
          ${escapeHTML(article.published_formatted)}
        </time>
      </div>
      <div class="article-bands">${bands}</div>
      <p class="article-summary" itemprop="description">${escapeHTML(article.summary)}</p>
      ${articleLink(article.link, 'Read more&nbsp;<b>&gt;</b>', 'article-link block-link')}
    </div>
  `;
}

/**
 * Renders the metadata summary showing number of bands tracked and feeds checked.
 *
 * @param {Object} data - Metadata container object.
 * @param {number} data.bands_tracked - Count of tracked bands.
 * @param {number} data.feeds_checked - Count of RSS/Atom feeds checked.
 * @returns {string} Summary text string.
 */
function renderMeta(data) {
  return `Tracking ${data.bands_tracked} bands across ${data.feeds_checked} feeds`;
}

/**
 * Builds a frequency count map of band occurrences across all articles.
 *
 * @param {Array<Object>} articles - List of article objects.
 * @returns {Map<string, number>} Map of band name to occurrence count.
 */
function buildBandHitCounts(articles) {
  const counts = new Map();
  articles.forEach((article) => {
    (article.matched_bands || []).forEach((band) => {
      counts.set(band, (counts.get(band) || 0) + 1);
    });
  });
  return counts;
}

const MARQUEE_ROW_COUNT = 3;
// Positive = content moves left. Equal step between rows: v, v+d, v+2d (row 0 slowest).
const MARQUEE_SLOWEST_ROW_PX_S = 14;
const MARQUEE_ROW_SPEED_STEP_PX_S = 9;
const MARQUEE_BASE_SPEEDS_PX_S = [
  MARQUEE_SLOWEST_ROW_PX_S,
  MARQUEE_SLOWEST_ROW_PX_S + MARQUEE_ROW_SPEED_STEP_PX_S,
  MARQUEE_SLOWEST_ROW_PX_S + 2 * MARQUEE_ROW_SPEED_STEP_PX_S
];
const MARQUEE_USER_BOOST_DECAY_PER_S = 1.8;
const MARQUEE_USER_BOOST_MAX = 220;
const MARQUEE_WHEEL_SENSITIVITY = 0.12;
// Initial segment copies per row injected into the HTML before the first measurement.
const MARQUEE_INITIAL_UNITS = 6;
// Keep at least this many viewport-widths of content beyond the current scroll position.
const MARQUEE_AHEAD_BUFFER_VP = 4;
// Never reduce a row below this many segments (prevents momentary gaps on slow frames).
const MARQUEE_MIN_SEGMENTS = 4;

/**
 * Splits a list of band names round-robin into multiple rows for the marquee.
 *
 * @param {string[]} bandsList - Array of band names.
 * @returns {string[][]} Array of band name arrays, one per marquee row.
 */
function splitBandsIntoMarqueeRows(bandsList) {
  const rows = Array.from({ length: MARQUEE_ROW_COUNT }, () => []);
  bandsList.forEach((band, i) => {
    rows[i % MARQUEE_ROW_COUNT].push(band);
  });
  for (let r = 0; r < MARQUEE_ROW_COUNT; r += 1) {
    if (rows[r].length === 0 && bandsList.length > 0) {
      rows[r].push(bandsList[r % bandsList.length]);
    }
  }
  return rows;
}

/**
 * Generates HTML span tags for a list of band names within a marquee segment.
 *
 * @param {string[]} bands - Array of band names for this segment.
 * @returns {string} HTML markup string of span tags.
 */
function renderMarqueeSegmentTags(bands) {
  return bands
    .map((band) => `<span class="band-tag band-tag--queried">${escapeHTML(band)}</span>`)
    .join('');
}

/**
 * Create a single segment element (one full copy of a row's band list).
 *
 * @param {string[]} bands - Array of band names.
 * @returns {HTMLDivElement} A newly created DOM div containing segment band tags.
 */
function makeSegmentEl(bands) {
  const el = document.createElement('div');
  el.className = 'music-news-marquee-segment';
  el.innerHTML = renderMarqueeSegmentTags(bands);
  return el;
}

/**
 * Renders the initial HTML structure for the queried bands marquee rows and tracks.
 *
 * @param {string[][]} rows - Multi-row array of band names.
 * @returns {string} HTML string representing the marquee viewport.
 */
function renderQueriedBandsMarquee(rows) {
  const rowsHtml = rows.map((rowBands) => {
    // Render MARQUEE_INITIAL_UNITS copies upfront; ensureBuffer() adds more after first measurement.
    const segsHtml = Array.from({ length: MARQUEE_INITIAL_UNITS }, (_, i) => {
      // First segment is not aria-hidden so screen readers can read the list once.
      const ariaAttr = i > 0 ? ' aria-hidden="true"' : '';
      return `<div class="music-news-marquee-segment"${ariaAttr}>${renderMarqueeSegmentTags(rowBands)}</div>`;
    }).join('');
    return `<div class="music-news-marquee-row"><div class="music-news-marquee-track">${segsHtml}</div></div>`;
  }).join('');
  return `<div class="music-news-marquee-viewport">${rowsHtml}</div>`;
}

/**
 * Initializes and manages the animated multi-row bands marquee ticker.
 * Sets up animation frames, scroll wheel acceleration, resize observers, and reduced-motion fallbacks.
 *
 * @param {HTMLElement|null} marqueeRootEl - The root container element for the marquee.
 * @param {string[]} bandsList - Array of band names to display.
 * @returns {Function} Cleanup function to cancel animations and remove event listeners.
 */
function initBandsMarquee(marqueeRootEl, bandsList) {
  if (!marqueeRootEl) return () => { };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion) {
    const rows = splitBandsIntoMarqueeRows(bandsList);
    const staticRows = rows.map((rowBands) => {
      const inner = renderMarqueeSegmentTags(rowBands);
      return `<div class="music-news-marquee-row music-news-marquee-row--static"><div class="music-news-marquee-static-inner">${inner}</div></div>`;
    }).join('');
    marqueeRootEl.innerHTML = `<div class="music-news-marquee-viewport music-news-marquee-viewport--static">${staticRows}</div>`;
    return () => { };
  }

  const rows = splitBandsIntoMarqueeRows(bandsList);
  marqueeRootEl.innerHTML = renderQueriedBandsMarquee(rows);

  const viewport = marqueeRootEl.querySelector('.music-news-marquee-viewport');
  const trackEls = [...marqueeRootEl.querySelectorAll('.music-news-marquee-track')];
  if (!viewport || !trackEls.length) return () => { };

  /**
   * Measures the current effective viewport width.
   * The full-bleed element's getBoundingClientRect().width can be 0 during first layout.
   * Fall back to window.innerWidth so we always have a usable viewport width.
   *
   * @returns {number} Viewport width in pixels.
   */
  function getVpWidth() {
    return Math.max(
      marqueeRootEl.getBoundingClientRect().width,
      window.innerWidth || 0,
      320,
    );
  }

  /**
   * Per-track state:
   *   position  — monotonically increasing px offset (adjusted when segments are removed)
   *   unitWidth — measured px width of one segment copy (0 until first layout)
   */
  const perTrack = trackEls.map((el, i) => ({
    el,
    rowBands: rows[i],
    position: 0,
    unitWidth: 0,
  }));

  let userBoost = 0;
  let lastTs = null;
  let rafId = null;

  /**
   * Append segments until there are at least MARQUEE_AHEAD_BUFFER_VP viewport-widths
   * of content beyond the current scroll position. Called once on measurement and
   * every tick thereafter to handle resize and user boost.
   *
   * @param {Object} t - The track state object.
   * @param {number} vpWidth - Viewport width in pixels.
   */
  function ensureBuffer(t, vpWidth) {
    const needed = t.position + vpWidth * MARQUEE_AHEAD_BUFFER_VP;
    let totalWidth = t.el.childElementCount * t.unitWidth;
    while (totalWidth < needed) {
      t.el.appendChild(makeSegmentEl(t.rowBands));
      totalWidth += t.unitWidth;
    }
  }

  /**
   * Main animation loop step function. Updates positions, handles wrap-around, and shifts transforms.
   *
   * @param {DOMHighResTimeStamp} ts - Current animation timestamp from requestAnimationFrame.
   */
  function tick(ts) {
    if (lastTs == null) lastTs = ts;
    const dt = Math.min((ts - lastTs) / 1000, 0.1);
    lastTs = ts;

    userBoost *= Math.exp(-MARQUEE_USER_BOOST_DECAY_PER_S * dt);
    if (Math.abs(userBoost) < 0.5) userBoost = 0;

    const vpWidth = getVpWidth();

    perTrack.forEach((t, i) => {
      // Measure segment width on the first frame where layout is ready.
      if (!t.unitWidth) {
        const seg = t.el.querySelector('.music-news-marquee-segment');
        if (seg) {
          const w = seg.getBoundingClientRect().width;
          if (w > 0) {
            t.unitWidth = w;
            // Randomize starting offset so rows begin at different points in the list.
            t.position = Math.random() * t.unitWidth;
            // Fill the lookahead buffer now that unitWidth is known.
            ensureBuffer(t, vpWidth);
          }
        }
        if (!t.unitWidth) return;
      }

      t.position += (MARQUEE_BASE_SPEEDS_PX_S[i] + userBoost) * dt;

      // Backward scroll: if userBoost pushes position negative, prepend a segment.
      while (t.position < 0) {
        t.el.prepend(makeSegmentEl(t.rowBands));
        t.position += t.unitWidth;
      }

      // Fill: keep enough content ahead of the scroll position.
      ensureBuffer(t, vpWidth);

      // Cleanup: once position ≥ unitWidth the first segment has completely scrolled
      // off-screen left. Remove it and subtract its width from position so the visual
      // is identical — this keeps the DOM from growing without bound.
      while (t.position >= t.unitWidth && t.el.childElementCount > MARQUEE_MIN_SEGMENTS) {
        const firstSeg = t.el.firstElementChild;
        if (!firstSeg) break;
        const removedWidth = firstSeg.getBoundingClientRect().width || t.unitWidth;
        t.el.removeChild(firstSeg);
        t.position -= removedWidth;
      }

      t.el.style.transform = `translate3d(${-t.position}px, 0, 0)`;
    });

    rafId = requestAnimationFrame(tick);
  }

  /**
   * Normalizes WheelEvent delta values into pixel delta units.
   *
   * @param {WheelEvent} event - Wheel event object.
   * @returns {number} Pixel delta for scrolling.
   */
  function wheelPixels(event) {
    let dx = event.deltaX + (event.shiftKey ? event.deltaY : 0);
    if (event.deltaMode === 1) dx *= 16;
    if (event.deltaMode === 2) dx *= 800;
    return dx;
  }

  /**
   * Event handler for wheel/trackpad scrolling over the marquee container.
   *
   * @param {WheelEvent} event - The wheel event.
   */
  function onWheel(event) {
    const dy = event.shiftKey ? 0 : event.deltaY;
    const dx = wheelPixels(event);
    const dominantHorizontal = event.shiftKey
      || (Math.abs(dx) > 0.01 && Math.abs(dx) >= Math.abs(dy));
    if (!dominantHorizontal) return;
    if (!event.shiftKey && Math.abs(dx) < 0.01) return;
    userBoost += dx * MARQUEE_WHEEL_SENSITIVITY;
    userBoost = Math.min(MARQUEE_USER_BOOST_MAX, Math.max(-MARQUEE_USER_BOOST_MAX, userBoost));
    event.preventDefault();
  }

  /**
   * Remeasures segment widths and refuels buffers on layout/font updates.
   */
  function remeasure() {
    const vpWidth = getVpWidth();
    perTrack.forEach((t) => {
      const seg = t.el.querySelector('.music-news-marquee-segment');
      if (!seg) return;
      const w = seg.getBoundingClientRect().width;
      if (w > 0) {
        t.unitWidth = w;
        ensureBuffer(t, vpWidth);
      }
    });
  }

  let resizeDebounce;
  /**
   * Debounced window resize handler to trigger remeasurement.
   */
  function onResize() {
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(remeasure, 150);
  }

  window.addEventListener('resize', onResize);
  marqueeRootEl.addEventListener('wheel', onWheel, { passive: false });

  let resizeObserver;
  if (typeof ResizeObserver !== 'undefined' && viewport) {
    resizeObserver = new ResizeObserver(remeasure);
    resizeObserver.observe(viewport);
  }

  requestAnimationFrame(() => {
    remeasure();
    lastTs = null;
    rafId = requestAnimationFrame(tick);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(remeasure);
    }
  });

  return () => {
    clearTimeout(resizeDebounce);
    window.removeEventListener('resize', onResize);
    marqueeRootEl.removeEventListener('wheel', onWheel);
    if (resizeObserver) resizeObserver.disconnect();
    if (rafId != null) cancelAnimationFrame(rafId);
  };
}

/**
 * Generates HTML button markup for band filter buttons with count badges.
 *
 * @param {string[]} bandsOrdered - Sorted array of band names.
 * @param {Map<string, number>} countsMap - Map of band names to article match counts.
 * @param {string|null} selectedBand - Currently selected band name, or null if unfiltered.
 * @returns {string} HTML markup string of button elements.
 */
function renderHitBandFilters(bandsOrdered, countsMap, selectedBand) {
  return bandsOrdered
    .map((band, index) => {
      const count = countsMap.get(band);
      const selected = selectedBand === band;
      return `
    <button
      type="button"
      class="band-filter${selected ? ' band-filter--selected' : ''}"
      data-band-index="${index}"
      aria-pressed="${selected}">
      <span class="band-filter__name">${escapeHTML(band)}</span>
      <span class="band-filter__count">${count}</span>
    </button>`;
    })
    .join('');
}

ready.document(() => {
  const listEl = document.getElementById('music-news-list');
  const metaEl = document.getElementById('music-news-meta');
  const emptyEl = document.getElementById('music-news-empty');
  const queriedWrapEl = document.getElementById('music-news-bands-queried-wrap');
  const marqueeEl = document.getElementById('music-news-bands-marquee');
  const hitsWrapEl = document.getElementById('music-news-bands-hits-wrap');
  const hitsEl = document.getElementById('music-news-bands-hits');

  let articles = [];
  let bandHitCounts = new Map();
  let bandsHitOrder = [];
  let selectedBand = null;

  /**
   * Filters articles by selectedBand (if any) and updates article list and filter button active states.
   */
  function applyFilter() {
    const filtered = selectedBand
      ? articles.filter((a) => (a.matched_bands || []).includes(selectedBand))
      : articles;

    listEl.innerHTML = filtered.map(renderArticle).join('');

    if (hitsEl && bandHitCounts.size > 0) {
      hitsEl.innerHTML = renderHitBandFilters(bandsHitOrder, bandHitCounts, selectedBand);
    }
  }

  fetch('/band-news/articles.json')
    .then((response) => response.json())
    .then((data) => {
      const rawArticles = data.articles || [];
      const bandsList = data.bands_list || [];

      if (bandsList.length > 0) {
        queriedWrapEl.hidden = false;
        initBandsMarquee(marqueeEl, bandsList);
      }

      if (rawArticles.length > 0) {
        metaEl.innerHTML = renderMeta(data);
        articles = rawArticles;
        bandHitCounts = buildBandHitCounts(articles);
        bandsHitOrder = [...bandHitCounts.keys()].sort((a, b) => a.localeCompare(b));

        if (bandsHitOrder.length > 0) {
          hitsWrapEl.hidden = false;
        }

        applyFilter();

        hitsEl.addEventListener('click', (event) => {
          const btn = event.target.closest('[data-band-index]');
          if (!btn) return;
          const index = parseInt(btn.dataset.bandIndex, 10);
          const band = bandsHitOrder[index];
          if (band === undefined) return;

          if (selectedBand === band) {
            selectedBand = null;
          } else {
            selectedBand = band;
          }
          applyFilter();
        });
      } else {
        emptyEl.style.display = 'block';
      }
    })
    .catch((error) => {
      console.error(error);
      emptyEl.style.display = 'block';
    });
});
