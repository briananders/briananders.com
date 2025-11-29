const { execSync } = require('child_process');

module.exports = (dir) => {
  const pkg = require(`${dir.root}package.json`);
  const production = require(`${dir.build}helpers/production`);

  // Get commit hash from git
  let commitHash = process.env.COMMIT_HASH;
  if (!commitHash) {
    try {
      commitHash = execSync('git rev-parse HEAD', {
        encoding: 'utf8',
        cwd: dir.root,
      }).trim();
    } catch (error) {
      console.warn('Could not get git commit hash:', error.message);
      commitHash = 'unknown';
    }
  }

  const instagramHandle = 'imbanders';
  const instagram = `https://instagram.com/${instagramHandle}`;
  const mastodonHandle = 'banders';
  const mastodon = `https://mastodon.social/@${mastodonHandle}`;
  const twitterHandle = 'imbanders';
  const twitter = `https://twitter.com/${twitterHandle}`;
  const cdYTHandle = 'bandersdrums';
  const cdYT = `https://www.youtube.com/@${cdYTHandle}`;

  return {
    commitHash,
    devBuild: !production,
    version: pkg.version,
    name: 'Brian Anders',
    description: "Brian Anders is an Engineer Manager in the tech industry. I'm also a Youtuber, Podcaster, and Musician.",
    author: 'Brian Anders',
    contact: twitter,
    domain: 'https://briananders.com/', // set domain
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
    bandersDrums: {
      youtubeHandle: cdYTHandle,
      youtube: cdYT,
      path: '/drums',
    },
    batLessons: 'https://batlessons.com',
  };
};
