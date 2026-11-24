'use strict';

/**
 * Visual diff orchestrator.
 *
 * Builds the current branch and the base branch (default: main) side-by-side
 * using a git worktree, captures screenshots of each, then pixel-diffs them.
 *
 * Usage:
 *   node bin/visual-diff.ts
 *   node bin/visual-diff.ts --base=staging
 */

import type { ChildProcess } from 'node:child_process';

const { execSync, spawn }: typeof import('node:child_process') = require('child_process');
const net: typeof import('node:net') = require('net');
const fs: typeof import('node:fs') = require('fs');
const path: typeof import('node:path') = require('path');
const os: typeof import('node:os') = require('os');

// Parse --key=value args
const args: Record<string, string> = {};
process.argv.slice(2).forEach((arg) => {
  const match = arg.match(/^--([\w-]+)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

const ROOT = path.join(__dirname, '..');
const VISUAL_DIFFS_DIR = path.join(ROOT, 'visual-diffs');
const WORKTREE_DIR = path.join(os.tmpdir(), 'briananders-visual-diff-worktree');

const BRANCH_PORT = 3001;
const BASE_PORT = 3002;

const SCREENSHOTS_DIR = path.join(VISUAL_DIFFS_DIR, 'test', 'screenshots');
const BRANCH_SCREENSHOTS = path.join(SCREENSHOTS_DIR, 'branch');
const BASE_SCREENSHOTS = path.join(SCREENSHOTS_DIR, 'base');
const DIFF_SCREENSHOTS = path.join(SCREENSHOTS_DIR, 'diff');

/**
 * Logs a styled progress step heading to standard output.
 */
function step(msg: string): void {
  console.log(`\n▶ ${msg}`);
}

/**
 * Executes a shell command synchronously in the specified working directory.
 */
function run(cmd: string, cwd = ROOT): void {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

/**
 * Spawns a background HTTP static file server on the specified port.
 */
function startServer(dir: string, port: number): ChildProcess {
  const proc = spawn('node', [path.join(ROOT, 'bin', 'serve.ts'), dir, String(port)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });
  if (proc.stdout) {
    proc.stdout.pipe(process.stdout);
  }
  if (proc.stderr) {
    proc.stderr.pipe(process.stderr);
  }
  return proc;
}

/**
 * Polls a TCP port until a connection succeeds or the timeout is reached.
 */
function waitForPort(port: number, timeoutMs = 60000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    /**
     * Attempts a socket connection to localhost on the designated port,
     * retrying periodically until deadline if connection fails.
     */
    function attempt(): void {
      const socket = net.createConnection(port, 'localhost');
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for port ${port}`));
        } else {
          setTimeout(attempt, 500);
        }
      });
    }
    attempt();
  });
}

/**
 * Runs the screenshot capture script against a local server port.
 */
function capture(port: number, outputDir: string): void {
  run(
    `node capture.js --domain=http://localhost:${port} --output="${outputDir}"`,
    VISUAL_DIFFS_DIR,
  );
}

/**
 * Main execution routine for orchestrating side-by-side visual diffs.
 * Builds the current branch and base branch, captures screenshots, and pixel-diffs them.
 */
async function main(): Promise<void> {
  const baseBranch = args.base || 'main';

  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT })
    .toString()
    .trim();

  if (currentBranch === baseBranch) {
    console.error(
      `Already on "${baseBranch}". Check out a feature branch first, or pass --base=<other-branch>.`,
    );
    process.exit(1);
  }

  console.log(`Comparing  "${currentBranch}"  vs  "${baseBranch}"`);

  let branchServer: ChildProcess | null = null;
  let baseServer: ChildProcess | null = null;

  try {
    // ── 1. Build current branch ───────────────────────────────────────────────
    step(`Building "${currentBranch}" (golden)…`);
    run('npm run build:golden');

    // ── 2. Capture current branch screenshots ─────────────────────────────────
    step(`Capturing "${currentBranch}" screenshots…`);
    branchServer = startServer(path.join(ROOT, 'golden'), BRANCH_PORT);
    await waitForPort(BRANCH_PORT);
    capture(BRANCH_PORT, BRANCH_SCREENSHOTS);
    branchServer.kill();
    branchServer = null;

    // ── 3. Create git worktree for base branch ────────────────────────────────
    step(`Setting up "${baseBranch}" via git worktree…`);
    if (fs.existsSync(WORKTREE_DIR)) {
      execSync(`git worktree remove --force "${WORKTREE_DIR}"`, { cwd: ROOT, stdio: 'inherit' });
    }
    execSync(`git worktree add "${WORKTREE_DIR}" ${baseBranch}`, { cwd: ROOT, stdio: 'inherit' });

    // Symlink node_modules so we don't need a full npm install
    const worktreeNM = path.join(WORKTREE_DIR, 'node_modules');
    if (!fs.existsSync(worktreeNM)) {
      fs.symlinkSync(path.join(ROOT, 'node_modules'), worktreeNM);
    }

    // ── 4. Build base branch ──────────────────────────────────────────────────
    step(`Building "${baseBranch}" (golden)…`);
    // Fall back to index.js when comparing against a base branch prior to the TypeScript migration.
    let baseBuildCommand = 'NODE_ENV=production node index.ts --golden';
    if (!fs.existsSync(path.join(WORKTREE_DIR, 'index.ts'))) {
      baseBuildCommand = 'NODE_ENV=production node index.js --golden';
    }
    run(baseBuildCommand, WORKTREE_DIR);

    // ── 5. Capture base screenshots ───────────────────────────────────────────
    step(`Capturing "${baseBranch}" screenshots…`);
    baseServer = startServer(path.join(WORKTREE_DIR, 'golden'), BASE_PORT);
    await waitForPort(BASE_PORT);
    capture(BASE_PORT, BASE_SCREENSHOTS);
    baseServer.kill();
    baseServer = null;

    // ── 6. Compare ────────────────────────────────────────────────────────────
    step('Comparing screenshots…');
    run(
      `node compare.js --baseline="${BASE_SCREENSHOTS}" --test="${BRANCH_SCREENSHOTS}" --output="${DIFF_SCREENSHOTS}"`,
      VISUAL_DIFFS_DIR,
    );
  } finally {
    if (branchServer) branchServer.kill();
    if (baseServer) baseServer.kill();
    if (fs.existsSync(WORKTREE_DIR)) {
      execSync(`git worktree remove --force "${WORKTREE_DIR}"`, { cwd: ROOT, stdio: 'pipe' });
    }
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('\nFailed:', message);
  process.exit(1);
});
