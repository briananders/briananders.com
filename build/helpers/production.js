/**
 * Production mode flag.
 *
 * Evaluates to `true` when the build is running in production mode —
 * specifically when the `NODE_ENV` environment variable (after trimming
 * whitespace and lowercasing) equals `'production'`.
 *
 * This flag is checked throughout the build pipeline to toggle:
 * - JavaScript and CSS minification
 * - HTML minification
 * - Source maps (disabled in production)
 * - Asset hashing and gzip compression
 * - Error handling strictness (fatal vs. recoverable errors in dev)
 * - Dev-server proxy and live-reload setup
 *
 * @type {boolean}
 */
module.exports = (process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
