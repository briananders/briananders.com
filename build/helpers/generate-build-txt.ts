import type { BuildDirectories } from '../types.ts';

const fs: typeof import('fs-extra') = require('fs-extra');
const resolveCommitHash: (root: string) => string = require('./commit-hash.ts');
const buildDate: () => Date = require('./build-date.ts');
const { log } = console;

const timestamp: { stamp: () => string } = require('./timestamp.ts');

/**
 * Writes a `build.txt` file to the output directory.
 *
 * The file contains two lines:
 * - `Build Date-Time: <ISO 8601 timestamp>` — when this build ran.
 * - `Commit Hash: <git SHA>` — the source commit being built.
 *
 * This file is useful for confirming which build is deployed on a server
 * and for correlating a deployed artifact back to a source commit.
 * It is called once at the start of the build and again on every source
 * file change during dev (`npm start`) so the timestamp stays current.
 *
 * @param configs - Build configuration object containing directory paths.
 */
module.exports = function generateBuildTxt(configs: { dir: Pick<BuildDirectories, 'root' | 'package'> }): void {
  const { dir } = configs;

  log(`${timestamp.stamp()} generateBuildTxt()`);

  try {
    // Capture the build date/time in ISO 8601 format (UTC); pinned in golden builds.
    const buildDateTime = buildDate().toISOString();

    // Try to resolve the current git commit SHA for traceability.
    const commitHash = resolveCommitHash(dir.root);

    // Assemble the file content.
    const buildTxtContent = `Build Date-Time: ${buildDateTime}
Commit Hash: ${commitHash}
`;

    // Ensure the output directory exists, then write the file.
    const buildTxtPath = `${dir.package}build.txt`;
    fs.ensureDirSync(dir.package);
    fs.writeFileSync(buildTxtPath, buildTxtContent);

    log(`${timestamp.stamp()} generateBuildTxt(): ${'DONE'.green.bold}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log(`${timestamp.stamp()} Error generating build.txt: ${message}`.red);
  }
};
