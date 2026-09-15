const fs = require('fs-extra');
const { globSync } = require('glob');
const path = require('path');
const browserify = require('browserify');
const babelify = require('babelify');
const watchify = require('watchify');
const mapLimit = require('../helpers/map-limit');

const sessions = new WeakMap();
function canonical(file) {
  if (!file) return file;
  try { return fs.realpathSync(file); } catch (error) {
    try {
      return path.join(fs.realpathSync(path.dirname(file)), path.basename(file));
    } catch (parentError) {
      return path.resolve(file);
    }
  }
}

/** Reuse development bundlers and invalidate only modules affected by a source edit. */
module.exports = async function bundleJS(configs, changedFile) {
  const { dir, buildEvents, BUILD_EVENTS } = configs;
  const production = require('../helpers/production');
  let entries = sessions.get(configs);
  if (!entries) {
    entries = new Map();
    sessions.set(configs, entries);
  }
  const files = globSync(`${dir.src}js/**/[^_]*.js`);
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
  await mapLimit(files, 4, async (file) => {
    let entry = entries.get(file);
    if (entry) {
      const affected = entry.dependencies.get(canonical(changedFile));
      if (changedFile && (entry.failed || affected)) {
        if (entry.failed) {
          Object.keys(entry.bundler._options.cache).forEach((key) => {
            entry.dirty.add(key);
          });
        } else {
          affected.forEach((key) => entry.dirty.add(key));
        }
        await entry.rebuild();
      }
      return;
    }
    const bundler = browserify({
      entries: [file],
      debug: !production,
      cache: {},
      packageCache: {},
      // The shared preview watcher dispatches changes; Watchify retains module caches.
      ...(production ? {} : { plugin: [[watchify, { ignoreWatch: () => true }]] }),
    });
    bundler.transform(require('./scss-stringify-transform'))
      .transform(babelify, { presets: ['@babel/preset-env', '@babel/preset-react'] });
    entry = {
      bundler,
      output: path.join(dir.package, 'scripts', path.relative(`${dir.src}js`, file)),
      running: null,
      pending: false,
      closed: false,
      dependencies: new Map(),
      dirty: new Set(),
    };
    entries.set(file, entry);
    function track(dependency, owner) {
      dependency = canonical(dependency);
      if (!entry.dependencies.has(dependency)) entry.dependencies.set(dependency, new Set());
      entry.dependencies.get(dependency).add(owner);
    }
    bundler.on('file', (dependency) => track(dependency, dependency));
    bundler.on('transform', (transform, owner) => {
      transform.on('file', (dependency) => track(dependency, owner));
    });
    async function rebuild() {
      entry.pending = true;
      if (entry.running) return entry.running;
      entry.running = (async () => {
        while (entry.pending && !entry.closed) {
          entry.pending = false;
          entry.dirty.forEach((key) => { delete bundler._options.cache[key]; });
          entry.dirty.clear();
          try {
            const result = await new Promise((resolve, reject) => {
              bundler.bundle((error, buffer) => (error ? reject(error) : resolve(buffer)));
            });
            await fs.outputFile(entry.output, result);
            entry.failed = false;
          } catch (error) {
            entry.failed = true;
            if (production) throw error;
            console.error(error);
          }
        }
      })();
      try { await entry.running; } finally { entry.running = null; }
    }
    entry.rebuild = rebuild;
    await rebuild();
  });
  // Initial readiness also covers the empty-entry case.
  buildEvents.emit(BUILD_EVENTS.jsMoved);
};

/** Release development watchers when a preview session is stopped. */
module.exports.close = async (configs) => {
  const entries = sessions.get(configs);
  if (!entries) return;
  await Promise.all([...entries.values()].map(async (entry) => {
    entry.closed = true;
    await entry.running;
    if (entry.bundler.close) entry.bundler.close();
  }));
  sessions.delete(configs);
};
