import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const projectRoot = path.resolve(process.cwd());
const packageDir = path.join(projectRoot, 'package');

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// Run the production build with a generous timeout
async function runProductionBuild() {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, NODE_ENV: 'production' };
    const child = spawn('node', ['index.js', '--verbose'], {
      cwd: projectRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Build timed out. Stdout: ${stdout.slice(-2000)}\nStderr: ${stderr.slice(-2000)}`));
    }, 5 * 60 * 1000); // 5 minutes

    child.on('exit', (code, signal) => {
      clearTimeout(timeout);
      if (signal) return reject(new Error(`Build terminated by signal: ${signal}`));
      // In production, the build process calls process.exit() when done. We consider code 0 as success.
      if (code === 0) return resolve({ stdout, stderr });
      reject(new Error(`Build exited with code ${code}. Stdout: ${stdout.slice(-2000)}\nStderr: ${stderr.slice(-2000)}`));
    });
  });
}

before(async () => {
  // Ensure a clean package directory before running
  if (await pathExists(packageDir)) {
    await fs.rm(packageDir, { recursive: true, force: true });
  }
});

after(async () => {
  // Leave artifacts for inspection in CI; no cleanup.
});

// The main test verifies the build completes and key artifacts exist
test('production build completes and outputs expected artifacts', async (t) => {
  const { stdout } = await runProductionBuild();

  // Sanity: log mentions production true
  assert.match(stdout, /PRODUCTION: TRUE/i, 'production mode should be enabled');

  // Basic directories
  assert.equal(await pathExists(packageDir), true, 'package directory should exist');
  assert.equal(await pathExists(path.join(packageDir, 'scripts')), true, 'scripts directory should exist');
  assert.equal(await pathExists(path.join(packageDir, 'images')), true, 'images directory should exist');

  // At least one HTML file (e.g., index.html under some path)
  // We scan a few likely locations
  const candidates = [
    path.join(packageDir, 'index.html'),
    path.join(packageDir, 'posts', 'index.html'),
    path.join(packageDir, 'about', 'index.html'),
  ];
  const anyHtmlExists = await candidates.reduce(async (accP, p) => {
    const acc = await accP;
    return acc || (await pathExists(p));
  }, Promise.resolve(false));
  assert.equal(anyHtmlExists, true, 'at least one HTML page should exist');

  // Sitemaps should be created
  assert.equal(await pathExists(path.join(packageDir, 'sitemap.json')), true, 'sitemap.json should exist');
  assert.equal(await pathExists(path.join(packageDir, 'sitemap.xml')), true, 'sitemap.xml should exist');

  // Gzip artifacts for some files
  assert.equal(await pathExists(path.join(packageDir, 'sitemap.json.gz')), true, 'sitemap.json.gz should exist');
  assert.equal(await pathExists(path.join(packageDir, 'sitemap.xml.gz')), true, 'sitemap.xml.gz should exist');
});
