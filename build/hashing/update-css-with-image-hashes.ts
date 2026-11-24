import type { EventEmitter } from 'node:events';
import type { BuildDirectories, BuildEventsMap } from '../types.ts';

const fs: typeof import('fs-extra') = require('fs-extra');
const { globSync }: typeof import('glob') = require('glob');
const mapLimit: <T>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<unknown> | unknown,
) => Promise<void> = require('../helpers/map-limit.ts');
const { replacePaths }: {
  replacePaths: (contents: string, mappings: Map<string, string>, origin?: string) => string;
} = require('./finish-hashing.ts');

const { log } = console;

interface UpdateCssParams {
  dir: Pick<BuildDirectories, 'package' | 'build'>;
  buildEvents: EventEmitter;
  hashingFileNameList: Record<string, string>;
}

/**
 * Rewrites CSS files to reference hashed image and video filenames.
 *
 * The asset-hashing pipeline runs in two passes:
 *   1. Image/video files are renamed with content hashes (`assetHashing`).
 *   2. CSS files that reference those assets must be updated before CSS
 *      files themselves are hashed — otherwise the CSS hash would be based
 *      on the pre-updated content, and the HTML/JSON rewrite would produce
 *      mismatched references.
 *
 * This function performs step 2: it scans every `.css` file in the output
 * directory and does a simple string-replace for each `originalPath →
 * hashedPath` entry in `hashingFileNameList`. Paths are stored as relative
 * filenames (without the `package/` prefix) to match how they appear inside
 * CSS `url()` values.
 *
 * When all CSS files have been updated the `indexCssForHashing` event is
 * emitted, which triggers `hashCSS` to hash the (now-updated) CSS files.
 *
 * @param configs - Build directories, events, and asset path mappings.
 */
module.exports = async function updateCSSwithImageHashes({
  dir, buildEvents, hashingFileNameList,
}: UpdateCssParams): Promise<void> {
  const BUILD_EVENTS: BuildEventsMap = require(`${dir.build}constants/build-events.ts`);
  const timestamp: { stamp: () => string } = require(`${dir.build}helpers/timestamp.ts`);

  log(`${timestamp.stamp()} hashingUpdateCSS()`);

  const mappings = new Map<string, string>(
    Object.entries(hashingFileNameList).map(([from, to]): [string, string] => [
      from.slice(dir.package.length), to.slice(dir.package.length)
    ])
  );
  await mapLimit(globSync(`${dir.package}**/*.css`), 8, async (file: string) => {
    const contents = await fs.readFile(file, 'utf8');
    await fs.writeFile(file, replacePaths(contents, mappings));
  });
  buildEvents.emit(BUILD_EVENTS.indexCssForHashing);
};
