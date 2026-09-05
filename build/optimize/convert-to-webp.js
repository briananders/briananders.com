const sharp = require('sharp');

/**
 * Converts a single raster image to WebP format.
 *
 * Uses Sharp to produce a sibling `.webp` file in the output directory
 * alongside the original format.
 * The source file itself is not modified — only the destination path changes.
 *
 * @param {string} sourceImage - Absolute path to the source image in `src/`.
 * @param {{ dir: { src: string, package: string, build: string } }} options
 * @returns {Promise<object>} Sharp output metadata.
 */
function convertToWebp(sourceImage, { dir }) {
  const destinationFileName = sourceImage.replace(dir.src, dir.package);
  const destination = `${destinationFileName.substring(0, destinationFileName.lastIndexOf('.'))}.webp`;

  return sharp(sourceImage)
    .webp()
    .toFile(destination);
}

module.exports = convertToWebp;
