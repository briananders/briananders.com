/**
 * Pinned build-time values for golden builds.
 *
 * Every page embeds build-time values (`build-id` and `build-datetime` meta
 * tags, the copyright year, sitemap `lastmod` for undated pages, `build.txt`),
 * and some templates draw random numbers at build time. Left live, they change
 * on every run, so regenerating `golden/` touched every file even when no page
 * changed. `index.js` exports these as environment variables of the same name
 * when `--golden` is passed.
 *
 * Date output is formatted in UTC so the build machine's timezone can't
 * change it; noon keeps the datetime clear of a day boundary regardless.
 */
module.exports = {
  BUILD_DATETIME: '2026-01-01T12:00:00.000Z',
  BUILD_RANDOM_SEED: '1',
  COMMIT_HASH: 'golden',
};
