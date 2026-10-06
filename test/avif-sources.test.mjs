import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
require('colors');
const sharp = require('sharp');
const { globSync } = require('glob');
const convertToAvif = require('../build/optimize/convert-to-avif');
const { moveOneImage } = require('../build/move-assets');

const { fingerprint, isGeneratedAvif, removeGeneratedAvif, MANIFEST_NAME } = convertToAvif;
const projectRoot = path.resolve(process.cwd());

function pngBuffer(color) {
  return sharp({
    create: {
      width: 8, height: 8, channels: 3, background: color,
    },
  }).png().toBuffer();
}

describe('convertToAvif keeps AVIFs in src/images', () => {
  let tmp;
  let dir;
  let manifestFile;

  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'avif-test-'));
    dir = {
      src: `${tmp}/src/`,
      package: `${tmp}/package/`,
      build: `${projectRoot}/build/`,
    };
    mkdirSync(`${dir.src}images`, { recursive: true });
    mkdirSync(`${dir.package}images`, { recursive: true });
    manifestFile = `${dir.src}images/${MANIFEST_NAME}`;
  });

  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  const readManifest = () => JSON.parse(readFileSync(manifestFile, 'utf8'));

  test('encodes a missing AVIF into src, records it, and copies it to the output', async () => {
    writeFileSync(`${dir.src}images/hero.png`, await pngBuffer('#ff0000'));
    await convertToAvif(`${dir.src}images/hero.png`, { dir });

    assert.ok(existsSync(`${dir.src}images/hero.avif`), 'AVIF written next to its source');
    assert.deepEqual(readManifest(), {
      'hero.avif': { source: 'hero.png', sha256: fingerprint(`${dir.src}images/hero.png`) },
    });
    assert.deepEqual(
      readFileSync(`${dir.package}images/hero.avif`),
      readFileSync(`${dir.src}images/hero.avif`)
    );
  });

  test('copies a current AVIF from src byte-for-byte instead of re-encoding', async () => {
    writeFileSync(`${dir.src}images/hero.png`, await pngBuffer('#ff0000'));
    await convertToAvif(`${dir.src}images/hero.png`, { dir });
    // Not a real AVIF: if the build re-encoded, these bytes would be replaced.
    writeFileSync(`${dir.src}images/hero.avif`, 'committed bytes');

    await convertToAvif(`${dir.src}images/hero.png`, { dir });
    assert.equal(readFileSync(`${dir.package}images/hero.avif`, 'utf8'), 'committed bytes');
  });

  test('re-encodes when the source image changes', async () => {
    writeFileSync(`${dir.src}images/hero.png`, await pngBuffer('#ff0000'));
    await convertToAvif(`${dir.src}images/hero.png`, { dir });
    writeFileSync(`${dir.src}images/hero.avif`, 'stale bytes');
    writeFileSync(`${dir.src}images/hero.png`, await pngBuffer('#0000ff'));

    await convertToAvif(`${dir.src}images/hero.png`, { dir });
    assert.notEqual(readFileSync(`${dir.src}images/hero.avif`, 'utf8'), 'stale bytes');
    assert.equal(readManifest()['hero.avif'].sha256, fingerprint(`${dir.src}images/hero.png`));
  });

  test('isGeneratedAvif tells generated AVIFs from supplied ones', async () => {
    writeFileSync(`${dir.src}images/hero.png`, await pngBuffer('#ff0000'));
    await convertToAvif(`${dir.src}images/hero.png`, { dir });
    assert.equal(isGeneratedAvif(`${dir.src}images/hero.avif`, { dir }), true);
    assert.equal(isGeneratedAvif(`${dir.src}images/supplied.avif`, { dir }), false);
  });

  test('removeGeneratedAvif deletes the AVIF and its entry only for its own source', async () => {
    writeFileSync(`${dir.src}images/hero.png`, await pngBuffer('#ff0000'));
    await convertToAvif(`${dir.src}images/hero.png`, { dir });

    removeGeneratedAvif(`${dir.src}images/hero.jpg`, { dir });
    assert.ok(existsSync(`${dir.src}images/hero.avif`), 'a different source must not remove it');

    removeGeneratedAvif(`${dir.src}images/hero.png`, { dir });
    assert.equal(existsSync(`${dir.src}images/hero.avif`), false);
    assert.deepEqual(readManifest(), {});
  });

  test('a WebP-only source stays canonical after its AVIF is generated beside it', async () => {
    const webp = await sharp(await pngBuffer('#00ff00')).webp().toBuffer();
    writeFileSync(`${dir.src}images/art.webp`, webp);
    const configs = { dir, debug: false };

    await moveOneImage(`${dir.src}images/art.webp`, configs);
    rmSync(`${dir.package}images/art.avif`);
    // The glob also yields the generated AVIF; it must be left to its source.
    await moveOneImage(`${dir.src}images/art.avif`, configs);
    assert.equal(existsSync(`${dir.package}images/art.avif`), false);

    await moveOneImage(`${dir.src}images/art.webp`, configs);
    assert.deepEqual(
      readFileSync(`${dir.package}images/art.avif`),
      readFileSync(`${dir.src}images/art.avif`)
    );
  });
});

test('every source image in src/images has a current, committed AVIF', () => {
  const dir = { src: `${projectRoot}/src/` };
  const imagesDir = path.join(projectRoot, 'src/images');
  const manifest = JSON.parse(readFileSync(path.join(imagesDir, MANIFEST_NAME), 'utf8'));
  const preferred = ['jpg', 'jpeg', 'png', 'webp'];

  const extensionsByBase = new Map();
  globSync(`${imagesDir}/**/*.{jpg,jpeg,png,webp,avif}`).forEach((file) => {
    const extension = path.extname(file).substring(1).toLowerCase();
    const base = file.substring(0, file.length - extension.length - 1);
    if (!extensionsByBase.has(base)) extensionsByBase.set(base, new Set());
    extensionsByBase.get(base).add(extension);
  });

  const problems = [];
  extensionsByBase.forEach((extensions, base) => {
    const avif = `${base}.avif`;
    if (extensions.has('avif') && !isGeneratedAvif(avif, { dir })) return; // supplied AVIF source
    const sourceExtension = preferred.find((extension) => extensions.has(extension));
    const source = `${base}.${sourceExtension}`;
    const key = path.relative(imagesDir, avif);
    const entry = manifest[key];
    if (!existsSync(avif)) problems.push(`${key}: missing (run a build and commit it)`);
    else if (!entry || entry.source !== path.relative(imagesDir, source)) problems.push(`${key}: not in ${MANIFEST_NAME}`);
    else if (entry.sha256 !== fingerprint(source)) problems.push(`${key}: stale (source changed; run a build and commit it)`);
  });

  Object.entries(manifest).forEach(([key, entry]) => {
    if (!existsSync(path.join(imagesDir, entry.source))) problems.push(`${key}: source ${entry.source} no longer exists`);
  });

  assert.deepEqual(problems, []);
});
