const { execFileSync }: typeof import('child_process') = require('child_process');

const cache = new Map<string, string>();

/** Share Git resolution across stages; refresh once when a preview rebuild begins. */
function commitHash(root: string): string {
  if (process.env.COMMIT_HASH) return process.env.COMMIT_HASH;
  if (!cache.has(root)) {
    try {
      cache.set(root, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Could not get git commit hash: ${message}`);
      cache.set(root, 'unknown');
    }
  }
  const cached = cache.get(root);
  if (cached === undefined) return 'unknown';
  return cached;
}

commitHash.clear = (): void => {
  cache.clear();
};

module.exports = commitHash;
