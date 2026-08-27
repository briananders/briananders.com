/**
 * Directory path factory.
 *
 * Returns an object of absolute paths used throughout the build system.
 * All paths include a trailing slash so callers can safely concatenate
 * relative paths without adding their own separator.
 *
 * @param {string} appRoot - Absolute path to the repository root (typically `__dirname` of `index.js`).
 * @param {boolean} [isGoldenBuild=false] - When true, output goes to `/golden/` instead of `/package/`.
 *   The golden build produces unhashed, uncompressed files for visual regression diffing.
 * @returns {{ root: string, src: string, package: string, build: string, nodeModules: string }}
 */
module.exports = (appRoot, isGoldenBuild = false) => ({
  /** Repository root — parent of `src/`, `build/`, `package/`, etc. */
  root: `${appRoot}/`,

  /** Source files: EJS templates, SCSS, JS entry points, images, etc. */
  src: `${appRoot}/src/`,

  /**
   * Output directory where the built site is written.
   * Points to `golden/` during golden builds, `package/` otherwise.
   */
  package: isGoldenBuild ? `${appRoot}/golden/` : `${appRoot}/package/`,

  /** Build system scripts (this directory). */
  build: `${appRoot}/build/`,

  /** node_modules — used as a Sass load path so SCSS can import npm packages. */
  nodeModules: `${appRoot}/node_modules/`,
});
