import type { EventEmitter } from 'node:events';
import type { BuildDirectories, BuildEventsMap, CompletionFlags } from './types.ts';

const fs: typeof import('fs-extra') = require('fs-extra');
const { globSync }: typeof import('glob') = require('glob');
const path: typeof import('path') = require('path');
const pngToIco: typeof import('png-to-ico') = require('png-to-ico');

const { log } = console;
const mapLimit: <T>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<unknown> | unknown,
) => Promise<void> = require('./helpers/map-limit.ts');

interface AssetCompletionFlags extends Partial<CompletionFlags> {
  ASSETS_ARE_MOVED?: boolean;
  FAVICON_ICO?: boolean;
}

interface AssetDirConfigs {
  dir: Pick<BuildDirectories, 'src' | 'package' | 'build'>;
  debug?: boolean;
}

interface MoveAssetsConfigs extends AssetDirConfigs {
  completionFlags: AssetCompletionFlags;
  buildEvents: EventEmitter;
  BUILD_EVENTS: BuildEventsMap;
}

interface FileFormats {
  images: string[];
  videos: string[];
  rasterImages: string[];
  rasterSourceImages: string[];
}

interface ConvertToAvifModule {
  (sourceImage: string, options: { dir: Pick<BuildDirectories, 'src' | 'package'> }): Promise<void>;
  MANIFEST_NAME: string;
  isGeneratedAvif: (avifPath: string, options: { dir: Pick<BuildDirectories, 'src'> }) => boolean;
  removeGeneratedAvif: (sourceImage: string, options: { dir: Pick<BuildDirectories, 'src'> }) => void;
}

interface TimestampHelper {
  stamp: () => string;
}

/**
 * Converts `src/images/favicon_base.png` to `favicon.ico` and writes it to
 * the output directory root.
 *
 * Uses `png-to-ico` (which exports an async default function in v3+) to
 * perform the PNG → ICO conversion. The resulting buffer is written
 * asynchronously and awaited before image completion is emitted.
 *
 * @param params - Build directory paths and completion flags.
 */
async function makeFaviconIco({
  dir, completionFlags,
}: {
  dir: Pick<BuildDirectories, 'src' | 'package' | 'build'>;
  completionFlags: AssetCompletionFlags;
}): Promise<void> {
  const timestamp: TimestampHelper = require(`${dir.build}helpers/timestamp.ts`);
  log(`${timestamp.stamp()} makeFaviconIco()`);
  completionFlags.FAVICON_ICO = false;
  // png-to-ico v3 ships as ESM with a default export — call via `.default()`.
  const buffer = await pngToIco.default(`${dir.src}images/favicon_base.png`);
  await fs.outputFile(`${dir.package}favicon.ico`, buffer);
  completionFlags.FAVICON_ICO = true;
  log(`${timestamp.stamp()} makeFaviconIco(): ${'MOVED'.green.bold}`);
}

/**
 * Removes the output-directory counterpart of a source file.
 *
 * Called when a source file no longer exists (e.g. deleted during a watch
 * session) so the stale artifact is cleaned up from the output directory.
 *
 * @param srcPath - Absolute path to the (now-missing) source file.
 * @param configs - Build configuration containing directories.
 */
function deletePackageFile(
  srcPath: string,
  { dir }: { dir: Pick<BuildDirectories, 'src' | 'package' | 'build'> },
): void {
  const destPath = srcPath.replace(dir.src, dir.package);
  fs.removeSync(destPath);

  const { rasterImages }: FileFormats = require(`${dir.build}constants/file-formats.ts`);
  const { isGeneratedAvif, removeGeneratedAvif }: ConvertToAvifModule = require(
    `${dir.build}optimize/convert-to-avif.ts`
  );
  const extension = path.extname(srcPath).substring(1).toLowerCase();
  if (!rasterImages.includes(extension)) return;

  const sourceWithoutExtension = srcPath.substring(0, srcPath.lastIndexOf('.'));
  const hasAlternateSource = rasterImages.some((candidate: string) => {
    const alternate = `${sourceWithoutExtension}.${candidate}`;
    return candidate !== extension && fs.existsSync(alternate)
      && !(candidate === 'avif' && isGeneratedAvif(alternate, { dir }));
  });
  if (!hasAlternateSource) {
    const destinationWithoutExtension = destPath.substring(0, destPath.lastIndexOf('.'));
    fs.removeSync(`${destinationWithoutExtension}.webp`);
    fs.removeSync(`${destinationWithoutExtension}.avif`);
    removeGeneratedAvif(srcPath, { dir });
  }
}

/**
 * Copies or optimizes a single image file to the output directory.
 *
 * Dispatch logic by file type:
 * - `.svg` → optimized via SVGO (`optimizeSvg`).
 * - Raster sources → copied as-is and given `.webp` and `.avif` siblings
 *   from one canonical source. The `.avif` is copied from its committed
 *   twin in `src/images/`, encoded there first when missing or stale.
 *
 * If the source file no longer exists the corresponding output file is
 * deleted and the callback is called immediately. Directories are skipped.
 *
 * @param imagePath - Absolute path to the source image.
 * @param configs - Build configuration object.
 * @param callback - Called once the image has been processed.
 */
async function moveOneImage(
  imagePath: string,
  configs: AssetDirConfigs,
  callback: () => void = () => { },
): Promise<void> {
  const {
    dir, debug,
  } = configs;

  const {
    rasterImages, rasterSourceImages,
  }: FileFormats = require(`${dir.build}constants/file-formats.ts`);
  const { optimizeSvg }: {
    optimizeSvg: (filePath: string, options: { dir: Pick<BuildDirectories, 'src' | 'package'> }) => Promise<void>;
  } = require(`${dir.build}optimize/optimize-svgs.ts`);
  const convertToWebp: (
    sourceImage: string,
    options: { dir: Pick<BuildDirectories, 'src' | 'package'> },
  ) => Promise<unknown> = require(`${dir.build}optimize/convert-to-webp.ts`);
  const convertToAvif: ConvertToAvifModule = require(`${dir.build}optimize/convert-to-avif.ts`);
  const timestamp: TimestampHelper = require(`${dir.build}helpers/timestamp.ts`);

  const extn = path.extname(imagePath).toLowerCase();
  const extension = extn.substring(1);
  const destination = imagePath.replace(dir.src, dir.package);

  function hasSourceWithExtension(extensionToCheck: string): boolean {
    const sourceWithoutExtension = imagePath.substring(0, imagePath.lastIndexOf('.'));
    const candidate = `${sourceWithoutExtension}.${extensionToCheck}`;
    if (!fs.existsSync(candidate)) return false;
    // Generated AVIFs are build output that lives in src/, not sources.
    return extensionToCheck !== 'avif' || !convertToAvif.isGeneratedAvif(candidate, { dir });
  }

  // The AVIF manifest sits in src/images/ but is build metadata, not an asset.
  if (path.basename(imagePath) === convertToAvif.MANIFEST_NAME) {
    callback();
    return;
  }

  function isCanonicalRasterSource(): boolean {
    if (rasterSourceImages.includes(extension)) {
      return !rasterSourceImages.slice(0, rasterSourceImages.indexOf(extension))
        .some(hasSourceWithExtension);
    }
    if (extension === 'webp') {
      return !rasterSourceImages.some(hasSourceWithExtension)
        && !hasSourceWithExtension('avif');
    }
    if (extension === 'avif') {
      return !rasterSourceImages.some(hasSourceWithExtension)
        && !hasSourceWithExtension('webp');
    }
    return false;
  }

  if (!fs.existsSync(imagePath)) {
    log(`${timestamp.stamp()} ${imagePath} does not exist`);
    deletePackageFile(imagePath, configs);
    callback();
    return;
  } if (fs.lstatSync(imagePath).isDirectory()) {
    log(`${timestamp.stamp()} ${imagePath} is a directory 1`);
    callback();
    return;
  }

  // Ensure the destination subdirectory exists before writing.
  fs.mkdirpSync(path.dirname(destination));
  if (debug) log(`${timestamp.stamp()} moveOneImage(${imagePath})`);

  if (extn === '.svg') {
    // SVGs are passed through SVGO for optimization before output.
    await optimizeSvg(imagePath, { dir });
    callback();
    return;
  } if (rasterImages.includes(extension)) {
    // Always keep the source format in the output. A canonical source also
    // creates both delivery formats; derived siblings are not reconverted
    // when a source/WebP pair exists, avoiding nondeterministic overwrites.
    // Original sources own the generated formats, even when supplied siblings exist.
    // Skipping their copies prevents concurrent writes to the same destination.
    // Generated AVIFs are copied by convertToAvif() when their source is processed.
    if (extension === 'avif' && convertToAvif.isGeneratedAvif(imagePath, { dir })) {
      callback();
      return;
    }
    if (['webp', 'avif'].includes(extension)
      && rasterSourceImages.some(hasSourceWithExtension)) {
      callback();
      return;
    }
    await fs.copyFile(imagePath, destination);
    if (!isCanonicalRasterSource()) {
      callback();
      return;
    }

    const conversions: Array<Promise<unknown>> = [];
    if (extn !== '.webp') {
      if (debug) log(`${timestamp.stamp()} convertToWebp(${imagePath}): ${destination}`);
      conversions.push(convertToWebp(imagePath, { dir }));
    }
    if (extn !== '.avif') {
      if (debug) log(`${timestamp.stamp()} convertToAvif(${imagePath}): ${destination}`);
      conversions.push(convertToAvif(imagePath, { dir }));
    }

    await Promise.all(conversions);
    callback();
    return;
  }

  await fs.copyFile(imagePath, destination);
  callback();
}

/**
 * Processes all source images and copies/converts them to the output directory.
 *
 * Also triggers `makeFaviconIco` to generate `favicon.ico`. Globbing is
 * driven by the `images` extension list in `constants/file-formats`. When
 * every image has been processed, `IMAGES_ARE_MOVED` is set to `true` and
 * the `imagesMoved` event is emitted.
 *
 * @param configs - Build configuration object.
 */
async function moveAllImages(configs: MoveAssetsConfigs): Promise<void> {
  const {
    dir, completionFlags, buildEvents, BUILD_EVENTS,
  } = configs;
  completionFlags.IMAGES_ARE_MOVED = false;
  const { images }: FileFormats = require(`${dir.build}constants/file-formats.ts`);
  await fs.ensureDir(`${dir.package}images/`);
  await Promise.all([
    makeFaviconIco(configs),
    mapLimit(
      globSync(`${dir.src}images/**/*.{${images.join(',')}}`),
      4,
      (file: string) => moveOneImage(file, configs)
    )
  ]);
  completionFlags.IMAGES_ARE_MOVED = true;
  buildEvents.emit(BUILD_EVENTS.imagesMoved);
}

/**
 * Copies a single video file to the output directory.
 *
 * If the source file is missing the output counterpart is deleted instead.
 * Directories are skipped.
 *
 * @param videoPath - Absolute path to the source video.
 * @param configs - Build configuration object.
 * @param callback - Called once the video has been processed.
 */
async function moveOneVideo(
  videoPath: string,
  configs: AssetDirConfigs,
  callback: () => void = () => { },
): Promise<void> {
  const {
    dir, debug,
  } = configs;

  const timestamp: TimestampHelper = require(`${dir.build}helpers/timestamp.ts`);
  const destination = videoPath.replace(dir.src, dir.package);

  if (!fs.existsSync(videoPath)) {
    log(`${timestamp.stamp()} ${videoPath} does not exist`);
    deletePackageFile(destination, configs);
    callback();
    return;
  } if (fs.lstatSync(videoPath).isDirectory()) {
    log(`${timestamp.stamp()} ${videoPath} is a directory 2`);
    callback();
    return;
  }

  if (debug) log(`${timestamp.stamp()} moveOneVideo(${videoPath})`);

  fs.mkdirpSync(path.dirname(destination));
  await fs.copyFile(videoPath, destination);

  callback();
}

/**
 * Copies all source videos to the output directory.
 *
 * Globbing is driven by the `videos` extension list in `constants/file-formats`.
 * When every video has been processed, `VIDEOS_ARE_MOVED` is set to `true`
 * and the `videosMoved` event is emitted.
 *
 * @param configs - Build configuration object.
 */
async function moveAllVideos(configs: MoveAssetsConfigs): Promise<void> {
  const {
    dir, completionFlags, buildEvents, BUILD_EVENTS,
  } = configs;
  completionFlags.VIDEOS_ARE_MOVED = false;
  const { videos }: FileFormats = require(`${dir.build}constants/file-formats.ts`);
  await fs.ensureDir(`${dir.package}videos/`);
  await mapLimit(
    globSync(`${dir.src}videos/**/*.{${videos.join(',')}}`),
    8,
    (file: string) => moveOneVideo(file, configs)
  );
  completionFlags.VIDEOS_ARE_MOVED = true;
  buildEvents.emit(BUILD_EVENTS.videosMoved);
}

/**
 * Copies a single `.txt` file from the source root to the output directory.
 *
 * Used for files like `robots.txt` and `humans.txt`. If the source file is
 * missing the output counterpart is deleted. Directories are skipped.
 *
 * @param filePath - Absolute path to the source `.txt` file.
 * @param configs - Build configuration object.
 * @param callback - Called once the file has been processed.
 */
async function moveOneTxtFile(
  filePath: string,
  configs: AssetDirConfigs,
  callback: () => void = () => { },
): Promise<void> {
  const {
    dir, debug,
  } = configs;

  const timestamp: TimestampHelper = require(`${dir.build}helpers/timestamp.ts`);
  const destination = filePath.replace(dir.src, dir.package);

  if (!fs.existsSync(filePath)) {
    log(`${timestamp.stamp()} ${filePath} does not exist`);
    deletePackageFile(destination, configs);
    callback();
    return;
  } if (fs.lstatSync(filePath).isDirectory()) {
    log(`${timestamp.stamp()} ${filePath} is a directory 3`);
    callback();
    return;
  }

  if (debug) log(`${timestamp.stamp()} moveOneTxtFile(${filePath})`);

  fs.mkdirpSync(path.dirname(destination));
  await fs.copyFile(filePath, destination);

  callback();
}

/**
 * Copies all `.txt` files from the source root to the output directory.
 *
 * Handles `robots.txt`, `humans.txt`, and any other top-level text files in
 * `src/`. Does not emit a build event — txt files are not a dependency of
 * any downstream stage.
 *
 * @param configs - Build configuration object.
 */
async function moveAllTxtFiles(configs: AssetDirConfigs): Promise<void> {
  const { dir } = configs;
  await mapLimit(
    globSync(`${dir.src}*.txt`),
    8,
    (file: string) => moveOneTxtFile(file, configs)
  );
}

/**
 * Copies a single file from `src/downloads/` to the output directory.
 *
 * Downloads are files exposed for direct browser download (PDFs, ZIPs, etc.).
 * If the source file is missing the output counterpart is deleted. Directories
 * are skipped.
 *
 * @param filePath - Absolute path to the source download file.
 * @param configs - Build configuration object.
 * @param callback - Called once the file has been processed.
 */
async function moveOneDownload(
  filePath: string,
  configs: AssetDirConfigs,
  callback: () => void = () => { },
): Promise<void> {
  const {
    dir, debug,
  } = configs;

  const timestamp: TimestampHelper = require(`${dir.build}helpers/timestamp.ts`);
  const destination = filePath.replace(dir.src, dir.package);

  if (!fs.existsSync(filePath)) {
    log(`${timestamp.stamp()} ${filePath} does not exist`);
    deletePackageFile(destination, configs);
    callback();
    return;
  } if (fs.lstatSync(filePath).isDirectory()) {
    log(`${timestamp.stamp()} ${filePath} is a directory 4`);
    callback();
    return;
  }

  if (debug) log(`${timestamp.stamp()} moveOneDownload(${filePath})`);

  fs.mkdirpSync(path.dirname(destination));
  await fs.copyFile(filePath, destination);

  callback();
}

/**
 * Copies all files from `src/downloads/` to the output directory.
 *
 * Uses `{ nodir: true }` on the glob so that the `downloads/` directory
 * itself is never included in the results (only its contents). Does not emit
 * a build event — downloads are not a dependency of any downstream stage.
 *
 * @param configs - Build configuration object.
 */
async function moveAllDownloads(configs: AssetDirConfigs): Promise<void> {
  const { dir } = configs;
  await fs.ensureDir(`${dir.package}downloads/`);
  await mapLimit(
    globSync(`${dir.src}downloads/**`, { nodir: true }),
    8,
    (file: string) => moveOneDownload(file, configs)
  );
}

module.exports = {
  /**
   * Runs all four asset-move operations in parallel:
   * images (+ favicon), videos, txt files, and downloads.
   *
   * @param configs - Build configuration object.
   */
  moveAssets: async (configs: MoveAssetsConfigs): Promise<void> => {
    configs.completionFlags.ASSETS_ARE_MOVED = false;
    await Promise.all([
      moveAllImages(configs), moveAllVideos(configs),
      moveAllTxtFiles(configs), moveAllDownloads(configs)
    ]);
    configs.completionFlags.ASSETS_ARE_MOVED = true;
    configs.buildEvents.emit(configs.BUILD_EVENTS.assetsMoved);
  },

  // Individual move functions exposed for incremental updates in watch mode.
  moveOneDownload,
  moveOneImage,
  moveOneTxtFile,
  moveOneVideo,
};
