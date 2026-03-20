/* eslint-disable no-console */
/* eslint-disable no-loop-func */
const fs = require('fs-extra');
const { globSync } = require('glob');
const path = require('path');
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
}) {
  return new Promise((resolve, reject) => {
    // Merge all data sources into a single template context object.
    const templateData = merge({}, ejsFunctions, siteData, frontMatter.data, { path: pagePath });

    // In dev mode, a missing `layout` front-matter key is a developer error —
    // surface it immediately via notification rather than silently producing bad output.
    if (!production && !templateData.layout) {
      const errorMessage = `You are missing a template definition in ${templatePath}`;
      console.error(errorMessage.red);
      notifier.notify({
        title: 'Template undefined',
        message: errorMessage,
      });
      reject();
    }

    // Read the layout file (e.g. src/layout/base.ejs) asynchronously.
    readFile(`${dir.src}layout/${templateData.layout}.ejs`).catch((error) => {
      if (error && production) throw error;
      else if (error) {
        console.error(error.message.red);
        notifier.notify({
          title: 'Template Error',
          message: error.message,
        });
        reject();
      }
    }).then(async (fileBuffer) => {
      const fileData = fileBuffer.toString();
      let html;
      try {
        // Pass 1: render the page template content.
        const renderedTemplate = ejs.render(frontMatter.content, templateData, ejsOptions);
        // Pass 2: inject the rendered content into the layout.
        html = ejs.render(fileData, merge({ content: renderedTemplate }, templateData), ejsOptions);
      } catch (e) {
        html = handleTemplateError(e);
      }

      // If the rendered HTML itself has front matter (recursive layouts),
      // re-parse and render again with the merged data.
      if (matter.test(html)) {
        const nextFrontMatter = matter(html);
        frontMatter.content = nextFrontMatter.content;
        frontMatter.data = merge({}, frontMatter.data, nextFrontMatter.data);
        html = await renderTemplate({
          templatePath,
          ejsFunctions,
          siteData,
          dir,
          production,
          ejsOptions,
          pagePath,
          frontMatter,
        });
      }
      resolve(html);
    });
  });
}

/**
 * Renders all EJS templates to HTML and writes them to the output directory.
 *
 * Globs every non-underscore-prefixed `.ejs` template in `src/templates/`.
 * Templates are processed sequentially (using `for…await`) rather than
 * concurrently to keep memory pressure low and avoid race conditions on the
 * shared `pageMappingData` array.
 *
 * Output path derivation:
 * - `*.html.ejs` (e.g. `index.html.ejs`) → output as `index.html`
 * - `*.ejs` (e.g. `posts/my-post.ejs`)   → output as `posts/my-post/index.html`
 *
 * When all templates have been written the `templatesMoved` event is emitted,
 * which triggers HTML minification in production.
 *
 * @param {{ dir: object, buildEvents: EventEmitter, pageMappingData: Array, debug: boolean }} configs
 */
module.exports = async function bundleEJS({
  dir, buildEvents, pageMappingData, debug,
}) {
  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const siteData = require(`${dir.build}constants/site-data`)(dir);
  const timestamp = require(`${dir.build}helpers/timestamp`);

  // Find all non-private EJS templates (files NOT starting with `_`).
  const templateGlob = globSync(`${dir.src}templates/**/[^_]*.ejs`);
  const production = require(`${dir.build}helpers/production`);

  log(`${timestamp.stamp()} bundleEJS()`);

  let processed = 0;

  for (let index = 0; index < templateGlob.length; index++) {
    const templatePath = templateGlob[index];
    if (debug) log(`${timestamp.stamp()} ${'REQUEST'.magenta} - Compiling Template - ${templatePath.split(/templates/)[1]}`);

    // Build per-template EJS helpers (includes pageMappingData context).
    const ejsFunctions = require(`${dir.build}helpers/ejs-functions`)(dir, pageMappingData);
    const ejsOptions = {
      compileDebug: true,
      filename: templatePath,          // Required for EJS include() paths to resolve correctly
      root: `${dir.src}templates/`,   // Allows absolute include paths within templates
    };

    // Derive the output path, applying the *.html.ejs → direct / *.ejs → /index.html rule.
    const outputPath = templatePath
      .replace(`${dir.src}templates/`, dir.package)
      .replace(/\.ejs$/, (templatePath.includes('.html.ejs')) ? '' : '/index.html');
    const pagePath = outputPath.replace(dir.package, '').replace('index.html', '');
    const frontMatter = matter.read(templatePath);

    const html = await renderTemplate({
      templatePath,
      ejsFunctions,
      siteData,
      dir,
      production,
      ejsOptions,
      pagePath,
      frontMatter,
    }).catch((err) => {
      if (err && production) throw err;
      else if (err) {
        console.error(err.message.red);
        notifier.notify({
          title: 'Template Error',
          message: err.message,
        });
      }
      processed++;
    });

    // Ensure the output directory exists, then write the rendered HTML.
    fs.mkdirp(path.dirname(outputPath), (err) => {
      if (err) throw err;

      fs.writeFile(outputPath, html, (e) => {
        if (e) throw e;

        if (debug) log(`${timestamp.stamp()} ${'SUCCESS'.bold.green} - Compiled Template - ${outputPath.split(/package/)[1]}`);
        processed++;

        // Emit templatesMoved only after every template has been written.
        if (processed >= templateGlob.length) {
          log(`${timestamp.stamp()} bundleEJS(): ${'DONE'.bold.green}`);
          buildEvents.emit(BUILD_EVENTS.templatesMoved);
        }
      });
    });
  }
};
