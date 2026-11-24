import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ConversionResult } from '../bin/convert-js-to-ts.ts';

interface ConvertJsModule {
  findLegacyJsFiles: (rootDir: string) => string[];
  convertLegacyJsFiles: (rootDir: string, options?: { checkOnly?: boolean }) => ConversionResult;
}

const require = createRequire(import.meta.url);
const {
  findLegacyJsFiles,
  convertLegacyJsFiles,
}: ConvertJsModule = require('../bin/convert-js-to-ts.ts');

const projectRoot = path.resolve(process.cwd());

/**
 * Writes a UTF-8 fixture file inside a root directory, creating parent folders as needed.
 */
function writeFixtureFile(rootDir: string, relativePath: string, content: string): string {
  const fullPath = path.join(rootDir, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, 'utf8');
  return fullPath;
}

describe('TypeScript-only repository guard and converter', () => {
  test('repository contains zero unconverted legacy .js or .mjs files', () => {
    const legacyFiles = findLegacyJsFiles(projectRoot).map((filePath) => path.relative(projectRoot, filePath));
    assert.deepEqual(
      legacyFiles,
      [],
      'Run `npm run convert-js` to convert legacy JavaScript files to TypeScript',
    );
  });

  describe('convertLegacyJsFiles fixture behavior', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ts-only-test-'));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    test('relocates src/js assets, rewrites requires, converts tests, respects exemptions, and skips conflicts', () => {
      writeFixtureFile(tmpDir, 'src/js/bar.js', "module.exports = 'bar';\n");
      writeFixtureFile(
        tmpDir,
        'src/js/foo.js',
        [
          "const bare = require('./bar');",
          "const explicit = require('./bar.js');",
          'module.exports = [bare, explicit];'
        ].join('\n'),
      );
      writeFixtureFile(tmpDir, 'src/js/widget.scss', '.widget { display: block; }\n');
      writeFixtureFile(tmpDir, 'test/sample.test.mjs', "import assert from 'node:assert/strict';\nassert.ok(true);\n");
      writeFixtureFile(tmpDir, 'eslint.config.mjs', 'export default [];\n');
      const conflictLegacy = writeFixtureFile(tmpDir, 'build/conflict.js', "module.exports = 'legacy';\n");
      const conflictExisting = writeFixtureFile(tmpDir, 'build/conflict.ts', "module.exports = 'existing';\n");

      const result = convertLegacyJsFiles(tmpDir);

      // Relocated scripts and co-located styles from src/js/ -> src/ts/
      const fooTarget = path.join(tmpDir, 'src/ts/foo.ts');
      const barTarget = path.join(tmpDir, 'src/ts/bar.ts');
      const scssTarget = path.join(tmpDir, 'src/ts/widget.scss');
      assert.equal(existsSync(fooTarget), true, 'src/js/foo.js should move to src/ts/foo.ts');
      assert.equal(existsSync(barTarget), true, 'src/js/bar.js should move to src/ts/bar.ts');
      assert.equal(existsSync(scssTarget), true, 'co-located SCSS should move to src/ts/widget.scss');
      assert.equal(readFileSync(scssTarget, 'utf8'), '.widget { display: block; }\n');

      // Rewrote both bare and .js relative require() specifiers to .ts
      const fooContent = readFileSync(fooTarget, 'utf8');
      assert.ok(fooContent.includes("require('./bar.ts')"), 'relative requires should resolve to .ts');
      assert.equal(fooContent.includes("require('./bar')"), false, 'bare relative require should be rewritten');
      assert.equal(fooContent.includes("require('./bar.js')"), false, '.js relative require should be rewritten');

      // Converted test .mjs -> .mts
      assert.equal(existsSync(path.join(tmpDir, 'test/sample.test.mts')), true);
      assert.equal(existsSync(path.join(tmpDir, 'test/sample.test.mjs')), false);

      // Removed empty src/js directory
      assert.equal(existsSync(path.join(tmpDir, 'src/js')), false, 'empty src/js/ directory should be removed');

      // Respected eslint.config.mjs exemption
      assert.equal(existsSync(path.join(tmpDir, 'eslint.config.mjs')), true);
      assert.equal(existsSync(path.join(tmpDir, 'eslint.config.mts')), false);

      // Skipped conflicting target without clobbering existing .ts file
      assert.deepEqual(result.skipped, [conflictLegacy]);
      assert.equal(existsSync(conflictLegacy), true, 'conflicting legacy source should remain for manual merge');
      assert.equal(readFileSync(conflictExisting, 'utf8'), "module.exports = 'existing';\n");
    });

    test('checkOnly reports pending conversions and conflicts without modifying disk', () => {
      const legacyScript = writeFixtureFile(tmpDir, 'src/js/foo.js', "module.exports = 'foo';\n");
      const legacyStyle = writeFixtureFile(tmpDir, 'src/js/widget.scss', '.widget {}\n');
      const legacyTest = writeFixtureFile(tmpDir, 'test/sample.test.mjs', 'export {};\n');
      const conflictLegacy = writeFixtureFile(tmpDir, 'build/conflict.js', "module.exports = 'legacy';\n");
      const conflictExisting = writeFixtureFile(tmpDir, 'build/conflict.ts', "module.exports = 'existing';\n");

      const result = convertLegacyJsFiles(tmpDir, { checkOnly: true });

      const pendingSources = result.converted.map((action) => action.sourcePath).sort();
      assert.deepEqual(pendingSources, [legacyScript, legacyStyle, legacyTest].sort());
      assert.deepEqual(result.skipped, [conflictLegacy]);

      // Verify nothing was written, moved, or deleted on disk
      assert.equal(existsSync(legacyScript), true);
      assert.equal(existsSync(legacyStyle), true);
      assert.equal(existsSync(legacyTest), true);
      assert.equal(existsSync(path.join(tmpDir, 'src/ts/foo.ts')), false);
      assert.equal(existsSync(path.join(tmpDir, 'src/ts/widget.scss')), false);
      assert.equal(existsSync(path.join(tmpDir, 'test/sample.test.mts')), false);
      assert.equal(readFileSync(conflictExisting, 'utf8'), "module.exports = 'existing';\n");
    });
  });
});
