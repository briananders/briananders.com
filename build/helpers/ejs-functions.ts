import type { BuildDirectories, PageMappingEntry } from '../types.ts';
import type { AdjacentShows, MusicHelpers } from './music.ts';

const ejs: typeof import('ejs') = require('ejs');
const fs: typeof import('fs') = require('fs');
const hljs: typeof import('highlight.js').default = require('highlight.js');
const merge: typeof import('merge') = require('merge');
const sass: typeof import('sass') = require('sass');
const { imageSize: sizeOf }: typeof import('image-size') = require('image-size');
const path: typeof import('path') = require('path');
const { camelize, dasherize }: typeof import('underscore.string') = require('underscore.string');
const { createSeo }: {
  createSeo: (dir: Pick<BuildDirectories, 'src'>) => (locals: Record<string, unknown>) => Record<string, unknown>;
} = require('./seo.ts');
const {
  formatShowDate,
  getPinnedMusicPages,
  getMusicShows,
  getAdjacentShows,
  buildGoogleMapsUrl,
  buildSetlistSearchUrl,
  buildConcertArchivesSearchUrl,
}: MusicHelpers = require('./music.ts');

interface ImageSourceVariant {
  src: string;
  type: string;
}

interface ImageVariantCandidate {
  src: string;
  type: string | null;
}

interface ImageSourcesResult {
  sources: ImageSourceVariant[];
  fallback: string;
}

interface CodeLocals {
  language?: string;
  class?: string;
  style?: string;
}

interface ImageParams {
  src?: string;
  alt?: string;
  classes?: string[];
  width?: number;
  height?: number;
}

interface LazyImageParams extends ImageParams {
  lazy?: boolean;
}

interface ResponsiveAssetPair {
  mobile: string;
  desktop: string;
}

interface LazyVideoParams {
  srcs?: ResponsiveAssetPair;
  placeholders?: ResponsiveAssetPair;
  attributes?: string[];
}

interface LinkLocals {
  href?: string;
  type?: string;
  class?: string;
  external?: boolean;
  rel?: string;
  target?: string;
  [key: string]: unknown;
}

/**
 * Removes `null`, `undefined`, and empty-string elements from an array in place.
 *
 * Used internally to clean up URL segment arrays before comparing indices,
 * so leading/trailing slashes that produce empty strings don't skew the depth
 * calculation in `getChildPages`.
 *
 * @param arr - The array to clean up (mutated in place).
 * @returns The same array with falsy/empty entries removed.
 */
function squeakyClean<T>(arr: Array<T | null | undefined | ''>): Array<T | null | undefined | ''> {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] == null || arr[i] === '') {
      arr.splice(i, 1);
      // Decrement index so the element shifted into position i is checked on the next pass.
      i -= 1;
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
 * @param value - The input value (coerced to string if not already).
 * @returns The cleaned-up string.
 */
function cleanUpString(value: unknown): string {
  let str = String(value);
  str = str.replace(/^\s+/, '');
  str = str.replace(/\s+$/, '');
  return str.split(/\s/g).join(' ');
}

/**
 * Returns the available delivery variants for a local image.
 *
 * Raster images are emitted as AVIF first, WebP second, and their original
 * JPEG/PNG format last. SVGs and other non-raster assets remain unchanged.
 *
 * @param src - Relative URL path to the image.
 * @param dir - Build directory paths.
 * @returns Picture sources and fallback image URL.
 */
function getImageSources(src: string, dir: Pick<BuildDirectories, 'package'>): ImageSourcesResult {
  const cleanSrc = src.split(/[?#]/)[0];
  const extension = path.extname(cleanSrc).toLowerCase();
  const rasterExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

  if (!rasterExtensions.includes(extension)) {
    return { sources: [], fallback: src };
  }

  const base = cleanSrc.substring(0, cleanSrc.length - extension.length);
  const originalSources = ['.jpg', '.jpeg', '.png']
    .map((originalExtension) => `${base}${originalExtension}`)
    .filter((candidate) => fs.existsSync(path.join(dir.package, candidate)));
  const variants: ImageVariantCandidate[] = [
    { src: `${base}.avif`, type: 'image/avif' },
    { src: `${base}.webp`, type: 'image/webp' },
    ...originalSources.map((originalSrc): ImageVariantCandidate => ({ src: originalSrc, type: null }))
  ].filter((candidate) => fs.existsSync(path.join(dir.package, candidate.src)));

  const fallback = variants.find((candidate) => candidate.type === null)
    || variants.find((candidate) => candidate.type === 'image/webp')
    || variants[0];

  const sources: ImageSourceVariant[] = variants.filter(
    (candidate): candidate is ImageSourceVariant => Boolean(candidate.type) && candidate !== fallback
  );

  return {
    sources,
    fallback: (fallback || { src }).src,
  };
}

/**
 * Renders `<source>` elements in AVIF/WebP order.
 *
 * @param sources - Picture sources.
 * @returns Rendered `<source>` markup.
 */
function renderPictureSources(sources: ImageSourceVariant[]): string {
  return sources.map(({ src, type }) => (
    `<source srcset="${src}" type="${type}" />`
  )).join('');
}

/**
 * EJS helper function factory.
 *
 * Returns an object of utility functions that are merged into the template
 * data context for every EJS render. Templates call these as top-level
 * functions (e.g. `<%- partial('header') %>`, `<%- img({ src: '/images/foo.jpg' }) %>`).
 *
 * @param dir - Directory paths object from `constants/directories`.
 * @param pageMappingData - Compiled front-matter index of every page, used by `getChildPages`.
 * @returns Object of EJS helper functions.
 */
module.exports = (
  dir: Pick<BuildDirectories, 'src' | 'package' | 'build' | 'nodeModules'>,
  pageMappingData: PageMappingEntry[],
) => {
  const partials = new Map<string, ejs.TemplateFunction>();
  const styles = new Map<string, string>();
  const seo = createSeo(dir);

  const helpers = {

    /**
     * Resolves a page's search and social metadata: document title, meta
     * description, canonical URL, Open Graph type, preview image and JSON-LD.
     * See `build/helpers/seo.ts`.
     */
    seo,

    /**
     * Renders an EJS partial from `src/partials/`.
     *
     * @param partialPath - Relative path within `src/partials/` without the `.ejs` extension.
     * @param data - Template data passed to the partial.
     * @returns Rendered HTML string.
     */
    partial(partialPath: string, data?: ejs.Data): string {
      const newPath = path.join(dir.src, 'partials/', `${partialPath}.ejs`);

      let compiledPartial = partials.get(newPath);
      if (!compiledPartial) {
        compiledPartial = ejs.compile(fs.readFileSync(newPath).toString(), { compileDebug: true });
        partials.set(newPath, compiledPartial);
      }
      return compiledPartial(data);
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
     * @param parentPath - A single URL segment (e.g. `'posts'`), or `''` for root.
     * @returns Matching page entries from `pageMappingData`.
     */
    getChildPages(parentPath: string): PageMappingEntry[] {
      return pageMappingData.filter((page) => {
        const splitUrl: Array<string | null | undefined> = page.url.split('/');
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
     * Formats a date in UTC as a human-readable concert date (e.g. `'June 21, 2006'`).
     *
     * @param dateString - The date to format.
     * @returns Human-readable UTC date string.
     */
    formatShowDate,

    /**
     * Returns pinned pages under `/music/`, ordered by `musicPinOrder`.
     *
     * @returns Pinned music pages.
     */
    getPinnedMusicPages(): PageMappingEntry[] {
      return getPinnedMusicPages(pageMappingData);
    },

    /**
     * Returns all show pages under `/music/show/`, ordered oldest to newest.
     *
     * @returns Ordered show pages.
     */
    getMusicShows(): PageMappingEntry[] {
      return getMusicShows(pageMappingData);
    },

    /**
     * Returns the adjacent older and newer show entries around `currentPath`.
     *
     * @param currentPath - Current show page path.
     * @returns Adjacent shows.
     */
    getAdjacentShows(currentPath: string): AdjacentShows {
      return getAdjacentShows(getMusicShows(pageMappingData), currentPath);
    },

    /**
     * Builds an encoded Google Maps search URL for a venue query.
     *
     * @param venueQuery - Venue name and/or street address.
     * @returns Google Maps search URL.
     */
    buildGoogleMapsUrl,

    /**
     * Builds an encoded Setlist.fm search URL for a band, location, and year.
     *
     * @param artistName - Band name.
     * @param location - Venue or city name.
     * @param year - Concert year.
     * @returns Setlist.fm search URL.
     */
    buildSetlistSearchUrl,

    /**
     * Builds an encoded Concert Archives search URL for a show query.
     *
     * @param query - Concert search query.
     * @returns Concert Archives search URL.
     */
    buildConcertArchivesSearchUrl,

    /**
     * Formats a date string as `YYYY-MM-DD`.
     *
     * Accepts any value that `new Date()` can parse (ISO strings, timestamps, etc.).
     * Month and day are always zero-padded to two digits. Uses UTC: front-matter
     * dates parse as UTC midnight, so local getters would shift them a day
     * earlier in any timezone west of UTC.
     *
     * @param dateString - The date to format.
     * @returns Formatted date, e.g. `'2024-03-15'`.
     */
    formattedDate(dateString: string | number | Date): string {
      const date = new Date(dateString);
      const month = `00${date.getUTCMonth() + 1}`.slice(-2);
      const day = `00${date.getUTCDate()}`.slice(-2);
      return `${date.getUTCFullYear()}-${month}-${day}`;
    },

    /**
     * Renders a syntax-highlighted code block using highlight.js.
     *
     * If `locals.language` is provided the block is highlighted with that
     * specific grammar; otherwise highlight.js auto-detects the language.
     * The result is wrapped in a `<pre><code>` structure with a
     * `code-container` class.
     *
     * @param block - The raw code string to highlight.
     * @param locals - Options object.
     * @returns HTML string with syntax-highlighted code.
     */
    code(block: string, locals: CodeLocals = {}): string {
      // https://github.com/highlightjs/highlight.js/blob/master/SUPPORTED_LANGUAGES.md
      let highlightedCode: string;
      if (locals.language !== undefined) {
        highlightedCode = hljs.highlight(block, { language: locals.language }).value;
      } else {
        highlightedCode = hljs.highlightAuto(block).value;
      }
      const cls = locals.class || '';
      const style = locals.style || '';
      return `
      <pre class="code-container ${cls}" style="${style}"><code>${highlightedCode}</code></pre>
    `;
    },

    /**
     * Renders an `<img>` tag with explicit `width` and `height` attributes.
     *
     * Reads the image from the output directory (post-asset-move) to determine
     * its actual pixel dimensions using `image-size`. Explicit dimensions are
     * required to avoid cumulative layout shift (CLS).
     *
     * @param params - Image parameters.
     * @returns A `<picture>` HTML string.
     * @throws {Error} If `src` is not provided.
     */
    img({
      src, alt = '', classes = [], width, height,
    }: ImageParams = {}): string {
      if (!src) {
        throw new Error('img is missing src attribute');
      }
      // image-size v2 requires a Buffer (synchronous read); it does not accept a path directly.
      const { sources, fallback } = getImageSources(src, dir);
      const dimensions = sizeOf(fs.readFileSync(path.join(dir.package, fallback)));
      const h = height || dimensions.height;
      const w = width || dimensions.width;
      let cls = '';
      if (classes.length) {
        cls = `class="${classes.join(' ')}"`;
      }
      // eslint-disable-next-line @stylistic/max-len
      return `<picture>${renderPictureSources(sources)}<img src="${fallback}" alt="${alt}" height="${h}" width="${w}" ${cls} /></picture>`;
    },

    /**
     * Renders a natively lazy-loaded responsive image.
     *
     * The browser receives the real `src`/`srcset` values immediately and uses
     * the standard `loading="lazy"` hint to defer offscreen image requests.
     * Explicit dimensions are retained to prevent cumulative layout shift.
     *
     * @param params - Lazy image parameters.
     * @returns HTML string containing a lazily-loaded `<picture>`.
     * @throws {Error} If `src` is not provided.
     */
    lazyImage({
      src, alt = '', classes = [], width, height, lazy = true,
    }: LazyImageParams = {}): string {
      if (!src) {
        throw new Error('lazyImage is missing src attribute');
      }
      const { sources, fallback } = getImageSources(src, dir);
      const dimensions = sizeOf(fs.readFileSync(path.join(dir.package, fallback)));
      const h = height || dimensions.height;
      const w = width || dimensions.width;
      let loadAttr = 'fetchpriority="high" loading="eager"';
      if (lazy) {
        loadAttr = 'loading="lazy" decoding="async"';
      }
      let cls = '';
      if (classes.length) {
        cls = `class="${classes.join(' ')}"`;
      }
      const imgTag = `<img ${loadAttr} src="${fallback}" alt="${alt}" height="${h}" width="${w}" ${cls} />`;
      return `
      <picture>${renderPictureSources(sources)}${imgTag}</picture>
    `;
    },

    /**
     * Renders a lazily-loaded responsive `<video>` element.
     *
     * Supports separate mobile and desktop source videos and a desktop poster.
     * The video is wrapped in a `.video-container` div with a `padding-top`
     * percentage derived from the desktop placeholder's aspect ratio, which
     * creates a stable layout box before the video loads.
     *
     * Native source media queries select the video for the viewport.
     *
     * @param params - Video sources, placeholders, and HTML attributes.
     * @returns HTML string for the responsive lazy video widget.
     * @throws {Error} If `srcs` is not provided.
     */
    lazyVideo({
      srcs,
      placeholders,
      attributes = ['autoplay', 'muted', 'loop', 'playsinline'],
    }: LazyVideoParams = {}): string {
      if (!srcs) {
        throw new Error('lazyVideo is missing srcs attribute');
      }
      if (!placeholders) {
        throw new Error('lazyVideo is missing placeholders attribute');
      }
      // Read dimensions from the placeholder images (in the output directory).
      const desktopDimensions = sizeOf(fs.readFileSync(path.join(dir.package, placeholders.desktop)));
      const mobileDimensions = sizeOf(fs.readFileSync(path.join(dir.package, placeholders.mobile)));
      const mobileType = path.extname(srcs.mobile).replace('.', '');
      const desktopType = path.extname(srcs.desktop).replace('.', '');
      const ratio = desktopDimensions.height / desktopDimensions.width;
      const minW = mobileDimensions.width;
      return `
    <div class="video-container" style="padding-top: ${ratio * 100}%; --aspect-ratio: ${ratio};">
      <video loading="lazy" preload="none" ${attributes.join(' ')}
        width="${desktopDimensions.width}"
        height="${desktopDimensions.height}"
        poster="${placeholders.desktop}"
      >
        <source src="${srcs.desktop}" media="(min-width: ${minW}px)" type="video/${desktopType}">
        <source src="${srcs.mobile}" type="video/${mobileType}">
      </video>
    </div>`;
    },

    /**
     * Converts a string to dash-case (e.g. `'fooBar'` → `'foo-bar'`).
     * Delegates to `underscore.string`.
     */
    dasherize: (str: string): string => dasherize(str),

    /**
     * Converts a string to camelCase with the first letter lowercased
     * (e.g. `'foo-bar'` → `'fooBar'`).
     * Delegates to `underscore.string`.
     */
    camelize: (str: string): string => camelize(str, true),

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
     * @param str - The link text (may contain HTML).
     * @param locals - Options merged into the `<a>` attributes.
     * @returns An `<a>` HTML string.
     * @throws {Error} If `locals.href` is not provided.
     */
    link(str: string, locals: LinkLocals): string {
      if (!locals.href) {
        throw new Error('externalLink is missing href attribute');
      }
      if (locals.class === undefined) locals.class = '';
      // Automatically treat http(s) links as external.
      if (locals.external || /^http/.test(locals.href)) {
        locals = merge<LinkLocals>({ rel: 'noopener', target: 'blank' }, locals);
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
        default:
          break;
      }
      // Build the attribute string by mapping all locals keys, cleaning up values.
      const attrs = Object.keys(locals)
        .map((attr) => `${attr}="${cleanUpString(locals[attr])}"`)
        .join(' ');
      return `<a itemprop="url" ${attrs}>${str}</a>`;
    },

    /**
     * Renders an inline anchor link (styled with `.inline-link`).
     */
    inlineLink(str: string, locals: LinkLocals): string {
      return helpers.link(str, merge<LinkLocals>({ type: 'inline' }, locals));
    },

    /**
     * Renders a block-style navigation link with a `>` arrow suffix.
     *
     * Wrapped in a `.block-link-wrapper` span so the arrow can be styled
     * independently.
     */
    blockLink(str: string, locals: LinkLocals): string {
      const inner = helpers.link(`${str}&nbsp;<b>&gt;</b>`, merge<LinkLocals>({ type: 'block' }, locals));
      return `<span class="block-link-wrapper">${inner}</span>`;
    },

    /**
     * Renders a card-style link (styled with `.card-link`).
     */
    cardLink(str: string, locals: LinkLocals): string {
      return helpers.link(str, merge<LinkLocals>({ type: 'card' }, locals));
    },

    /**
     * Renders a button-style link (styled with `.button`).
     */
    buttonLink(str: string, locals: LinkLocals): string {
      return helpers.link(str, merge<LinkLocals>({ type: 'button' }, locals));
    },

    /**
     * Returns the contents of a source file as a string.
     *
     * SVG files are run through SVGO (`getSVG`) before being returned, so
     * inlined SVGs are always optimized. All other file types are read as-is.
     *
     * Commonly used to inline SVG icons directly into HTML markup.
     *
     * @param src - Path to the file relative to `src/`.
     * @returns File contents as a string (optimized for SVGs).
     */
    getFileContents(src: string): string {
      const { getSVG }: { getSVG: (filePath: string) => string } = require(`${dir.build}optimize/optimize-svgs.ts`);

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
     * @param albums - `true` for album placeholders, `false` for artist.
     * @returns HTML markup for a single loading placeholder item.
     */
    defaultLastFMModule: (albums = true): string => `
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
          Loading play data
        </span>
        <bar style="width: 100%;"></bar>
      </span>
      <span>Loading ${albums ? 'album' : 'artist'} cover</span>
    </span>`,

    /**
     * Compiles an SCSS file and returns the resulting CSS as a string.
     *
     * Used for inlining critical CSS directly into `<style>` tags in templates.
     * The `src/styles/` load path is configured so `@use 'system/utilities'`
     * works identically to standalone SCSS compilation.
     *
     * @param src - Path to the SCSS file relative to `src/`.
     * @returns Compiled CSS string.
     */
    inlineScss(src: string): string {
      const cached = styles.get(src);
      if (cached !== undefined) return cached;
      const fileData = fs.readFileSync(path.join(dir.src, src)).toString();
      const result = sass.compileString(fileData, {
        loadPaths: [`${dir.src}styles/`, dir.nodeModules],
      });
      styles.set(src, result.css);
      return result.css;
    },
  };

  return helpers;
};
