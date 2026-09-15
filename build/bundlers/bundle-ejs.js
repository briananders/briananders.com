/* eslint-disable no-console */
/* eslint-disable no-loop-func */
const fs = require('fs-extra');
const { globSync } = require('glob');
const merge = require('merge');
const ejs = require('ejs');
const matter = require('gray-matter');
const notifier = require('node-notifier');
const util = require('util');
const readFile = util.promisify(fs.readFile);

const { log } = console;

/**
 * Converts an EJS error into a self-contained HTML error page.
 *
 * In dev mode, template compilation errors should not crash the server — they
 * should surface in the browser. This function HTML-escapes the error message,
 * wraps it in a minimal HTML page, and returns it as a string so the build
 * can write it to the output file and display it in-browser. It also fires a
 * desktop notification for immediate visibility.
 *
 * @param {Error} e - The error thrown by the EJS render.
 * @returns {string} An HTML error page as a string.
 */
function handleTemplateError(e) {
  console.error(e.message.red);
  notifier.notify({
    title: 'Template Error',
    message: e.message,
  });
  return `
    <html>
      <head></head>
      <body>
        <h1>There was an error.</h1>
        <div style="color: red; font-family: monospace;">
          ${
  e.message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>')
    .replace(/\s\s/g, '&nbsp;&nbsp;')
}
        </div>
      </body>
    </html>`;
}

/**
 * Renders a single EJS template through its layout wrapper.
 *
 * The rendering process is two-pass:
 *   1. The template's own content (stripped of front matter by gray-matter)
 *      is rendered with EJS, producing an HTML fragment.
 *   2. That fragment is injected as `{{ content }}` into the layout file
 *      (e.g. `src/layout/base.ejs`) and the combined result is rendered.
 *
 * This function is recursive: if the rendered output itself contains YAML
 * front matter (detected by `matter.test()`), it is parsed and a second
 * render pass is triggered. This supports layouts that themselves use layouts.
 *
 * Template data is assembled by merging (in priority order):
 *   `ejsFunctions` ← `siteData` ← `frontMatter.data` ← `{ path: pagePath }`
 *
 * @param {object} params
 * @param {string}   params.templatePath  - Absolute path to the source `.ejs` template.
 * @param {object}   params.ejsFunctions  - Helper functions from `ejs-functions.js`.
 * @param {object}   params.siteData      - Global site metadata from `constants/site-data`.
 * @param {object}   params.dir           - Directory paths object.
 * @param {boolean}  params.production    - Whether this is a production build.
 * @param {object}   params.ejsOptions    - Options passed directly to `ejs.render`.
 * @param {string}   params.pagePath      - The output page's relative URL (e.g. `/posts/my-post/`).
 * @param {object}   params.frontMatter   - gray-matter parse result (`{ content, data }`).
 * @returns {Promise<string>} Resolves with the fully rendered HTML string.
 */
async function renderTemplate({
  templatePath,
  ejsFunctions,
  siteData,
  dir,
  production,
  ejsOptions,
  pagePath,
  frontMatter,
  layouts, compiled,
}) {
  const templateData = merge({}, ejsFunctions, siteData, frontMatter.data, { path: pagePath });
  if (!templateData.layout) throw new Error(`You are missing a template definition in ${templatePath}`);
  const layoutPath = `${dir.src}layout/${templateData.layout}.ejs`;
  // Cache by layout and include context; EJS resolves relative includes using filename.
  const cacheKey = `${layoutPath}:${ejsOptions.filename}`;
  if (!layouts.has(layoutPath)) layouts.set(layoutPath, readFile(layoutPath, 'utf8'));
  const fileData = await layouts.get(layoutPath);
  if (!compiled.has(cacheKey)) compiled.set(cacheKey, ejs.compile(fileData, ejsOptions));
  const renderedTemplate = ejs.render(frontMatter.content, templateData, ejsOptions);
  let html = compiled.get(cacheKey)(merge({ content: renderedTemplate }, templateData));
  if (matter.test(html)) {
    const next = matter(html);
    html = await renderTemplate({
      templatePath,
      ejsFunctions,
      siteData,
      dir,
      production,
      ejsOptions,
      pagePath,
      layouts,
      compiled,
      frontMatter: { content: next.content, data: merge({}, frontMatter.data, next.data) },
    });
  }
  return html;
}

/**
 * Renders all EJS templates to HTML and writes them to the output directory.
 *
 * Globs every non-underscore-prefixed `.ejs` template in `src/templates/`.
 * Templates use bounded concurrency, build-scoped layout caches, and a
 * snapshot of page mapping data. All output writes are awaited.
 *
 * Output path derivation:
 * - `*.html.ejs` (e.g. `index.html.ejs`) → output as `index.html`
 * - `*.ejs` (e.g. `posts/my-post.ejs`)   → output as `posts/my-post/index.html`
 *
 * When all templates have been written the `templatesMoved` event is emitted,
 * which triggers HTML minification in production.
 *
 * @param {object} configs - Build directories, events, and page mapping snapshot.
 */
module.exports = async function bundleEJS({
  dir, buildEvents, pageMappingData,
}) {
  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const siteData = require(`${dir.build}constants/site-data`)(dir);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  // Find all non-private EJS templates (files NOT starting with `_`).
  const templateGlob = globSync(`${dir.src}templates/**/[^_]*.ejs`);
  const production = require(`${dir.build}helpers/production`);

  log(`${timestamp.stamp()} bundleEJS()`);

  const layouts = new Map();
  const compiled = new Map();
  const ejsFunctions = require(`${dir.build}helpers/ejs-functions`)(dir, pageMappingData);
  await require('../helpers/map-limit')(templateGlob, 8, async (templatePath) => {
    const outputPath = templatePath
      .replace(`${dir.src}templates/`, dir.package)
      .replace(/\.ejs$/, templatePath.includes('.html.ejs') ? '' : '/index.html');
    const pagePath = outputPath.replace(dir.package, '').replace('index.html', '');
    let html;
    try {
      html = await renderTemplate({
        templatePath,
        ejsFunctions,
        siteData,
        dir,
        production,
        pagePath,
        layouts,
        compiled,
        frontMatter: matter.read(templatePath),
        ejsOptions: { compileDebug: true, filename: templatePath, root: `${dir.src}templates/` },
      });
    } catch (err) {
      if (production) throw err;
      html = handleTemplateError(err);
    }
    await fs.outputFile(outputPath, html);
  });
  log(`${timestamp.stamp()} bundleEJS(): ${'DONE'.bold.green}`);
  buildEvents.emit(BUILD_EVENTS.templatesMoved);
};
