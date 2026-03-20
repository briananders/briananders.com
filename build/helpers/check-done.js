/**
 * Logs the current state of every completion flag to the terminal.
 *
 * Only called when `debug` mode is active. Prints a bordered summary block
 * so developers can see at a glance which stages have and haven't finished
 * before the gate check runs.
 *
 * @param {{ dir: object, completionFlags: object }} params
 */
function logCompletionFlags({ dir, completionFlags }) {
  const { log } = console;
  const timestamp = require(`${dir.build}helpers/timestamp`);

  log(`--------------------------------`);
  log(`${timestamp.stamp()} checkDone()`);
  log(`JS_IS_MINIFIED: ${completionFlags.JS_IS_MINIFIED}`);
  log(`CSS_IS_MINIFIED: ${completionFlags.CSS_IS_MINIFIED}`);
  log(`HTML_IS_MINIFIED: ${completionFlags.HTML_IS_MINIFIED}`);
  log(`IMAGES_ARE_MOVED: ${completionFlags.IMAGES_ARE_MOVED}`);
  log(`VIDEOS_ARE_MOVED: ${completionFlags.VIDEOS_ARE_MOVED}`);
  log(`ASSET_HASH.IMAGES: ${completionFlags.ASSET_HASH.IMAGES}`);
  log(`ASSET_HASH.CSS: ${completionFlags.ASSET_HASH.CSS}`);
  log(`ASSET_HASH.JS: ${completionFlags.ASSET_HASH.JS}`);
  log(`ASSET_HASH.DONE: ${completionFlags.ASSET_HASH.DONE}`);
  log(`SITE_MAP: ${completionFlags.SITE_MAP}`);
  log(`GZIP: ${completionFlags.GZIP}`);
  log(`PREVIEW_READY: ${completionFlags.PREVIEW_READY}`);
  log(`--------------------------------`);
}

/**
 * Gate function that exits the process once every production build stage is done.
 *
 * Called after each significant build event (e.g. `gzipDone`, `sitemapDone`).
 * Inspects all the completion flags and calls `process.exit()` only when every
 * required stage has been marked `true`. Any unfinished stage causes an early
 * `return false` so the build continues running.
 *
 * In production builds this is the terminal step: all flags true → print the
 * success banner → exit cleanly.
 *
 * @param {{ dir: object, debug: boolean, completionFlags: object }} params
 * @returns {false|undefined} Returns `false` if build stages are still pending; otherwise exits.
 */
module.exports = function checkDone({ dir, debug, completionFlags }) {

  if (debug) {
    logCompletionFlags({ dir, completionFlags });
  }

  // All flags that must be true before the build is considered complete.
  const flagsToCheck = [
    completionFlags.JS_IS_MINIFIED,
    completionFlags.CSS_IS_MINIFIED,
    completionFlags.HTML_IS_MINIFIED,
    completionFlags.IMAGES_ARE_MOVED,
    completionFlags.VIDEOS_ARE_MOVED,
    completionFlags.ASSET_HASH.IMAGES,
    completionFlags.ASSET_HASH.CSS,
    completionFlags.ASSET_HASH.JS,
    completionFlags.ASSET_HASH.DONE,
    completionFlags.SITE_MAP,
    completionFlags.GZIP,
  ];

  // If any flag is still false, the build isn't done yet — bail out early.
  if (flagsToCheck.some((flag) => !flag)) {
    return false;
  }

  // All stages complete: print the success banner and exit.
  require(`${dir.build}helpers/exit-message`)();

  process.exit();
};
