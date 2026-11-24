import type { EventEmitter } from 'node:events';
import type { Options as EjsOptions, TemplateFunction } from 'ejs';
import type { BuildDirectories, BuildEventsMap, PageMappingEntry } from '../types.ts';

const fs: typeof import('fs-extra') = require('fs-extra');
const { globSync }: typeof import('glob') = require('glob');
const merge: typeof import('merge') = require('merge');
const ejs: typeof import('ejs') = require('ejs');
const matter: typeof import('gray-matter') = require('gray-matter');
const notifier: typeof import('node-notifier') = require('node-notifier');
const util: typeof import('util') = require('util');
const mapLimit: <T>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<unknown> | unknown,
) => Promise<void> = require('../helpers/map-limit.ts');

const readFile = util.promisify(fs.readFile);

const { log } = console;

interface ParsedFrontMatter {
  content: string;
  data: Record<string, unknown>;
}

interface RenderTemplateParams {
  templatePath: string;
  ejsFunctions: Record<string, unknown>;
  siteData: Record<string, unknown>;
  dir: Pick<BuildDirectories, 'src'>;
  production: boolean;
  ejsOptions: EjsOptions & { async?: false; client?: false };
  pagePath: string;
  frontMatter: ParsedFrontMatter;
  layouts: Map<string, Promise<string>>;
  compiled: Map<string, TemplateFunction>;
}

interface BundleEjsParams {
  dir: BuildDirectories;
  buildEvents: EventEmitter;
  pageMappingData: PageMappingEntry[];
}

/**
 * Converts an EJS error into a self-contained HTML error page.
 *
 * In dev mode, template compilation errors should not crash the server — they
 * should surface in the browser. This function HTML-escapes the error message,
 * wraps it in a minimal HTML page, and returns it as a string so the build
 * can write it to the output file and display it in-browser. It also fires a
 * desktop notification for immediate visibility.
 *
 * @param e - The error thrown by the EJS render.
 * @returns An HTML error page as a string.
 */
function handleTemplateError(e: Error): string {
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
 * @param params - Template render context and shared layout caches.
 * @returns Resolves with the fully rendered HTML string.
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
}: RenderTemplateParams): Promise<string> {
  const templateData = merge<Record<string, unknown>>({}, ejsFunctions, siteData, frontMatter.data, { path: pagePath });
  if (!templateData.layout) throw new Error(`You are missing a template definition in ${templatePath}`);
  const layoutPath = `${dir.src}layout/${String(templateData.layout)}.ejs`;
  // Cache by layout and include context; EJS resolves relative includes using filename.
  const cacheKey = `${layoutPath}:${ejsOptions.filename}`;
  let layoutPromise = layouts.get(layoutPath);
  if (!layoutPromise) {
    layoutPromise = readFile(layoutPath, 'utf8');
    layouts.set(layoutPath, layoutPromise);
  }
  const fileData = await layoutPromise;
  let compiledLayout = compiled.get(cacheKey);
  if (!compiledLayout) {
    compiledLayout = ejs.compile(fileData, ejsOptions);
    compiled.set(cacheKey, compiledLayout);
  }
  const renderedTemplate = ejs.render(frontMatter.content, templateData, ejsOptions);
  let html = compiledLayout(merge<Record<string, unknown>>({ content: renderedTemplate }, templateData));
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
      frontMatter: { content: next.content, data: merge<Record<string, unknown>>({}, frontMatter.data, next.data) },
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
 * @param configs - Build directories, events, and page mapping snapshot.
 */
module.exports = async function bundleEJS({
  dir, buildEvents, pageMappingData,
}: BundleEjsParams): Promise<void> {
  const BUILD_EVENTS: BuildEventsMap = require(`${dir.build}constants/build-events.ts`);
  const createSiteData: (d: BuildDirectories) => Record<string, unknown> = require(
    `${dir.build}constants/site-data.ts`
  );
  const siteData = createSiteData(dir);
  const timestamp: { stamp: () => string } = require(`${dir.build}helpers/timestamp.ts`);

  // Find all non-private EJS templates (files NOT starting with `_`).
  const templateGlob = globSync(`${dir.src}templates/**/[^_]*.ejs`);
  const production: boolean = require(`${dir.build}helpers/production.ts`);

  log(`${timestamp.stamp()} bundleEJS()`);

  const layouts = new Map<string, Promise<string>>();
  const compiled = new Map<string, TemplateFunction>();
  const createEjsFunctions: (
    d: BuildDirectories,
    pages: PageMappingEntry[],
  ) => Record<string, unknown> = require(`${dir.build}helpers/ejs-functions.ts`);
  const ejsFunctions = createEjsFunctions(dir, pageMappingData);
  await mapLimit(templateGlob, 8, async (templatePath: string) => {
    let extensionReplacement = '/index.html';
    if (templatePath.includes('.html.ejs')) {
      extensionReplacement = '';
    }
    const outputPath = templatePath
      .replace(`${dir.src}templates/`, dir.package)
      .replace(/\.ejs$/, extensionReplacement);
    const pagePath = outputPath.replace(dir.package, '').replace('index.html', '');
    let html: string;
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
    } catch (err: unknown) {
      if (production) throw err;
      const templateError = err instanceof Error ? err : new Error(String(err));
      html = handleTemplateError(templateError);
    }
    await fs.outputFile(outputPath, html);
  });
  log(`${timestamp.stamp()} bundleEJS(): ${'DONE'.green.bold}`);
  buildEvents.emit(BUILD_EVENTS.templatesMoved);
};
