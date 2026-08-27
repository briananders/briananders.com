const fs = require('fs-extra');
const { execSync } = require('child_process');
const { log } = console;

const timestamp = require('./timestamp');

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
 * @param {object} configs - Build configuration object.
 * @param {{ package: string }} configs.dir - Directory paths object.
 */
module.exports = function generateBuildTxt(configs) {
  const { dir } = configs;

  log(`${timestamp.stamp()} generateBuildTxt()`);

  try {
    // Capture the current date/time in ISO 8601 format (UTC).
    const buildDateTime = new Date().toISOString();

    // Try to resolve the current git commit SHA for traceability.
    let commitHash = 'unknown';
    try {
      commitHash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    } catch (error) {
      log(`${timestamp.stamp()} Warning: Could not get git commit hash: ${error.message}`);
    }

    // Assemble the file content.
    const buildTxtContent = `Build Date-Time: ${buildDateTime}
Commit Hash: ${commitHash}
`;

    // Ensure the output directory exists, then write the file.
    const buildTxtPath = `${dir.package}build.txt`;
    fs.ensureDirSync(dir.package);
    fs.writeFileSync(buildTxtPath, buildTxtContent);

    log(`${timestamp.stamp()} generateBuildTxt(): ${'DONE'.bold.green}`);
  } catch (error) {
    log(`${timestamp.stamp()} Error generating build.txt: ${error.message}`.red);
  }
};
