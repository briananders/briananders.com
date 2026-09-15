const fs = require('fs-extra');
const { globSync } = require('glob');
const { promisify } = require('util');
const gzip = promisify(require('zlib').gzip);
const mapLimit = require('../helpers/map-limit');

/** Compress a bounded batch, and signal completion only after all writes finish. */
module.exports = async function gzipFiles({ dir, completionFlags, buildEvents }) {
  completionFlags.GZIP = false;
  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  await mapLimit(globSync(`${dir.package}**/*.+(html|xml|css|js|txt|json)`), 8, async (file) => {
    await fs.writeFile(`${file}.gz`, await gzip(await fs.readFile(file)));
  });
  completionFlags.GZIP = true;
  buildEvents.emit(BUILD_EVENTS.gzipDone);
};
