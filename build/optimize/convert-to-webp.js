const webp = require('webp-converter');
const path = require('path');
const { log } = console;

/**
 * Converts a single raster image to WebP format.
 *
 * Uses `webp-converter` (a wrapper around the `cwebp` binary) to produce a
 * sibling `.webp` file in the output directory alongside the original format.
 * The source file itself is not modified — only the destination path changes.
 *
 * Only files whose extension is listed in `webpCandidates` (`jpg`, `jpeg`,
 * `png`) are converted; calling this function with an SVG or WebP source
 * logs a cancellation and returns early.
 *
 * @param {string} sourceImage - Absolute path to the source image in `src/`.
 * @param {{ dir: { src: string, package: string, build: string } }} options
 * @returns {Promise|undefined} The promise returned by `webp-converter`, or
 *   `undefined` if the file is not a conversion candidate.
 */
function convertToWebp(sourceImage, { dir }) {
  const timestamp = require(`${dir.build}helpers/timestamp`);
  const extn = path.extname(sourceImage);

  const { webpCandidates } = require(`${dir.build}constants/file-formats`);

  // Skip files that aren't raster candidates (e.g. SVGs, already-WebP files).
  if (!webpCandidates.includes(extn.substring(1))) {
    log(`${timestamp.stamp()} convertToWebp(): ${'CANCELLED'.bold.yellow} not conversion candidates`);
    return;
  }

  // Grant execute permissions to the cwebp binary bundled by webp-converter.
  webp.grant_permission();

  // Mirror the src/ path structure into package/, swapping the extension to .webp.
  const destinationFileName = sourceImage.replace(dir.src, dir.package);
  const result = webp.cwebp(sourceImage, `${destinationFileName.substring(0, destinationFileName.lastIndexOf('.'))}.webp`);

  return result;
}

module.exports = convertToWebp;
