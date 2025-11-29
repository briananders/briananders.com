const fs = require('fs-extra');
const { execSync } = require('child_process');
const { log } = console;

const timestamp = require('./timestamp');

/**
 * Generate build.txt file with build date-time and commit hash
 * @param {Object} configs - Build configuration object
 */
module.exports = function generateBuildTxt(configs) {
  const { dir } = configs;

  log(`${timestamp.stamp()} generateBuildTxt()`);

  try {
    // Get current date-time in ISO format
    const buildDateTime = new Date().toISOString();

    // Get git commit hash
    let commitHash = 'unknown';
    try {
      commitHash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    } catch (error) {
      log(`${timestamp.stamp()} Warning: Could not get git commit hash: ${error.message}`);
    }

    // Generate build.txt content
    const buildTxtContent = `Build Date-Time: ${buildDateTime}
Commit Hash: ${commitHash}
`;

    // Write to src/build.txt (will be copied to package/ by moveAllTxtFiles)
    const buildTxtPath = `${dir.src}build.txt`;
    fs.writeFileSync(buildTxtPath, buildTxtContent);

    log(`${timestamp.stamp()} generateBuildTxt(): ${'DONE'.bold.green}`);
  } catch (error) {
    log(`${timestamp.stamp()} Error generating build.txt: ${error.message}`.red);
  }
};
