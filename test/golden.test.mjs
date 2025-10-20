import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());
const goldenDir = path.join(projectRoot, 'golden');

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
