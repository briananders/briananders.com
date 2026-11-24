import type { BuildDirectories } from '../types.ts';

const resolveCommitHash: (root: string) => string = require('../helpers/commit-hash.ts');
const buildDate: () => Date = require('../helpers/build-date.ts');
const buildRandom: () => () => number = require('../helpers/build-random.ts');

interface PackageJson {
  version: string;
}

interface BandersDrumsData {
  youtubeHandle: string;
  youtube: string;
  path: string;
}

interface ResolvedSiteData {
  commitHash: string;
  buildDateTime: string;
  buildRandom: () => () => number;
  devBuild: boolean;
  version: string;
  name: string;
  description: string;
  author: string;
  jobTitle: string;
  locale: string;
  contact: string;
  domain: string;
  instagram: string;
  instagramHandle: string;
  lastfm: string;
  bluesky: string;
  twitterHandle: string;
  twitter: string;
  github: string;
  linkedin: string;
  mastodonHandle: string;
  mastodon: string;
  bandersDrums: BandersDrumsData;
  batLessons: string;
  batLessonsYT: string;
  [key: string]: unknown;
}

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
 * @param dir - Directory paths from `constants/directories`.
 * @returns Site metadata object exposed to all EJS templates.
 */
function createSiteData(dir: Pick<BuildDirectories, 'root' | 'build'>): ResolvedSiteData {
  const pkg: PackageJson = require(`${dir.root}package.json`);
  const production: boolean = require(`${dir.build}helpers/production.ts`);

  // Prefer an injected COMMIT_HASH env var (e.g., from GitHub Actions) so that
  // the git binary doesn't need to be available in every build environment.
  const commitHash = resolveCommitHash(dir.root);

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
    /** ISO 8601 build time; pinned via `BUILD_DATETIME` in golden builds. */
    buildDateTime: buildDate().toISOString(),
    /**
     * Random-number generator factory for build-time template code; use it
     * instead of `Math.random`. Seeded via `BUILD_RANDOM_SEED` in golden builds.
     */
    buildRandom,
    /** `true` during dev/preview builds (`NODE_ENV !== 'production'`). */
    devBuild: !production,
    /** Package version string from `package.json`. */
    version: pkg.version,
    name: 'Brian Anders',
    // eslint-disable-next-line @stylistic/max-len
    description: "Brian Anders is an Engineering Manager in the tech industry. I'm also a YouTuber, Podcaster, and Musician.",
    author: 'Brian Anders',
    /** Used in the Person structured data on every page. */
    jobTitle: 'Engineering Manager',
    /** BCP 47 language of every page, for structured data and Open Graph. */
    locale: 'en-US',
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
}

module.exports = createSiteData;
