const fs = require('fs-extra');
const { globSync } = require('glob');
const mapLimit = require('../helpers/map-limit');

/** Replace full local URL paths without touching longer filenames or remote URLs. */
function replacePaths(contents, mappings) {
  // HTML attributes, CSS url(), JSON strings, and srcset entries use these delimiters.
  return contents.replace(
    /(^|[\s"'`(=,])((?:\/)?[^\s"'`()<>=?#,]+)(?=[?#\s"'`)<>,]|$)/g,
    (match, prefix, url) => {
      const key = url.startsWith('/') ? url.slice(1) : url;
      const replacement = mappings.get(key);
      return replacement ? `${prefix}${url.startsWith('/') ? '/' : ''}${replacement}` : match;
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
    await mapLimit(globSync(`${dir.package}**/*.{html,json}`), 8, async (file) => {
      const contents = await fs.readFile(file, 'utf8');
      await fs.writeFile(file, replacePaths(contents, mappings));
    });
    flags.DONE = true;
    buildEvents.emit(require(`${dir.build}constants/build-events`).hashingDone);
  } finally {
    flags.REWRITING = false;
  }
}
module.exports = finishHashing;
module.exports.replacePaths = replacePaths;
