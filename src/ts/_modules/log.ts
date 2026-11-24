const { isProduction } = require('./environment.ts');
const { log, table } = console;

module.exports = {
  /**
   * Outputs tabular data to the console if the environment is not production.
   *
   * @param {...unknown} args - Arguments passed directly to `console.table`.
   * @returns {void}
   */
  table: (...args: unknown[]): void => {
    if (!isProduction) table(...args);
  },

  /**
   * Outputs messages or objects to the console if the environment is not production.
   *
   * @param {...unknown} args - Arguments passed directly to `console.log`.
   * @returns {void}
   */
  log: (...args: unknown[]): void => {
    if (!isProduction) log(...args);
  },
};
