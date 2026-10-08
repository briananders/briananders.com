/**
 * Returns a random-number generator for build-time template code.
 *
 * Unseeded builds get `Math.random`. When `BUILD_RANDOM_SEED` is set (golden
 * builds; see `constants/golden-build`), returns a seeded linear congruential
 * generator so the output is reproducible. Call it once per page: each call
 * starts a fresh sequence, so render order can't change a page's values.
 *
 * @returns {() => number} Generator yielding floats in [0, 1).
 * @throws {RangeError} If `BUILD_RANDOM_SEED` is set but not an integer.
 */
module.exports = function buildRandom() {
  const seed = process.env.BUILD_RANDOM_SEED;
  if (!seed) return Math.random;

  if (!/^\d+$/.test(seed)) {
    throw new RangeError(`BUILD_RANDOM_SEED is not an integer: "${seed}"`);
  }

  // Numerical Recipes LCG constants; every intermediate stays below 2^53, so float math is exact.
  const MODULUS = 2 ** 32;
  let state = Number(seed) % MODULUS;
  return function seededRandom() {
    state = (state * 1664525 + 1013904223) % MODULUS;
    return state / MODULUS;
  };
};
