import type { EventEmitter } from 'node:events';
import type { BuildDirectories, BuildEventsMap, CompletionFlags } from '../types.ts';

const fs: typeof import('fs-extra') = require('fs-extra');
const { globSync }: typeof import('glob') = require('glob');
const { promisify }: typeof import('util') = require('util');
const zlib: typeof import('zlib') = require('zlib');
const gzip = promisify(zlib.gzip);
const mapLimit: <T>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<unknown> | unknown,
) => Promise<void> = require('../helpers/map-limit.ts');

interface GzipFilesParams {
  dir: Pick<BuildDirectories, 'package' | 'build'>;
  completionFlags: Pick<CompletionFlags, 'GZIP'>;
  buildEvents: EventEmitter;
}

/** Compress a bounded batch, and signal completion only after all writes finish. */
module.exports = async function gzipFiles({ dir, completionFlags, buildEvents }: GzipFilesParams): Promise<void> {
  completionFlags.GZIP = false;
  const BUILD_EVENTS: BuildEventsMap = require(`${dir.build}constants/build-events.ts`);
  await mapLimit(globSync(`${dir.package}**/*.+(html|xml|css|js|txt|json)`), 8, async (file: string) => {
    await fs.writeFile(`${file}.gz`, await gzip(await fs.readFile(file)));
  });
  completionFlags.GZIP = true;
  buildEvents.emit(BUILD_EVENTS.gzipDone);
};
