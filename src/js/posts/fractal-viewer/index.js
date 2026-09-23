const ready = require('../../_modules/document-ready');
const createFractalCore = require('./core');
const FRACTALS = require('./fractals');

// Preview passes: coarse blocks first so zooming always shows the fractal forming,
// then full resolution once the view holds still.
const PASSES = [8, 3, 1];
const STRIP_BLOCKS = 6; // strip height = step * STRIP_BLOCKS rows
const MAX_ITER = 8000;
// float64 carries ~16 significant digits (one ulp near 1.0 is 2.2e-16). Below ~4 ulps
// per pixel, neighbouring pixels collapse onto the same number and the image turns to blocks.
const PRECISION_FLOOR = 1e-15;
const MIN_ZOOM = 0.25;

/**
 * Spins up render workers from the core's source. Falls back to a main-thread shim
 * when workers are unavailable (e.g. a CSP that blocks blob: workers).
 *
 * @param {Function} onResult - Receives each finished strip.
 * @returns {Array<{ postMessage: Function, busy: boolean }>} Worker handles.
 */
function createPool(onResult) {
  const count = Math.max(2, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
  const source = `var core = (${createFractalCore.toString()})();
self.onmessage = function (e) {
  var r = core.renderStrip(e.data);
  self.postMessage(r, [r.pixels.buffer]);
};`;
  const pool = [];
  try {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    for (let i = 0; i < count; i++) {
      const worker = new Worker(url);
      const handle = { busy: false, postMessage: (job) => worker.postMessage(job) };
      worker.onmessage = (e) => onResult(handle, e.data);
      pool.push(handle);
    }
  } catch (err) {
    const core = createFractalCore();
    const handle = { busy: false };
    handle.postMessage = (job) => setTimeout(() => onResult(handle, core.renderStrip(job)), 0);
    pool.push(handle);
  }
  return pool;
}

/**
 * Formats a number with enough digits to distinguish neighbouring pixels.
 *
 * @param {number} value - Coordinate.
 * @param {number} scale - World units per pixel.
 * @returns {string} Formatted coordinate.
 */
function formatCoord(value, scale) {
  const digits = Math.min(16, Math.max(2, Math.ceil(-Math.log10(scale)) + 1));
  return value.toFixed(digits).replace('-', '−');
}

/**
 * Formats the zoom factor (e.g. 2.5×, 1.3e+9×).
 *
 * @param {number} zoom - Zoom factor.
 * @returns {string} Label.
 */
function formatZoom(zoom) {
  if (zoom < 1000) return `${zoom < 10 ? zoom.toFixed(2) : Math.round(zoom)}×`;
  return `${zoom.toExponential(1).replace('e+', ' × 10^')}×`.replace(/\^(\d+)/, '<sup>$1</sup>');
}

ready.document(() => {
  const select = document.querySelector('#fractal-select');
  const paletteSelect = document.querySelector('#palette-select');
  const equationEl = document.querySelector('.fractal-equation .equation');
  const captionEl = document.querySelector('.fractal-equation .caption');
  const linkEl = document.querySelector('.fractal-equation .reference');
  const viewer = document.querySelector('.fractal-viewer');
  const canvas = viewer.querySelector('canvas');
  const context = canvas.getContext('2d');
  const hud = viewer.querySelector('.hud');
  const status = viewer.querySelector('.status');
  const scratch = document.createElement('canvas');
  const scratchContext = scratch.getContext('2d');

  let fractal = FRACTALS[0];
  let view = { ...fractal.view };
  let palette = paletteSelect.value;
  let shown = null; // view + fractal the canvas pixels currently depict
  let jobId = 0;
  let queue = [];
  let pass = 0;
  let pending = 0;
  let totalStrips = 0;
  let doneStrips = 0;
  let frame = null;
  let hashTimer = null;

  // ---------------------------------------------------------------- catalog UI

  const groups = {};
  FRACTALS.forEach((f) => {
    if (!groups[f.group]) {
      groups[f.group] = document.createElement('optgroup');
      groups[f.group].label = f.group;
      select.appendChild(groups[f.group]);
    }
    const option = document.createElement('option');
    option.value = f.id;
    option.textContent = f.name;
    groups[f.group].appendChild(option);
  });

  // ---------------------------------------------------------------- geometry

  /** @returns {number} World units per device pixel for the current view. */
  function scaleOf(v) {
    return v.span / Math.min(canvas.width, canvas.height);
  }

  /** @returns {number} Smallest span allowed before float64 runs out of digits. */
  function minSpan(v) {
    const magnitude = Math.max(Math.abs(v.cx), Math.abs(v.cy), 0.5);
    return magnitude * PRECISION_FLOOR * Math.min(canvas.width, canvas.height);
  }

  /**
   * Converts a client (CSS pixel) position into device pixels on the canvas.
   *
   * @returns {{ x: number, y: number }} Device-pixel position.
   */
  function toCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  /**
   * Zooms by `factor` keeping the world point under device pixel (px, py) fixed.
   *
   * @param {number} factor - >1 zooms in.
   * @param {number} px - Anchor x in device pixels.
   * @param {number} py - Anchor y in device pixels.
   */
  function zoomAt(factor, px = canvas.width / 2, py = canvas.height / 2) {
    const maxSpan = fractal.view.span / MIN_ZOOM;
    const span = Math.min(maxSpan, Math.max(minSpan(view), view.span / factor));
    const before = scaleOf(view);
    const after = span / Math.min(canvas.width, canvas.height);
    const dx = px - canvas.width / 2;
    const dy = py - canvas.height / 2;
    view = {
      cx: view.cx + dx * (before - after),
      cy: view.cy - dy * (before - after),
      span,
    };
    requestRender();
  }

  /**
   * Pans by a device-pixel offset (content moves with the pointer).
   */
  function panBy(dx, dy) {
    const scale = scaleOf(view);
    view = { ...view, cx: view.cx - dx * scale, cy: view.cy + dy * scale };
    requestRender();
  }

  // ---------------------------------------------------------------- rendering

  const pool = createPool((worker, result) => {
    worker.busy = false;
    if (result.id === jobId) {
      context.putImageData(new ImageData(result.pixels, result.width, result.rows), 0, result.y0);
      pending--;
      doneStrips++;
      if (pending === 0 && queue.length === 0) nextPass();
      updateStatus();
    }
    dispatch();
  });

  /** Hands queued strips to idle workers. */
  function dispatch() {
    pool.forEach((worker) => {
      if (worker.busy || queue.length === 0) return;
      worker.busy = true;
      worker.postMessage(queue.shift());
    });
  }

  /**
   * Iteration budget for a zoom level: each doubling of zoom adds perOctave, so new
   * boundary detail keeps resolving instead of flattening into the interior color.
   *
   * @param {Object} def - Fractal definition.
   * @param {number} zoom - Zoom factor.
   * @returns {number} Iteration cap (0 for the geometric fractals).
   */
  function iterationsFor(def, zoom) {
    if (!def.iter) return 0;
    const octaves = Math.max(0, Math.log2(zoom));
    return Math.min(MAX_ITER, Math.round(def.iter.base + def.iter.perOctave * octaves));
  }

  /**
   * Queues the next preview pass of the current job, ordering strips from the center
   * outward. Uses the job's snapshot, not the live view, which may already have moved.
   */
  function nextPass() {
    if (pass >= PASSES.length) return;
    const step = PASSES[pass++];
    const { view: jobView, def } = shown;
    const scale = scaleOf(jobView);
    const zoom = def.view.span / jobView.span;
    const base = {
      id: jobId,
      fractal: def.id,
      palette: shown.palette,
      width: canvas.width,
      height: canvas.height,
      cx: jobView.cx,
      cy: jobView.cy,
      scale,
      zoom,
      step,
      flipY: !!def.flipY,
      density: def.density || 0.16,
      maxIter: iterationsFor(def, zoom),
      levels: def.levelBase ? Math.log(3 / scale) / Math.log(def.levelBase) + 2 : 0,
    };
    const stripHeight = step * STRIP_BLOCKS;
    const strips = [];
    for (let y0 = 0; y0 < canvas.height; y0 += stripHeight) {
      strips.push({ ...base, y0, rows: Math.min(stripHeight, canvas.height - y0) });
    }
    const mid = canvas.height / 2;
    strips.sort((a, b) => Math.abs(a.y0 + a.rows / 2 - mid) - Math.abs(b.y0 + b.rows / 2 - mid));
    queue = strips;
    pending = strips.length;
    dispatch();
  }

  /**
   * Repaints the last image stretched into the new view so pans and zooms respond
   * instantly while the workers catch up.
   */
  function reprojectShown() {
    if (!shown || shown.fractal !== fractal.id || shown.palette !== palette
      || shown.width !== canvas.width || shown.height !== canvas.height) return;
    const oldScale = scaleOf(shown.view);
    const newScale = scaleOf(view);
    const k = oldScale / newScale;
    if (k > 64 || k < 1 / 64) return;
    const w = canvas.width;
    const h = canvas.height;
    const dx = (shown.view.cx - view.cx) / newScale + (w / 2) * (1 - k);
    const dy = (view.cy - shown.view.cy) / newScale + (h / 2) * (1 - k);
    scratch.width = w;
    scratch.height = h;
    scratchContext.drawImage(canvas, 0, 0);
    context.fillStyle = '#000';
    context.fillRect(0, 0, w, h);
    context.drawImage(scratch, dx, dy, w * k, h * k);
  }

  /** Starts a fresh render of the current view, abandoning any in-flight work. */
  function render() {
    frame = null;
    if (!canvas.width || !canvas.height) return;
    reprojectShown();
    jobId++;
    queue = [];
    pass = 0;
    doneStrips = 0;
    totalStrips = PASSES
      .reduce((sum, step) => sum + Math.ceil(canvas.height / (step * STRIP_BLOCKS)), 0);
    shown = {
      view: { ...view },
      def: fractal,
      fractal: fractal.id,
      palette,
      width: canvas.width,
      height: canvas.height,
    };
    nextPass();
    updateHud();
    scheduleHash();
  }

  /** Coalesces bursts of input (wheel, drag) into one render per frame. */
  function requestRender() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  /** Shows render progress. */
  function updateStatus() {
    const done = doneStrips >= totalStrips;
    status.textContent = done ? '' : `Rendering ${Math.round((doneStrips / totalStrips) * 100)}%`;
    viewer.classList.toggle('is-rendering', !done);
  }

  /** Writes zoom, iteration and position readouts. */
  function updateHud() {
    const scale = scaleOf(view);
    const zoom = fractal.view.span / view.span;
    const parts = [`Zoom ${formatZoom(zoom)}`];
    if (fractal.iter) parts.push(`${iterationsFor(fractal, zoom).toLocaleString()} iterations`);
    const im = view.cy * (fractal.flipY ? -1 : 1);
    parts.push(`${formatCoord(view.cx, scale)} ${im < 0 ? '−' : '+'} ${formatCoord(Math.abs(im), scale)}<i>i</i>`);
    if (view.span <= minSpan(view) * 1.01) parts.push('<strong>float64 precision limit</strong>');
    hud.innerHTML = parts.join('<span class="sep" aria-hidden="true">·</span>');
  }

  /** Matches the canvas backing store to its displayed size. */
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (w === canvas.width && h === canvas.height) return;
    canvas.width = w;
    canvas.height = h;
    requestRender();
  }

  // ---------------------------------------------------------------- selection + URL

  /** Shows the selected fractal's equation above the viewer. */
  function showEquation() {
    equationEl.innerHTML = fractal.equation;
    captionEl.innerHTML = fractal.caption;
    linkEl.href = fractal.link;
    linkEl.textContent = `More about the ${fractal.name}`;
  }

  /**
   * Switches fractals, optionally restoring a saved view.
   *
   * @param {string} id - Fractal id.
   * @param {Object} [savedView] - View to restore instead of the default.
   */
  function selectFractal(id, savedView) {
    fractal = FRACTALS.find((f) => f.id === id) || FRACTALS[0];
    select.value = fractal.id;
    view = savedView || { ...fractal.view };
    showEquation();
    requestRender();
  }

  /** Mirrors fractal + view into the URL hash so any location can be shared. */
  function scheduleHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => {
      const hash = `#${fractal.id}/${view.cx}/${view.cy}/${view.span}/${palette}`;
      if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
    }, 400);
  }

  /** @returns {boolean} Whether a valid view was restored from the URL hash. */
  function restoreFromHash() {
    const [id, cx, cy, span, pal] = window.location.hash.slice(1).split('/');
    if (!FRACTALS.some((f) => f.id === id)) return false;
    if (pal && paletteSelect.querySelector(`option[value="${pal}"]`)) {
      paletteSelect.value = pal;
      palette = pal;
    }
    const saved = { cx: Number(cx), cy: Number(cy), span: Number(span) };
    const valid = [saved.cx, saved.cy, saved.span].every(Number.isFinite) && saved.span > 0;
    selectFractal(id, valid ? saved : undefined);
    return true;
  }

  // ---------------------------------------------------------------- input

  select.addEventListener('change', () => selectFractal(select.value));
  paletteSelect.addEventListener('change', () => {
    palette = paletteSelect.value;
    requestRender();
  });

  viewer.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const nudge = Math.min(canvas.width, canvas.height) / 4;
      switch (button.dataset.action) {
        case 'zoom-in': zoomAt(2); break;
        case 'zoom-out': zoomAt(0.5); break;
        case 'up': panBy(0, nudge); break;
        case 'down': panBy(0, -nudge); break;
        case 'left': panBy(nudge, 0); break;
        case 'right': panBy(-nudge, 0); break;
        default: selectFractal(fractal.id);
      }
    });
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 33;
    else if (e.deltaMode === 2) delta *= canvas.clientHeight;
    const point = toCanvas(e.clientX, e.clientY);
    zoomAt(Math.exp(-Math.max(-300, Math.min(300, delta)) * 0.002), point.x, point.y);
  }, { passive: false });

  canvas.addEventListener('dblclick', (e) => {
    const point = toCanvas(e.clientX, e.clientY);
    zoomAt(e.shiftKey ? 0.5 : 2, point.x, point.y);
  });

  // Pointer events cover mouse drag, one-finger pan, and two-finger pinch.
  const pointers = new Map();
  let gesture = null;

  /** @returns {{ x: number, y: number, d: number }} Centroid and spread of active pointers. */
  function gestureState() {
    const points = Array.from(pointers.values());
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    const d = points.length > 1
      ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
      : 0;
    return { x, y, d };
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, toCanvas(e.clientX, e.clientY));
    gesture = gestureState();
    viewer.classList.add('is-dragging');
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, toCanvas(e.clientX, e.clientY));
    const next = gestureState();
    panBy(next.x - gesture.x, next.y - gesture.y);
    if (next.d && gesture.d) zoomAt(next.d / gesture.d, next.x, next.y);
    gesture = next;
  });

  /** Ends a pointer's participation in the current gesture. */
  function releasePointer(e) {
    pointers.delete(e.pointerId);
    gesture = pointers.size ? gestureState() : null;
    if (!pointers.size) viewer.classList.remove('is-dragging');
  }
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);

  canvas.addEventListener('keydown', (e) => {
    const nudge = Math.min(canvas.width, canvas.height) / 8;
    const actions = {
      ArrowUp: () => panBy(0, nudge),
      ArrowDown: () => panBy(0, -nudge),
      ArrowLeft: () => panBy(nudge, 0),
      ArrowRight: () => panBy(-nudge, 0),
      '+': () => zoomAt(1.5),
      '=': () => zoomAt(1.5),
      '-': () => zoomAt(1 / 1.5),
      _: () => zoomAt(1 / 1.5),
      0: () => selectFractal(fractal.id),
    };
    if (!actions[e.key]) return;
    e.preventDefault();
    actions[e.key]();
  });

  // Pasted links and back/forward only change the hash; replaceState never fires this.
  window.addEventListener('hashchange', restoreFromHash);

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);

  if (!restoreFromHash()) selectFractal(FRACTALS[0].id);
  resize();
});
