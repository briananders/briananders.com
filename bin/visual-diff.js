'use strict';

/**
 * Visual diff orchestrator.
 *
 * Builds the current branch and the base branch (default: main) side-by-side
 * using a git worktree, captures screenshots of each, then pixel-diffs them.
 *
 * Usage:
 *   node bin/visual-diff.js
 *   node bin/visual-diff.js --base=staging
 */

const { execSync, spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Parse --key=value args
const args = {};
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

function step(msg) {
  console.log(`\n▶ ${msg}`);
}

function run(cmd, cwd = ROOT) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function startServer(dir, port) {
  const proc = spawn('node', [path.join(ROOT, 'bin', 'serve.js'), dir, String(port)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });
  proc.stdout.pipe(process.stdout);
  proc.stderr.pipe(process.stderr);
  return proc;
}

function waitForPort(port, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    function attempt() {
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

function capture(port, outputDir) {
  run(
    `node capture.js --domain=http://localhost:${port} --output="${outputDir}"`,
    VISUAL_DIFFS_DIR,
  );
}

async function main() {
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

  let branchServer = null;
  let baseServer = null;

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
    run('NODE_ENV=production node index.js --golden', WORKTREE_DIR);

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

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
