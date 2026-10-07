// -----------------------------------------------------------------------------
// Number and date formatting shared by the Last.fm dashboards.
// -----------------------------------------------------------------------------

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * @param {number} value - Number to format.
 * @returns {string} Thousands-separated integer ("12,346").
 */
function number(value) {
  return Math.round(Number(value) || 0).toLocaleString('en-US');
}

/**
 * Compact form for tight spaces: 950 → "950", 12346 → "12.3K", 268699 → "269K".
 *
 * @param {number} value - Number to format.
 * @returns {string} Compact string.
 */
function compact(value) {
  const n = Number(value) || 0;
  if (Math.abs(n) < 1000) return String(Math.round(n));
  if (Math.abs(n) < 100000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  if (Math.abs(n) < 1000000) return `${Math.round(n / 1000)}K`;
  return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
}

/**
 * @param {number} ratio - 0..1 share.
 * @param {number} [digits=0] - Decimal places.
 * @returns {string} Percentage ("42%").
 */
function percent(ratio, digits = 0) {
  return `${((Number(ratio) || 0) * 100).toFixed(digits)}%`;
}

/**
 * Signed relative change, e.g. +12% / −4%. Uses a true minus sign.
 *
 * @param {number} ratio - Relative change (0.12 for +12%).
 * @returns {string} Signed percentage.
 */
function signedPercent(ratio) {
  const rounded = Math.round(ratio * 100);
  if (rounded === 0) return '±0%';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}%`;
}

/**
 * Signed percentage-point change, e.g. +3.2 pts.
 *
 * @param {number} delta - Change in share (0.032 for +3.2 points).
 * @returns {string} Signed points.
 */
function signedPoints(delta) {
  const pts = Math.round(delta * 1000) / 10;
  if (pts === 0) return '±0 pts';
  return `${pts > 0 ? '+' : '−'}${Math.abs(pts).toFixed(1)} pts`;
}

/**
 * @param {string} key - "YYYY-MM".
 * @param {boolean} [long=false] - Full month name.
 * @returns {string} "Mar 2025" or "March 2025".
 */
function monthLabel(key, long = false) {
  const [y, m] = key.split('-').map(Number);
  return `${(long ? MONTHS_LONG : MONTHS_SHORT)[m - 1]} ${y}`;
}

/**
 * @param {Date} date - UTC date.
 * @param {boolean} [withYear=true] - Append the year.
 * @returns {string} "Sep 22, 2026" or "Sep 22".
 */
function shortDate(date, withYear = true) {
  const base = `${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}`;
  return withYear ? `${base}, ${date.getUTCFullYear()}` : base;
}

/**
 * Human date range for a period span.
 *
 * @param {{ start: Date, end: Date }} span - Period span.
 * @returns {string} "Aug 30 – Sep 29, 2026" or "Dec 29, 2025 – Jan 4, 2026".
 */
function dateRange(span) {
  const sameYear = span.start.getUTCFullYear() === span.end.getUTCFullYear();
  return `${shortDate(span.start, !sameYear)} – ${shortDate(span.end)}`;
}

module.exports = {
  MONTHS_LONG,
  MONTHS_SHORT,
  compact,
  dateRange,
  monthLabel,
  number,
  percent,
  shortDate,
  signedPercent,
  signedPoints,
};
