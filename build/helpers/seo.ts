import type { BuildDirectories, OgImageRecipe } from '../types.ts';

const fs: typeof import('fs') = require('fs');
const path: typeof import('path') = require('path');
const { imageSize }: typeof import('image-size') = require('image-size');

/**
 * Search and social metadata for one page.
 *
 * `src/partials/head/meta.ejs` renders the result. Keeping the decisions here,
 * not in the template, lets `test/seo.test.mts` check them without a build.
 */

interface ImageDimensions {
  width: number;
  height: number;
}

interface SeoLocals {
  path: string;
  domain: string;
  name: string;
  author: string;
  jobTitle: string;
  locale: string;
  title?: string;
  altTitle?: string;
  metaTitle?: string;
  description?: string;
  metaDescription?: string;
  date?: string | number | Date;
  robots?: boolean | string;
  schemaType?: string;
  homepage?: boolean;
  ogImage?: OgImageRecipe;
  github?: string;
  linkedin?: string;
  bandersDrums: {
    youtube?: string;
  };
  batLessons?: string;
  batLessonsYT?: string;
  bluesky?: string;
  mastodon?: string;
  instagram?: string;
  lastfm?: string;
  twitter?: string;
  [key: string]: unknown;
}

interface SeoImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

interface SeoPageBase {
  title: string;
  documentTitle: string;
  description: string;
  url: string;
  schemaType: string;
  openGraphType: string;
  openGraphLocale: string;
  published: string | null;
  robots: string;
  image: SeoImage | null;
}

interface SeoPage extends SeoPageBase {
  jsonLd: string;
}

/** Where each page's social preview image lives, relative to `src/`. */
const OG_IMAGE_DIR = 'images/og/';
const OG_IMAGE_EXTENSION = '.jpg';
/** 1.91:1, the ratio Open Graph and X large-image cards crop to. */
const OG_IMAGE_SIZE = { width: 1200, height: 630 };
/** Google cuts snippets at roughly 160 characters; longer text is truncated mid-sentence. */
const META_DESCRIPTION_MAX_LENGTH = 160;

/**
 * Maps a page path to its social preview image's URL path.
 *
 * `''` → `/images/og/index.jpg`, `posts/` → `/images/og/posts.jpg`,
 * `posts/coin-flip/` → `/images/og/posts/coin-flip.jpg`, `404.html` → `/images/og/404.jpg`.
 *
 * @param pagePath - Page path as `bundleEJS` passes it (no leading slash).
 * @returns Root-relative URL of the image.
 */
function ogImagePath(pagePath: string): string {
  const slug = pagePath.replace(/\.html$/, '').replace(/\/$/, '') || 'index';
  return `/${OG_IMAGE_DIR}${slug}${OG_IMAGE_EXTENSION}`;
}

/**
 * Whether a page is an individual post (not the `posts/` listing).
 *
 * @param pagePath - Page path without leading slash.
 * @returns True if the path is an individual post.
 */
function isPost(pagePath: string): boolean {
  return /^posts\/.+/.test(pagePath);
}

/**
 * The schema.org type that describes a page. Front matter `schemaType` wins;
 * otherwise posts are articles and the posts listing is a collection.
 *
 * @param locals - Template data (front matter + site data + `path`).
 * @returns The resolved schema.org type name.
 */
function schemaTypeFor(locals: Pick<SeoLocals, 'schemaType' | 'path'>): string {
  if (locals.schemaType) return locals.schemaType;
  if (isPost(locals.path)) return 'BlogPosting';
  if (locals.path === 'posts/') return 'CollectionPage';
  return 'WebPage';
}

/** Open Graph only knows a few types; map schema.org types onto them. */
function openGraphTypeFor(schemaType: string): string {
  if (schemaType === 'BlogPosting') return 'article';
  if (schemaType === 'ProfilePage') return 'profile';
  return 'website';
}

/**
 * Serializes JSON-LD for an inline `<script>`. Escaping `<` keeps a stray
 * `</script>` in a title or description from closing the tag early.
 *
 * @param data - Structured data object to serialize.
 * @returns Escaped JSON string.
 */
function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * Builds the JSON-LD graph: the person, the site, and this page.
 *
 * The Person node carries `sameAs` links to every profile, which is how
 * search engines connect those accounts to this site.
 *
 * @param locals - Template data.
 * @param page - Values already resolved by `seo`.
 * @returns JSON-LD graph object.
 */
function structuredData(locals: SeoLocals, page: SeoPageBase): Record<string, unknown> {
  const { domain } = locals;
  const personId = `${domain}#person`;
  const websiteId = `${domain}#website`;

  const person: Record<string, unknown> = {
    '@type': 'Person',
    '@id': personId,
    name: locals.author,
    url: domain,
    jobTitle: locals.jobTitle,
    sameAs: [
      locals.github,
      locals.linkedin,
      locals.bandersDrums.youtube,
      locals.batLessons,
      locals.batLessonsYT,
      locals.bluesky,
      locals.mastodon,
      locals.instagram,
      locals.lastfm,
      locals.twitter
    ].filter((value): value is string => Boolean(value)),
  };

  const website: Record<string, unknown> = {
    '@type': 'WebSite',
    '@id': websiteId,
    url: domain,
    name: locals.name,
    inLanguage: locals.locale,
    publisher: { '@id': personId },
  };

  let webPageId = page.url;
  if (page.schemaType === 'BlogPosting') {
    webPageId = `${page.url}#article`;
  }

  const webPage: Record<string, unknown> = {
    '@type': page.schemaType,
    '@id': webPageId,
    url: page.url,
    name: page.title,
    inLanguage: locals.locale,
    isPartOf: { '@id': websiteId },
  };
  if (page.description) webPage.description = page.description;
  if (page.image) webPage.image = page.image.url;

  if (page.schemaType === 'BlogPosting') {
    Object.assign(webPage, {
      headline: page.title,
      mainEntityOfPage: page.url,
      author: { '@id': personId },
      publisher: { '@id': personId },
    });
    if (page.published) webPage.datePublished = page.published;
  }
  if (page.schemaType === 'ProfilePage') webPage.mainEntity = { '@id': personId };
  if (locals.homepage) webPage.about = { '@id': personId };

  const graph: Array<Record<string, unknown>> = [person, website, webPage];

  // Breadcrumbs let search results show "briananders.com › Posts" instead of a raw URL.
  if (isPost(locals.path) || locals.path === 'posts/') {
    const crumbs = [{ name: locals.name, item: domain }, { name: 'Posts', item: `${domain}posts/` }];
    if (isPost(locals.path)) crumbs.push({ name: page.title, item: page.url });
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((crumb, index) => ({
        '@type': 'ListItem', position: index + 1, ...crumb,
      })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

/**
 * Creates the `seo(locals)` template helper.
 *
 * @param dir - Build directory paths.
 * @returns Helper function resolving every meta value for a page.
 */
function createSeo(dir: Pick<BuildDirectories, 'src'>): (locals: SeoLocals) => SeoPage {
  const sizes = new Map<string, ImageDimensions | null>();

  /** Returns `{ width, height }` for an image under `src/`, or `null` when it is missing. */
  function sizeOfSource(urlPath: string): ImageDimensions | null {
    if (!sizes.has(urlPath)) {
      const file = path.join(dir.src, urlPath);
      if (fs.existsSync(file)) {
        const result = imageSize(fs.readFileSync(file));
        sizes.set(urlPath, { width: result.width, height: result.height });
      } else {
        sizes.set(urlPath, null);
      }
    }
    const cached = sizes.get(urlPath);
    if (cached === undefined) return null;
    return cached;
  }

  /**
   * Resolves the page's preview image, falling back to the home page's so
   * pages without their own (404, noindex examples) still share a real image.
   */
  function resolveImage(locals: SeoLocals, title: string): SeoImage | null {
    const own = ogImagePath(locals.path);
    let urlPath = ogImagePath('');
    if (sizeOfSource(own)) {
      urlPath = own;
    }
    const size = sizeOfSource(urlPath);
    if (!size) return null;
    // A borrowed image keeps describing what it shows: the homepage, not this page.
    let alt = `Screenshot of the ${locals.name} homepage`;
    if (urlPath === own) alt = (locals.ogImage && locals.ogImage.alt) || `Screenshot of ${title}`;
    return {
      url: `${locals.domain}${urlPath.slice(1)}`,
      width: size.width,
      height: size.height,
      alt,
    };
  }

  return function seo(locals: SeoLocals): SeoPage {
    // Match the visible <h1>, which base.ejs takes from altTitle when a page sets it.
    const heading = (locals.altTitle || locals.title || '').replace(/_/g, ' ').trim();
    // The homepage's front-matter title ("Home") names a nav item, not the page.
    const title = (!locals.homepage && heading) || locals.name;
    let documentTitle = locals.name;
    if (locals.metaTitle) documentTitle = locals.metaTitle;
    else if (title !== locals.name) documentTitle = `${title} | ${locals.name}`;

    const schemaType = schemaTypeFor(locals);
    const url = `${locals.domain}${locals.path}`;
    let published: string | null = null;
    if (locals.date) {
      published = new Date(locals.date).toISOString();
    }
    let robots = 'max-image-preview:large';
    if (locals.robots === false) {
      robots = 'noindex, nofollow';
    }
    const pageBase: SeoPageBase = {
      title,
      documentTitle,
      description: locals.metaDescription || locals.description || '',
      url,
      schemaType,
      openGraphType: openGraphTypeFor(schemaType),
      // Open Graph spells locales with an underscore: en_US.
      openGraphLocale: locals.locale.replace('-', '_'),
      published,
      // max-image-preview:large opts indexable pages into large image previews (Discover, results).
      robots,
      image: resolveImage(locals, title),
    };
    return {
      ...pageBase,
      jsonLd: serializeJsonLd(structuredData(locals, pageBase)),
    };
  };
}

module.exports = {
  createSeo,
  ogImagePath,
  isPost,
  schemaTypeFor,
  serializeJsonLd,
  structuredData,
  OG_IMAGE_DIR,
  OG_IMAGE_EXTENSION,
  OG_IMAGE_SIZE,
  META_DESCRIPTION_MAX_LENGTH,
};
