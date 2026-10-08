/**
 * The build's notion of "now".
 *
 * Returns the `BUILD_DATETIME` environment variable as a Date when set,
 * otherwise the current time. Golden builds set it (see
 * `constants/golden-build`) so their output is reproducible.
 *
 * @returns {Date}
 * @throws {RangeError} If `BUILD_DATETIME` is set but not a parseable date.
 */
module.exports = function buildDate() {
  const pinned = process.env.BUILD_DATETIME;
  if (!pinned) return new Date();

  const date = new Date(pinned);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`BUILD_DATETIME is not a valid date: "${pinned}"`);
  }
  return date;
};
