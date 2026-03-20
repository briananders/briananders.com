/**
 * Build event name constants used by the EventEmitter pipeline.
 *
 * The build system is event-driven: each stage emits one of these string
 * tokens when it finishes, and downstream stages listen for them. Using named
 * constants instead of raw strings prevents typo bugs and makes the pipeline
 * easy to follow.
 *
 * Rough event flow (production):
 *   jsMoved → jsMinified → assetHashJsListed ─┐
 *   stylesMoved → assetHashCssListed ──────────┤→ finishHashing → hashingDone → gzipDone
 *   imagesMoved → assetHashImagesListed → indexCssForHashing ──┘
 *   templatesMoved → htmlMinified ─────────────┘
 *   sitemapDone / gzipDone → checkDone → process.exit()
 */
module.exports = {
  /** CSS files have been hashed and renamed. */
  assetHashCssListed: 'asset-hashing/hash-css-listed',

  /** Image and video files have been hashed and renamed. */
  assetHashImagesListed: 'asset-hash-images-listed',

  /** JS files have been hashed and renamed. */
  assetHashJsListed: 'asset-hash-js-listed',

  /** All eligible files have been gzip-compressed. */
  gzipDone: 'gzip-done',

  /** HTML and JSON files have been updated with hashed asset references. */
  hashingDone: 'hashing-done',

  /** All HTML files have been minified. */
  htmlMinified: 'html-minified',

  /** All source images have been copied/converted to the output directory. */
  imagesMoved: 'images-moved',

  /**
   * Image hashes have been applied to CSS files, making them ready
   * for their own hashing pass.
   */
  indexCssForHashing: 'index-css-for-hashing',

  /** All JS files have been minified with UglifyJS. */
  jsMinified: 'js-minified',

  /** All JS entry points have been bundled by Browserify. */
  jsMoved: 'js-moved',

  /** Front-matter metadata has been extracted from all EJS templates. */
  pageMappingDataCompiled: 'page-mapping-data-compiled',

  /** Dev server is ready: all initial assets have been compiled. */
  previewReady: 'preview-ready',

  /** Both sitemap.json and sitemap.xml have been written. */
  sitemapDone: 'sitemap-done',

  /** All SCSS files have been compiled to CSS. */
  stylesMoved: 'styles-moved',

  /** All EJS templates have been rendered to HTML. */
  templatesMoved: 'templates-moved',

  /** All source videos have been copied to the output directory. */
  videosMoved: 'videos-moved',
};
