const fs = require('fs-extra');

const timestamp = require('./timestamp');

const { log } = console;

module.exports = ({ dir }) => new Promise((resolve, reject) => {
  log(`${timestamp.stamp()} clean()`);

  fs.emptyDir(dir.package, (error) => {
    if (error) {
      log(error);
      reject();
    } else {
      resolve();
    }
  });
});
