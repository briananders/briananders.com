import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { PageFrontMatter, PageMappingEntry } from '../build/types.ts';
import type { MusicHelpers } from '../build/helpers/music.ts';

const require = createRequire(import.meta.url);
const { globSync }: typeof import('glob') = require('glob');
const matter: typeof import('gray-matter') = require('gray-matter');

const {
  normalizePageUrl,
  formatShowDate,
  getPinnedMusicPages,
  getMusicShows,
  getAdjacentShows,
  buildGoogleMapsUrl,
  buildSetlistSearchUrl,
  buildConcertArchivesSearchUrl,
}: MusicHelpers = require('../build/helpers/music.ts');

const projectRoot = path.resolve(process.cwd());
const showsDir = path.join(projectRoot, 'src/templates/music/show');
const goldenDir = path.join(projectRoot, 'golden');

describe('music helpers', () => {
  test('normalizePageUrl strips leading and trailing slashes', () => {
    assert.equal(
      normalizePageUrl('/music/show/2006-06-21-bonner-springs/'),
      'music/show/2006-06-21-bonner-springs',
    );
    assert.equal(normalizePageUrl('music/'), 'music');
    assert.equal(normalizePageUrl(''), '');
    assert.equal(normalizePageUrl(null), '');
    assert.equal(normalizePageUrl(undefined), '');
  });

  test('formatShowDate formats UTC dates consistently without timezone drift', () => {
    assert.equal(formatShowDate(new Date('2006-06-21T00:00:00.000Z')), 'June 21, 2006');
    assert.equal(formatShowDate('2026-11-14T00:00:00.000Z'), 'November 14, 2026');
    assert.equal(formatShowDate('not-a-date'), '');
    assert.equal(formatShowDate(undefined), '');
  });

  test('getPinnedMusicPages selects direct music children with musicPinOrder sorted ascending', () => {
    const pages: PageMappingEntry[] = [
      { url: 'music/', data: { title: 'Music' } },
      { url: 'music/music-news/', data: { title: 'Music News', musicPinOrder: 3 } },
      { url: 'music/last-fm/', data: { title: 'Recent Listening Trends', musicPinOrder: 1 } },
      { url: 'music/last-fm-scrobbles/', data: { title: 'Music Listening History', musicPinOrder: 2 } },
      { url: 'music/alpha-tie/', data: { title: 'Alpha Tie', musicPinOrder: 2 } },
      { url: 'music/redirected/', data: { title: 'Redirected', musicPinOrder: 1, redirectTo: '/music/' } },
      { url: 'music/show/2006-06-21-bonner-springs/', data: { title: 'Warped Tour', musicPinOrder: 0 } },
      { url: 'music/hidden/', data: { title: 'Hidden', musicPinOrder: 4, robots: false } },
      { url: 'posts/last-fm/', data: { title: 'Old', musicPinOrder: 1 } }
    ];
    const pinned = getPinnedMusicPages(pages);
    assert.deepEqual(
      pinned.map((entry) => entry.url),
      ['music/last-fm/', 'music/alpha-tie/', 'music/last-fm-scrobbles/', 'music/music-news/'],
    );
  });

  test('getMusicShows returns show pages sorted oldest to newest with deterministic URL tiebreaks', () => {
    const pages: PageMappingEntry[] = [
      { url: 'music/show/2024-07-06-inglewood/', data: { date: new Date('2024-07-06T00:00:00.000Z') } },
      { url: 'music/show/2006-06-21-bonner-springs/', data: { date: new Date('2006-06-21T00:00:00.000Z') } },
      { url: 'music/show/2024-07-06-alpha/', data: { date: new Date('2024-07-06T00:00:00.000Z') } },
      { url: 'music/show/redirected/', data: { date: new Date('2005-01-01T00:00:00.000Z'), redirectTo: '/music/' } },
      { url: 'music/last-fm/', data: { date: new Date('2017-09-07T00:00:00.000Z') } },
      { url: 'music/show/hidden/', data: { date: new Date('2010-01-01T00:00:00.000Z'), robots: false } }
    ];
    const shows = getMusicShows(pages);
    assert.deepEqual(
      shows.map((entry) => entry.url),
      [
        'music/show/2006-06-21-bonner-springs/',
        'music/show/2024-07-06-alpha/',
        'music/show/2024-07-06-inglewood/'
      ],
    );
  });

  test('getAdjacentShows handles first, middle, last, and unknown shows', () => {
    const shows: PageMappingEntry[] = [
      { url: 'music/show/a/', data: { title: 'A' } },
      { url: 'music/show/b/', data: { title: 'B' } },
      { url: 'music/show/c/', data: { title: 'C' } }
    ];
    assert.deepEqual(getAdjacentShows(shows, 'music/show/a/'), { previous: null, next: shows[1] });
    assert.deepEqual(getAdjacentShows(shows, 'music/show/b/'), { previous: shows[0], next: shows[2] });
    assert.deepEqual(getAdjacentShows(shows, 'music/show/c/'), { previous: shows[1], next: null });
    assert.deepEqual(getAdjacentShows(shows, 'music/show/missing/'), { previous: null, next: null });
  });

  test('URL builders produce properly encoded external links', () => {
    assert.equal(
      buildGoogleMapsUrl('The Beaumont Club, 4050 Pennsylvania Ave, Kansas City, MO'),
      'https://www.google.com/maps/search/?api=1&query='
        + 'The%20Beaumont%20Club%2C%204050%20Pennsylvania%20Ave%2C%20Kansas%20City%2C%20MO',
    );
    assert.equal(buildGoogleMapsUrl(''), '');
    assert.equal(buildGoogleMapsUrl(null), '');
    assert.equal(
      buildSetlistSearchUrl('Nine Inch Nails', 'San Diego, CA', 2026),
      'https://www.setlist.fm/search?query=Nine%20Inch%20Nails%20San%20Diego%2C%20CA%202026',
    );
    assert.equal(
      buildSetlistSearchUrl('Nine Inch Nails'),
      'https://www.setlist.fm/search?query=Nine%20Inch%20Nails',
    );
    assert.equal(
      buildConcertArchivesSearchUrl('Underoath Kansas City 2008'),
      'https://www.concertarchives.org/concerts?search=Underoath%20Kansas%20City%202008',
    );
    assert.equal(buildConcertArchivesSearchUrl(''), 'https://www.concertarchives.org/');
    assert.equal(buildConcertArchivesSearchUrl(null), 'https://www.concertarchives.org/');
  });
});

describe('music show templates', () => {
  const showFiles = globSync(`${showsDir}/*.ejs`).sort();

  test('all 41 show templates exist with complete metadata and no private artifact leaks', () => {
    assert.equal(showFiles.length, 41, `expected 41 show templates, found ${showFiles.length}`);

    showFiles.forEach((filePath) => {
      const raw = readFileSync(filePath, 'utf8');
      const relative = path.relative(projectRoot, filePath);
      const { data }: { data: PageFrontMatter } = matter(raw);

      assert.ok(data.tour, `${relative}: missing tour`);
      assert.ok(data.date instanceof Date, `${relative}: date must parse as a YAML Date`);
      assert.ok(data.location, `${relative}: missing location`);
      assert.ok(data.venue && data.venue.name, `${relative}: missing venue.name`);
      assert.ok(Array.isArray(data.tourHistory) && data.tourHistory.length > 0, `${relative}: missing tourHistory`);
      assert.ok(Array.isArray(data.bands) && data.bands.length > 0, `${relative}: missing bands`);

      if (data.venue.name !== 'Unverified Venue') {
        assert.ok(data.venue.mapsQuery || data.venue.mapsUrl, `${relative}: missing Google Maps query or URL`);
      }

      // Ensure personal Gmail receipts, Drive folders, and Google Photos links never leak into public templates.
      assert.equal(/mail\.google\.com/i.test(raw), false, `${relative}: contains private Gmail link`);
      assert.equal(/drive\.google\.com/i.test(raw), false, `${relative}: contains private Google Drive link`);
      assert.equal(/photos\.google\.com/i.test(raw), false, `${relative}: contains private Google Photos link`);
      assert.equal(/iambanders@gmail\.com/i.test(raw), false, `${relative}: contains personal email address`);
    });
  });
});

describe('rendered golden music section', () => {
  /**
   * Reads a rendered HTML page from the golden directory.
   */
  const readGolden = (relativePath: string): string => readFileSync(path.join(goldenDir, relativePath), 'utf8');

  test(
    '/music/ pins Music Listening History and Music News before oldest-to-newest shows',
    () => {
      const html = readGolden('music/index.html');

      const historyPos = html.indexOf('/music/listening-history/');
      const newsPos = html.indexOf('/music/music-news/');
      const firstShowPos = html.indexOf('/music/show/2006-06-21-bonner-springs/');
      const middleShowPos = html.indexOf('/music/show/2019-05-23-new-orleans/');
      const lastShowPos = html.indexOf('/music/show/2026-11-14-san-francisco/');

      assert.equal(html.includes('/music/last-fm/'), false, 'merged /music/last-fm/ must not be pinned on /music/');
      assert.equal(
        html.includes('/music/last-fm-scrobbles/'),
        false,
        'moved /music/last-fm-scrobbles/ must not be pinned on /music/',
      );
      assert.ok(historyPos > -1 && newsPos > -1, 'both pinned music posts must appear on /music/');
      assert.ok(historyPos < newsPos, 'pinned posts must render in pin order');
      assert.ok(newsPos < firstShowPos, 'pinned posts must appear above the shows list');
      assert.ok(firstShowPos < middleShowPos && middleShowPos < lastShowPos, 'shows must be listed oldest to newest');
    },
  );

  test('homepage links to listening history and music news under Music that I have been listening to', () => {
    const homeHtml = readGolden('index.html');
    const sectionStart = homeHtml.indexOf('Music that I have been listening to');
    assert.ok(sectionStart > -1, 'expected homepage music section heading');
    const musicSection = homeHtml.slice(sectionStart);
    assert.ok(musicSection.includes('/music/listening-history/'), 'expected listening history link on homepage');
    assert.ok(musicSection.includes('/music/music-news/'), 'expected music news link on homepage');
  });

  test('/posts/ excludes the moved music posts while legacy and merged URLs redirect cleanly', () => {
    const postsHtml = readGolden('posts/index.html');
    assert.equal(postsHtml.includes('/posts/last-fm/'), false);
    assert.equal(postsHtml.includes('/posts/last-fm-scrobbles/'), false);
    assert.equal(postsHtml.includes('/posts/music-news/'), false);

    const redirectPairs: Array<[string, string]> = [
      ['music/last-fm/index.html', '/music/listening-history/'],
      ['music/last-fm-scrobbles/index.html', '/music/listening-history/'],
      ['posts/last-fm/index.html', '/music/listening-history/'],
      ['posts/last-fm-scrobbles/index.html', '/music/listening-history/'],
      ['posts/music-news/index.html', '/music/music-news/']
    ];
    redirectPairs.forEach(([file, target]) => {
      assert.ok(existsSync(path.join(goldenDir, file)), `missing redirect stub ${file}`);
      const stubHtml = readGolden(file);
      assert.match(stubHtml, /noindex, nofollow/);
      assert.ok(stubHtml.includes(`url=${target}`), `${file} should meta-refresh to ${target}`);
      assert.ok(
        stubHtml.includes(`href=https://briananders.com${target}`)
          || stubHtml.includes(`href="https://briananders.com${target}"`),
        `${file} canonical should point to ${target}`,
      );
    });
  });

  test('redirects.txt maps every historical URL directly to an existing non-redirect golden page', () => {
    const raw = readFileSync(path.join(projectRoot, 'redirects.txt'), 'utf8').trim();
    const lines = raw.split('\n').filter((line) => line.trim().length > 0);
    assert.ok(lines.length >= 50, `expected historical redirect map, found ${lines.length} entries`);

    const sources = new Set<string>();
    const targets = new Set<string>();
    lines.forEach((line) => {
      const parts = line.trim().split(/\s+/);
      assert.equal(parts.length, 2, `invalid redirect line: ${line}`);
      const [fromUrl, toUrl] = parts;
      assert.ok(fromUrl.startsWith('/') && fromUrl.endsWith('/'), `expected normalized source path: ${fromUrl}`);
      assert.ok(toUrl.startsWith('/') && toUrl.endsWith('/'), `expected normalized target path: ${toUrl}`);
      assert.notEqual(fromUrl, toUrl, `self-redirect not allowed: ${line}`);
      assert.equal(sources.has(fromUrl), false, `duplicate redirect source: ${fromUrl}`);
      sources.add(fromUrl);
      targets.add(toUrl);

      const goldenTarget = path.join(goldenDir, toUrl.replace(/^\/+/, ''), 'index.html');
      assert.ok(existsSync(goldenTarget), `redirect target missing from golden: ${toUrl}`);
      const targetHtml = readFileSync(goldenTarget, 'utf8');
      assert.equal(targetHtml.includes('http-equiv=refresh'), false, `redirect target is itself a redirect: ${toUrl}`);
    });

    targets.forEach((target) => {
      assert.equal(sources.has(target), false, `redirect chain detected through ${target}`);
    });
  });

  test('individual show pages render Google Maps, Concert Archives, setlist links, history, and media sections', () => {
    const html = readGolden('music/show/2007-10-15-kansas-city/index.html');
    assert.match(html, /google\.com\/maps\/search/);
    assert.match(html, /concertarchives\.org\/concerts\/underoath-at-the-beaumont-club-october-15-2007/);
    assert.match(html, /setlist\.fm/);
    assert.match(html, /Tour &amp; Band History/);
    assert.match(html, /Lineup &amp; Setlists/);
    assert.match(html, /Photos &amp; Videos/);
    assert.match(html, /\/music\/show\/2007-07-28-lamoni\//);
    assert.match(html, /\/music\/show\/2008-02-19-kansas-city\//);
  });
});
