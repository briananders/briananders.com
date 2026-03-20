require('colors');

/**
 * Build-log timestamp helper.
 *
 * Provides a single `stamp()` method that returns the current wall-clock
 * time formatted as `[HH:MM:SS]` in grey. Every build log message is
 * prefixed with this stamp so developers can track the relative timing of
 * individual build stages and spot slow steps at a glance.
 */
module.exports = {

  /**
   * Returns a grey-coloured `[HH:MM:SS]` timestamp string for the current time.
   *
   * Minutes and seconds are zero-padded to two digits so the output width is
   * constant (useful for aligning multi-line log output).
   *
   * @returns {string} Formatted and coloured timestamp, e.g. `"[14:05:09]"`.
   */
  stamp: function stamp() {
    const now = new Date();

    // Build a [hours, minutes, seconds] array from the current time.
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()];

    // Zero-pad minutes (index 1) and seconds (index 2) to always show two digits.
    for (let i = 1; i < 3; i++) {
      if (time[i] < 10) {
        time[i] = `0${time[i]}`;
      }
    }

    // Return the formatted string with grey colouring from the `colors` package.
    return `[${time.join(':')}]`.grey;
  },

};
