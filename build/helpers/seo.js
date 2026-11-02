const fs = require('fs');
const path = require('path');
const { imageSize } = require('image-size');

/**
 * Search and social metadata for one page.
 *
 * `src/partials/head/meta.ejs` renders the result. Keeping the decisions here,
 * not in the template, lets `test/seo.test.mjs` check them without a build.
 */

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
 * @param {string} pagePath - Page path as `bundleEJS` passes it (no leading slash).
 * @returns {string} Root-relative URL of the image.
 */
function ogImagePath(pagePath) {
  const slug = pagePath.replace(/\.html$/, '').replace(/\/$/, '') || 'index';
  return `/${OG_IMAGE_DIR}${slug}${OG_IMAGE_EXTENSION}`;
}

/**
 * Whether a page is an individual post (not the `posts/` listing).
 *
 * @param {string} pagePath
 * @returns {boolean}
 */
function isPost(pagePath) {
  return /^posts\/.+/.test(pagePath);
}

/**
 * The schema.org type that describes a page. Front matter `schemaType` wins;
 * otherwise posts are articles and the posts listing is a collection.
 *
 * @param {object} locals - Template data (front matter + site data + `path`).
 * @returns {string}
 */
function schemaTypeFor(locals) {
  if (locals.schemaType) return locals.schemaType;
  if (isPost(locals.path)) return 'BlogPosting';
  if (locals.path === 'posts/') return 'CollectionPage';
  return 'WebPage';
}

/** Open Graph only knows a few types; map schema.org types onto them. */
function openGraphTypeFor(schemaType) {
  if (schemaType === 'BlogPosting') return 'article';
  if (schemaType === 'ProfilePage') return 'profile';
  return 'website';
}

/**
 * Serializes JSON-LD for an inline `<script>`. Escaping `<` keeps a stray
 * `</script>` in a title or description from closing the tag early.
 *
 * @param {object} data
 * @returns {string}
 */
function serializeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * Builds the JSON-LD graph: the person, the site, and this page.
 *
 * The Person node carries `sameAs` links to every profile, which is how
 * search engines connect those accounts to this site.
 *
 * @param {object} locals - Template data.
 * @param {object} page - Values already resolved by `pageSeo`.
 * @returns {object}
 */
function structuredData(locals, page) {
  const { domain } = locals;
  const personId = `${domain}#person`;
  const websiteId = `${domain}#website`;

  const person = {
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
    ].filter(Boolean),
  };

  const website = {
    '@type': 'WebSite',
    '@id': websiteId,
    url: domain,
    name: locals.name,
    inLanguage: 'en-US',
    publisher: { '@id': personId },
  };

  const webPage = {
    '@type': page.schemaType,
    '@id': page.schemaType === 'BlogPosting' ? `${page.url}#article` : page.url,
    url: page.url,
    name: page.title,
    inLanguage: 'en-US',
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

  const graph = [person, website, webPage];

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
 * @param {{ src: string }} dir - Build directory paths.
 * @returns {(locals: object) => object} Resolves every meta value for a page.
 */
function createSeo(dir) {
  const sizes = new Map();

  /** Returns `{ width, height }` for an image under `src/`, or `null` when it is missing. */
  function sizeOfSource(urlPath) {
    if (!sizes.has(urlPath)) {
      const file = path.join(dir.src, urlPath);
      sizes.set(urlPath, fs.existsSync(file) ? imageSize(fs.readFileSync(file)) : null);
    }
    return sizes.get(urlPath);
  }

  /**
   * Resolves the page's preview image, falling back to the home page's so
   * pages without their own (404, noindex examples) still share a real image.
   */
  function resolveImage(locals, title) {
    const own = ogImagePath(locals.path);
    const urlPath = sizeOfSource(own) ? own : ogImagePath('');
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

  return function seo(locals) {
    const rawTitle = (locals.title || '').replace(/_/g, ' ').trim();
    const title = rawTitle || locals.name;
    let documentTitle = locals.name;
    if (locals.metaTitle) documentTitle = locals.metaTitle;
    else if (rawTitle && !locals.homepage) documentTitle = `${rawTitle} | ${locals.name}`;

    const schemaType = schemaTypeFor(locals);
    const url = `${locals.domain}${locals.path}`;
    const page = {
      title,
      documentTitle,
      description: locals.metaDescription || locals.description || '',
      url,
      schemaType,
      openGraphType: openGraphTypeFor(schemaType),
      published: locals.date ? new Date(locals.date).toISOString() : null,
      // max-image-preview:large opts indexable pages into large image previews (Discover, results).
      robots: locals.robots === false ? 'noindex, nofollow' : 'max-image-preview:large',
      image: resolveImage(locals, title),
    };
    page.jsonLd = serializeJsonLd(structuredData(locals, page));
    return page;
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
