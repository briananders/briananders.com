/**
 * Determines whether the user prefers dark mode via CSS media query.
 *
 * @type {boolean}
 */
module.exports.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
