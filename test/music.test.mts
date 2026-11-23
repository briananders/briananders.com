import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { PageMappingEntry } from '../build/types.ts';
import type { AdjacentShows } from '../build/helpers/music.ts';

interface MusicHelpersModule {
  normalizePageUrl: (pageUrl?: string | null) => string;
  formatShowDate: (dateValue?: string | number | Date) => string;
  getPinnedMusicPages: (pageMappingData: PageMappingEntry[]) => PageMappingEntry[];
  getMusicShows: (pageMappingData: PageMappingEntry[]) => PageMappingEntry[];
  getAdjacentShows: (orderedShows: PageMappingEntry[], currentPath: string) => AdjacentShows;
  buildGoogleMapsUrl: (venueQuery?: string | null) => string;
  buildSetlistSearchUrl: (artistName: string, location?: string, year?: string | number) => string;
  buildConcertArchivesSearchUrl: (query?: string | null) => string;
}

interface ShowFrontMatter {
  tour?: string;
  date?: unknown;
  location?: string;
  venue?: {
    name?: string;
    mapsQuery?: string;
    mapsUrl?: string;
  };
  tourHistory?: unknown[];
  bands?: unknown[];
}

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
}: MusicHelpersModule = require('../build/helpers/music.ts');

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
  });

  test('formatShowDate formats UTC dates consistently without timezone drift', () => {
    assert.equal(formatShowDate(new Date('2006-06-21T00:00:00.000Z')), 'June 21, 2006');
    assert.equal(formatShowDate('2026-11-14T00:00:00.000Z'), 'November 14, 2026');
    assert.equal(formatShowDate('not-a-date'), '');
  });

  test('getPinnedMusicPages selects direct music children with musicPinOrder sorted ascending', () => {
    const pages: PageMappingEntry[] = [
      { url: 'music/', data: { title: 'Music' } },
      { url: 'music/music-news/', data: { title: 'Music News', musicPinOrder: 3 } },
      { url: 'music/last-fm/', data: { title: 'Recent Listening Trends', musicPinOrder: 1 } },
      { url: 'music/last-fm-scrobbles/', data: { title: 'Music Listening History', musicPinOrder: 2 } },
      { url: 'music/show/2006-06-21-bonner-springs/', data: { title: 'Warped Tour', musicPinOrder: 0 } },
      { url: 'music/hidden/', data: { title: 'Hidden', musicPinOrder: 4, robots: false } },
      { url: 'posts/last-fm/', data: { title: 'Old', musicPinOrder: 1 } }
    ];
    const pinned = getPinnedMusicPages(pages);
    assert.deepEqual(
      pinned.map((entry) => entry.url),
      ['music/last-fm/', 'music/last-fm-scrobbles/', 'music/music-news/'],
    );
  });

  test('getMusicShows returns show pages sorted oldest to newest with deterministic URL tiebreaks', () => {
    const pages: PageMappingEntry[] = [
      { url: 'music/show/2024-07-06-inglewood/', data: { date: new Date('2024-07-06T00:00:00.000Z') } },
      { url: 'music/show/2006-06-21-bonner-springs/', data: { date: new Date('2006-06-21T00:00:00.000Z') } },
      { url: 'music/show/2024-07-06-alpha/', data: { date: new Date('2024-07-06T00:00:00.000Z') } },
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
    assert.equal(
      buildSetlistSearchUrl('Nine Inch Nails', 'San Diego, CA', 2026),
      'https://www.setlist.fm/search?query=Nine%20Inch%20Nails%20San%20Diego%2C%20CA%202026',
    );
    assert.equal(
      buildConcertArchivesSearchUrl('Underoath Kansas City 2008'),
      'https://www.concertarchives.org/concerts?search=Underoath%20Kansas%20City%202008',
    );
    assert.equal(buildConcertArchivesSearchUrl(''), 'https://www.concertarchives.org/');
  });
});

describe('music show templates', () => {
  const showFiles = globSync(`${showsDir}/*.ejs`).sort();

  test('all 41 show templates exist with complete metadata and no private artifact leaks', () => {
    assert.equal(showFiles.length, 41, `expected 41 show templates, found ${showFiles.length}`);

    showFiles.forEach((filePath) => {
      const raw = readFileSync(filePath, 'utf8');
      const relative = path.relative(projectRoot, filePath);
      const { data } = matter(raw) as { data: ShowFrontMatter };

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
    '/music/ pins Recent Listening Trends, Music Listening History, and Music News before oldest-to-newest shows',
    () => {
      const html = readGolden('music/index.html');

      const recentPos = html.indexOf('/music/last-fm/');
      const historyPos = html.indexOf('/music/last-fm-scrobbles/');
      const newsPos = html.indexOf('/music/music-news/');
      const firstShowPos = html.indexOf('/music/show/2006-06-21-bonner-springs/');
      const middleShowPos = html.indexOf('/music/show/2019-05-23-new-orleans/');
      const lastShowPos = html.indexOf('/music/show/2026-11-14-san-francisco/');

      assert.ok(recentPos > -1 && historyPos > -1 && newsPos > -1, 'all 3 pinned music posts must appear on /music/');
      assert.ok(recentPos < historyPos && historyPos < newsPos, 'pinned posts must render in pin order');
      assert.ok(newsPos < firstShowPos, 'pinned posts must appear above the shows list');
      assert.ok(firstShowPos < middleShowPos && middleShowPos < lastShowPos, 'shows must be listed oldest to newest');
    },
  );

  test('/posts/ excludes the three moved music posts while legacy /posts/ URLs redirect cleanly', () => {
    const postsHtml = readGolden('posts/index.html');
    assert.equal(postsHtml.includes('/posts/last-fm/'), false);
    assert.equal(postsHtml.includes('/posts/last-fm-scrobbles/'), false);
    assert.equal(postsHtml.includes('/posts/music-news/'), false);

    const redirectPairs: Array<[string, string]> = [
      ['posts/last-fm/index.html', '/music/last-fm/'],
      ['posts/last-fm-scrobbles/index.html', '/music/last-fm-scrobbles/'],
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
