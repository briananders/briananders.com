const fs = require('fs-extra');
const { globSync } = require('glob');
const mapLimit = require('../helpers/map-limit');

/**
 * Replace full local URL paths without touching longer filenames or remote URLs.
 *
 * @param {string} contents - HTML or JSON text.
 * @param {Map<string, string>} mappings - Output-relative path → hashed path.
 * @param {string} [origin] - The site's own origin with a trailing slash. URLs
 *   that start with it are local too: social tags (`og:image`) and JSON-LD
 *   must be absolute, and would 404 if they kept the unhashed name.
 * @returns {string}
 */
function replacePaths(contents, mappings, origin = '') {
  // HTML attributes, CSS url(), JSON strings, and srcset entries use these delimiters.
  return contents.replace(
    /(^|[\s"'`(=,])((?:\/)?[^\s"'`()<>=?#,]+)(?=[?#\s"'`)<>,]|$)/g,
    (match, prefix, url) => {
      let base = url.startsWith('/') ? '/' : '';
      if (origin && url.startsWith(origin)) base = origin;
      const replacement = mappings.get(url.slice(base.length));
      return replacement ? `${prefix}${base}${replacement}` : match;
    }
  );
}

async function finishHashing({
  dir, completionFlags, buildEvents, hashingFileNameList,
}) {
  const flags = completionFlags.ASSET_HASH;
  if (!flags.IMAGES || !flags.CSS || !flags.JS || flags.REWRITING || flags.DONE) return;
  flags.REWRITING = true;
  try {
    const mappings = new Map(Object.entries(hashingFileNameList).map(([from, to]) => [
      from.slice(dir.package.length), to.slice(dir.package.length)
    ]));
    const { domain } = require(`${dir.build}constants/site-data`)(dir);
    await mapLimit(globSync(`${dir.package}**/*.{html,json}`), 8, async (file) => {
      const contents = await fs.readFile(file, 'utf8');
      await fs.writeFile(file, replacePaths(contents, mappings, domain));
    });
    flags.DONE = true;
    buildEvents.emit(require(`${dir.build}constants/build-events`).hashingDone);
  } finally {
    flags.REWRITING = false;
  }
}
module.exports = finishHashing;
module.exports.replacePaths = replacePaths;
