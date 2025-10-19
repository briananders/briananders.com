const fs = require('fs-extra');

const timestamp = require('./timestamp');

const { log } = console;

module.exports = ({ dir, isComparisonBuild }) => new Promise((resolve, reject) => {
  log(`${timestamp.stamp()} clean()`);

  const targetDir = isComparisonBuild ? dir.package : dir.package;
  
  fs.emptyDir(targetDir, (error) => {
    if (error) {
      log(error);
      reject();
    } else {
      resolve();
    }
  });
});
