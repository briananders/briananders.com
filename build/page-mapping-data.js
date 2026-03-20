const { globSync } = require('glob');
const matter = require('gray-matter');

const { log } = console;

/**
 * Compiles the page-mapping index from all EJS template front matter.
 *
 * Scans every non-underscore-prefixed `.ejs` template in `src/templates/`,
 * reads its YAML front matter via `gray-matter`, and pushes a `{ url, data }`
 * entry into the shared `pageMappingData` array.
 *
 * The array is cleared before each run so calling this function multiple
 * times in watch mode never produces duplicate entries.
 *
 * `pageMappingData` is consumed by:
 * - `bundleEJS` — to build navigation and related-pages partials.
 * - `compileSitemap` — to generate `sitemap.json` and `sitemap.xml`.
 * - `ejs-functions.getChildPages()` — to resolve parent/child page relationships.
 *
 * URL derivation rules:
 * - Templates named `*.html.ejs` (e.g. `index.html.ejs`) produce a URL
 *   ending in `.html` (e.g. `/index.html`).
 * - All other templates produce a clean directory URL ending in `/`
 *   (e.g. `posts/my-post.ejs` → `/posts/my-post/`).
 *
 * When all templates have been processed the `pageMappingDataCompiled` event
 * is emitted, triggering both `bundleEJS` (once images and videos are also
 * done) and `compileSitemap`.
 *
 * @param {{ dir: object, buildEvents: EventEmitter, pageMappingData: Array }} configs
 */
module.exports = ({ dir, buildEvents, pageMappingData }) => {
  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  // Collect every non-private EJS template (files prefixed with `_` are excluded).
  const templateGlob = globSync(`${dir.src}templates/**/[^_]*.ejs`);

  // Clear the shared array in-place so other modules holding a reference to it
  // also see the fresh data (Object.assign or reassignment would break the reference).
  pageMappingData.splice(0, pageMappingData.length);

  log(`${timestamp.stamp()} compilePageMappingData()`);
  let processed = 0;
  templateGlob.forEach((templatePath, index, array) => {
    // Derive the output path from the template path, applying the same logic
    // as bundleEJS: *.html.ejs stays as-is; others get an /index.html suffix.
    const outputPath = templatePath
      .replace(`${dir.src}templates/`, dir.package)
      .replace(/\.ejs$/, (templatePath.includes('.html.ejs')) ? '' : '/index.html');

    const frontMatter = matter.read(templatePath);

    pageMappingData.push({
      // Strip the package prefix and trailing 'index.html' to get a clean URL.
      url: outputPath.replace(dir.package, '').replace('index.html', ''),
      data: frontMatter.data,
    });

    processed++;
    if (processed >= array.length) {
      log(`${timestamp.stamp()} compilePageMappingData() ${'DONE'.bold.green}`);

      buildEvents.emit(BUILD_EVENTS.pageMappingDataCompiled);
    }
  });
};
