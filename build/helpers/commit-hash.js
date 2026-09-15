const { execFileSync } = require('child_process');
const cache = new Map();
/** Share Git resolution across stages; refresh once when a preview rebuild begins. */
function commitHash(root) {
  if (process.env.COMMIT_HASH) return process.env.COMMIT_HASH;
  if (!cache.has(root)) {
    try {
      cache.set(root, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim());
    } catch (error) {
      console.warn(`Could not get git commit hash: ${error.message}`);
      cache.set(root, 'unknown');
    }
  }
  return cache.get(root);
}
commitHash.clear = () => cache.clear();
module.exports = commitHash;
