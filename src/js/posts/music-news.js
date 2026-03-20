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
const MARQUEE_MIN_TAGS_PER_SEGMENT = 14;
// One loop must be much wider than the clip so the seam never shows empty space.
const MARQUEE_SEGMENT_TO_VIEWPORT_MIN = 2.4;

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

function expandRowBandsForWidth(rowBands) {
  if (rowBands.length === 0) return rowBands;
  let expanded = [...rowBands];
  while (expanded.length < MARQUEE_MIN_TAGS_PER_SEGMENT) {
    expanded = expanded.concat(rowBands);
  }
  return expanded;
}

function renderMarqueeSegmentTags(bands) {
  return bands
    .map((band) => `<span class="band-tag band-tag--queried">${escapeHTML(band)}</span>`)
    .join('');
}

function renderMarqueeRow(rowBands) {
  const segmentBands = expandRowBandsForWidth(rowBands);
  const segmentInner = renderMarqueeSegmentTags(segmentBands);
  const seg = (ariaHidden) => (
    `<div class="music-news-marquee-segment"${ariaHidden ? ' aria-hidden="true"' : ''}>${segmentInner}</div>`
  );
  return `
    <div class="music-news-marquee-row">
      <div class="music-news-marquee-track">
        ${seg(false)}
        ${seg(true)}
        ${seg(true)}
      </div>
    </div>`;
}

function staticQueriedRowHtml(tags) {
  const row = 'music-news-marquee-row music-news-marquee-row--static';
  const inner = 'music-news-marquee-static-inner';
  return `<div class="${row}"><div class="${inner}">${tags}</div></div>`;
}

function renderQueriedBandsMarquee(bandsList) {
  const rows = splitBandsIntoMarqueeRows(bandsList);
  return `
    <div class="music-news-marquee-viewport">
      ${rows.map((rowBands) => renderMarqueeRow(rowBands)).join('')}
    </div>`;
}

function syncTrackSegmentHtml(track, html) {
  track.querySelectorAll('.music-news-marquee-segment').forEach((el) => {
    el.innerHTML = html;
  });
}

/**
 * Repeat each row's pattern until one segment is wide enough vs the visible row;
 * avoids empty space in the clip and seams when fonts finish loading.
 */
function padMarqueeTracksToFillWidth(tracks, rowBandsByTrack, widthHintPx) {
  const hint = Math.max(widthHintPx || 0, 320);
  tracks.forEach((track, i) => {
    const rowEl = track.closest('.music-news-marquee-row');
    const rowW = rowEl && rowEl.clientWidth > 0 ? rowEl.clientWidth : hint;
    const target = Math.max(rowW, hint) * MARQUEE_SEGMENT_TO_VIEWPORT_MIN;
    const base = rowBandsByTrack[i];
    if (!base || base.length === 0) return;

    let expanded = expandRowBandsForWidth(base);
    let guard = 0;
    while (guard < 200) {
      const seg = track.querySelector('.music-news-marquee-segment');
      const segW = seg ? seg.getBoundingClientRect().width : 0;
      if (segW >= target) break;
      expanded = expanded.concat(base);
      syncTrackSegmentHtml(track, renderMarqueeSegmentTags(expanded));
      guard += 1;
    }
  });
}

function initBandsMarquee(marqueeRootEl, bandsList) {
  if (!marqueeRootEl) return () => {};

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion) {
    const rows = splitBandsIntoMarqueeRows(bandsList);
    const staticRows = rows
      .map((rowBands) => staticQueriedRowHtml(
        renderMarqueeSegmentTags(expandRowBandsForWidth(rowBands)),
      ))
      .join('');
    const vp = 'music-news-marquee-viewport music-news-marquee-viewport--static';
    marqueeRootEl.innerHTML = `<div class="${vp}">${staticRows}</div>`;
    return;
  }

  marqueeRootEl.innerHTML = renderQueriedBandsMarquee(bandsList);

  const viewport = marqueeRootEl.querySelector('.music-news-marquee-viewport');
  const tracks = marqueeRootEl.querySelectorAll('.music-news-marquee-track');
  if (!viewport || !tracks.length) return () => {};

  const state = {
    positions: [],
    segmentWidths: [],
    baseSpeeds: MARQUEE_BASE_SPEEDS_PX_S.slice(),
    userBoost: 0,
    lastTs: null,
    rafId: null,
  };

  function segmentWidth(track) {
    const seg = track.querySelector('.music-news-marquee-segment');
    if (!seg) return 0;
    const w = seg.getBoundingClientRect().width;
    return w > 0 ? w : 0;
  }

  function measure() {
    const prev = state.positions.slice();
    state.segmentWidths = [];
    state.positions = [];
    tracks.forEach((track, i) => {
      const w = segmentWidth(track);
      state.segmentWidths.push(w);
      const pos = prev[i];
      if (w <= 0) {
        state.positions[i] = 0;
      } else if (pos === undefined || Number.isNaN(pos)) {
        state.positions[i] = Math.random() * w;
      } else {
        let wrapped = pos % w;
        if (wrapped < 0) wrapped += w;
        state.positions[i] = wrapped;
      }
    });
  }

  function tick(ts) {
    if (state.lastTs == null) state.lastTs = ts;
    const dt = Math.min((ts - state.lastTs) / 1000, 0.1);
    state.lastTs = ts;

    state.userBoost *= Math.exp(-MARQUEE_USER_BOOST_DECAY_PER_S * dt);
    if (Math.abs(state.userBoost) < 0.5) state.userBoost = 0;

    tracks.forEach((track, i) => {
      let W = state.segmentWidths[i];
      if (!W) {
        W = segmentWidth(track);
        if (W) state.segmentWidths[i] = W;
      }
      if (!W) return;
      const speed = state.baseSpeeds[i] + state.userBoost;
      state.positions[i] += speed * dt;
      while (state.positions[i] >= W) state.positions[i] -= W;
      while (state.positions[i] < 0) state.positions[i] += W;
      track.style.transform = `translate3d(${-state.positions[i]}px, 0, 0)`;
    });

    state.rafId = requestAnimationFrame(tick);
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
    state.userBoost += dx * MARQUEE_WHEEL_SENSITIVITY;
    state.userBoost = Math.min(
      MARQUEE_USER_BOOST_MAX,
      Math.max(-MARQUEE_USER_BOOST_MAX, state.userBoost),
    );
    event.preventDefault();
  }

  const rowBandsByTrack = splitBandsIntoMarqueeRows(bandsList);

  function startAnimation() {
    measure();
    state.lastTs = null;
    if (state.rafId != null) cancelAnimationFrame(state.rafId);
    state.rafId = requestAnimationFrame(tick);
  }

  function layoutMarqueeAndRemeasure() {
    const wHint = marqueeRootEl.getBoundingClientRect().width || window.innerWidth;
    padMarqueeTracksToFillWidth(tracks, rowBandsByTrack, wHint);
    measure();
  }

  let resizeDebounce;
  function onResizePad() {
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(() => {
      layoutMarqueeAndRemeasure();
    }, 150);
  }

  window.addEventListener('resize', onResizePad);
  marqueeRootEl.addEventListener('wheel', onWheel, { passive: false });

  let resizeObserver;
  if (typeof ResizeObserver !== 'undefined' && viewport) {
    resizeObserver = new ResizeObserver(() => {
      measure();
    });
    resizeObserver.observe(viewport);
  }

  requestAnimationFrame(() => {
    layoutMarqueeAndRemeasure();
    requestAnimationFrame(startAnimation);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        layoutMarqueeAndRemeasure();
      });
    }
  });

  return () => {
    clearTimeout(resizeDebounce);
    window.removeEventListener('resize', onResizePad);
    marqueeRootEl.removeEventListener('wheel', onWheel);
    if (resizeObserver) resizeObserver.disconnect();
    if (state.rafId != null) cancelAnimationFrame(state.rafId);
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
