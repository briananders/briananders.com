import {
  test, describe, before, after,
} from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const ejs = require('ejs');
const { globSync } = require('glob');
const { imageSize } = require('image-size');

const {
  createSeo, ogImagePath, serializeJsonLd, OG_IMAGE_SIZE, META_DESCRIPTION_MAX_LENGTH,
} = require('../build/helpers/seo');
const { replacePaths } = require('../build/hashing/finish-hashing');
const {
  parseArgs, normalizeRecipe, clipFor, cornerColor, pointIn, allPages, pagesWithRecipes,
} = require('../bin/og-images');

const projectRoot = path.resolve(process.cwd());
const domain = 'https://briananders.com/';

/** Site data as templates see it; only the fields seo() reads. */
const siteLocals = {
  name: 'Brian Anders',
  author: 'Brian Anders',
  jobTitle: 'Engineering Manager',
  locale: 'en-US',
  domain,
  github: 'https://github.com/briananders',
  linkedin: 'https://www.linkedin.com/in/andersbrian/',
  bandersDrums: { youtube: 'https://www.youtube.com/@bandersdrums' },
  batLessons: 'https://batlessons.com',
  batLessonsYT: 'https://www.youtube.com/@batlessons',
  bluesky: 'https://bsky.app/profile/imbanders.bsky.social',
  mastodon: 'https://mastodon.social/@banders',
  instagram: 'https://instagram.com/imbanders',
  lastfm: 'https://www.last.fm/user/imbanders',
  twitter: 'https://twitter.com/imbanders',
};

async function writeImage(file, width, height) {
  mkdirSync(path.dirname(file), { recursive: true });
  await sharp({
    create: {
      width, height, channels: 3, background: '#123456',
    },
  }).jpeg().toFile(file);
}

describe('ogImagePath', () => {
  test('maps each kind of page path to a file under /images/og/', () => {
    assert.equal(ogImagePath(''), '/images/og/index.jpg');
    assert.equal(ogImagePath('posts/'), '/images/og/posts.jpg');
    assert.equal(ogImagePath('posts/coin-flip/'), '/images/og/posts/coin-flip.jpg');
    assert.equal(ogImagePath('about/'), '/images/og/about.jpg');
    assert.equal(ogImagePath('404.html'), '/images/og/404.jpg');
    assert.equal(
      ogImagePath('example/ssr-csr-performance-experiment/csr/'),
      '/images/og/example/ssr-csr-performance-experiment/csr.jpg',
    );
  });
});

describe('seo()', () => {
  let tmp;
  let seo;

  before(async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'seo-test-'));
    await writeImage(`${tmp}/src/images/og/index.jpg`, 1200, 630);
    await writeImage(`${tmp}/src/images/og/posts/coin-flip.jpg`, 1200, 630);
    seo = createSeo({ src: `${tmp}/src/` });
  });
  after(() => rmSync(tmp, { recursive: true, force: true }));

  const post = (overrides = {}) => ({
    ...siteLocals,
    path: 'posts/coin-flip/',
    title: 'Coin Flip',
    description: 'A simple coin flipping widget.',
    date: new Date('2025-06-10T00:00:00.000Z'),
    ogImage: { selector: '.coin-container', alt: 'A gold coin showing heads' },
    ...overrides,
  });

  test('puts the page title before the site name and makes every URL absolute', () => {
    const page = seo(post());
    assert.equal(page.documentTitle, 'Coin Flip | Brian Anders');
    assert.equal(page.title, 'Coin Flip');
    assert.equal(page.url, 'https://briananders.com/posts/coin-flip/');
    assert.equal(page.openGraphLocale, 'en_US');
    assert.equal(JSON.parse(page.jsonLd)['@graph'].find((node) => node['@type'] === 'WebSite').inLanguage, 'en-US');
    assert.deepEqual(page.image, {
      url: 'https://briananders.com/images/og/posts/coin-flip.jpg',
      width: 1200,
      height: 630,
      alt: 'A gold coin showing heads',
    });
  });

  test('lets metaTitle and metaDescription override the on-page title and description', () => {
    const page = seo(post({ metaTitle: 'Custom title', metaDescription: 'Short snippet.' }));
    assert.equal(page.documentTitle, 'Custom title');
    assert.equal(page.description, 'Short snippet.');
  });

  test('uses the bare site name for the homepage and for pages without a title', () => {
    // The homepage's front matter says "Home", a nav label; shared links should say who it is.
    const home = seo({ ...siteLocals, path: '', title: 'Home', homepage: true });
    assert.equal(home.documentTitle, 'Brian Anders');
    assert.equal(home.title, 'Brian Anders');
    assert.equal(JSON.parse(home.jsonLd)['@graph'].find((node) => node['@type'] === 'WebPage').name, 'Brian Anders');
    const untitled = seo({ ...siteLocals, path: 'example/minesweeper/', title: '' });
    assert.equal(untitled.documentTitle, 'Brian Anders');
    assert.equal(untitled.title, 'Brian Anders');
  });

  test('titles a page after its visible heading when altTitle overrides it', () => {
    const page = seo({
      ...siteLocals, path: 'posts/', title: 'Posts', altTitle: 'Posts and Experiments',
    });
    assert.equal(page.title, 'Posts and Experiments');
    assert.equal(page.documentTitle, 'Posts and Experiments | Brian Anders');
  });

  test('marks noindex pages and opts the rest into large image previews', () => {
    assert.equal(seo(post({ robots: false })).robots, 'noindex, nofollow');
    assert.equal(seo(post()).robots, 'max-image-preview:large');
  });

  test('falls back to the homepage image, described as the homepage, when a page has none', () => {
    const page = seo({
      ...siteLocals, path: 'posts/yahtzee/', title: 'Yahtzee', ogImage: { alt: 'Dice' },
    });
    assert.equal(page.image.url, 'https://briananders.com/images/og/index.jpg');
    assert.equal(page.image.alt, 'Screenshot of the Brian Anders homepage');
  });

  test('defaults the alt text of a page\'s own image to its title', () => {
    assert.equal(seo(post({ ogImage: { selector: '.coin-container' } })).image.alt, 'Screenshot of Coin Flip');
  });

  test('omits the image when not even the homepage has one', () => {
    const bare = createSeo({ src: `${tmp}/missing/` });
    assert.equal(bare(post()).image, null);
  });

  test('describes posts as articles with a publish date, author and breadcrumbs', () => {
    const page = seo(post());
    assert.equal(page.schemaType, 'BlogPosting');
    assert.equal(page.openGraphType, 'article');
    assert.equal(page.published, '2025-06-10T00:00:00.000Z');

    const graph = JSON.parse(page.jsonLd)['@graph'];
    const article = graph.find((node) => node['@type'] === 'BlogPosting');
    assert.equal(article.headline, 'Coin Flip');
    assert.equal(article.datePublished, '2025-06-10T00:00:00.000Z');
    assert.equal(article.image, 'https://briananders.com/images/og/posts/coin-flip.jpg');
    assert.deepEqual(article.author, { '@id': 'https://briananders.com/#person' });

    const person = graph.find((node) => node['@type'] === 'Person');
    assert.ok(person.sameAs.includes('https://github.com/briananders'));
    assert.equal(person.jobTitle, 'Engineering Manager');

    const crumbs = graph.find((node) => node['@type'] === 'BreadcrumbList').itemListElement;
    assert.deepEqual(crumbs.map((crumb) => crumb.item), [
      'https://briananders.com/', 'https://briananders.com/posts/', 'https://briananders.com/posts/coin-flip/',
    ]);
  });

  test('types the posts listing, profile pages and everything else', () => {
    const listing = seo({ ...siteLocals, path: 'posts/', title: 'Posts' });
    assert.equal(listing.schemaType, 'CollectionPage');
    assert.equal(listing.openGraphType, 'website');

    const about = seo({
      ...siteLocals, path: 'about/', title: 'About me', schemaType: 'ProfilePage',
    });
    assert.equal(about.openGraphType, 'profile');
    const profile = JSON.parse(about.jsonLd)['@graph'].find((node) => node['@type'] === 'ProfilePage');
    assert.deepEqual(profile.mainEntity, { '@id': 'https://briananders.com/#person' });

    const drums = seo({ ...siteLocals, path: 'drums/', title: 'Drums' });
    assert.equal(drums.schemaType, 'WebPage');
    assert.equal(JSON.parse(drums.jsonLd)['@graph'].some((node) => node['@type'] === 'BreadcrumbList'), false);
  });

  test('JSON-LD cannot close its own script tag', () => {
    const json = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    assert.equal(json.includes('</script>'), false);
    assert.equal(JSON.parse(json).name, '</script><script>alert(1)</script>');
  });
});

describe('every indexable page', () => {
  // The build's own page index, so these URLs are the ones the site serves.
  const pages = allPages().filter(({ data }) => data.robots !== false);

  test('the page index covers every template', () => {
    assert.ok(pages.length >= 50, `only ${pages.length} indexable pages found`);
    assert.ok(pages.some(({ url }) => url === '/'));
    assert.ok(pages.some(({ url }) => url === '/posts/coin-flip/'));
  });

  test('has a valid capture recipe with alt text', () => {
    pages.forEach(({ url, data }) => {
      assert.ok(data.ogImage, `${url} has no ogImage recipe`);
      assert.doesNotThrow(() => normalizeRecipe(data.ogImage, url));
      assert.ok(data.ogImage.alt, `${url} ogImage has no alt text`);
    });
  });

  test(`has a ${OG_IMAGE_SIZE.width}×${OG_IMAGE_SIZE.height} preview image`, () => {
    pages.forEach(({ url }) => {
      const image = path.join(projectRoot, 'src', ogImagePath(url.slice(1)));
      assert.ok(existsSync(image), `${url}: missing ${path.relative(projectRoot, image)}; run npm run og-images`);
      const { width, height } = imageSize(readFileSync(image));
      assert.deepEqual({ width, height }, OG_IMAGE_SIZE, `${url}: wrong preview size`);
    });
  });

  test(`has a meta description of at most ${META_DESCRIPTION_MAX_LENGTH} characters`, () => {
    pages.forEach(({ url, data }) => {
      const description = data.metaDescription || data.description;
      assert.ok(description, `${url} has no description`);
      assert.ok(
        description.length <= META_DESCRIPTION_MAX_LENGTH,
        `${url}: ${description.length} characters; add a shorter metaDescription`,
      );
    });
  });

  test('is captured by npm run og-images', () => {
    const captured = pagesWithRecipes().map((page) => page.url);
    pages.forEach(({ url }) => assert.ok(captured.includes(url), `${url} is not captured`));
  });
});

describe('og-images tool', () => {
  test('parseArgs reads paths and options', () => {
    assert.deepEqual(parseArgs(['posts/coin-flip/', '--dir=golden']), {
      paths: ['/posts/coin-flip/'], dir: 'golden', out: 'screenshots/og-images',
    });
    assert.throws(() => parseArgs(['--bogus=1']), /Unknown option --bogus/);
  });

  test('normalizeRecipe fills defaults and rejects bad recipes', () => {
    const recipe = normalizeRecipe({ selector: '#canvas' }, '/x/');
    assert.equal(recipe.fit, 'cover');
    assert.equal(recipe.width, 1200);
    assert.equal(recipe.scale, 2);
    assert.equal(recipe.hideFixed, true);
    assert.deepEqual(recipe.actions, []);
    assert.throws(() => normalizeRecipe({}, '/x/'), /selector is required/);
    assert.throws(() => normalizeRecipe({ selector: 'a', fit: 'stretch' }, '/x/'), /fit must be/);
    assert.throws(() => normalizeRecipe({ selector: 'a', wait: -1 }, '/x/'), /wait must be/);
    assert.throws(() => normalizeRecipe({ selector: 'a', scale: 0 }, '/x/'), /scale must be a positive number/);
    assert.throws(() => normalizeRecipe({ selector: 'a', width: 0 }, '/x/'), /width must be a positive number/);
    assert.throws(() => normalizeRecipe({ selector: 'a', hideFixed: 'no' }, '/x/'), /hideFixed must be/);
    assert.doesNotThrow(() => normalizeRecipe({ selector: 'a', actions: [{ scroll: 1800 }, { drag: ['a', [[0, 0], [1, 1]]] }] }, '/x/'));
    assert.throws(() => normalizeRecipe({ selector: 'a', actions: [{ tap: 'a' }] }, '/x/'), /exactly one of/);
    assert.throws(() => normalizeRecipe({ selector: 'a', actions: [{ click: 'a', wait: 1 }] }, '/x/'), /exactly one of/);
  });

  test('normalizeRecipe checks each action\'s argument', () => {
    const valid = [
      { click: '#play' }, { click: ['#canvas', 0.25, 1] }, { fill: ['#n', 11] }, { fill: ['#url', 'https://x.test/'] },
      { press: ['#n', 'Tab'] }, { select: ['#count', '3'] }, { hover: '.card' },
      { drag: ['#canvas', [[0, 0.5], [1, 0.5]]] }, { scroll: '#nav' }, { scroll: 0 }, { wait: 500 },
    ];
    assert.doesNotThrow(() => normalizeRecipe({ selector: 'a', actions: valid }, '/x/'));
    const invalid = [
      { click: ['#canvas', 0.5] }, { click: ['#canvas', 1.5, 0.5] }, { click: '' },
      { fill: '#n' }, { press: ['#n'] }, { select: ['#count'] }, { hover: 3 },
      { drag: ['#canvas', [[0, 0]]] }, { drag: ['#canvas', [[0, 0], [2, 0]]] },
      { scroll: -10 }, { wait: '500' },
    ];
    invalid.forEach((action) => {
      assert.throws(
        () => normalizeRecipe({ selector: 'a', actions: [action] }, '/x/'),
        /invalid argument/,
        JSON.stringify(action),
      );
    });
  });

  test('clipFor pads the element and stays inside the viewport', () => {
    const viewport = { width: 1200, height: 900 };
    assert.deepEqual(clipFor({
      x: 100.4, y: 200.6, width: 300, height: 150,
    }, 20, viewport), {
      x: 80, y: 180, width: 341, height: 191,
    });
    // Scrolled partly above the viewport and wider than it: clamped on every side.
    assert.deepEqual(clipFor({
      x: -10, y: -50, width: 1300, height: 2000,
    }, 40, viewport), {
      x: 0, y: 0, width: 1200, height: 900,
    });
  });

  test('cornerColor letterboxes with the color most corners share', () => {
    const info = { width: 2, height: 2, channels: 3 };
    // top-left, top-right, bottom-left, bottom-right
    const pixels = Buffer.from([9, 9, 9, 1, 2, 3, 1, 2, 3, 1, 2, 3]);
    assert.deepEqual(cornerColor(pixels, info), { r: 1, g: 2, b: 3 });
    const allDifferent = Buffer.from([9, 9, 9, 1, 1, 1, 2, 2, 2, 3, 3, 3]);
    assert.deepEqual(cornerColor(allDifferent, info), { r: 9, g: 9, b: 9 }, 'ties go to the top-left corner');
  });

  test('pointIn converts fractions of a box to coordinates', () => {
    assert.deepEqual(pointIn({
      x: 100, y: 50, width: 200, height: 100,
    }, [0.25, 0.5]), { x: 150, y: 100 });
  });
});

test('hash rewriting also updates absolute URLs on the site\'s own origin', () => {
  const mapping = new Map([['images/og/index.jpg', 'images/og/index-123.jpg']]);
  const html = '<meta property=og:image content=https://briananders.com/images/og/index.jpg>'
    + '<script>{"image":"https://briananders.com/images/og/index.jpg"}</script>';
  assert.equal(
    replacePaths(html, mapping, domain),
    '<meta property=og:image content=https://briananders.com/images/og/index-123.jpg>'
      + '<script>{"image":"https://briananders.com/images/og/index-123.jpg"}</script>',
  );
  const elsewhere = '"https://example.com/images/og/index.jpg" "https://briananders.com/images/og/index.jpg.webp"';
  assert.equal(replacePaths(elsewhere, mapping, domain), elsewhere);
});

test('sitemap.xml declares the exact sitemap protocol namespace', async () => {
  const xml = await ejs.renderFile(`${projectRoot}/src/sitemap.xml.ejs`, {
    pages: [{ url: 'posts/coin-flip/', data: { date: new Date('2025-06-10'), priority: 0.8 } }],
    siteData: { domain, buildDateTime: '2026-01-01T12:00:00.000Z' },
  });
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<loc>https:\/\/briananders\.com\/posts\/coin-flip\/<\/loc>/);
});

test('robots.txt has one group, names the sitemap, and leaves noindex pages crawlable', () => {
  const robots = readFileSync(`${projectRoot}/src/robots.txt`, 'utf8');
  const rules = robots.split('\n').filter((line) => line && !line.startsWith('#'));
  assert.equal(rules.filter((line) => /^user-agent:/i.test(line)).length, 1);
  assert.ok(rules.includes('Sitemap: https://briananders.com/sitemap.xml'));
  rules.filter((line) => /^(dis)?allow:/i.test(line)).forEach((line) => {
    assert.match(line, /^(Dis)?[Aa]llow: \//, `${line} must start with /`);
  });
  // Crawlers can only obey a page's noindex tag if robots.txt lets them fetch it.
  assert.equal(rules.some((line) => /example|404/.test(line)), false);
});

describe('rendered golden pages', () => {
  const read = (page) => readFileSync(`${projectRoot}/golden/${page}`, 'utf8');
  const tag = (html, attribute, name) => {
    const match = html.match(new RegExp(`<meta ${attribute}=["']?${name}["']? content=("[^"]*"|[^\\s>]+)`));
    return match ? match[1].replace(/^"|"$/g, '') : null;
  };

  test('a post has charset first, a page-first title and absolute social tags', () => {
    const html = read('posts/coin-flip/index.html');
    assert.match(html, /<head>\s*<meta charset=UTF-8/);
    assert.match(html, /<title>Coin Flip \| Brian Anders<\/title>/);
    assert.equal(tag(html, 'property', 'og:title'), 'Coin Flip');
    assert.equal(tag(html, 'property', 'og:type'), 'article');
    assert.equal(tag(html, 'property', 'og:url'), 'https://briananders.com/posts/coin-flip/');
    assert.equal(tag(html, 'property', 'og:image'), 'https://briananders.com/images/og/posts/coin-flip.jpg');
    assert.equal(tag(html, 'name', 'twitter:card'), 'summary_large_image');
    assert.ok(existsSync(`${projectRoot}/golden/images/og/posts/coin-flip.jpg`));
  });

  test('the homepage and posts listing use their real names, not their nav labels', () => {
    assert.equal(tag(read('index.html'), 'property', 'og:title'), 'Brian Anders');
    assert.equal(tag(read('posts/index.html'), 'property', 'og:title'), 'Posts and Experiments');
  });

  test('every page has a title, absolute canonical, a preview image that exists, and JSON-LD', () => {
    const pages = globSync(`${projectRoot}/golden/**/*.html`);
    assert.ok(pages.length >= 60, `only ${pages.length} golden pages found`);
    pages.forEach((file) => {
      const page = path.relative(`${projectRoot}/golden`, file);
      const html = read(page);
      assert.match(html, /<title>[^<]+<\/title>/, `${page} has no title`);
      assert.match(html, /<link rel=canonical href=https:\/\/briananders\.com\//, `${page} canonical is not absolute`);

      const image = tag(html, 'property', 'og:image');
      assert.ok(image && image.startsWith(domain), `${page}: og:image ${image} is not absolute`);
      assert.ok(existsSync(`${projectRoot}/golden/${image.slice(domain.length)}`), `${page}: ${image} is not in the build`);

      const match = html.match(/<script type=application\/ld\+json>(.*?)<\/script>/);
      assert.ok(match, `${page} has no JSON-LD`);
      assert.ok(JSON.parse(match[1])['@graph'].length >= 3, `${page} JSON-LD graph is incomplete`);
    });
  });
});
