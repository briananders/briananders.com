import type { Dirent } from 'node:fs';

const fs = require('fs-extra');
const path = require('node:path');

const EXEMPT_ROOT_FILES = new Set(['eslint.config.mjs']);
const SCAN_DIRECTORIES = ['src/js', 'src/ts', 'build', 'bin', 'scaffold', 'test'];

export interface ConversionAction {
  sourcePath: string;
  targetPath: string;
  isScript: boolean;
}

export interface ConversionResult {
  converted: ConversionAction[];
  skipped: string[];
}

/**
 * Recursively collects files under a directory, skipping hidden metadata files.
 *
 * @param {string} directory - Directory to walk.
 * @returns {string[]} Absolute paths of discovered files.
 */
function walkDirectory(directory: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }
  const entries: Dirent[] = fs.readdirSync(directory, { withFileTypes: true });
  const results: string[] = [];
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (entry.name.startsWith('.')) {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDirectory(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Checks whether a file path is a legacy JavaScript file that must be converted to TypeScript.
 *
 * @param {string} rootDir - Repository root directory.
 * @param {string} filePath - Absolute path to inspect.
 * @returns {boolean} True when the file should be converted or relocated.
 */
function isLegacyFile(rootDir: string, filePath: string): boolean {
  const relativePath = path.relative(rootDir, filePath).split(path.sep).join('/');
  if (EXEMPT_ROOT_FILES.has(relativePath)) {
    return false;
  }
  if (relativePath.startsWith('src/js/')) {
    return true;
  }
  const extension = path.extname(relativePath).toLowerCase();
  if (extension === '.js') {
    return true;
  }
  if (extension === '.mjs' && relativePath.startsWith('test/')) {
    return true;
  }
  return false;
}

/**
 * Finds all legacy JavaScript files (and any files inside `src/js/`) across the repo.
 *
 * @param {string} rootDir - Repository root directory.
 * @returns {string[]} Sorted list of absolute paths requiring migration.
 */
function findLegacyJsFiles(rootDir: string): string[] {
  const discovered: string[] = [];

  if (fs.existsSync(rootDir)) {
    const rootEntries: Dirent[] = fs.readdirSync(rootDir, { withFileTypes: true });
    for (let index = 0; index < rootEntries.length; index++) {
      const entry = rootEntries[index];
      if (entry.isFile()) {
        const fullPath = path.join(rootDir, entry.name);
        if (isLegacyFile(rootDir, fullPath)) {
          discovered.push(fullPath);
        }
      }
    }
  }

  for (let index = 0; index < SCAN_DIRECTORIES.length; index++) {
    const scanRoot = path.join(rootDir, SCAN_DIRECTORIES[index]);
    const files = walkDirectory(scanRoot);
    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      if (isLegacyFile(rootDir, files[fileIndex])) {
        discovered.push(files[fileIndex]);
      }
    }
  }

  return Array.from(new Set(discovered)).sort();
}

/**
 * Computes the destination TypeScript path for a legacy JavaScript or `src/js/` file.
 *
 * @param {string} rootDir - Repository root directory.
 * @param {string} sourcePath - Absolute path of the legacy file.
 * @returns {ConversionAction} Source path, target path, and whether code rewriting applies.
 */
function computeTargetAction(rootDir: string, sourcePath: string): ConversionAction {
  const relativePath = path.relative(rootDir, sourcePath).split(path.sep).join('/');
  let targetRelative = relativePath;
  if (targetRelative.startsWith('src/js/')) {
    targetRelative = `src/ts/${targetRelative.slice('src/js/'.length)}`;
  }

  const extension = path.extname(targetRelative).toLowerCase();
  let isScript = false;
  if (extension === '.js') {
    targetRelative = `${targetRelative.slice(0, -3)}.ts`;
    isScript = true;
  } else if (extension === '.mjs') {
    targetRelative = `${targetRelative.slice(0, -4)}.mts`;
    isScript = true;
  }

  return {
    sourcePath,
    targetPath: path.join(rootDir, targetRelative),
    isScript,
  };
}

/**
 * Resolves a single relative import or require specifier to its `.ts` or `.mts` equivalent.
 *
 * @param {string} specifier - Original module specifier string.
 * @param {string} targetFileDir - Directory of the converted target file.
 * @param {Set<string>} knownTargets - Set of target paths being created in this run.
 * @returns {string} Updated module specifier.
 */
function rewriteSpecifier(
  specifier: string,
  targetFileDir: string,
  knownTargets: Set<string>,
): string {
  const updated = specifier.replace(/\/src\/js\//g, '/src/ts/').replace(/^src\/js\//, 'src/ts/');
  if (!updated.startsWith('./') && !updated.startsWith('../')) {
    return updated;
  }

  if (updated.endsWith('.js')) {
    return `${updated.slice(0, -3)}.ts`;
  }
  if (updated.endsWith('.mjs')) {
    return `${updated.slice(0, -4)}.mts`;
  }
  if (path.extname(updated) !== '') {
    return updated;
  }

  const directCandidate = path.resolve(targetFileDir, `${updated}.ts`);
  if (knownTargets.has(directCandidate) || fs.existsSync(directCandidate)) {
    return `${updated}.ts`;
  }

  const indexCandidate = path.resolve(targetFileDir, updated, 'index.ts');
  if (knownTargets.has(indexCandidate) || fs.existsSync(indexCandidate)) {
    return `${updated}/index.ts`;
  }

  return updated;
}

/**
 * Rewrites relative `require()` and `import` specifiers inside a converted script.
 *
 * @param {string} sourceCode - Original JavaScript source content.
 * @param {string} targetPath - Destination TypeScript file path.
 * @param {Set<string>} knownTargets - Target paths created in the same conversion pass.
 * @returns {string} Source code with updated TypeScript specifiers.
 */
function rewriteRelativeSpecifiers(
  sourceCode: string,
  targetPath: string,
  knownTargets: Set<string>,
): string {
  const targetDir = path.dirname(targetPath);

  const afterRequire = sourceCode.replace(
    /require\(\s*(['"])([^'"]+)\1\s*\)/g,
    (_match: string, quote: string, spec: string) => {
      const nextSpec = rewriteSpecifier(spec, targetDir, knownTargets);
      return `require(${quote}${nextSpec}${quote})`;
    },
  );

  return afterRequire.replace(
    /((?:import|export)\s+(?:[\s\S]*?\s+from\s+)?)(['"])([^'"]+)\2/g,
    (_match: string, prefix: string, quote: string, spec: string) => {
      const nextSpec = rewriteSpecifier(spec, targetDir, knownTargets);
      return `${prefix}${quote}${nextSpec}${quote}`;
    },
  );
}

/**
 * Recursively prunes empty directories under `directory`, removing `directory` itself if empty.
 *
 * @param {string} directory - Directory path to clean up.
 */
function removeEmptyDirectories(directory: string): void {
  if (!fs.existsSync(directory)) {
    return;
  }
  const entries: Dirent[] = fs.readdirSync(directory, { withFileTypes: true });
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (entry.isDirectory()) {
      removeEmptyDirectories(path.join(directory, entry.name));
    }
  }
  const remaining: string[] = fs.readdirSync(directory).filter((name: string) => name !== '.DS_Store');
  if (remaining.length === 0) {
    fs.removeSync(directory);
  }
}

/**
 * Converts all legacy JavaScript files in `rootDir` to TypeScript.
 *
 * @param {string} rootDir - Repository root directory.
 * @param {{ checkOnly?: boolean }} [options] - When `checkOnly` is true, does not modify disk.
 * @returns {ConversionResult} Converted actions and any skipped conflicts.
 */
function convertLegacyJsFiles(
  rootDir: string,
  options: { checkOnly?: boolean } = {},
): ConversionResult {
  const checkOnly = Boolean(options.checkOnly);
  const legacyFiles = findLegacyJsFiles(rootDir);
  const actions = legacyFiles.map((filePath) => computeTargetAction(rootDir, filePath));
  const knownTargets = new Set(actions.map((action) => action.targetPath));
  const converted: ConversionAction[] = [];
  const skipped: string[] = [];

  for (let index = 0; index < actions.length; index++) {
    const action = actions[index];
    if (action.sourcePath !== action.targetPath && fs.existsSync(action.targetPath)) {
      skipped.push(action.sourcePath);
      continue;
    }

    converted.push(action);
    if (checkOnly) {
      continue;
    }

    fs.mkdirpSync(path.dirname(action.targetPath));
    if (action.isScript) {
      const original = fs.readFileSync(action.sourcePath, 'utf8');
      const updated = rewriteRelativeSpecifiers(original, action.targetPath, knownTargets);
      fs.writeFileSync(action.targetPath, updated, 'utf8');
      fs.removeSync(action.sourcePath);
    } else {
      fs.moveSync(action.sourcePath, action.targetPath);
    }
  }

  if (!checkOnly) {
    removeEmptyDirectories(path.join(rootDir, 'src', 'js'));
  }

  return { converted, skipped };
}

/**
 * CLI entrypoint for `npm run convert-js` and `.githooks/post-merge`.
 */
function main(): void {
  const rootDir = path.resolve(__dirname, '..');
  const checkOnly = process.argv.includes('--check');
  const { converted, skipped } = convertLegacyJsFiles(rootDir, { checkOnly });

  if (checkOnly) {
    if (converted.length > 0 || skipped.length > 0) {
      console.error('Unconverted legacy JavaScript files detected:');
      converted.forEach((action) => {
        console.error(`  ${path.relative(rootDir, action.sourcePath)} -> ${path.relative(rootDir, action.targetPath)}`);
      });
      skipped.forEach((filePath) => {
        console.error(`  ${path.relative(rootDir, filePath)} (target .ts already exists — resolve manually)`);
      });
      process.exit(1);
    }
    return;
  }

  if (converted.length === 0 && skipped.length === 0) {
    return;
  }

  console.log(`Converted ${converted.length} legacy JavaScript file(s) to TypeScript:`);
  converted.forEach((action) => {
    console.log(`  ${path.relative(rootDir, action.sourcePath)} -> ${path.relative(rootDir, action.targetPath)}`);
  });
  if (skipped.length > 0) {
    console.warn('Skipped files where a TypeScript counterpart already exists (merge manually):');
    skipped.forEach((filePath) => {
      console.warn(`  ${path.relative(rootDir, filePath)}`);
    });
  }
  console.log('Next step: add strict types where needed and run `npm run typecheck && npm run lint && npm test`.');
}

if (require.main === module) {
  main();
}

module.exports = {
  findLegacyJsFiles,
  computeTargetAction,
  rewriteRelativeSpecifiers,
  convertLegacyJsFiles,
};
