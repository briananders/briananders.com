const { execSync } = require('child_process');

/**
 * Site-wide metadata factory.
 *
 * Builds and returns a plain object containing all static site metadata —
 * author info, social links, domain, and build-time context — that gets
 * injected into every EJS template via `bundleEJS`.
 *
 * Commit hash resolution order:
 *   1. `COMMIT_HASH` environment variable (preferred in CI/CD pipelines).
 *   2. Shell out to `git rev-parse HEAD` at build time.
 *   3. Fall back to `'unknown'` if git is unavailable.
 *
 * @param {{ root: string, build: string }} dir - Directory paths object from `constants/directories`.
 * @returns {object} Site metadata object exposed to all EJS templates.
 */
module.exports = (dir) => {
  const pkg = require(`${dir.root}package.json`);
  const production = require(`${dir.build}helpers/production`);

  // Prefer an injected COMMIT_HASH env var (e.g., from GitHub Actions) so that
  // the git binary doesn't need to be available in every build environment.
  let commitHash = process.env.COMMIT_HASH;
  if (!commitHash) {
    try {
      commitHash = execSync('git rev-parse HEAD', {
        encoding: 'utf8',
        cwd: dir.root
      }).trim();
    } catch (error) {
      console.warn('Could not get git commit hash:', error.message);
      commitHash = 'unknown';
    }
  }

  // Build handle/URL pairs so both the bare handle and the full URL are
  // available in templates (e.g. for display text vs. href attributes).
  const instagramHandle = 'imbanders';
  const instagram = `https://instagram.com/${instagramHandle}`;
  const mastodonHandle = 'banders';
  const mastodon = `https://mastodon.social/@${mastodonHandle}`;
  const twitterHandle = 'imbanders';
  const twitter = `https://twitter.com/${twitterHandle}`;
  const cdYTHandle = 'bandersdrums';
  const cdYT = `https://www.youtube.com/@${cdYTHandle}`;

  return {
    /** Current git commit SHA, or `'unknown'` if git is unavailable. */
    commitHash,
    /** `true` during dev/preview builds (`NODE_ENV !== 'production'`). */
    devBuild: !production,
    /** Package version string from `package.json`. */
    version: pkg.version,
    name: 'Brian Anders',
    description: "Brian Anders is an Engineering Manager in the tech industry. I'm also a YouTuber, Podcaster, and Musician.",
    author: 'Brian Anders',
    /** Primary contact URL (Twitter/X profile). */
    contact: twitter,
    /** Canonical production domain, including trailing slash. */
    domain: 'https://briananders.com/',
    instagram,
    instagramHandle,
    lastfm: 'https://www.last.fm/user/imbanders',
    bluesky: 'https://bsky.app/profile/imbanders.bsky.social',
    twitterHandle,
    twitter,
    github: 'https://github.com/briananders',
    linkedin: 'https://www.linkedin.com/in/andersbrian/',
    mastodonHandle,
    mastodon,
    /** Banders Drums YouTube channel data. */
    bandersDrums: {
      youtubeHandle: cdYTHandle,
      youtube: cdYT,
      /** Relative path for the drums page on this site. */
      path: '/drums',
    },
    batLessons: 'https://batlessons.com',
    batLessonsYT: 'https://www.youtube.com/@batlessons',
  };
};
