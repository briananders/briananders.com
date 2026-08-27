const { isProduction } = require('./environment');
const { log, table } = console;

module.exports = {

  table: (...args) => {
    if (!isProduction) table(...args);
  },

  log: (...args) => {
    if (!isProduction) log(...args);
  },

};
