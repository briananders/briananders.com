import type { PluginConfig } from 'svgo';
import type { BuildDirectories } from '../types.ts';

const path: typeof import('path') = require('path');
const { optimize }: typeof import('svgo') = require('svgo');
const { readFileSync, writeFile, mkdirpSync }: typeof import('fs-extra') = require('fs-extra');

/**
 * SVGO plugin configuration.
 *
 * Uses `preset-default`, which applies a curated set of safe optimizations
 * such as removing redundant attributes, collapsing transforms, and
 * minifying colour values. No custom overrides are applied — the preset
 * defaults are sufficient and forward-compatible with svgo v4.
 */
const plugins: PluginConfig[] = [
  {
    name: 'preset-default',
  }
];

/**
 * Optimizes an SVG file and returns the resulting SVG string.
 *
 * Used by `ejs-functions.ts` to inline optimized SVGs directly into HTML
 * templates via the `getFileContents()` helper.
 *
 * @param filePath - Absolute path to the source `.svg` file.
 * @returns The optimized SVG markup as a string.
 */
function getSVG(filePath: string): string {
  const svgString = readFileSync(filePath, 'utf8');

  const { data } = optimize(svgString, {
    path: filePath,
    plugins,
  });

  return data;
}

/**
 * Optimizes an SVG and writes the result to the output directory.
 *
 * Called by `move-assets.ts` during the image-moving stage. Mirrors the
 * source file's path from `src/` into `package/`, creating intermediate
 * directories as needed.
 *
 * @param filePath - Absolute path to the source `.svg` file in `src/`.
 * @param options - Options containing source and output directories.
 */
function optimizeSvg(
  filePath: string,
  { dir }: { dir: Pick<BuildDirectories, 'src' | 'package'> },
): Promise<void> {
  const svgString = readFileSync(filePath, 'utf8');
  const destination = filePath.replace(dir.src, dir.package);

  const { data } = optimize(svgString, {
    path: filePath,
    plugins,
  });

  // Ensure the destination subdirectory exists before writing.
  mkdirpSync(path.dirname(destination));

  return writeFile(destination, data);
}

module.exports = {
  getSVG,
  optimizeSvg,
};
