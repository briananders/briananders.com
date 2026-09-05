const sharp = require('sharp');

/**
 * Converts a raster image to an AVIF sibling.
 *
 * AVIF quality is intentionally fixed here so local preview and production
 * builds produce the same output.
 *
 * @param {string} sourceImage - Absolute path to the source image.
 * @param {{ dir: { src: string, package: string } }} options
 * @returns {Promise<object>} Sharp output metadata.
 */
function convertToAvif(sourceImage, { dir }) {
  const destinationFileName = sourceImage.replace(dir.src, dir.package);
  const destination = `${destinationFileName.substring(0, destinationFileName.lastIndexOf('.'))}.avif`;

  return sharp(sourceImage)
    .avif({ quality: 80 })
    .toFile(destination);
}

module.exports = convertToAvif;
