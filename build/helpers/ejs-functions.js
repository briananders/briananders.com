const ejs = require('ejs');
const fs = require('fs');
const hljs = require('highlight.js');
const merge = require('merge');
const sass = require('sass');
const { imageSize: sizeOf } = require('image-size');
const path = require('path');
const { camelize, dasherize } = require('underscore.string');

/**
 * Removes `null`, `undefined`, and empty-string elements from an array in place.
 *
 * Used internally to clean up URL segment arrays before comparing indices,
 * so leading/trailing slashes that produce empty strings don't skew the depth
 * calculation in `getChildPages`.
 *
 * @param {Array} arr - The array to clean up (mutated in place).
 * @returns {Array} The same array with falsy/empty entries removed.
 */
function squeakyClean(arr) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] == null || arr[i] === '') {
      arr.splice(i, 1);
    }
  }
  return arr;
}

/**
 * Trims leading/trailing whitespace and collapses internal runs of whitespace
 * to a single space.
 *
 * Used by the `link()` helper to normalize attribute values before inserting
 * them into HTML, preventing accidental double-spaces or newlines in attributes.
 *
 * @param {string} str - The input string (coerced to string if not already).
 * @returns {string} The cleaned-up string.
 */
function cleanUpString(str) {
  str = str.toString();
  str = str.replace(/^\s+/, '');
  str = str.replace(/\s+$/, '');
  return str.split(/\s/g).join(' ');
}

/**
 * EJS helper function factory.
 *
 * Returns an object of utility functions that are merged into the template
 * data context for every EJS render. Templates call these as top-level
 * functions (e.g. `<%- partial('header') %>`, `<%- img({ src: '/images/foo.jpg' }) %>`).
 *
 * @param {{ src: string, package: string, build: string, nodeModules: string }} dir
 *   Directory paths object from `constants/directories`.
 * @param {Array<{ url: string, data: object }>} pageMappingData
 *   The compiled front-matter index of every page, used by `getChildPages`.
 * @returns {object} Object of EJS helper functions.
 */
module.exports = (dir, pageMappingData) => ({

  /**
   * Renders an EJS partial from `src/partials/`.
   *
   * @param {string} partialPath - Relative path within `src/partials/` without the `.ejs` extension.
   * @param {object} data - Template data passed to the partial.
   * @returns {string} Rendered HTML string.
   */
  partial(partialPath, data) {
    const newPath = path.join(dir.src, 'partials/', `${partialPath}.ejs`);

    return ejs.render(fs.readFileSync(newPath).toString(), data, {
      compileDebug: true,
    });
  },

  /**
   * Returns all direct child pages of the given parent path.
   *
   * Used to build navigation lists. The "child" relationship is determined by
   * URL depth: a child's URL segments contain the parent at index N and have
   * exactly N+1 total non-empty segments.
   *
   * Special case: passing an empty string returns top-level pages (those whose
   * URL has a depth of 0 and doesn't include `.html`).
   *
   * @param {string} parentPath - A single URL segment (e.g. `'posts'`), or `''` for root.
   * @returns {Array<{ url: string, data: object }>} Matching page entries from `pageMappingData`.
   */
  getChildPages(parentPath) {
    return pageMappingData.filter((page) => {
      const splitUrl = page.url.split('/');
      squeakyClean(splitUrl);
      const iOf = splitUrl.indexOf(parentPath);
      const len = splitUrl.length - 1;
      if (parentPath === '') {
        return len === 0 && !page.url.includes('.html');
      } if (iOf === -1) {
        return false;
      } if (len - iOf === 1) {
        return true;
      }
      return false;
    });
  },

  /**
   * Formats a date string as `YYYY-MM-DD`.
   *
   * Accepts any value that `new Date()` can parse (ISO strings, timestamps, etc.).
   * Month and day are always zero-padded to two digits.
   *
   * @param {string|number} dateString - The date to format.
   * @returns {string} Formatted date, e.g. `'2024-03-15'`.
   */
  formattedDate(dateString) {
    const date = new Date(dateString);
    const month = `00${date.getMonth() + 1}`.slice(-2);
    const day = `00${date.getDate()}`.slice(-2);
    return `${date.getFullYear()}-${month}-${day}`;
  },

  /**
   * Prevents widowed words in headings by replacing the last space with `&nbsp;`.
   *
   * Also replaces double underscores (`__`) with regular spaces, which is a
   * convention used in front-matter strings where a literal space would
   * otherwise be stripped.
   *
   * @param {string} str - The heading or title string.
   * @returns {string} The string with the last word attached via a non-breaking space.
   */
  noWidows(str) {
    // Replace the last space with &nbsp; so the last word doesn't appear alone on a new line.
    // Replace __ with regular spaces (an escape convention for front-matter strings).
    return str.replace(/\s([^\s]+)$/, '&nbsp;$1').replace(/__/g, ' ');
  },

  /**
   * Renders a syntax-highlighted code block using highlight.js.
   *
   * If `locals.language` is provided the block is highlighted with that
   * specific grammar; otherwise highlight.js auto-detects the language.
   * The result is wrapped in a `<pre><code>` structure with a
   * `code-container` class.
   *
   * @param {string} block - The raw code string to highlight.
   * @param {object} [locals={}] - Options object.
   * @param {string} [locals.language] - highlight.js language identifier (e.g. `'javascript'`).
   * @param {string} [locals.class] - Additional CSS class(es) for the `<pre>` element.
   * @param {string} [locals.style] - Inline styles for the `<pre>` element.
   * @returns {string} HTML string with syntax-highlighted code.
   */
  code(block, locals = {}) {
    // https://github.com/highlightjs/highlight.js/blob/master/SUPPORTED_LANGUAGES.md
    const highlightedCode = (locals.language !== undefined)
      ? hljs.highlight(block, { language: locals.language }).value
      : hljs.highlightAuto(block).value;
    return `
      <pre class="code-container ${locals.class || ''}" style="${locals.style || ''}"><code>${highlightedCode}</code></pre>
    `;
  },

  /**
   * Renders an `<img>` tag with explicit `width` and `height` attributes.
   *
   * Reads the image from the output directory (post-asset-move) to determine
   * its actual pixel dimensions using `image-size`. Explicit dimensions are
   * required to avoid cumulative layout shift (CLS).
   *
   * @param {object} params
   * @param {string}   params.src       - Relative URL path to the image (e.g. `/images/foo.jpg`).
   * @param {string}   [params.alt='']  - Alt text.
   * @param {string[]} [params.classes=[]] - CSS class names.
   * @param {number}   [params.width]   - Override the intrinsic width.
   * @param {number}   [params.height]  - Override the intrinsic height.
   * @returns {string} An `<img>` HTML string.
   * @throws {Error} If `src` is not provided.
   */
  img({
    src, alt = '', classes = [], width, height,
  } = {}) {
    if (!src) {
      throw new Error('img is missing src attribute');
    }
    // image-size v2 requires a Buffer (synchronous read); it does not accept a path directly.
    const dimensions = sizeOf(fs.readFileSync(path.join(dir.package, src)));
    return `<img src="${src}" alt="${alt}" height="${height || dimensions.height}" width="${width || dimensions.width}" ${classes.length ? `class="${classes.join(' ')}"` : ''} />`;
  },

  /**
   * Renders a lazily-loaded `<img>` tag using an inline SVG placeholder.
   *
   * The placeholder SVG is sized to match the image's intrinsic dimensions
   * (preventing layout shift), and the real image URL is placed in
   * `data-src` for the lazy-loader JavaScript module to swap in.
   * A `<link rel="preload">` hint is prepended to prime the browser's
   * prefetch queue.
   *
   * @param {object} params
   * @param {string}   params.src       - Relative URL path to the image.
   * @param {string}   [params.alt='']  - Alt text.
   * @param {string[]} [params.classes=[]] - CSS class names.
   * @param {number}   [params.width]   - Override the intrinsic width.
   * @param {number}   [params.height]  - Override the intrinsic height.
   * @returns {string} HTML string containing a `<link>` preload and a lazy `<img>`.
   * @throws {Error} If `src` is not provided.
   */
  lazyImage({
    src, alt = '', classes = [], width, height,
  } = {}) {
    if (!src) {
      throw new Error('lazyImage is missing src attribute');
    }
    const dimensions = sizeOf(fs.readFileSync(path.join(dir.package, src)));
    return `
      <link rel="preload" href="${src}" as="image" />
      <img lazy src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width || dimensions.width} ${height || dimensions.height}'%3E%3C/svg%3E" data-src="${src}" alt="${alt}" height="${height || dimensions.height}" width="${width || dimensions.width}" ${classes.length ? `class="${classes.join(' ')}"` : ''} />
    `;
  },

  /**
   * Renders a lazily-loaded responsive `<video>` element.
   *
   * Supports separate mobile and desktop source videos and placeholder images.
   * The video is wrapped in a `.video-container` div with a `padding-top`
   * percentage derived from the desktop placeholder's aspect ratio, which
   * creates a stable layout box before the video loads.
   *
   * The lazy-loader JS module reads `data-mobile-*` / `data-desktop-*`
   * attributes to select the appropriate source and poster based on viewport.
   *
   * @param {object} params
   * @param {{ mobile: string, desktop: string }} params.srcs - Relative URLs to video sources.
   * @param {{ mobile: string, desktop: string }} params.placeholders - Relative URLs to placeholder images.
   * @param {string[]} [params.attributes] - HTML attributes on the `<video>` element.
   * @returns {string} HTML string for the responsive lazy video widget.
   * @throws {Error} If `srcs` is not provided.
   */
  lazyVideo({ srcs, placeholders, attributes = ['autoplay', 'muted', 'loop', 'playsinline'] } = {}) {
    if (!srcs) {
      throw new Error('lazyVideo is missing srcs attribute');
    }
    // Read dimensions from the placeholder images (in the output directory).
    const desktopDimensions = sizeOf(fs.readFileSync(path.join(dir.package, placeholders.desktop)));
    const mobileDimensions = sizeOf(fs.readFileSync(path.join(dir.package, placeholders.mobile)));
    const videoType = path.extname(srcs.mobile).replace('.', '');
    return `
    <link rel="preload" href="${srcs.mobile}" as="video" type="video/${videoType}" />
    <link rel="preload" href="${srcs.desktop}" as="video" type="video/${videoType}" />
    <div class="video-container" style="padding-top: ${(desktopDimensions.height / desktopDimensions.width) * 100}%; --aspect-ratio: ${desktopDimensions.height / desktopDimensions.width};">
      <video lazy ${attributes.join(' ')}
        data-mobile-width="${mobileDimensions.width}"
        data-mobile-height="${mobileDimensions.height}"
        data-mobile-poster="${placeholders.mobile}"
        data-desktop-width="${desktopDimensions.width}"
        data-desktop-height="${desktopDimensions.height}"
        data-desktop-poster="${placeholders.desktop}"
      >
        <source
          data-mobile-src="${srcs.mobile}"
          data-desktop-src="${srcs.desktop}"
        type="video/${videoType}">
      </video>
    </div>`;
  },

  /**
   * Converts a string to dash-case (e.g. `'fooBar'` → `'foo-bar'`).
   * Delegates to `underscore.string`.
   *
   * @param {string} str
   * @returns {string}
   */
  dasherize: (str) => dasherize(str),

  /**
   * Converts a string to camelCase with the first letter lowercased
   * (e.g. `'foo-bar'` → `'fooBar'`).
   * Delegates to `underscore.string`.
   *
   * @param {string} str
   * @returns {string}
   */
  camelize: (str) => camelize(str, true),

  /**
   * Renders an `<a>` element with automatic external link handling and
   * type-based CSS class assignment.
   *
   * External links (those starting with `http` or where `locals.external` is
   * truthy) automatically receive `rel="noopener"` and `target="blank"`.
   *
   * Link types and their CSS classes:
   * - `'inline'` → `.inline-link`
   * - `'block'`  → `.block-link`
   * - `'card'`   → `.card-link`
   * - `'button'` → `.button`
   *
   * @param {string} str    - The link text (may contain HTML).
   * @param {object} locals - Options merged into the `<a>` attributes.
   * @param {string} locals.href  - The link destination URL (required).
   * @param {string} [locals.type] - Link type for CSS class assignment.
   * @param {string} [locals.class] - Additional CSS class(es).
   * @param {boolean} [locals.external] - Force external link treatment.
   * @returns {string} An `<a>` HTML string.
   * @throws {Error} If `locals.href` is not provided.
   */
  link(str, locals) {
    if (!locals.href) {
      throw new Error('externalLink is missing href attribute');
    }
    if (locals.class === undefined) locals.class = '';
    // Automatically treat http(s) links as external.
    if (locals.external || /^http/.test(locals.href)) {
      locals = merge({ rel: 'noopener', target: 'blank' }, locals);
    }
    switch (locals.type) {
      case 'inline':
        locals.class += ' inline-link';
        break;
      case 'block':
        locals.class += ' block-link';
        break;
      case 'card':
        locals.class += ' card-link';
        break;
      case 'button':
        locals.class += ' button';
        break;
    }
    // Build the attribute string by mapping all locals keys, cleaning up values.
    return `<a itemprop="url" ${Object.keys(locals).map((attr) => `${attr}="${cleanUpString(locals[attr])}"`).join(' ')}>${str}</a>`;
  },

  /**
   * Renders an inline anchor link (styled with `.inline-link`).
   *
   * @param {string} str - Link text.
   * @param {object} locals - Link options (must include `href`).
   * @returns {string} An `<a>` HTML string.
   */
  inlineLink(str, locals) {
    return this.link(str, merge({ type: 'inline' }, locals));
  },

  /**
   * Renders a block-style navigation link with a `>` arrow suffix.
   *
   * Wrapped in a `.block-link-wrapper` span so the arrow can be styled
   * independently.
   *
   * @param {string} str - Link text.
   * @param {object} locals - Link options (must include `href`).
   * @returns {string} HTML string with the wrapped block link.
   */
  blockLink(str, locals) {
    return `<span class="block-link-wrapper">${this.link(`${str}&nbsp;<b>&gt;</b>`, merge({ type: 'block' }, locals))}</span>`;
  },

  /**
   * Renders a card-style link (styled with `.card-link`).
   *
   * @param {string} str - Link text.
   * @param {object} locals - Link options (must include `href`).
   * @returns {string} An `<a>` HTML string.
   */
  cardLink(str, locals) {
    return this.link(str, merge({ type: 'card' }, locals));
  },

  /**
   * Renders a button-style link (styled with `.button`).
   *
   * @param {string} str - Link text.
   * @param {object} locals - Link options (must include `href`).
   * @returns {string} An `<a>` HTML string.
   */
  buttonLink(str, locals) {
    return this.link(str, merge({ type: 'button' }, locals));
  },

  /**
   * Returns the contents of a source file as a string.
   *
   * SVG files are run through SVGO (`getSVG`) before being returned, so
   * inlined SVGs are always optimized. All other file types are read as-is.
   *
   * Commonly used to inline SVG icons directly into HTML markup.
   *
   * @param {string} src - Path to the file relative to `src/`.
   * @returns {string} File contents as a string (optimized for SVGs).
   */
  getFileContents(src) {
    const { getSVG } = require(`${dir.build}optimize/optimize-svgs`);

    if (path.extname(src) === '.svg') return getSVG(path.join(dir.src, src));
    return fs.readFileSync(path.join(dir.src, src)).toString();
  },

  /**
   * Returns a placeholder HTML snippet for a Last.fm module loading state.
   *
   * Renders either an album or artist placeholder depending on the `albums`
   * flag. The markup mirrors the real Last.fm component structure so the page
   * has correct dimensions before the API data loads.
   *
   * @param {boolean} [albums=true] - `true` for album placeholders, `false` for artist.
   * @returns {string} HTML markup for a single loading placeholder item.
   */
  defaultLastFMModule: (albums = true) => `
    <span class="item ${albums ? 'album' : 'artist'}">
      <span class="info">
        ${albums ? `
          <span class="name">
            Loading album name
          </span>
        ` : ''}
        <span class="name">
          Loading artist name
        </span>
        <span class="scrobbles">
          Loading scrobbles
        </span>
        <bar style="width: 100%;"></bar>
      </span>
      ${albums ? `
        <span>Loading album cover</span>
      ` : ''}
    </span>`,

  /**
   * Compiles an SCSS file and returns the resulting CSS as a string.
   *
   * Used for inlining critical CSS directly into `<style>` tags in templates.
   * The `src/styles/` load path is configured so `@use 'system/utilities'`
   * works identically to standalone SCSS compilation.
   *
   * @param {string} src - Path to the SCSS file relative to `src/`.
   * @returns {string} Compiled CSS string.
   */
  inlineScss(src) {
    const fileData = fs.readFileSync(path.join(dir.src, src)).toString();
    const result = sass.compileString(fileData, {
      loadPaths: [`${dir.src}styles/`, dir.nodeModules],
    });
    return result.css;
  },
});
