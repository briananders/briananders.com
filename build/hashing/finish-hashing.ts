import type { EventEmitter } from 'node:events';
import type { AssetHashFlags, BuildDirectories, BuildEventsMap } from '../types.ts';

const fs: typeof import('fs-extra') = require('fs-extra');
const { globSync }: typeof import('glob') = require('glob');
const mapLimit: <T>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<unknown> | unknown,
) => Promise<void> = require('../helpers/map-limit.ts');

interface ExtendedAssetHashFlags extends AssetHashFlags {
  REWRITING?: boolean;
}

interface FinishHashingParams {
  dir: Pick<BuildDirectories, 'root' | 'package' | 'build'>;
  completionFlags: {
    ASSET_HASH: ExtendedAssetHashFlags;
  };
  buildEvents: EventEmitter;
  hashingFileNameList: Record<string, string>;
}

/**
 * Replace full local URL paths without touching longer filenames or remote URLs.
 *
 * @param contents - HTML or JSON text.
 * @param mappings - Output-relative path → hashed path.
 * @param origin - The site's own origin with a trailing slash. URLs
 *   that start with it are local too: social tags (`og:image`) and JSON-LD
 *   must be absolute, and would 404 if they kept the unhashed name.
 * @returns Text with local asset URLs replaced by hashed filenames.
 */
function replacePaths(contents: string, mappings: Map<string, string>, origin = ''): string {
  // HTML attributes, CSS url(), JSON strings, and srcset entries use these delimiters.
  return contents.replace(
    /(^|[\s"'`(=,])((?:\/)?[^\s"'`()<>=?#,]+)(?=[?#\s"'`)<>,]|$)/g,
    (match: string, prefix: string, url: string): string => {
      let base = '';
      if (url.startsWith('/')) {
        base = '/';
      }
      if (origin && url.startsWith(origin)) base = origin;
      const replacement = mappings.get(url.slice(base.length));
      if (replacement) {
        return `${prefix}${base}${replacement}`;
      }
      return match;
    }
  );
}

/**
 * Rewrites HTML and JSON files in the output directory to reference hashed asset paths.
 *
 * @param configs - Build directories, completion flags, event emitter, and hash map.
 */
async function finishHashing({
  dir, completionFlags, buildEvents, hashingFileNameList,
}: FinishHashingParams): Promise<void> {
  const flags = completionFlags.ASSET_HASH;
  if (!flags.IMAGES || !flags.CSS || !flags.JS || flags.REWRITING || flags.DONE) return;
  flags.REWRITING = true;
  try {
    const mappings = new Map<string, string>(
      Object.entries(hashingFileNameList).map(([from, to]): [string, string] => [
        from.slice(dir.package.length), to.slice(dir.package.length)
      ])
    );
    const createSiteData: (d: Pick<BuildDirectories, 'root' | 'build'>) => { domain: string } = require(
      `${dir.build}constants/site-data.ts`
    );
    const { domain } = createSiteData(dir);
    await mapLimit(globSync(`${dir.package}**/*.{html,json}`), 8, async (file: string) => {
      const contents = await fs.readFile(file, 'utf8');
      await fs.writeFile(file, replacePaths(contents, mappings, domain));
    });
    flags.DONE = true;
    const BUILD_EVENTS: BuildEventsMap = require(`${dir.build}constants/build-events.ts`);
    buildEvents.emit(BUILD_EVENTS.hashingDone);
  } finally {
    flags.REWRITING = false;
  }
}

module.exports = finishHashing;
module.exports.replacePaths = replacePaths;
