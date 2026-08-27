const ready = require('../_modules/document-ready');

function escapeHTML(str) {
  const tempElement = document.createElement('temp');
  tempElement.innerHTML = str;
  return tempElement.innerText;
}

function articleLink(link, content, classes = '') {
  return `<a href="${escapeHTML(link)}" class="${classes}" target="_blank" rel="noopener" itemprop="url">${content}</a>`;
}

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

function renderMeta(data) {
  return `Tracking ${data.bands_tracked} bands across ${data.feeds_checked} feeds`;
}

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

function renderMarqueeSegmentTags(bands) {
  return bands
    .map((band) => `<span class="band-tag band-tag--queried">${escapeHTML(band)}</span>`)
    .join('');
}

/** Create a single segment element (one full copy of a row's band list). */
function makeSegmentEl(bands) {
  const el = document.createElement('div');
  el.className = 'music-news-marquee-segment';
  el.innerHTML = renderMarqueeSegmentTags(bands);
  return el;
}

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

  // The full-bleed element's getBoundingClientRect().width can be 0 during first layout.
  // Fall back to window.innerWidth so we always have a usable viewport width.
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
   */
  function ensureBuffer(t, vpWidth) {
    const needed = t.position + vpWidth * MARQUEE_AHEAD_BUFFER_VP;
    let totalWidth = t.el.childElementCount * t.unitWidth;
    while (totalWidth < needed) {
      t.el.appendChild(makeSegmentEl(t.rowBands));
      totalWidth += t.unitWidth;
    }
  }

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

  function wheelPixels(event) {
    let dx = event.deltaX + (event.shiftKey ? event.deltaY : 0);
    if (event.deltaMode === 1) dx *= 16;
    if (event.deltaMode === 2) dx *= 800;
    return dx;
  }

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
