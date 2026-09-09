const { isProduction } = require('./environment');
const { log, table } = console;

module.exports = {
  /**
   * Outputs tabular data to the console if the environment is not production.
   *
   * @param {...*} args - Arguments passed directly to `console.table`.
   * @returns {void}
   */
  table: (...args) => {
    if (!isProduction) table(...args);
  },

  /**
   * Outputs messages or objects to the console if the environment is not production.
   *
   * @param {...*} args - Arguments passed directly to `console.log`.
   * @returns {void}
   */
  log: (...args) => {
    if (!isProduction) log(...args);
  },
};
