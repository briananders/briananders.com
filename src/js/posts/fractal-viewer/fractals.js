/**
 * Fractal catalog: default views, iteration budgets, and the equation markup shown
 * above the viewer.
 *
 * view.span is the world-space size of the default view across the shorter canvas side.
 * iter.base / iter.perOctave set how the iteration cap grows as you zoom (each doubling
 * of zoom adds perOctave), which is what keeps new detail appearing instead of the edges
 * going flat.
 * levelBase is the subdivision factor for the geometric fractals.
 */

const z = (sub, sup = '') => `<i>z</i>${sub ? `<sub>${sub}</sub>` : ''}${sup ? `<sup>${sup}</sup>` : ''}`;
const zn = z('n');
const zn1 = z('n+1');

module.exports = [
  {
    id: 'mandelbrot',
    name: 'Mandelbrot Set',
    group: 'Escape-time',
    view: { cx: -0.65, cy: 0, span: 2.6 },
    iter: { base: 200, perOctave: 60 },
    density: 0.16,
    equation: `${zn1} = ${z('n', '2')} + <i>c</i>`,
    caption: '<i>z</i><sub>0</sub> = 0, <i>c</i> = the pixel. Colored by how fast the orbit escapes.',
    link: 'https://en.wikipedia.org/wiki/Mandelbrot_set',
  },
  {
    id: 'julia',
    name: 'Julia Set',
    group: 'Escape-time',
    view: { cx: 0, cy: 0, span: 2.4 },
    iter: { base: 200, perOctave: 60 },
    density: 0.16,
    equation: `${zn1} = ${z('n', '2')} + <i>c</i>`,
    caption: '<i>z</i><sub>0</sub> = the pixel, <i>c</i> = −0.8 + 0.156<i>i</i>.',
    link: 'https://en.wikipedia.org/wiki/Julia_set',
  },
  {
    id: 'burning-ship',
    name: 'Burning Ship',
    group: 'Escape-time',
    view: { cx: -0.4, cy: 0.55, span: 2.8 },
    flipY: true,
    iter: { base: 200, perOctave: 60 },
    density: 0.16,
    equation: `${zn1} = (|Re(${zn})| + <i>i</i>|Im(${zn})|)<sup>2</sup> + <i>c</i>`,
    caption: '<i>z</i><sub>0</sub> = 0, <i>c</i> = the pixel. Imaginary axis flipped so the ship sails upright.',
    link: 'https://en.wikipedia.org/wiki/Burning_Ship_fractal',
  },
  {
    id: 'tricorn',
    name: 'Tricorn (Mandelbar)',
    group: 'Escape-time',
    view: { cx: -0.3, cy: 0, span: 3.4 },
    iter: { base: 200, perOctave: 60 },
    density: 0.16,
    equation: `${zn1} = <span class="conj"><i>z</i></span><sub>n</sub><sup>2</sup> + <i>c</i>`,
    caption: 'The Mandelbrot iteration with the complex conjugate of <i>z</i>.',
    link: 'https://en.wikipedia.org/wiki/Tricorn_(mathematics)',
  },
  {
    id: 'multibrot',
    name: 'Multibrot (d = 3)',
    group: 'Escape-time',
    view: { cx: 0, cy: 0, span: 2.8 },
    iter: { base: 200, perOctave: 60 },
    density: 0.16,
    equation: `${zn1} = ${z('n', '3')} + <i>c</i>`,
    caption: 'Cubic Mandelbrot: raising the power to <i>d</i> gives <i>d</i> − 1 fold symmetry.',
    link: 'https://en.wikipedia.org/wiki/Multibrot_set',
  },
  {
    id: 'celtic',
    name: 'Celtic Mandelbrot',
    group: 'Escape-time',
    view: { cx: -0.35, cy: 0, span: 3 },
    iter: { base: 200, perOctave: 60 },
    density: 0.16,
    equation: `${zn1} = |Re(${z('n', '2')})| + <i>i</i> Im(${z('n', '2')}) + <i>c</i>`,
    caption: 'Folding the real part of <i>z</i><sup>2</sup> knots the bulbs into interlaced shapes.',
    link: 'https://en.wikibooks.org/wiki/Fractals/Iterations_in_the_complex_plane/Mandelbrot_set#Celtic',
  },
  {
    id: 'phoenix',
    name: 'Phoenix',
    group: 'Escape-time',
    view: { cx: 0, cy: 0, span: 2.4 },
    iter: { base: 200, perOctave: 60 },
    density: 0.16,
    equation: `${zn1} = ${z('n', '2')} + <i>c</i> + <i>p</i> ${z('n−1')}`,
    caption: '<i>c</i> = 0.5667, <i>p</i> = −0.5, <i>z</i><sub>0</sub> = the pixel (real axis vertical). Each step remembers the one before it.',
    link: 'https://en.wikipedia.org/wiki/Phoenix_set',
  },
  {
    id: 'newton',
    name: 'Newton Fractal',
    group: 'Escape-time',
    view: { cx: 0, cy: 0, span: 3 },
    iter: { base: 60, perOctave: 12 },
    density: 0.16,
    equation: `${zn1} = ${zn} − <span class="frac"><span>${z('n', '3')} − 1</span><span>3${z('n', '2')}</span></span>`,
    caption: 'Newton\'s method on <i>z</i><sup>3</sup> − 1. Hue = which cube root of 1 the pixel converges to; brightness = how fast.',
    link: 'https://en.wikipedia.org/wiki/Newton_fractal',
  },
  {
    id: 'sierpinski',
    name: 'Sierpiński Triangle',
    group: 'Self-similar',
    view: { cx: 0, cy: 0, span: 2.1 },
    levelBase: 2,
    equation: 'S = ⋃<sub><i>k</i>=1..3</sub> ½(S + <i>v</i><sub><i>k</i></sub>)',
    caption: 'Three half-size copies of itself, one pinned to each corner <i>v</i><sub><i>k</i></sub>. Holes are colored by the level that removed them.',
    link: 'https://en.wikipedia.org/wiki/Sierpi%C5%84ski_triangle',
  },
  {
    id: 'carpet',
    name: 'Sierpiński Carpet',
    group: 'Self-similar',
    view: { cx: 0, cy: 0, span: 2.3 },
    levelBase: 3,
    equation: 'C = ⋃<sub>(<i>a</i>,<i>b</i>) ≠ (1,1)</sub> ⅓(C + (<i>a</i>, <i>b</i>)),&ensp;<i>a</i>, <i>b</i> ∈ {0, 1, 2}',
    caption: 'Eight third-size copies; the center square is removed at every scale.',
    link: 'https://en.wikipedia.org/wiki/Sierpi%C5%84ski_carpet',
  },
  {
    id: 'koch',
    name: 'Koch Snowflake',
    group: 'Self-similar',
    view: { cx: 0, cy: 0, span: 2.6 },
    levelBase: 3,
    equation: 'K = ⋃<sub><i>k</i>=0..3</sub> <i>f</i><sub><i>k</i></sub>(K),&ensp;<i>f</i><sub><i>k</i></sub>(<i>z</i>) = <i>a</i><sub><i>k</i></sub> + ⅓<i>e</i><sup><i>iθ</i><sub><i>k</i></sub></sup><i>z</i>',
    caption: 'θ = 0, π/3, −π/3, 0. Each edge sprouts a triangle on its middle third, forever. Finite area, infinite perimeter.',
    link: 'https://en.wikipedia.org/wiki/Koch_snowflake',
  },
  {
    id: 'dragon',
    name: 'Heighway Dragon',
    group: 'Self-similar',
    view: { cx: 5 / 12, cy: 1 / 6, span: 1.3 },
    equation: 'D = <i>f</i><sub>1</sub>(D) ∪ <i>f</i><sub>2</sub>(D),&ensp;<i>f</i><sub>1</sub>(<i>z</i>) = ½(1 + <i>i</i>)<i>z</i>,&ensp;<i>f</i><sub>2</sub>(<i>z</i>) = 1 − ½(1 − <i>i</i>)<i>z</i>',
    caption: 'Fold a strip of paper in half forever and unfold it at right angles. Colored by position along the curve.',
    link: 'https://en.wikipedia.org/wiki/Dragon_curve',
  }
];
