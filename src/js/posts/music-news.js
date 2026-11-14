const ready = require('../_modules/document-ready');
require('../_components/last-updated').init();
require('../_components/multiselect-dropdown').init();
const { createMusicNews } = require('../_modules/band-news/controller');
const { escapeHTML } = require('../_modules/band-news/render');

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
      // eslint-disable-next-line max-len
      return `<div class="music-news-marquee-row music-news-marquee-row--static"><div class="music-news-marquee-static-inner">${inner}</div></div>`;
    }).join('');
    // eslint-disable-next-line max-len
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

ready.document(() => {
  const byId = (id) => document.getElementById(id);
  const marqueeWrapEl = byId('music-news-bands-queried-wrap');
  const marqueeEl = byId('music-news-bands-marquee');
  let stopMarquee = () => { };
  let marqueeBands = '';

  createMusicNews({
    elements: {
      root: byId('music-news'),
      meta: byId('music-news-meta'),
      list: byId('music-news-list'),
      empty: byId('music-news-empty'),
      historyWrap: byId('music-news-history-wrap'),
      historySelect: byId('music-news-history-select'),
      historyPrev: byId('music-news-history-prev'),
      historyNext: byId('music-news-history-next'),
      historyLatest: byId('music-news-history-latest'),
      newWrap: byId('music-news-new-wrap'),
      newOnly: byId('music-news-new-only'),
      tagsWrap: byId('music-news-tags-wrap'),
      tags: byId('music-news-tags'),
      bandsWrap: byId('music-news-bands-hits-wrap'),
      bandsSelect: byId('music-news-bands-select'),
      filterStatus: byId('music-news-filter-status'),
    },
    // Each snapshot carries the artist list it searched; restart the marquee
    // only when that list actually changes between snapshots.
    onFeedChange(feed) {
      const key = feed.bandsList.join('\n');
      if (key === marqueeBands) return;
      marqueeBands = key;
      stopMarquee();
      marqueeWrapEl.hidden = feed.bandsList.length === 0;
      stopMarquee = feed.bandsList.length ? initBandsMarquee(marqueeEl, feed.bandsList) : () => { };
    },
  });
});
