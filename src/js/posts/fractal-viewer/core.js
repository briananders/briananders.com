/**
 * Fractal render core.
 *
 * Everything lives inside one self-contained factory so the viewer can stringify
 * it into a Web Worker via a Blob URL. Keep this file free of anything Babel would
 * rewrite into an external helper (for...of, spread, classes, destructuring, typeof,
 * closures over loop variables) — helpers live outside the function and would not
 * survive toString().
 *
 * @returns {{ renderStrip: Function, PALETTES: Object }} Render API.
 */
function createFractalCore() {
  const LUT_SIZE = 2048;
  const BAILOUT = 1e6; // |z|^2 escape radius; large radius keeps smooth coloring clean
  const LOG2 = Math.log(2);
  const LOG3 = Math.log(3);
  const SQRT3 = Math.sqrt(3);

  // Cyclic gradient stops: [position 0..1, r, g, b]
  const PALETTES = {
    deco: [
      [0, 8, 12, 28], [0.18, 20, 64, 92], [0.36, 32, 150, 150], [0.5, 238, 226, 196],
      [0.64, 212, 175, 55], [0.82, 120, 58, 20], [1, 8, 12, 28]
    ],
    classic: [
      [0, 0, 7, 100], [0.16, 32, 107, 203], [0.42, 237, 255, 255],
      [0.6425, 255, 170, 0], [0.8575, 0, 2, 0], [1, 0, 7, 100]
    ],
    fire: [
      [0, 10, 0, 0], [0.2, 120, 10, 5], [0.4, 230, 70, 10], [0.6, 255, 190, 40],
      [0.75, 255, 250, 210], [0.9, 90, 20, 60], [1, 10, 0, 0]
    ],
    ocean: [
      [0, 2, 10, 30], [0.25, 10, 70, 140], [0.5, 90, 210, 230], [0.62, 240, 255, 255],
      [0.8, 120, 80, 200], [1, 2, 10, 30]
    ],
    gotham: [
      [0, 6, 6, 10], [0.3, 60, 64, 80], [0.5, 230, 230, 235], [0.58, 250, 214, 60],
      [0.7, 70, 74, 90], [1, 6, 6, 10]
    ],
  };

  const lutCache = {};

  /**
   * Builds (and caches) a flat RGB lookup table for a palette.
   *
   * @param {string} name - Palette key.
   * @returns {Uint8Array} LUT_SIZE * 3 RGB bytes.
   */
  function getLut(name) {
    if (lutCache[name]) return lutCache[name];
    const stops = PALETTES[name] || PALETTES.deco;
    const lut = new Uint8Array(LUT_SIZE * 3);
    let s = 0;
    for (let i = 0; i < LUT_SIZE; i++) {
      const t = i / LUT_SIZE;
      while (s < stops.length - 2 && t > stops[s + 1][0]) s++;
      const a = stops[s];
      const b = stops[s + 1];
      let f = (t - a[0]) / (b[0] - a[0]);
      f = f * f * (3 - 2 * f); // smoothstep between stops
      lut[i * 3] = a[1] + (b[1] - a[1]) * f;
      lut[i * 3 + 1] = a[2] + (b[2] - a[2]) * f;
      lut[i * 3 + 2] = a[3] + (b[3] - a[3]) * f;
    }
    lutCache[name] = lut;
    return lut;
  }

  /**
   * Writes a palette color (with optional shading) into an RGBA buffer.
   *
   * @param {Uint8Array} lut - Palette lookup table.
   * @param {number} t - Palette position; wraps every 1.0.
   * @param {number} shade - Brightness multiplier 0..1.
   * @param {Uint8ClampedArray} out - Destination pixels.
   * @param {number} o - Byte offset into out.
   */
  function paint(lut, t, shade, out, o) {
    const f = t - Math.floor(t);
    const i = Math.floor(f * LUT_SIZE) * 3;
    out[o] = lut[i] * shade;
    out[o + 1] = lut[i + 1] * shade;
    out[o + 2] = lut[i + 2] * shade;
    out[o + 3] = 255;
  }

  const KINDS = {
    mandelbrot: 1, julia: 2, 'burning-ship': 3, tricorn: 4, celtic: 5, multibrot: 6, phoenix: 7,
  };

  /**
   * Escape-time iteration for the polynomial fractals.
   * Returns the smooth (normalized) iteration count, or -1 when the orbit never escapes.
   * Brent-style periodicity checking bails out of interior points early — they would
   * otherwise burn the full iteration budget, which grows with zoom.
   *
   * @param {number} k - Fractal code from KINDS.
   * @param {number} px - Real part of the sample point.
   * @param {number} py - Imaginary part of the sample point.
   * @param {number} maxIter - Iteration cap.
   * @param {number} tol - Periodicity tolerance; kept well under a pixel so near-boundary
   *   orbits that merely shadow a cycle are not mistaken for interior points.
   * @returns {number} Smooth iteration count or -1 for interior.
   */
  function escape(k, px, py, maxIter, tol) {
    let x = 0;
    let y = 0;
    let cx = px;
    let cy = py;
    let ox = 0;
    let oy = 0;
    let xx;
    let yy;
    let t;
    let ny;
    let n = 0;

    if (k === 1) {
      // Main cardioid and period-2 bulb never escape; skip them outright.
      const q = (px - 0.25) * (px - 0.25) + py * py;
      if (q * (q + (px - 0.25)) <= 0.25 * py * py) return -1;
      if ((px + 1) * (px + 1) + py * py <= 0.0625) return -1;
    } else if (k === 2) {
      x = px; y = py; cx = -0.8; cy = 0.156;
    } else if (k === 7) {
      // Ushiki's Phoenix, drawn with the real axis vertical (the conventional orientation).
      x = py; y = px; cx = 0.5667; cy = 0;
    }

    let sx = x;
    let sy = y;
    let nextCheck = 8;

    // One tight loop per formula: a shared loop with a per-iteration branch ran ~2x slower.
    if (k === 3) {
      for (; n < maxIter; n++) {
        xx = x * x; yy = y * y;
        if (xx + yy > BAILOUT) break;
        y = Math.abs(2 * x * y) + cy;
        x = xx - yy + cx;
        if (Math.abs(x - sx) + Math.abs(y - sy) < tol) return -1;
        if (n === nextCheck) { sx = x; sy = y; nextCheck *= 2; }
      }
    } else if (k === 4) {
      for (; n < maxIter; n++) {
        xx = x * x; yy = y * y;
        if (xx + yy > BAILOUT) break;
        y = -2 * x * y + cy;
        x = xx - yy + cx;
        if (Math.abs(x - sx) + Math.abs(y - sy) < tol) return -1;
        if (n === nextCheck) { sx = x; sy = y; nextCheck *= 2; }
      }
    } else if (k === 5) {
      for (; n < maxIter; n++) {
        xx = x * x; yy = y * y;
        if (xx + yy > BAILOUT) break;
        y = 2 * x * y + cy;
        x = Math.abs(xx - yy) + cx;
        if (Math.abs(x - sx) + Math.abs(y - sy) < tol) return -1;
        if (n === nextCheck) { sx = x; sy = y; nextCheck *= 2; }
      }
    } else if (k === 6) {
      for (; n < maxIter; n++) {
        xx = x * x; yy = y * y;
        if (xx + yy > BAILOUT) break;
        t = x * (xx - 3 * yy) + cx;
        y = y * (3 * xx - yy) + cy;
        x = t;
        if (Math.abs(x - sx) + Math.abs(y - sy) < tol) return -1;
        if (n === nextCheck) { sx = x; sy = y; nextCheck *= 2; }
      }
    } else if (k === 7) {
      for (; n < maxIter; n++) {
        xx = x * x; yy = y * y;
        if (xx + yy > BAILOUT) break;
        t = xx - yy + cx - 0.5 * ox;
        ny = 2 * x * y - 0.5 * oy;
        ox = x; oy = y;
        x = t; y = ny;
        if (Math.abs(x - sx) + Math.abs(y - sy) < tol) return -1;
        if (n === nextCheck) { sx = x; sy = y; nextCheck *= 2; }
      }
    } else {
      for (; n < maxIter; n++) {
        xx = x * x; yy = y * y;
        if (xx + yy > BAILOUT) break;
        y = 2 * x * y + cy;
        x = xx - yy + cx;
        if (Math.abs(x - sx) + Math.abs(y - sy) < tol) return -1;
        if (n === nextCheck) { sx = x; sy = y; nextCheck *= 2; }
      }
    }

    if (n >= maxIter) return -1;
    return n + 1 - Math.log(Math.log(x * x + y * y) / 2) / (k === 6 ? LOG3 : LOG2);
  }

  /**
   * Newton's method on z^3 - 1. Returns root index * 1e6 + iteration count, or -1.
   *
   * @param {number} px - Real part.
   * @param {number} py - Imaginary part.
   * @param {number} maxIter - Iteration cap.
   * @returns {{ root: number, n: number }} Converged root (or -1) and smooth step count.
   */
  function newton(px, py, maxIter, result) {
    let x = px;
    let y = py;
    const eps = 1e-12;
    for (let n = 0; n < maxIter; n++) {
      const xx = x * x;
      const yy = y * y;
      const d = xx + yy;
      if (d < 1e-300) break;
      // z - (z^3 - 1) / (3 z^2)  ==  (2/3) z + 1 / (3 z^2)
      const d2 = d * d;
      const ix = (xx - yy) / d2; // real part of 1/z^2
      const iy = (-2 * x * y) / d2;
      x = (2 * x + ix) / 3;
      y = (2 * y + iy) / 3;
      const r0 = (x - 1) * (x - 1) + y * y;
      const r1 = (x + 0.5) * (x + 0.5) + (y - SQRT3 / 2) * (y - SQRT3 / 2);
      const r2 = (x + 0.5) * (x + 0.5) + (y + SQRT3 / 2) * (y + SQRT3 / 2);
      let r = 0;
      let dist = r0;
      if (r1 < dist) { r = 1; dist = r1; }
      if (r2 < dist) { r = 2; dist = r2; }
      if (dist < eps) {
        result.root = r;
        // Quadratic convergence: fractional step from how far under eps we landed.
        result.n = n + Math.log(Math.log(eps) / Math.log(dist)) / LOG2 + 1;
        return;
      }
    }
    result.root = -1;
    result.n = maxIter;
  }

  /**
   * Sierpinski triangle via barycentric doubling. Returns the level at which the point
   * falls into a removed middle triangle, 0 for outside, or -1 for points in the set.
   *
   * @param {number} px - X.
   * @param {number} py - Y.
   * @param {number} depth - Levels to resolve.
   * @returns {number} Level (1-based), 0 outside, -1 inside set.
   */
  function sierpinski(px, py, depth) {
    // Triangle A(-1, -h/2), B(1, -h/2), C(0, h/2) with side 2
    const h = SQRT3;
    let v = (py + h / 2) / h;
    let u = (px + 1) / 2 - v / 2;
    if (u < 0 || v < 0 || u + v > 1) return 0;
    for (let k = 1; k <= depth; k++) {
      u *= 2; v *= 2;
      if (u >= 1) u -= 1;
      else if (v >= 1) v -= 1;
      else if (u + v > 1) return k;
    }
    return -1;
  }

  /**
   * Sierpinski carpet via base-3 digits of both coordinates.
   *
   * @param {number} px - X.
   * @param {number} py - Y.
   * @param {number} depth - Levels to resolve.
   * @returns {number} Level of the removed square, 0 outside, -1 inside set.
   */
  function carpet(px, py, depth) {
    let u = (px + 1) / 2;
    let v = (py + 1) / 2;
    if (u < 0 || v < 0 || u >= 1 || v >= 1) return 0;
    for (let k = 1; k <= depth; k++) {
      u *= 3; v *= 3;
      const iu = Math.floor(u);
      const iv = Math.floor(v);
      if (iu === 1 && iv === 1) return k;
      u -= iu; v -= iv;
    }
    return -1;
  }

  /**
   * Walks one Koch "island" (the region between a unit segment and its Koch curve).
   * Local frame: segment from (0,0) to (1,0), bumps grow toward +y. Each level the
   * bounding triangle splits into a solid middle bump plus four scaled copies, which
   * tile it exactly — so at most one branch is followed per level.
   *
   * @returns {number} Level at which the point was filled, or 0 if it lies outside.
   */
  function kochIsland(x, y, depth) {
    const c = Math.cos(Math.PI / 3);
    const s = Math.sin(Math.PI / 3);
    const slope = 1 / SQRT3;
    for (let k = 1; k <= depth; k++) {
      // Outside this level's bounding triangle (0,0)-(1,0)-(0.5, sqrt3/6)?
      if (y < 0 || y > x * slope || y > (1 - x) * slope) return 0;
      // Middle bump: equilateral triangle on [1/3, 2/3]
      const inBump = x >= 1 / 3 && x <= 2 / 3;
      if (inBump && y <= (x - 1 / 3) * SQRT3 && y <= (2 / 3 - x) * SQRT3) return k;
      let nx;
      let ny;
      if (x < 1 / 3) {
        nx = x * 3; ny = y * 3;
      } else if (x > 2 / 3) {
        nx = (x - 2 / 3) * 3; ny = y * 3;
      } else if (x < 0.5) {
        // Segment (1/3,0)->(1/2, sqrt3/6): rotate by -60deg around (1/3,0)
        const dx = (x - 1 / 3) * 3;
        const dy = y * 3;
        nx = dx * c + dy * s; ny = -dx * s + dy * c;
      } else {
        // Segment (1/2, sqrt3/6)->(2/3,0): rotate by +60deg
        const ex = (x - 0.5) * 3;
        const ey = (y - SQRT3 / 6) * 3;
        nx = ex * c - ey * s; ny = ex * s + ey * c;
      }
      x = nx; y = ny;
    }
    return depth + 1;
  }

  /**
   * Koch snowflake: the base triangle plus a Koch island on each edge.
   *
   * @returns {number} Fill level (1 = base triangle), or 0 outside.
   */
  function koch(px, py, depth) {
    // Equilateral triangle, side 2, centered at origin; vertices listed clockwise so
    // each edge's local +y points outward.
    const R = 2 / SQRT3;
    const ax = 0; const ay = R;
    const bx = 1; const by = -R / 2;
    const cx = -1; const cy = -R / 2;
    const verts = [ax, ay, bx, by, cx, cy, ax, ay];
    let inside = true;
    for (let e = 0; e < 3; e++) {
      const x0 = verts[e * 2];
      const y0 = verts[e * 2 + 1];
      const x1 = verts[e * 2 + 2];
      const y1 = verts[e * 2 + 3];
      const ux = (x1 - x0) / 2;
      const uy = (y1 - y0) / 2;
      // Local frame scaled so the edge spans [0, 1]; +y is the left (outward) normal.
      const lx = ((px - x0) * ux + (py - y0) * uy) / 2;
      const ly = ((py - y0) * ux - (px - x0) * uy) / 2;
      if (ly > 0) {
        inside = false;
        const lvl = kochIsland(lx, ly, depth);
        if (lvl) return lvl + 1;
      }
    }
    return inside ? 1 : 0;
  }

  // Heighway dragon IFS: f1(z) = (1+i)z/2, f2(z) = 1 - (1-i)z/2.
  // Disk enclosing the whole attractor; pruning only needs A inside it, not invariance.
  const DRAGON_CX = 5 / 12;
  const DRAGON_CY = 1 / 12;
  const DRAGON_R = 0.8;
  const dragonStack = new Float64Array(6 * 512);

  /**
   * Heighway dragon via depth-first inverse iteration with bounding-disk pruning.
   * Colors follow the curve parameter t in [0,1], tracked as phase = frac(t * cycles)
   * so deep zooms keep precision (t itself would underflow past ~1e8 zoom).
   *
   * @param {number} px - X.
   * @param {number} py - Y.
   * @param {number} eps - Half a pixel in world units.
   * @param {number} cycles - Palette cycles along the whole curve.
   * @returns {number} Palette phase, or -1 if the point misses the dragon.
   */
  function dragon(px, py, eps, cycles) {
    const st = dragonStack;
    st[0] = px; st[1] = py; st[2] = eps; st[3] = 0; st[4] = cycles; st[5] = 0;
    let sp = 1;
    let nodes = 0;
    while (sp > 0) {
      sp--;
      let b = sp * 6;
      const x = st[b];
      const y = st[b + 1];
      const e = st[b + 2];
      const phase = st[b + 3];
      const span = st[b + 4];
      const depth = st[b + 5];
      const dx = x - DRAGON_CX;
      const dy = y - DRAGON_CY;
      const lim = DRAGON_R + e;
      // Skip pieces whose bounding disk misses the pixel entirely.
      if (dx * dx + dy * dy <= lim * lim) {
        if (DRAGON_R < e || depth > 160 || ++nodes > 6000) return phase + span / 2;
        // Stack grows by at most one entry per level, so depth <= 160 keeps it under 512.
        const e2 = e * Math.SQRT2;
        // f2 inverse: (1 - z)(1 + i); the second half of the curve runs backwards
        const ax = 1 - x;
        const ay = -y;
        const p2 = phase + span;
        b = sp * 6;
        st[b] = ax - ay; st[b + 1] = ax + ay; st[b + 2] = e2;
        st[b + 3] = p2 - Math.floor(p2); st[b + 4] = -span / 2; st[b + 5] = depth + 1;
        sp++;
        // f1 inverse: z(1 - i)
        b = sp * 6;
        st[b] = x + y; st[b + 1] = y - x; st[b + 2] = e2;
        st[b + 3] = phase; st[b + 4] = span / 2; st[b + 5] = depth + 1;
        sp++;
      }
    }
    return -1;
  }

  /**
   * Renders a horizontal strip of the current view into RGBA pixels.
   *
   * @param {Object} job - Render parameters from the main thread.
   * @returns {Object} Job echo plus the `pixels` buffer.
   */
  function renderStrip(job) {
    const { width } = job;
    const { height } = job;
    const { rows } = job;
    const { step } = job;
    const { scale } = job; // world units per device pixel
    const kind = job.fractal;
    const lut = getLut(job.palette);
    const out = new Uint8ClampedArray(width * rows * 4);
    const { maxIter } = job;
    const flip = job.flipY ? -1 : 1;
    const { density } = job;
    const levels = Math.max(4, Math.ceil(job.levels));
    const nres = { root: -1, n: 0 };
    const { zoom } = job;
    const code = KINDS[kind];
    const periodTol = Math.max(1e-15, Math.min(1e-10, scale * 1e-4));

    for (let ry = 0; ry < rows; ry += step) {
      const py = job.y0 + ry;
      const wy = flip * (job.cy - (py + step / 2 - height / 2) * scale);
      for (let rx = 0; rx < width; rx += step) {
        const wx = job.cx + (rx + step / 2 - width / 2) * scale;
        const o = (ry * width + rx) * 4;
        let lvl;

        if (kind === 'newton') {
          newton(wx, wy, maxIter, nres);
          if (nres.root < 0) {
            out[o] = 0; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 255;
          } else {
            // Hue = root, brightness falls off with the steps it took to get there.
            paint(lut, 0.3 + nres.root * 0.17, 0.3 + 0.7 * Math.exp(-nres.n * 0.18), out, o);
          }
        } else if (kind === 'sierpinski' || kind === 'carpet' || kind === 'koch') {
          if (kind === 'sierpinski') lvl = sierpinski(wx, wy, levels);
          else if (kind === 'carpet') lvl = carpet(wx, wy, levels);
          else lvl = koch(wx, wy, levels);
          if (kind === 'koch') {
            if (lvl === 0) {
              out[o] = 6; out[o + 1] = 8; out[o + 2] = 16; out[o + 3] = 255;
            } else {
              paint(lut, 0.12 + lvl * 0.083, 1, out, o);
            }
          } else if (lvl === 0) {
            out[o] = 6; out[o + 1] = 8; out[o + 2] = 16; out[o + 3] = 255;
          } else if (lvl < 0) {
            out[o] = 250; out[o + 1] = 244; out[o + 2] = 228; out[o + 3] = 255;
          } else {
            paint(lut, 0.1 + lvl * 0.083, 0.35 + 0.65 * 0.9 ** (lvl % 12), out, o);
          }
        } else if (kind === 'dragon') {
          // Area-filling curve: the parameter span on screen shrinks with zoom^2.
          const ph = dragon(wx, wy, scale * 0.75, 3 * zoom * zoom);
          if (ph < 0) {
            out[o] = 6; out[o + 1] = 8; out[o + 2] = 16; out[o + 3] = 255;
          } else {
            paint(lut, ph, 1, out, o);
          }
        } else {
          const mu = escape(code, wx, wy, maxIter, periodTol);
          if (mu < 0) {
            out[o] = 0; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 255;
          } else {
            paint(lut, Math.sqrt(Math.max(mu, 0)) * density, 1, out, o);
          }
        }

        // Fill the step x step block (preview passes)
        if (step > 1) {
          const r = out[o];
          const g = out[o + 1];
          const bl = out[o + 2];
          for (let by = 0; by < step && ry + by < rows; by++) {
            for (let bx = 0; bx < step && rx + bx < width; bx++) {
              const p = ((ry + by) * width + rx + bx) * 4;
              out[p] = r; out[p + 1] = g; out[p + 2] = bl; out[p + 3] = 255;
            }
          }
        }
      }
    }

    return {
      id: job.id,
      y0: job.y0,
      rows,
      width,
      pixels: out,
    };
  }

  return { renderStrip, PALETTES };
}

module.exports = createFractalCore;
