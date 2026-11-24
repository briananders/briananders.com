import type { OutputInfo } from 'sharp';
import type { BuildDirectories } from '../types.ts';

const sharp: typeof import('sharp') = require('sharp');

/**
 * Converts a single raster image to WebP format.
 *
 * Uses Sharp to produce a sibling `.webp` file in the output directory
 * alongside the original format.
 * The source file itself is not modified — only the destination path changes.
 *
 * @param sourceImage - Absolute path to the source image in `src/`.
 * @param options - Options containing source and output directories.
 * @returns Sharp output metadata.
 */
function convertToWebp(
  sourceImage: string,
  { dir }: { dir: Pick<BuildDirectories, 'src' | 'package'> },
): Promise<OutputInfo> {
  const destinationFileName = sourceImage.replace(dir.src, dir.package);
  const destination = `${destinationFileName.substring(0, destinationFileName.lastIndexOf('.'))}.webp`;

  return sharp(sourceImage)
    .webp()
    .toFile(destination);
}

module.exports = convertToWebp;
