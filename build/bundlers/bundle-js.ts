import type { EventEmitter } from 'node:events';
import type { BrowserifyObject } from 'browserify';
import type { BuildDirectories, BuildEventsMap } from '../types.ts';

const fs: typeof import('fs-extra') = require('fs-extra');
const { globSync }: typeof import('glob') = require('glob');
const path: typeof import('path') = require('path');
const browserify: typeof import('browserify') = require('browserify');
const watchify: typeof import('watchify') = require('watchify');
const babelTransform: (
  file: string,
  options?: Record<string, unknown>,
) => NodeJS.ReadWriteStream = require('./babel-transform.ts');
const scssStringifyTransform: (file: string) => NodeJS.ReadWriteStream = require('./scss-stringify-transform.ts');
const mapLimit: <T>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<unknown> | unknown,
) => Promise<void> = require('../helpers/map-limit.ts');

interface WatchifyBrowserify extends BrowserifyObject {
  _options: {
    cache: Record<string, unknown>;
  };
  close?: () => void;
}

interface BundlerEntry {
  bundler: WatchifyBrowserify;
  output: string;
  running: Promise<void> | null;
  pending: boolean;
  closed: boolean;
  failed?: boolean;
  dependencies: Map<string, Set<string>>;
  dirty: Set<string>;
  rebuild: () => Promise<void>;
}

interface BundleJsConfigs {
  dir: Pick<BuildDirectories, 'src' | 'package'>;
  buildEvents: EventEmitter;
  BUILD_EVENTS: BuildEventsMap;
}

const sessions = new WeakMap<object, Map<string, BundlerEntry>>();

/** Resolves symlinks when possible so dependency keys match watcher paths. */
function canonical(file?: string): string {
  if (!file) return '';
  try { return fs.realpathSync(file); } catch {
    try {
      return path.join(fs.realpathSync(path.dirname(file)), path.basename(file));
    } catch {
      return path.resolve(file);
    }
  }
}

/** Reuse development bundlers and invalidate only modules affected by a source edit. */
async function bundleJS(configs: BundleJsConfigs, changedFile?: string): Promise<void> {
  const { dir, buildEvents, BUILD_EVENTS } = configs;
  const production: boolean = require('../helpers/production.ts');
  let entries = sessions.get(configs);
  if (!entries) {
    entries = new Map<string, BundlerEntry>();
    sessions.set(configs, entries);
  }
  const files = globSync(`${dir.src}ts/**/[^_]*.ts`);
  for (let index = 0, list = [...entries]; index < list.length; index++) {
    const [file, entry] = list[index];
    if (!files.includes(file)) {
      entry.closed = true;
      await entry.running;
      if (entry.bundler.close) entry.bundler.close();
      entries.delete(file);
      await fs.remove(entry.output);
    }
  }
  await mapLimit(files, 4, async (file: string) => {
    let entry = entries.get(file);
    if (entry) {
      const affected = entry.dependencies.get(canonical(changedFile));
      if (changedFile && (entry.failed || affected)) {
        if (entry.failed) {
          Object.keys(entry.bundler._options.cache).forEach((key: string) => {
            entry!.dirty.add(key);
          });
        } else if (affected) {
          affected.forEach((key: string) => entry!.dirty.add(key));
        }
        await entry.rebuild();
      }
      return;
    }
    const bundlerOptions: Record<string, unknown> = {
      entries: [file],
      extensions: ['.ts', '.tsx', '.js', '.json'],
      debug: !production,
      cache: {},
      packageCache: {},
    };
    if (!production) {
      // The shared preview watcher dispatches changes; Watchify retains module caches.
      bundlerOptions.plugin = [[watchify, { ignoreWatch: () => true }]];
    }
    const bundler = browserify(bundlerOptions) as WatchifyBrowserify;
    bundler.transform(scssStringifyTransform)
      // Browserify's acorn 7 parser cannot parse ES2022+ syntax or ESM import/export
      // (including the `export {};` marker emitted by @babel/preset-typescript for type-only
      // imports), so pin @babel/preset-env v8 to ES5 + CommonJS output.
      .transform(babelTransform, {
        presets: [
          ['@babel/preset-env', { targets: { ie: '11' }, modules: 'commonjs' }],
          '@babel/preset-react',
          '@babel/preset-typescript'
        ],
      });
    const output = path.join(dir.package, 'scripts', path.relative(`${dir.src}ts`, file).replace(/\.tsx?$/, '.js'));
    const newEntry: BundlerEntry = {
      bundler,
      output,
      running: null,
      pending: false,
      closed: false,
      dependencies: new Map<string, Set<string>>(),
      dirty: new Set<string>(),
      rebuild: async () => {},
    };
    entry = newEntry;
    entries.set(file, newEntry);
    function track(dependency: string, owner: string): void {
      const canonicalDependency = canonical(dependency);
      let owners = newEntry.dependencies.get(canonicalDependency);
      if (!owners) {
        owners = new Set<string>();
        newEntry.dependencies.set(canonicalDependency, owners);
      }
      owners.add(owner);
    }
    bundler.on('file', (dependency: string) => track(dependency, dependency));
    bundler.on('transform', (transform: EventEmitter, owner: string) => {
      transform.on('file', (dependency: string) => track(dependency, owner));
    });
    async function rebuild(): Promise<void> {
      newEntry.pending = true;
      if (newEntry.running) return newEntry.running;
      newEntry.running = (async () => {
        while (newEntry.pending && !newEntry.closed) {
          newEntry.pending = false;
          newEntry.dirty.forEach((key: string) => { delete bundler._options.cache[key]; });
          newEntry.dirty.clear();
          try {
            const result = await new Promise<Buffer>((resolve, reject) => {
              bundler.bundle((error: unknown, buffer: Buffer) => {
                if (error) {
                  reject(error);
                } else {
                  resolve(buffer);
                }
              });
            });
            await fs.outputFile(newEntry.output, result);
            newEntry.failed = false;
          } catch (error: unknown) {
            newEntry.failed = true;
            if (production) throw error;
            console.error(error);
          }
        }
      })();
      try { await newEntry.running; } finally { newEntry.running = null; }
    }
    newEntry.rebuild = rebuild;
    await rebuild();
  });
  // Initial readiness also covers the empty-entry case.
  buildEvents.emit(BUILD_EVENTS.jsMoved);
}

/** Release development watchers when a preview session is stopped. */
async function closeBundlers(configs: object): Promise<void> {
  const entries = sessions.get(configs);
  if (!entries) return;
  await Promise.all([...entries.values()].map(async (entry: BundlerEntry) => {
    entry.closed = true;
    await entry.running;
    if (entry.bundler.close) entry.bundler.close();
  }));
  sessions.delete(configs);
}

module.exports = bundleJS;
module.exports.close = closeBundlers;
