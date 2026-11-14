import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://briananders.com/posts/music-news/' });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.customElements = dom.window.customElements;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;

const require = createRequire(import.meta.url);

const MultiselectDropdown = require('../src/js/_components/multiselect-dropdown.js');
MultiselectDropdown.init();
const data = require('../src/js/_modules/band-news/data.js');
const render = require('../src/js/_modules/band-news/render.js');
const { createMusicNews } = require('../src/js/_modules/band-news/controller.js');

describe('band-news data module', () => {
  describe('cleanSourceName', () => {
    test('removes trailing separators and whitespace', () => {
      assert.equal(data.cleanSourceName('The Guide Liverpool |'), 'The Guide Liverpool');
      assert.equal(data.cleanSourceName('Distorted Sound Magazine -'), 'Distorted Sound Magazine');
      assert.equal(data.cleanSourceName('Blabbermouth –'), 'Blabbermouth');
      assert.equal(data.cleanSourceName('Pitchfork'), 'Pitchfork');
      assert.equal(data.cleanSourceName(null), '');
    });
  });

  describe('safeUrl', () => {
    test('accepts valid http and https URLs', () => {
      assert.equal(data.safeUrl('https://example.com/article'), 'https://example.com/article');
      assert.equal(data.safeUrl('http://example.com/'), 'http://example.com/');
    });

    test('rejects unsafe schemes, relative URLs, and non-strings', () => {
      assert.equal(data.safeUrl('javascript:alert(1)'), null);
      assert.equal(data.safeUrl('/relative/path'), null);
      assert.equal(data.safeUrl(''), null);
      assert.equal(data.safeUrl(null), null);
    });
  });

  describe('normalizeArticle', () => {
    test('normalizes an article with new schema (sources array and tag)', () => {
      const raw = {
        title: 'Thrice Announces Tour',
        link: 'https://example.com/story1',
        summary: 'Thrice will be touring nationwide.',
        published: '2026-11-12T12:00:00.000Z',
        published_formatted: 'November 12, 2026 at 12:00 PM',
        source: 'Consequence',
        matched_bands: ['Thrice'],
        image_url: 'https://example.com/pic.jpg',
        tag: 'tour',
        sources: [
          {
            title: 'Thrice Announces Tour Dates',
            link: 'https://example.com/story1',
            source: 'Consequence',
            published: '2026-11-12T12:00:00.000Z'
          },
          {
            title: 'Thrice on the road again',
            link: 'https://example.com/story2',
            source: 'Loudwire |',
            published: '2026-11-12T12:30:00.000Z'
          }
        ]
      };

      const result = data.normalizeArticle(raw);
      assert.ok(result);
      assert.equal(result.title, 'Thrice Announces Tour');
      assert.equal(result.tag, 'tour');
      assert.deepEqual(result.bands, ['Thrice']);
      assert.equal(result.sources.length, 2);
      assert.equal(result.sources[1].source, 'Loudwire');
    });

    test('normalizes legacy article without sources array or tag', () => {
      const legacy = {
        title: 'Deftones Update',
        link: 'https://example.com/deftones',
        summary: 'Working on new songs.',
        published: '2026-11-10T08:00:00.000Z',
        published_formatted: 'November 10, 2026 at 08:00 AM',
        source: 'Rolling Stone',
        matched_bands: ['Deftones'],
        image_url: null
      };

      const result = data.normalizeArticle(legacy);
      assert.ok(result);
      assert.equal(result.title, 'Deftones Update');
      assert.equal(result.tag, null);
      assert.equal(result.sources.length, 1);
      assert.equal(result.sources[0].link, 'https://example.com/deftones');
    });

    test('rejects articles missing title or valid link', () => {
      assert.equal(data.normalizeArticle({ title: '' }), null);
      assert.equal(data.normalizeArticle({ title: 'Test', link: 'not-a-url' }), null);
    });
  });

  describe('normalizeFeed', () => {
    test('sorts articles newest first and normalizes metadata', () => {
      const raw = {
        generated_at: '2026-11-12T14:00:00.000Z',
        bands_tracked: 50,
        feeds_checked: 10,
        bands_list: ['Band A', 'Band B'],
        articles: [
          {
            title: 'Older Article',
            link: 'https://example.com/1',
            published: '2026-11-10T10:00:00.000Z'
          },
          {
            title: 'Newer Article',
            link: 'https://example.com/2',
            published: '2026-11-12T10:00:00.000Z'
          }
        ]
      };

      const feed = data.normalizeFeed(raw);
      assert.equal(feed.bandsTracked, 50);
      assert.equal(feed.feedsChecked, 10);
      assert.equal(feed.articles.length, 2);
      assert.equal(feed.articles[0].title, 'Newer Article');
      assert.equal(feed.articles[1].title, 'Older Article');
    });
  });

  describe('buildSnapshots', () => {
    test('creates list of snapshots including latest and valid catalog entries', () => {
      const latestFeed = {
        generatedAt: '2026-11-12T14:00:00.000Z',
        articles: [{ title: 'A', link: 'https://example.com/a' }]
      };
      const catalog = {
        history: [
          {
            date: '2026-11-12',
            path: 'history/2026-11-12-articles.json',
            generated_at: '2026-11-12T14:00:00.000Z', // matches latest feed, should be excluded
            article_count: 1
          },
          {
            date: '2026-11-11',
            path: 'history/2026-11-11-articles.json',
            generated_at: '2026-11-11T20:00:00.000Z',
            article_count: 42
          },
          {
            date: 'invalid',
            path: 'bad/path',
            article_count: 0
          }
        ]
      };

      const snapshots = data.buildSnapshots(latestFeed, catalog);
      assert.equal(snapshots.length, 2);
      assert.equal(snapshots[0].key, 'latest');
      assert.equal(snapshots[0].isLatest, true);
      assert.equal(snapshots[1].key, '2026-11-11');
      assert.equal(snapshots[1].isLatest, false);
      assert.equal(snapshots[1].articleCount, 42);
    });
  });

  describe('markNew', () => {
    test('identifies articles not seen in previous snapshot links', () => {
      const current = [
        {
          title: 'Existing Story',
          link: 'https://example.com/old',
          sources: [{ link: 'https://example.com/old' }]
        },
        {
          title: 'Brand New Story',
          link: 'https://example.com/brand-new',
          sources: [{ link: 'https://example.com/brand-new' }]
        }
      ];
      const previous = [
        {
          title: 'Existing Story in Past Feed',
          link: 'https://example.com/old',
          sources: [{ link: 'https://example.com/old' }]
        }
      ];

      const marked = data.markNew(current, previous);
      assert.equal(marked[0].isNew, false);
      assert.equal(marked[1].isNew, true);
    });
  });

  describe('filtering and facetCounts', () => {
    const articles = [
      {
        title: 'A',
        link: 'https://example.com/a',
        tag: 'tour',
        bands: ['Band 1'],
        isNew: true
      },
      {
        title: 'B',
        link: 'https://example.com/b',
        tag: 'tour',
        bands: ['Band 2'],
        isNew: false
      },
      {
        title: 'C',
        link: 'https://example.com/c',
        tag: 'new music',
        bands: ['Band 1'],
        isNew: true
      }
    ];

    test('filters articles by tag, band, and newOnly', () => {
      assert.equal(data.filterArticles(articles, { tag: 'tour', band: null, newOnly: false }).length, 2);
      assert.equal(data.filterArticles(articles, { tag: null, band: 'Band 1', newOnly: false }).length, 2);
      assert.equal(data.filterArticles(articles, { tag: null, bands: ['Band 1', 'Band 2'], newOnly: false }).length, 3);
      assert.equal(data.filterArticles(articles, { tag: 'tour', band: 'Band 1', newOnly: false }).length, 1);
      assert.equal(data.filterArticles(articles, { tag: 'tour', bands: ['Band 1'], newOnly: false }).length, 1);
      assert.equal(data.filterArticles(articles, { tag: 'tour', band: 'Band 1', newOnly: true }).length, 1);
      assert.equal(data.filterArticles(articles, { tag: 'tour', band: 'Band 2', newOnly: true }).length, 0);
    });

    test('facetCounts computes available counts dynamically', () => {
      const facets = data.facetCounts(articles, { tag: null, band: null, newOnly: false });
      assert.deepEqual(facets.tags, [
        { value: 'new music', count: 1 },
        { value: 'tour', count: 2 }
      ]);
      assert.deepEqual(facets.bands, [
        { value: 'Band 1', count: 2 },
        { value: 'Band 2', count: 1 }
      ]);
    });

    test('facetCounts respects other active filters and excludes artists with zero matches', () => {
      // When Band 2 is selected, tag counts reflect Band 2 only
      const facetsForBand2 = data.facetCounts(articles, { tag: null, band: 'Band 2', newOnly: false });
      assert.deepEqual(facetsForBand2.tags, [
        { value: 'tour', count: 1 }
      ]);

      // When "new music" is selected, only Band 1 has matches; Band 2 has 0 and must not be listed
      const facetsForNewMusic = data.facetCounts(articles, { tag: 'new music', bands: [], newOnly: false });
      assert.deepEqual(facetsForNewMusic.bands, [
        { value: 'Band 1', count: 1 }
      ]);
    });
  });

  describe('parseState & serializeState', () => {
    test('parses query string parameters with single or multiple bands', () => {
      const state1 = data.parseState('?snapshot=2026-11-10&tag=tour&band=Thursday&new=1');
      assert.equal(state1.snapshot, '2026-11-10');
      assert.equal(state1.tag, 'tour');
      assert.deepEqual(state1.bands, ['Thursday']);
      assert.equal(state1.band, 'Thursday');
      assert.equal(state1.newOnly, true);

      const state2 = data.parseState('?bands=Thursday,Underoath');
      assert.deepEqual(state2.bands, ['Thursday', 'Underoath']);
    });

    test('serializes state back to clean query string omitting defaults', () => {
      const query = data.serializeState('', {
        snapshot: 'latest',
        tag: 'new music',
        bands: ['Underoath', 'Thursday'],
        newOnly: false
      });
      assert.equal(query, '?tag=new+music&bands=Underoath%2CThursday');
    });
  });
});

describe('band-news render module', () => {
  test('escapeHTML prevents injection', () => {
    assert.equal(render.escapeHTML('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  test('renderSources renders up to VISIBLE_SOURCES then collapsible details', () => {
    const sources = [
      { title: 'S1', link: 'https://example.com/1', source: 'Out 1', published: '2026-11-12T10:00:00Z' },
      { title: 'S2', link: 'https://example.com/2', source: 'Out 2', published: '2026-11-12T11:00:00Z' },
      { title: 'S3', link: 'https://example.com/3', source: 'Out 3', published: '2026-11-12T12:00:00Z' },
      { title: 'S4', link: 'https://example.com/4', source: 'Out 4', published: '2026-11-12T13:00:00Z' }
    ];

    const html = render.renderSources(sources);
    assert.ok(html.includes('Sources'));
    assert.ok(html.includes('S1'));
    assert.ok(html.includes('S2'));
    assert.ok(html.includes('S3'));
    assert.ok(html.includes('<details class="article-sources-more">'));
    assert.ok(html.includes('Show 1 more source'));
    assert.ok(html.includes('S4'));
  });

  test('renderArticle renders tags, bands, multiple sources, and new badge', () => {
    const article = {
      title: 'Major News',
      link: 'https://example.com/major',
      summary: 'Summary text',
      published: '2026-11-12T10:00:00.000Z',
      publishedFormatted: 'Nov 12, 2026',
      source: 'Pitchfork',
      bands: ['Underoath'],
      imageUrl: null,
      tag: 'new music',
      sources: [
        { title: 'Major News', link: 'https://example.com/major', source: 'Pitchfork', published: '2026-11-12T10:00:00.000Z' },
        { title: 'Second reporting', link: 'https://example.com/major2', source: 'NME', published: '2026-11-12T11:00:00.000Z' }
      ],
      isNew: true
    };

    const html = render.renderArticle(article, { tag: 'new music', band: null });
    assert.ok(html.includes('article-card--new'));
    assert.ok(html.includes('article-new'));
    assert.ok(html.includes('article-tag--selected'));
    assert.ok(html.includes('data-filter="tag"'));
    assert.ok(html.includes('data-value="new music"'));
    assert.ok(html.includes('data-filter="band"'));
    assert.ok(html.includes('data-value="Underoath"'));
    assert.ok(html.includes('2 sources'));
  });
});

describe('band-news controller', () => {
  let document;
  let elements;
  let fetchMock;
  let historyMock;
  let locationMock;

  const mockFeedLatest = {
    generated_at: '2026-11-12T14:00:00.000Z',
    bands_tracked: 10,
    feeds_checked: 5,
    bands_list: ['Underoath', 'Thursday'],
    articles: [
      {
        title: 'Underoath Single',
        link: 'https://example.com/uo-single',
        summary: 'New single out today.',
        published: '2026-11-12T12:00:00.000Z',
        source: 'Loudwire',
        matched_bands: ['Underoath'],
        tag: 'new music',
        sources: [
          { title: 'Underoath Single', link: 'https://example.com/uo-single', source: 'Loudwire', published: '2026-11-12T12:00:00.000Z' }
        ]
      },
      {
        title: 'Thursday Tour',
        link: 'https://example.com/thursday-tour',
        summary: 'Tour announced.',
        published: '2026-11-12T10:00:00.000Z',
        source: 'Consequence',
        matched_bands: ['Thursday'],
        tag: 'tour',
        sources: [
          { title: 'Thursday Tour', link: 'https://example.com/thursday-tour', source: 'Consequence', published: '2026-11-12T10:00:00.000Z' }
        ]
      }
    ]
  };

  const mockFeedHistory = {
    generated_at: '2026-11-11T14:00:00.000Z',
    bands_tracked: 10,
    feeds_checked: 5,
    bands_list: ['Thursday'],
    articles: [
      {
        title: 'Thursday Tour',
        link: 'https://example.com/thursday-tour',
        summary: 'Tour announced.',
        published: '2026-11-11T10:00:00.000Z',
        source: 'Consequence',
        matched_bands: ['Thursday'],
        tag: 'tour',
        sources: [
          { title: 'Thursday Tour', link: 'https://example.com/thursday-tour', source: 'Consequence', published: '2026-11-11T10:00:00.000Z' }
        ]
      }
    ]
  };

  const mockCatalog = {
    generated_at: '2026-11-12T14:00:00.000Z',
    history_count: 1,
    history: [
      {
        date: '2026-11-11',
        path: 'history/2026-11-11-articles.json',
        generated_at: '2026-11-11T14:00:00.000Z',
        article_count: 1
      }
    ]
  };

  beforeEach(() => {
    dom.window.document.body.innerHTML = `
      <div id="music-news">
        <p id="music-news-meta"></p>
        <div id="music-news-history-wrap">
          <select id="music-news-history-select"></select>
          <button id="music-news-history-prev"></button>
          <button id="music-news-history-next"></button>
          <button id="music-news-history-latest"></button>
          <div id="music-news-new-wrap">
            <input type="checkbox" id="music-news-new-only" />
          </div>
        </div>
        <div id="music-news-tags-wrap"><div id="music-news-tags"></div></div>
        <div id="music-news-bands-hits-wrap">
          <multiselect-dropdown id="music-news-bands-select" placeholder="All matching artists"></multiselect-dropdown>
          <div id="music-news-bands-hits"></div>
        </div>
        <div id="music-news-filter-status"></div>
        <div id="music-news-list"></div>
        <div id="music-news-empty"></div>
      </div>
    `;

    document = dom.window.document;
    global.document = document;
    global.window = dom.window;

    elements = {
      root: document.getElementById('music-news'),
      meta: document.getElementById('music-news-meta'),
      list: document.getElementById('music-news-list'),
      empty: document.getElementById('music-news-empty'),
      historyWrap: document.getElementById('music-news-history-wrap'),
      historySelect: document.getElementById('music-news-history-select'),
      historyPrev: document.getElementById('music-news-history-prev'),
      historyNext: document.getElementById('music-news-history-next'),
      historyLatest: document.getElementById('music-news-history-latest'),
      newWrap: document.getElementById('music-news-new-wrap'),
      newOnly: document.getElementById('music-news-new-only'),
      tagsWrap: document.getElementById('music-news-tags-wrap'),
      tags: document.getElementById('music-news-tags'),
      bandsWrap: document.getElementById('music-news-bands-hits-wrap'),
      bandsSelect: document.getElementById('music-news-bands-select'),
      bands: document.getElementById('music-news-bands-hits'),
      filterStatus: document.getElementById('music-news-filter-status')
    };

    locationMock = {
      search: '',
      pathname: '/posts/music-news/',
      hash: ''
    };

    historyMock = {
      state: null,
      replaceState: (state, title, url) => {
        const u = new URL(url, 'https://briananders.com');
        locationMock.search = u.search;
      }
    };

    fetchMock = async (url) => {
      if (url.endsWith('/articles.json')) {
        return { ok: true, json: async () => mockFeedLatest };
      }
      if (url.endsWith('/catalog.json')) {
        return { ok: true, json: async () => mockCatalog };
      }
      if (url.endsWith('2026-11-11-articles.json')) {
        return { ok: true, json: async () => mockFeedHistory };
      }
      return { ok: false, status: 404 };
    };
  });

  test('initializes and renders latest feed with history and filters', async () => {
    const controller = createMusicNews({
      elements,
      fetchImpl: fetchMock,
      location: locationMock,
      history: historyMock
    });

    await controller.ready;

    // Both articles rendered
    assert.equal(elements.list.children.length, 2);
    assert.ok(elements.meta.textContent.includes('Tracking 10 bands'));

    // Tag chips rendered
    const tagButtons = elements.tags.querySelectorAll('button');
    assert.equal(tagButtons.length, 2);

    // Multiselect populated with available matching artists
    assert.equal(elements.bandsSelect.options.length, 2);
    assert.equal(elements.bandsSelect.options[0].value, 'Thursday');
    assert.equal(elements.bandsSelect.options[1].value, 'Underoath');

    // History controls populated
    assert.equal(elements.historySelect.children.length, 2);
    assert.equal(elements.historySelect.value, 'latest');
    assert.equal(elements.historyPrev.disabled, false);
    assert.equal(elements.historyNext.disabled, true);
  });

  test('filtering by tag updates article list and URL', async () => {
    const controller = createMusicNews({
      elements,
      fetchImpl: fetchMock,
      location: locationMock,
      history: historyMock
    });

    await controller.ready;

    const tourTagBtn = [...elements.tags.querySelectorAll('button')]
      .find((btn) => btn.dataset.value === 'tour');
    assert.ok(tourTagBtn);

    tourTagBtn.click();

    // Only Thursday Tour matches
    assert.equal(elements.list.children.length, 1);
    assert.ok(elements.list.textContent.includes('Thursday Tour'));
    assert.ok(locationMock.search.includes('tag=tour'));

    // Multiselect options dynamically updated to only show matching artists (Underoath has 0 matches for tour)
    assert.equal(elements.bandsSelect.options.length, 1);
    assert.equal(elements.bandsSelect.options[0].value, 'Thursday');

    // Clicking again clears filter
    const activeTourBtn = [...elements.tags.querySelectorAll('button')]
      .find((btn) => btn.dataset.value === 'tour');
    assert.ok(activeTourBtn);
    activeTourBtn.click();
    assert.equal(elements.list.children.length, 2);
    assert.ok(!locationMock.search.includes('tag=tour'));
    assert.equal(elements.bandsSelect.options.length, 2);
  });

  test('multiselect dropdown filters articles and syncs with card artist clicks', async () => {
    const controller = createMusicNews({
      elements,
      fetchImpl: fetchMock,
      location: locationMock,
      history: historyMock
    });

    await controller.ready;

    // Filter by selecting Underoath in multiselect
    elements.bandsSelect.setSelected(['Underoath']);
    elements.bandsSelect.dispatchEvent(new dom.window.CustomEvent('change', {
      detail: { values: ['Underoath'] }
    }));

    assert.equal(elements.list.children.length, 1);
    assert.ok(elements.list.textContent.includes('Underoath Single'));
    assert.ok(locationMock.search.includes('bands=Underoath'));

    // Clicking an artist tag on an article card toggles it in multiselect
    const uoTag = elements.list.querySelector('[data-filter="band"][data-value="Underoath"]');
    assert.ok(uoTag);
    uoTag.click();

    // Toggling off restores both articles
    assert.equal(elements.list.children.length, 2);
    assert.deepEqual(elements.bandsSelect.value, []);
    assert.ok(!locationMock.search.includes('bands='));
  });

  test('switching snapshot in history select re-renders from archive and updates comparison', async () => {
    const controller = createMusicNews({
      elements,
      fetchImpl: fetchMock,
      location: locationMock,
      history: historyMock
    });

    await controller.ready;

    // Switch to 2026-11-11 snapshot
    elements.historySelect.value = '2026-11-11';
    elements.historySelect.dispatchEvent(new dom.window.Event('change'));

    await new Promise((resolve) => { setTimeout(resolve, 20); });

    assert.equal(elements.list.children.length, 1);
    assert.ok(elements.list.textContent.includes('Thursday Tour'));
    assert.ok(locationMock.search.includes('snapshot=2026-11-11'));
    assert.equal(elements.historyLatest.hidden, false);

    // Step back to latest via back-to-latest button
    elements.historyLatest.click();
    await new Promise((resolve) => { setTimeout(resolve, 20); });

    assert.equal(elements.list.children.length, 2);
    assert.equal(elements.historySelect.value, 'latest');
  });

  test('clear filters button resets all active filters', async () => {
    locationMock.search = '?tag=tour&band=Thursday';
    const controller = createMusicNews({
      elements,
      fetchImpl: fetchMock,
      location: locationMock,
      history: historyMock
    });

    await controller.ready;

    assert.equal(elements.list.children.length, 1);
    assert.equal(elements.filterStatus.hidden, false);

    const clearBtn = elements.filterStatus.querySelector('[data-action="clear-filters"]');
    assert.ok(clearBtn);

    clearBtn.click();

    assert.equal(elements.list.children.length, 2);
    assert.equal(elements.filterStatus.hidden, true);
    assert.equal(locationMock.search, '');
  });
});
