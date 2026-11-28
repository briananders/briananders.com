import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());
const packageDir = path.join(projectRoot, 'package');
const distDir = path.join(projectRoot, 'dist');

interface BuildOutput {
  stdout: string;
  stderr: string;
}

/**
 * Checks whether a filesystem path is accessible.
 */
async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Recursively finds files under a directory matching the given extension.
 */
async function filesWithExtension(dir: string, extension: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await filesWithExtension(entryPath, extension));
    } else if (entry.name.endsWith(extension)) {
      files.push(entryPath);
    }
  }
  return files;
}

/**
 * Runs the production build with a generous timeout and returns captured output.
 */
async function runProductionBuild(): Promise<BuildOutput> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, NODE_ENV: 'production' };
    const child = spawn('node', ['index.ts', '--verbose'], {
      cwd: projectRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Build timed out. Stdout: ${stdout.slice(-2000)}\nStderr: ${stderr.slice(-2000)}`));
    }, 5 * 60 * 1000); // 5 minutes

    child.on('exit', (code, signal) => {
      clearTimeout(timeout);
      if (signal) return reject(new Error(`Build terminated by signal: ${signal}`));
      // In production, the build process calls process.exit() when done. We consider code 0 as success.
      if (code === 0) return resolve({ stdout, stderr });
      const message = `Build exited with code ${code}. Stdout: ${stdout.slice(-2000)}\nStderr: ${stderr.slice(-2000)}`;
      reject(new Error(message));
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
test('production build completes and outputs expected artifacts', async () => {
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
    path.join(packageDir, 'about', 'index.html')
  ];
  const anyHtmlExists = await candidates.reduce(async (accP, p) => {
    const acc = await accP;
    return acc || (await pathExists(p));
  }, Promise.resolve(false));
  assert.equal(anyHtmlExists, true, 'at least one HTML page should exist');

  // Sitemaps should be created
  assert.equal(await pathExists(path.join(packageDir, 'sitemap.json')), true, 'sitemap.json should exist');
  assert.equal(await pathExists(path.join(packageDir, 'sitemap.xml')), true, 'sitemap.xml should exist');

  // Redirect routing rules should be emitted into dist/ (not package/)
  assert.equal(
    await pathExists(path.join(distDir, 'redirects.json')),
    true,
    'dist/redirects.json should exist',
  );
  assert.equal(
    await pathExists(path.join(packageDir, 'redirects.json')),
    false,
    'redirects.json should not be emitted into public package/',
  );

  // Gzip artifacts for some files
  assert.equal(await pathExists(path.join(packageDir, 'sitemap.json.gz')), true, 'sitemap.json.gz should exist');
  assert.equal(await pathExists(path.join(packageDir, 'sitemap.xml.gz')), true, 'sitemap.xml.gz should exist');

  const webpFiles = await filesWithExtension(path.join(packageDir, 'images'), '.webp');
  const avifFiles = await filesWithExtension(path.join(packageDir, 'images'), '.avif');
  assert.ok(webpFiles.length > 0, 'build should emit WebP image variants');
  assert.equal(avifFiles.length, webpFiles.length, 'every WebP image should have an AVIF variant');

  const aboutHtml = await fs.readFile(path.join(packageDir, 'about', 'index.html'), 'utf8');
  assert.match(aboutHtml, /<picture>/, 'image tags should be wrapped in picture elements');
  assert.match(aboutHtml, /type=image\/avif/, 'picture elements should include AVIF sources');
  assert.match(aboutHtml, /type=image\/webp/, 'picture elements should include WebP sources');
  assert.match(aboutHtml, /loading=lazy/, 'lazy images should use native loading');
  assert.doesNotMatch(aboutHtml, /data-src(?:set)?=/, 'lazy images should not use custom data-src attributes');
});
