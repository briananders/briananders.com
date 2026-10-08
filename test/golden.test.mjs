import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const goldenBuild = require('../build/constants/golden-build');

const projectRoot = path.resolve(process.cwd());
const goldenDir = path.join(projectRoot, 'golden');

async function htmlFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await htmlFiles(entryPath));
    } else if (entry.name.endsWith('.html')) {
      files.push(entryPath);
    }
  }
  return files;
}

function metaContent(html, name) {
  const match = html.match(new RegExp(`name=["']?${name}["']?\\s+content=["']?([^"'\\s>]+)`));
  return match ? match[1] : null;
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function isDirectoryEmpty(dir) {
  try {
    const entries = await fs.readdir(dir);
    return entries.length === 0;
  } catch {
    return true; // If we can't read it, treat as empty
  }
}

test('golden directory exists and is not empty', async (t) => {
  // Verify the golden directory exists
  assert.equal(await pathExists(goldenDir), true, 'golden directory should exist');

  // Verify the golden directory is not empty
  const isEmpty = await isDirectoryEmpty(goldenDir);
  assert.equal(isEmpty, false, 'golden directory should not be empty');

  // Optional: Verify it contains expected build artifacts
  const entries = await fs.readdir(goldenDir);
  assert.ok(entries.length > 0, `golden directory should contain files (found ${entries.length} entries)`);
});

test('golden build.txt carries the pinned datetime and commit hash', async () => {
  const buildTxt = await fs.readFile(path.join(goldenDir, 'build.txt'), 'utf8');
  assert.match(buildTxt, new RegExp(`^Build Date-Time: ${goldenBuild.BUILD_DATETIME}$`, 'm'));
  assert.match(buildTxt, new RegExp(`^Commit Hash: ${goldenBuild.COMMIT_HASH}$`, 'm'));
});

test('golden pages carry the pinned build-id and build-datetime meta tags', async () => {
  const files = await htmlFiles(goldenDir);
  let checked = 0;
  for (const file of files) {
    const html = await fs.readFile(file, 'utf8');
    const buildId = metaContent(html, 'build-id');
    const buildDateTime = metaContent(html, 'build-datetime');
    if (buildId === null && buildDateTime === null) continue;
    const relative = path.relative(goldenDir, file);
    assert.equal(buildId, goldenBuild.COMMIT_HASH, `${relative} build-id`);
    assert.equal(buildDateTime, goldenBuild.BUILD_DATETIME, `${relative} build-datetime`);
    checked++;
  }
  assert.ok(checked > 0, 'expected at least one golden page with build meta tags');
});

test('golden pages contain no timezone-dependent Date.toString() output', async () => {
  const files = await htmlFiles(goldenDir);
  const leaks = [];
  for (const file of files) {
    const html = await fs.readFile(file, 'utf8');
    if (/GMT[+-]\d{4} \(/.test(html)) leaks.push(path.relative(goldenDir, file));
  }
  assert.deepEqual(leaks, [], 'format dates with formattedDate() instead of interpolating a Date');
});
