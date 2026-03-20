const path = require('path');
const { optimize } = require('svgo');
const { readFileSync, writeFile, mkdirpSync } = require('fs-extra');

/**
 * SVGO plugin configuration.
 *
 * Uses `preset-default`, which applies a curated set of safe optimizations
 * such as removing redundant attributes, collapsing transforms, and
 * minifying colour values. No custom overrides are applied — the preset
 * defaults are sufficient and forward-compatible with svgo v4.
 */
const plugins = [
  {
    name: 'preset-default',
  },
];

/**
 * Optimizes an SVG file and returns the resulting SVG string.
 *
 * Used by `ejs-functions.js` to inline optimized SVGs directly into HTML
 * templates via the `getFileContents()` helper.
 *
 * @param {string} filePath - Absolute path to the source `.svg` file.
 * @returns {string} The optimized SVG markup as a string.
 */
function getSVG(filePath) {
  const svgString = readFileSync(filePath);

  const { data } = optimize(svgString, {
    path: filePath,
    plugins,
  });

  return data;
}

/**
 * Optimizes an SVG and writes the result to the output directory.
 *
 * Called by `move-assets.js` during the image-moving stage. Mirrors the
 * source file's path from `src/` into `package/`, creating intermediate
 * directories as needed.
 *
 * @param {string} filePath - Absolute path to the source `.svg` file in `src/`.
 * @param {{ dir: { src: string, package: string } }} options
 */
function optimizeSvg(filePath, { dir }) {
  const svgString = readFileSync(filePath);
  const destination = filePath.replace(dir.src, dir.package);

  const { data } = optimize(svgString, {
    path: filePath,
    plugins,
  });

  // Ensure the destination subdirectory exists before writing.
  mkdirpSync(path.dirname(destination));

  writeFile(destination, data, (e) => {
    if (e) throw e;
  });
}

module.exports = {
  getSVG,
  optimizeSvg,
};
