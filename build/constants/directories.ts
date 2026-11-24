import type { BuildDirectories } from '../types.ts';

/**
 * Directory path factory.
 *
 * Returns an object of absolute paths used throughout the build system.
 * All paths include a trailing slash so callers can safely concatenate
 * relative paths without adding their own separator.
 *
 * @param appRoot - Absolute path to the repository root (typically `__dirname` of `index.ts`).
 * @param isGoldenBuild - When true, output goes to `/golden/` instead of `/package/`.
 *   The golden build produces unhashed, uncompressed files for visual regression diffing.
 * @returns Directory paths for the build pipeline.
 */
function createDirectories(appRoot: string, isGoldenBuild = false): BuildDirectories {
  let packageDir = `${appRoot}/package/`;
  if (isGoldenBuild) {
    packageDir = `${appRoot}/golden/`;
  }

  return {
    /** Repository root — parent of `src/`, `build/`, `package/`, etc. */
    root: `${appRoot}/`,

    /** Source files: EJS templates, SCSS, TS entry points, images, etc. */
    src: `${appRoot}/src/`,

    /**
     * Output directory where the built site is written.
     * Points to `golden/` during golden builds, `package/` otherwise.
     */
    package: packageDir,

    /** Build system scripts (this directory). */
    build: `${appRoot}/build/`,

    /** node_modules — used as a Sass load path so SCSS can import npm packages. */
    nodeModules: `${appRoot}/node_modules/`,
  };
}

module.exports = createDirectories;
