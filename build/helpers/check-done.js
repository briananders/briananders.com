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

module.exports = function checkDone({ dir, debug, completionFlags, isComparisonBuild }) {

  if (debug || isComparisonBuild) {
    logCompletionFlags({ dir, completionFlags });
  }

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

  if (flagsToCheck.some((flag) => !flag)) {
    return false;
  }

  require(`${dir.build}helpers/exit-message`)();

  process.exit();
};
