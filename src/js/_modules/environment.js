/**
 * Evaluates whether the current environment is production based on the window hostname.
 *
 * @type {boolean}
 */
module.exports.isProduction = (() => window.location.hostname === 'briananders.com')();
