/**
 * Mutable boolean flags that track which build stages have finished.
 *
 * This object is passed by reference through `configs` so every module shares
 * the same instance. Each stage flips its flag to `true` when it completes.
 * `check-done.js` reads all flags to decide whether the overall build is done.
 *
 * Note: flags are reset to `false` at the start of each stage function so
 * that re-running a stage (e.g. in watch mode) clears the previous state.
 */
module.exports = {
  /** True once all JS entry points have been minified by UglifyJS. */
  JS_IS_MINIFIED: false,

  /** True once all SCSS files have been compiled (and minified in production). */
  CSS_IS_MINIFIED: false,

  /** True once all HTML output files have been minified. */
  HTML_IS_MINIFIED: false,

  /** True once all source images have been processed and copied to output. */
  IMAGES_ARE_MOVED: false,

  /** True once all source videos have been copied to output. */
  VIDEOS_ARE_MOVED: false,

  /** Sub-flags for the asset-hashing pipeline. */
  ASSET_HASH: {
    /** True once all image/video files have been renamed with content hashes. */
    IMAGES: false,

    /** True once all CSS files have been renamed with content hashes. */
    CSS: false,

    /** True once all JS files have been renamed with content hashes. */
    JS: false,

    /**
     * True once all HTML and JSON files have been rewritten to reference the
     * hashed asset filenames (the final step of the hashing pipeline).
     */
    DONE: false,
  },

  /** True once both sitemap.json and sitemap.xml have been written. */
  SITE_MAP: false,

  /** True once all output files have been gzip-compressed. */
  GZIP: false,

  /**
   * True once the dev-mode preview is ready (JS, CSS, templates, and images
   * have all finished their first compile). Not used in production builds.
   */
  PREVIEW_READY: false,
};
