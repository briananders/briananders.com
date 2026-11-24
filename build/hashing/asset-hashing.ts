import type { EventEmitter } from 'node:events';
import type { BuildDirectories, BuildEventsMap, CompletionFlags } from '../types.ts';

const fs: typeof import('fs-extra') = require('fs-extra');
const { globSync }: typeof import('glob') = require('glob');
const XXHash: typeof import('xxhash') = require('xxhash');

const { log } = console;

interface AssetHashingParams {
  dir: Pick<BuildDirectories, 'package' | 'build'>;
  completionFlags: CompletionFlags;
  buildEvents: EventEmitter;
  hashingFileNameList: Record<string, string>;
  debug: boolean;
}

/**
 * Content-hashes all JS and image/video asset files in the output directory.
 *
 * This function is called multiple times — once for each upstream event
 * (`stylesMoved`, `jsMinified`, `htmlMinified`, `imagesMoved`). It guards
 * against premature execution by checking that all five prerequisite flags are
 * set before doing any work. When called before all stages are ready it simply
 * returns `false`.
 *
 * Once all prerequisites are met it runs two parallel hashing passes:
 *
 * **JS pass** — all `.js` files under `package/`:
 *   - Reads each file, computes an XXHash (seed `0xCAFEBABE`), renames the
 *     file to `<basename>-<hash>.js`, and records the mapping in
 *     `hashingFileNameList`. Emits `assetHashJsListed` when done.
 *
 * **Images/Videos pass** — all image and video files under `package/images/`
 * and `package/videos/`:
 *   - Same rename/record process as JS. Emits `assetHashImagesListed` when done,
 *     which in turn triggers `updateCSSwithImageHashes` so CSS `url()` references
 *     are updated before CSS files are hashed.
 *
 * @param configs - Build configuration subset for asset hashing.
 * @returns `false` if prerequisites aren't met, otherwise `undefined`.
 */
module.exports = function assetHashing({
  dir, completionFlags, buildEvents, hashingFileNameList, debug,
}: AssetHashingParams): false | undefined {
  if (completionFlags.ASSET_HASH.STARTED) return false;
  // Reset sub-flags before the first hashing run.
  completionFlags.ASSET_HASH.IMAGES = false;
  completionFlags.ASSET_HASH.JS = false;

  const BUILD_EVENTS: BuildEventsMap = require(`${dir.build}constants/build-events.ts`);
  const timestamp: { stamp: () => string } = require(`${dir.build}helpers/timestamp.ts`);
  const { images, videos }: { images: string[]; videos: string[] } = require(`${dir.build}constants/file-formats.ts`);

  // Guard: all five upstream stages must be complete before we can hash.
  // This function is called on multiple events so it will be a no-op until
  // the last prerequisite finishes.
  if (!completionFlags.JS_IS_MINIFIED
      || !completionFlags.CSS_IS_MINIFIED
      || !completionFlags.HTML_IS_MINIFIED
      || !completionFlags.IMAGES_ARE_MOVED
      || !completionFlags.VIDEOS_ARE_MOVED
      || !completionFlags.SITE_MAP) {
    return false;
  }
  completionFlags.ASSET_HASH.STARTED = true;
  log(`${timestamp.stamp()} assetHashing().images`);
  if (debug) {
    log(`completionFlags.JS_IS_MINIFIED :${completionFlags.JS_IS_MINIFIED}`);
    log(`completionFlags.CSS_IS_MINIFIED    :${completionFlags.CSS_IS_MINIFIED}`);
    log(`completionFlags.HTML_IS_MINIFIED     :${completionFlags.HTML_IS_MINIFIED}`);
    log(`completionFlags.IMAGES_ARE_MOVED     :${completionFlags.IMAGES_ARE_MOVED}`);
    log(`completionFlags.VIDEOS_ARE_MOVED     :${completionFlags.VIDEOS_ARE_MOVED}`);
  }

  // Collect JS and asset files for the two independent hashing passes.
  const jsGlob = globSync(`${dir.package}**/*.js`);
  const assetGlob = globSync(`${dir.package}{images,videos}/**/*.{${[...images, ...videos].join(',')}}`);

  // --- JS hashing pass ---
  let processedJs = 0;
  jsGlob.forEach((file: string, _index: number, array: string[]) => {
    const fileContents = fs.readFileSync(file);
    const hash = XXHash.hash(fileContents, 0xCAFEBABE);
    // Insert the hash before the file extension: foo.js → foo-1234567890.js
    const hashedFileName = `${file.substr(0, file.lastIndexOf('.'))}-${hash}${file.substr(file.lastIndexOf('.'))}`;
    hashingFileNameList[file] = hashedFileName;
    fs.rename(file, hashedFileName, (err: NodeJS.ErrnoException | null) => {
      if (err) throw err;
      if (debug) log(`${timestamp.stamp()} assetHashing().images: ${hashedFileName} renamed complete`);
      processedJs++;
      if (processedJs >= array.length) {
        completionFlags.ASSET_HASH.JS = true;
        if (debug) {
          // eslint-disable-next-line @stylistic/max-len
          log(`${timestamp.stamp()} assetHashing().images: completionFlags.ASSET_HASH.JS: ${completionFlags.ASSET_HASH.JS}`);
        }
        buildEvents.emit(BUILD_EVENTS.assetHashJsListed);
      }
    });
  });

  // --- Images/Videos hashing pass ---
  let processedImages = 0;
  assetGlob.forEach((file: string, _index: number, array: string[]) => {
    const fileContents = fs.readFileSync(file);
    const hash = XXHash.hash(fileContents, 0xCAFEBABE);
    const hashedFileName = `${file.substr(0, file.lastIndexOf('.'))}-${hash}${file.substr(file.lastIndexOf('.'))}`;
    hashingFileNameList[file] = hashedFileName;
    fs.rename(file, hashedFileName, (err: NodeJS.ErrnoException | null) => {
      if (err) throw err;
      if (debug) log(`${timestamp.stamp()} assetHashing().images: ${hashedFileName} renamed complete`);
      processedImages++;
      if (processedImages >= array.length) {
        completionFlags.ASSET_HASH.IMAGES = true;
        log(`${timestamp.stamp()} assetHashing().images: ${'DONE'.green.bold}`);
        // Emitting this event triggers updateCSSwithImageHashes so CSS url()
        // references are rewritten before CSS files are hashed.
        buildEvents.emit(BUILD_EVENTS.assetHashImagesListed);
      }
    });
  });
};
