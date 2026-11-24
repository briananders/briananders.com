# Claude Context — briananders.com

@AGENTS.md

The rules above apply to every agent. This file is the architecture reference.

## Project Overview

This is the personal website of **Brian Anders** — an Engineering Manager, YouTuber, Podcaster, and Musician. The site is a custom-built Node.js static site generator that produces pages from EJS templates, SCSS stylesheets, and Browserify-bundled JavaScript. Content is primarily **posts and experiments** — interactive demos, code explorations, music data visualizations, and personal projects — rather than traditional blog articles.

## URLs

| Environment | URL |
|---|---|
| **Production** | https://briananders.com |
| **Staging** | http://staging.briananders.com.s3-website-us-east-1.amazonaws.com |
| **Local dev** | http://localhost:3000 |

## Supporting Repositories

| Repository | Purpose |
|---|---|
| [briananders/briananders.com](https://github.com/briananders/briananders.com) | This repo — the main website |
| [briananders/briananders.com-visual-diffs](https://github.com/briananders/briananders.com-visual-diffs) | Visual regression testing. `visual-diffs/` is a committed symlink to Brian's local clone, so `npm run visual-diff` only works on his machine. Agents use `npm run screenshot`. |
| [briananders/sublime-text-dublicate](https://github.com/briananders/sublime-text-dublicate) | VSCode extension: Sublime Duplicate Text |
| [briananders/pageweight](https://github.com/briananders/pageweight) | NPM CLI tool for measuring webpage weight |
| [briananders/two-way-merge](https://github.com/briananders/two-way-merge) | NPM CLI tool for two-way directory sync |

### External Data Sources (hosted on S3, managed outside this repo)

These paths are **preserved during deploys** via `s3-upload-allowlist.json` and are **not built from this repo**. In local dev, they are proxied from the staging S3 bucket.

| S3 Path | Description | Consumer |
|---|---|---|
| `/last-fm-history/` | Pre-processed Last.fm scrobble data (JSON reports, monthly trends, images) for both listening dashboards and the homepage album list | `src/js/_modules/last-fm/` |
| `/band-news/` | Aggregated music news articles matching followed bands (`articles.json`, `catalog.json`, `history/*.json`) | `src/js/_modules/band-news/`, `src/js/posts/music-news.js` |
| `/data/` | Static JSON datasets (word lists for Wordle/Wordscapes solvers) | Various post scripts |
| `/movies/` | Movie/IMDb ratings data | `src/js/posts/imdb-ratings.js` |

### Last.fm Listening Dashboards

`/posts/last-fm/` (recent, rolling windows) and `/posts/last-fm-scrobbles/` (history, every period type) share one dashboard: the `src/partials/last-fm-dashboard.ejs` shell, `src/styles/posts/_last-fm-dashboard.scss`, and the controller in `src/js/_modules/last-fm/dashboard.js`. The browser never calls the Last.fm API; everything is read from `/last-fm-history/` (user `imbanders`):

| Path | Shape | Used for |
|---|---|---|
| `reports/index.json` | Every published period, grouped by type (`all-time`, `rolling`, `year`, `quarter`, `month`, `week`) | Period pickers, "previous period" comparisons |
| `reports/{type}_{period}.json` | `totalScrobbles` + top-50 `artists` / `albums` (rolling reports also carry `startDate`/`endDate`) | KPIs, covers, bars, focus, movers |
| `reports/year_totals.json` | Scrobbles per year | Year columns |
| `reports/last_updated.json` | Data freshness | "Last updated", clipping in-progress periods |
| `trends/years/{YYYY}.json` | Monthly totals | Heatmap, 24-month timeline, year dialog |
| `trends/artists/{slug}.json`, `trends/albums/{artist}/{album}.json` | Monthly plays | Drill-down dialog |
| `images/{hash}` (`.avif`/`.webp`/`.jpg`) | Cover and artist art | `<api-image>` |

Trend slugs are lowercase with everything outside `[a-z0-9 -]` removed and whitespace collapsed to `-` (no accent folding): see `slugify()` in `data.js`. URL state: `?type=&period=` for the period, `?trends=artists/…` for the dialog.

Every panel compares against one report per period (`comparisonFor()` in `data.js`). Top albums and Top artists show each item's count there: the previous period's count for calendar periods; for rolling windows, which have no earlier window of equal length, the longer window's count scaled to this window's days ("usual"). A report only lists its top 50, so an item missing from the comparison report has no count there: for months, quarters and years the dashboard reads the real count (often 0) from that item's monthly trend file (`resolveMissing()`); weeks and rolling windows don't line up with months, so they show the honest bound "≤ N", where N is the comparison list's #50 count. Report and trend counts matched exactly in spot checks of a year, a quarter and a month.

### Band News Feed & History

`/posts/music-news/` consumes data aggregated by `~/Code/band-news` and published to `/band-news/`:
- `articles.json` — Latest feed conforming to `schema/articles.schema.json`.
- `catalog.json` — History catalog conforming to `schema/catalog.schema.json`.
- `history/YYYY-MM-DD-articles.json` — Archived feed snapshots.

Architecture lives in `src/js/_modules/band-news/` and `src/js/_components/`:
- `multiselect-dropdown.js` — Custom web component (`<multiselect-dropdown>`) providing an accessible multi-select dropdown with checkboxes, option match counts, keyboard navigation (W3C APG Combobox/Listbox pattern), and mobile-friendly popover styling.
- `data.js` — Normalization for articles and feeds, snapshot catalog parsing, dynamic faceted counts (excluding 0-match options), query-string view state serialization (`?snapshot=&tag=&bands=&new=1`), and novelty comparison against the previous snapshot.
- `render.js` — HTML builders for article cards (with tags, multi-source links, and novelty indicators), filter chips, history controls, and filter status.
- `controller.js` — Coordinates async snapshot loading, URL state synchronization, and faceted filter interactions across tags, multiselect dropdown, and history archives.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 26.13.1 (see `.nvmrc`) — **must use nvm**; runs `.ts` natively via built-in type stripping |
| Language | TypeScript 6 (`strict: true`, `erasableSyntaxOnly: true`; `tsconfig.json` for Node + `tsconfig.browser.json` for `src/ts/`) |
| Templates | EJS with gray-matter YAML front matter |
| Styles | SCSS (Dart Sass via `sass` package), minified with CleanCSS |
| Client Scripts | CommonJS TypeScript modules (`src/ts/`) bundled to `.js` with Browserify + custom Babel 8 transform (`build/bundlers/babel-transform.ts` with `@babel/preset-typescript`, `@babel/preset-env`, `@babel/preset-react`) |
| Hosting | AWS S3 + CloudFront |
| Deployment | Custom `s3-uploader.ts` using AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `@aws-sdk/client-cloudfront`) |
| Dev server | Express with express-static and http-proxy-middleware |
| Linting | ESLint 10 flat config (`eslint.config.mjs` with `@eslint/js`, `typescript-eslint`, `@stylistic/eslint-plugin`, `eslint-plugin-import-x`) |
| Build optimization | HTML minification (html-minifier-terser), JS minification (uglify-js), SVG optimization (svgo), WebP/AVIF conversion (sharp), gzip compression, content-hash asset naming (xxhash) |
| Analytics | Google Tag Manager (production only) |
| Screenshots | Playwright (`^1.65.1`). Run `npx playwright install chromium` once per machine. |

## Project Structure

```
├── index.ts                    # Main entry: build pipeline + dev server
├── s3-uploader.ts              # AWS S3 deploy script
├── s3-upload-allowlist.json    # S3 paths preserved during deploy
├── scaffold.ts                 # New page scaffolding tool
├── preview-production.ts       # Serve production build locally
├── package.json
├── .nvmrc                      # Node 26.13.1
├── tsconfig.json               # Node + test TypeScript config (strict, erasableSyntaxOnly)
├── tsconfig.browser.json       # Browser TypeScript config for src/ts/
├── eslint.config.mjs           # ESLint 10 + typescript-eslint flat config
├── .githooks/post-merge        # Auto-converts legacy .js files merged from older branches
│
├── AGENTS.md                   # Rules for every AI agent (imported above)
├── bin/convert-js-to-ts.ts     # Automatic legacy JS → TS converter (`npm run convert-js`)
├── bin/screenshot.ts           # Contact-sheet screenshots + viewport-edge layout check (`npm run screenshot`)
├── bin/og-images.ts            # Social preview captures from front-matter recipes (`npm run og-images`)
├── types/                      # Ambient TypeScript declarations (`modules.d.ts`, `browser.d.ts`)
│
├── build/                      # Build pipeline (TypeScript, runs natively on Node 26)
│   ├── types.ts                # Shared build interfaces (`BuildConfigs`, `CompletionFlags`, etc.)
│   ├── bundlers/
│   │   ├── babel-transform.ts  # Custom Browserify transform using @babel/core v8 + preset-typescript
│   │   ├── bundle-ejs.ts       # EJS → HTML renderer (two-pass: template then layout)
│   │   ├── bundle-js.ts        # Browserify + Babel 8 bundler (`src/ts/` → `scripts/*.js`); watchify in dev
│   │   ├── bundle-scss.ts      # Dart Sass compiler + CleanCSS minifier
│   │   └── sitemap.ts          # Renders sitemap.json.ejs + sitemap.xml.ejs
│   ├── constants/              # Event names, completion flags, directory paths, formats, golden-build, site-data (.ts)
│   ├── hashing/                # XXHash JS/images/CSS + URL rewriting (.ts)
│   ├── helpers/                # Build helpers, EJS functions, SEO, commit-hash, check-done (.ts)
│   ├── optimize/               # WebP/AVIF, gzip, HTML/JS minification, SVGO (.ts)
│   ├── move-assets.ts          # Copies images (SVG→SVGO, raster→WebP+AVIF+copy), videos, txt, downloads
│   ├── page-mapping-data.ts    # Front-matter index compiled from all EJS templates
│   ├── prod-builder.ts         # Production event listener wiring
│   ├── preview-builder.ts      # Dev mode: chokidar watchers + previewReady gate
│   └── golden-builder.ts       # Golden build: minify only, hashing/gzip flags pre-set
│
├── src/
│   ├── templates/              # EJS page templates (one per output page)
│   ├── partials/               # Reusable EJS partials (header, footer, nav, etc.)
│   ├── layout/                 # Layout templates (base.ejs, blank.ejs, empty.ejs)
│   ├── styles/                 # SCSS source (`system/`, `modules/`, `posts/`)
│   ├── ts/                     # TypeScript browser source (`_modules/`, `_components/`, `posts/`, `example/`)
│   ├── images/                 # Source images + their committed .avif twins and avif-manifest.json
│   ├── videos/                 # Source videos
│   ├── data/                   # Static JSON data files
│   ├── downloads/              # Downloadable files
│   ├── sitemap.json.ejs        # Sitemap template (receives pageMappingData + siteData)
│   ├── sitemap.xml.ejs         # Sitemap XML template
│   ├── robots.txt
│   └── humans.txt
│
├── .github/workflows/          # CI/CD
├── test/                       # node:test TypeScript suites (`test/*.test.mts`)
├── scaffold/                   # TypeScript templates for `npm run scaffold` (`css.ts`, `html.ts`, `ts.ts`)
└── visual-diffs/               # Symlink to Brian's local briananders.com-visual-diffs clone
```

## Key Conventions

### Page Creation

Each page is an EJS template in `src/templates/` with YAML front matter:

```yaml
---
title: "Page Title"
description: "Page description shown at the top and in meta tags."
date: 2024-12-31
priority: 0.8
ogImage:
  selector: '#canvas'
  alt: "What the preview image shows"
pageClasses:
  - 'page-class-name'
layout: base
styles:
  - 'main'
  - 'posts/page-name'
scripts:
  - 'posts/page-name'
---
```

- **Layout** is required: `base` (standard with header/footer), `blank` (HTML shell only), or `empty`
- **Styles** array references SCSS files in `src/styles/` (without extension)
- **Scripts** array references JS entry files in `src/js/` (without extension)
- Output paths are derived from template paths: `posts/my-post.ejs` → `/posts/my-post/index.html`
- Files named `*.html.ejs` output directly (e.g., `index.html.ejs` → `index.html`)
- Templates prefixed with `_` are excluded from the build
- `robots: false` makes a page `noindex` and leaves it out of `sitemap.xml`. Don't also block it in `robots.txt`: crawlers can't read a noindex tag on a page they're not allowed to fetch.

### SEO and Social Previews

`build/helpers/seo.js` decides every search and social tag; `src/partials/head/meta.ejs` only renders it (via the `seo(locals)` EJS helper).

| Output | Source |
|---|---|
| `<title>`, `og:title` | The page's heading (`altTitle` when set, as the visible `<h1>` uses it, else `title`). `<title>` appends ` \| Brian Anders`; front matter `metaTitle` replaces it. The homepage's `title` is a nav label ("Home"), so its social title is the site name and its `<title>` comes from `metaTitle` |
| Meta / OG / Twitter description | `metaDescription`, else `description`. Google cuts snippets at about 160 characters, and a test enforces that limit on indexable pages; set `metaDescription` when the on-page `description` runs longer |
| Canonical, `og:url`, `og:image` | Always absolute (`siteData.domain`). Production hashing rewrites same-origin absolute URLs too (`replacePaths` in `finish-hashing.js`) |
| `og:type` + JSON-LD type | Posts are `article` / `BlogPosting` with breadcrumbs, `posts/` is a `CollectionPage`, everything else a `WebPage`. Front matter `schemaType` overrides it (`about.ejs` is a `ProfilePage`) |
| JSON-LD `Person` | `sameAs` lists every profile in `site-data.js`, which links them to this site in search. `jobTitle` and `locale` (`inLanguage`, `og:locale`) also come from `site-data.js` |

**Preview images.** Every indexable page has a 1200×630 JPEG at `src/images/og/<page path>.jpg` (`/` → `index.jpg`, `/posts/` → `posts.jpg`, `/posts/coin-flip/` → `posts/coin-flip.jpg`). Pages without one (404, `example/`) fall back to the homepage's, with alt text that says so. They're screenshots of each page's signature element, taken by `npm run og-images` from the front matter recipe:

| Key | Default | Purpose |
|---|---|---|
| `selector` | required | The element to capture |
| `alt` | `Screenshot of <title>` | `og:image:alt` / `twitter:image:alt`. Tests require it on indexable pages |
| `fit` | `cover` | `cover` crops to fill 1200×630; `contain` letterboxes in the color most of the capture's corners share, so the bars continue the surrounding card or page |
| `position` | `centre` | Crop anchor for `cover` (`top`, `left`, …) |
| `padding` | `0` | CSS px of surrounding page to include |
| `width` / `height` | `1200` / `900` | Viewport. The capture is clipped to it, never full-page: resizing the viewport fires `resize`, which resets the canvas experiments. A narrower width enlarges text-heavy pages |
| `scale` | `2` | Device pixel ratio; raise it for tiny elements |
| `hideFixed` | `true` | Hide fixed and sticky elements outside the element, such as the site header |
| `wait` | `1500` | ms for animations to run before the capture |
| `actions` | `[]` | Run in order first: `click` (selector, or `[selector, x, y]` as fractions of its box), `fill`, `press`, `select`, `hover`, `drag` (`[selector, [[x, y], …]]`), `scroll` (window y, or a selector to bring to the top), `wait` |

Captures are source images, not build output: animations and randomness make each run differ, so only regenerate the pages you mean to (`npm run og-images -- /posts/coin-flip/`). Review the contact sheets in `screenshots/og-images/`, build to create the AVIFs, and commit `src/images/og/` with `src/images/avif-manifest.json`. `test/seo.test.mjs` fails when an indexable page lacks a recipe, alt text, a correctly sized image or a short enough description.

### Scaffolding New Pages

```bash
npm run scaffold -- --path=/posts/my-new-post
```

Creates three files: the EJS template, SCSS stylesheet, and JS entry with boilerplate.

### EJS Helper Functions

Available in all templates via `build/helpers/ejs-functions.js`:

| Helper | Description |
|---|---|
| `partial(name, data)` | Include an EJS partial from `src/partials/` |
| `img({ src, alt, classes, width, height })` | `<img>` tag with auto-dimensions from image-size |
| `lazyImage({ src, alt, classes })` | Lazy-loaded image with inline SVG placeholder |
| `lazyVideo({ srcs, placeholders, attributes })` | Lazy-loaded responsive video with aspect-ratio box |
| `code(block, { language })` | Syntax-highlighted `<pre><code>` block (highlight.js) |
| `link(str, locals)` | `<a>` tag with automatic external/rel handling |
| `inlineLink(str, { href })` | Inline anchor (`.inline-link`) |
| `blockLink(str, { href })` | Block nav link with `>` arrow (`.block-link`) |
| `cardLink(str, { href })` | Card-style link (`.card-link`) |
| `buttonLink(str, { href })` | Button-style link (`.button`) |
| `formattedDate(dateString)` | Formats as `YYYY-MM-DD` in UTC (front-matter dates parse as UTC midnight) |
| `getChildPages(parentPath)` | Returns direct children from `pageMappingData` |
| `defaultLastFMModule(albums)` | Last.fm loading placeholder markup |
| `inlineScss(src)` | Compiles SCSS file to CSS string for inline `<style>` use |
| `seo(locals)` | Resolves a page's title, description, canonical URL, OG/Twitter values, preview image and JSON-LD (`build/helpers/seo.js`) |
| `getFileContents(src)` | Returns file as string; SVGs are run through svgo first |
| `dasherize(str)` | `fooBar` → `foo-bar` |
| `camelize(str)` | `foo-bar` → `fooBar` |

**Build-time values** come from `siteData` and are available in every template:

- `buildDateTime`: ISO build time. Use it instead of `new Date()`.
- `buildRandom()`: returns a generator. Use it instead of `Math.random()`, and call it once per page.

Golden builds pin both (see Build Modes). A test fails if a template calls `Math.random` at build time.

**Important:** `img()`, `lazyImage()`, and `lazyVideo()` read from the **output** directory (`dir.package`) not the source. This is why `bundleEJS` cannot start until both `imagesMoved` and `videosMoved` flags are true.

### TypeScript Conventions

- All Node scripts, build modules, browser scripts (`src/ts/`), scaffolds, and tests (`test/*.test.mts`) are strict TypeScript (`erasableSyntaxOnly: true` for Node 26 native type stripping — no `enum`, `namespace`, or constructor parameter properties)
- CommonJS modules (`require`/`module.exports`) with `import type` for type-only imports and explicit `.ts` extensions on relative requires (e.g., `require('../_modules/document-ready.ts')`)
- Underscore-prefixed directories (`_modules/`, `_components/`) are shared/private — not entry points
- Entry scripts (no underscore) in `src/ts/` or `src/ts/posts/` map to page `scripts` front matter and compile to `package/scripts/**/*.js`
- `document-ready` module wraps DOM-ready callbacks: `require('../_modules/document-ready.ts').document(() => { ... })`
- Legacy JS branch merges: `.githooks/post-merge` automatically runs `node bin/convert-js-to-ts.ts` (`npm run convert-js`) to relocate `src/js/` -> `src/ts/`, rename `.js`/`.mjs` -> `.ts`/`.mts`, and rewrite relative specifiers; tighten strict types afterward and run `npm run typecheck`

### SCSS Conventions

- Use `@use "system/utilities" as *` at the top of every SCSS file (migrated from `@import` in March 2026)
- Design system variables in `src/styles/system/variables/` (colors, fonts, viewports, spacing, grid)
- Mixins in `src/styles/system/mixins/` (media queries, typography, elements, grid, colors)
- Page classes in front matter scope styles (e.g., `.posts.last-fm { ... }`)
- Use `sass:color`, `sass:map`, `sass:math`, `sass:string` modules for built-in functions

---

## Build System Deep Dive

### Running the Build (Node Version Required)

**Always activate Node 26 before running any build command:**
```bash
source ~/.nvm/nvm.sh && nvm use v26.13.1
```

Chokidar v6, jsdom v31, node-notifier v12, and other packages require a modern Node runtime (pinned to Node 26.13.1 in `.nvmrc`). Running under older Node versions fails with engine or ESM errors.

### Build Modes

| Mode | Command | Output dir | Minify | Hash | Gzip | Watchers |
|---|---|---|---|---|---|---|
| Dev | `npm start` | `package/` | No | No | No | Yes (chokidar + live reload) |
| Production | `npm run build` | `package/` | Yes | Yes | Yes | No |
| Golden | `npm run build:golden` | `golden/` | Yes | No | No | No |

The golden build is used for visual regression tests — it produces realistic HTML without hashes or gzip so the output can be diff'd against a reference snapshot.

Golden output is reproducible. `index.js` exports the values in `build/constants/golden-build.js` as environment variables:

- `BUILD_DATETIME`: build time, copyright year, sitemap fallback dates, `build.txt`
- `COMMIT_HASH`: the `build-id` meta tag and `build.txt`
- `BUILD_RANDOM_SEED`: seeds `buildRandom()`

Dates are formatted in UTC, so two golden builds at different times or in different timezones produce identical HTML. AVIFs are copied from `src/images/` (see Image Processing Pipeline), so they're identical on every machine. Only page changes show up in the `golden/` diff.

### The `configs` Object

All build modules share a single `configs` object passed by reference from `index.js`. This is the central nervous system of the pipeline:

```js
const configs = {
  BUILD_EVENTS,        // { assetHashCssListed, imagesMoved, ... } — event name constants
  buildEvents,         // Node.js EventEmitter instance — the pipeline message bus
  completionFlags,     // Shared mutable booleans tracking which stages have finished
  debug,               // true if --verbose flag passed
  dir,                 // { root, src, package, build, nodeModules } — all absolute paths
  hashingFileNameList, // {} — populated during hashing: originalPath → hashedPath
  pageMappingData,     // [] — populated by compilePageMappingData: [{ url, data }]
  isGoldenBuild,       // true if --golden flag passed
};
```

Because it's passed by reference, mutations to `completionFlags`, `hashingFileNameList`, and `pageMappingData` are visible to every module without any import coupling.

### Completion Flags

`build/constants/completion-flags.js` defines the shared state object:

```js
{
  JS_IS_MINIFIED: false,
  CSS_IS_MINIFIED: false,
  HTML_IS_MINIFIED: false,
  IMAGES_ARE_MOVED: false,
  VIDEOS_ARE_MOVED: false,
  ASSET_HASH: {
    IMAGES: false,   // images + videos renamed with hashes
    CSS: false,      // CSS files renamed with hashes
    JS: false,       // JS files renamed with hashes
    DONE: false,     // HTML + JSON rewritten to use hashed filenames
  },
  SITE_MAP: false,
  GZIP: false,
  PREVIEW_READY: false,  // dev only — not checked by checkDone
}
```

`check-done.js` checks all flags except `PREVIEW_READY`. The golden builder pre-sets `ASSET_HASH.*` and `GZIP` to `true` so those stages are skipped without modifying `checkDone`.

### Complete Production Event Flow

```
index.js: clean() resolves
  ├── compilePageMappingData()       → emits: pageMappingDataCompiled
  │     ├── compileSitemap()         → emits: sitemapDone → checkDone
  │     └── shouldBundleEjs() [gate: waits for imagesMoved + videosMoved]
  ├── bundleJS()                     → emits: jsMoved
  │     └── (prod) minifyJS()        → sets JS_IS_MINIFIED → emits: jsMinified
  │           └── assetHashing() [gate: all 5 prereq flags must be true]
  ├── bundleSCSS()                   → sets CSS_IS_MINIFIED → emits: stylesMoved
  │     └── assetHashing() [gate]
  └── moveAssets()
        ├── moveAllImages()          → sets IMAGES_ARE_MOVED → emits: imagesMoved
        │     ├── shouldBundleEjs() [gate]
        │     └── assetHashing() [gate]
        └── moveAllVideos()          → sets VIDEOS_ARE_MOVED → emits: videosMoved
              └── shouldBundleEjs() [gate: both flags now true → bundleEJS()]

bundleEJS()                          → emits: templatesMoved
  └── (prod) minifyHTML()            → sets HTML_IS_MINIFIED → emits: htmlMinified
        └── assetHashing() [gate: all 5 now true → runs]
              ├── hash JS files      → sets ASSET_HASH.JS → emits: assetHashJsListed
              │     └── finishHashing() [gate: all 3 hash flags]
              └── hash image files   → sets ASSET_HASH.IMAGES → emits: assetHashImagesListed
                    ├── updateCSSwithImageHashes() → emits: indexCssForHashing
                    │     └── hashCSS()            → sets ASSET_HASH.CSS → emits: assetHashCssListed
                    │           └── finishHashing() [gate: all 3 now true → runs]
                    │                 → sets ASSET_HASH.DONE → emits: hashingDone
                    │                       ├── checkDone()
                    │                       └── gzipFiles() → sets GZIP → emits: gzipDone
                    │                             └── checkDone() [all flags true → exit()]
                    └── finishHashing() [gate: already run above, exits early]
```

### Asset Hashing Pipeline (Two-Pass CSS)

CSS files reference images via `url()`. If CSS were hashed before images, the CSS hash would be based on the pre-updated content and the final HTML rewrite would produce mismatched references. The order is enforced:

1. **Hash images and JS** simultaneously (`assetHashing`)
2. **Update CSS `url()` references** with the new image hashes (`updateCSSwithImageHashes`)
3. **Hash CSS** (now its content reflects the hashed image paths) (`hashCSS`)
4. **Rewrite HTML + JSON** with all three sets of hashes (`finishHashing`)

### EJS Template Rendering (Two-Pass)

`bundle-ejs.js` renders each template in two passes:

**Pass 1:** The template's content (YAML front matter stripped by gray-matter) is rendered with `ejs.render()`. Template data = `ejsFunctions + siteData + frontMatter.data + { path: pagePath }`.

**Pass 2:** The rendered content is injected as `{{ content }}` into the layout file (e.g. `src/layout/base.ejs`) and that combined string is rendered again.

**Recursive detection:** If the output of pass 2 contains YAML front matter (detected by `matter.test()`), the process repeats — this supports layouts that extend other layouts.

**Error handling:** In dev mode, template errors produce an in-browser red error page (via `handleTemplateError`) and a desktop notification, rather than crashing the server.

### Image Processing Pipeline

`move-assets.js` dispatches based on file extension:

| Extension | Processing |
|---|---|
| `.svg` | Passed through svgo `preset-default` before writing to output |
| `.jpg`, `.jpeg`, `.png` | Copied as-is, converted to a sibling `.webp`, and given its committed `.avif` (below) |
| `.webp` | Copied as-is; when it's the only source format, also given its committed `.avif` |
| Generated `.avif` in `src/images/` | Skipped by the glob; its source copies it |
| `favicon_base.png` | Also generates `favicon.ico` via png-to-ico |

**AVIFs are committed source, not build output.** AVIF encoders produce different bytes on macOS and Linux. So `convert-to-avif.js` encodes each image once, writes the result next to the source in `src/images/`, and every build copies that file.

`src/images/avif-manifest.json` records each generated AVIF's source and a fingerprint (source bytes plus encoder settings). A missing AVIF, a changed source or changed settings triggers a re-encode into `src/`; commit the result. Deleting a source in watch mode deletes its generated AVIF too. PR validation (`build-validation.yml`) fails if the build changes anything in `src/images/`; that's the guard against an uncommitted AVIF. `test/avif-sources.test.mjs` covers the cache logic and flags missing, stale or orphaned AVIFs.

**Note:** `{ nodir: true }` is required on the downloads glob — glob v13's `**` pattern matches the base directory itself.

### Dev Server Details

`index.js` sets up an Express server (port 3000) in dev mode with:

- **`/livereload`** — Server-Sent Events (SSE) endpoint. Browser tabs connect and wait for `data: reload\n\n` messages. After `previewReady`, a chokidar watcher on `dir.package` sends reload events on every file change.
- **Proxy routes** — `/last-fm-history`, `/band-news`, `/data`, `/movies` are proxied to the staging S3 bucket so external data is available locally without downloading.
- **Static serving** — `express-static` serves `dir.package` for all other paths.

The live-reload script in HTML pages opens a persistent `EventSource('/livereload')` connection and calls `location.reload()` on each message.

### File Watcher Behavior (Dev Mode)

`preview-builder.js` runs three chokidar watchers:

| Watcher | Target | On change |
|---|---|---|
| `buildDirWatcher` | `build/` directory | `process.exit()` — forces manual restart |
| `indexWatcher` | `index.ts` | `process.exit()` — forces manual restart |
| `sourceWatcher` | `src/` directory | Incremental rebuild of changed asset type only |

Source file changes dispatch by path:
- `src/ts/**` → `bundleJS(configs, filePath)` (handles `.ts`, `.tsx`, and co-located `.scss`)
- `src/styles/**` → `bundleSCSS` + `compilePageMappingData` (both, because inlined SCSS may change)
- `src/templates/**`, `src/partials/**`, `src/layout/**` → `compilePageMappingData`
- `src/images/**` → `moveOneImage`
- `src/videos/**` → `moveOneVideo`
- `src/downloads/**` → `moveOneDownload`
- `src/data/**` or `.txt` → `moveOneTxtFile`

### How to Extend the Build

#### Adding a new image/video format
1. Add the extension to `build/constants/file-formats.js` in the `images` or `videos` array.
2. Raster image sources automatically receive `.webp` and `.avif` siblings during preview and production builds. New AVIFs land in `src/images/`; commit them.

#### Adding a new static asset type (e.g. fonts)
1. Add a `moveAllFonts` / `moveOneFont` pair to `move-assets.js` following the same pattern as `moveAllVideos`.
2. Call `moveAllFonts(configs)` from the `moveAssets` export.
3. If downstream stages need to wait for it: add a `FONTS_ARE_MOVED` completion flag, a `fontsMoved` build event, and update `checkDone` to include the new flag.

#### Adding a new build stage (e.g. a new optimizer)
1. Write the module in `build/optimize/` — accept `configs`, reset a completion flag, do work, set flag, emit an event.
2. Add the new event name to `build/constants/build-events.js`.
3. Add the new flag to `build/constants/completion-flags.js`.
4. Wire the listener in `build/prod-builder.js` (and `golden-builder.js` if applicable).
5. Update `checkDone.js` to include the new flag in `flagsToCheck`.

#### Adding a new EJS helper function
1. Add the function to the object returned by `build/helpers/ejs-functions.js`.
2. It's immediately available in all templates — no other changes needed.
3. Add JSDoc with `@param` / `@returns`.

### Key Packages and Their Roles

| Package | Role | Version note |
|---|---|---|
| `browserify` | JS bundler — resolves `require()` for browsers | — |
| `babel-transform.js` | Custom Browserify transform using `@babel/core` v8 | Presets: preset-env (`targets: { ie: '11' }` for Acorn 7 compat) + preset-react |
| `watchify` | Incremental rebuild plugin for Browserify | Dev mode only |
| `sass` | Dart Sass compiler | Uses `compileAsync()` with `loadPaths` |
| `clean-css` | CSS minifier | Production only |
| `ejs` | Template engine | v7 — dual CJS/ESM |
| `gray-matter` | YAML front matter parser | — |
| `glob` | File globbing | v14 — use `const { globSync } = require('glob')` |
| `xxhash` | Fast content hashing for asset filenames | Native addon, compiles via node-gyp |
| `html-minifier-terser` | HTML minification | v7 — `minify()` is async (returns Promise) |
| `uglify-js` | JS minification | — |
| `svgo` | SVG optimization | v4 — use `preset-default` only, no overrides |
| `sharp` | PNG/JPG/WebP → WebP/AVIF conversion | AVIF output uses quality 80 |
| `image-size` | Read image dimensions at template render time | v2 — `sizeOf(fs.readFileSync(path))` |
| `png-to-ico` | favicon.ico generation | v3 ESM — call `pngToIco.default(path)` |
| `chokidar` | File system watcher | v6 ESM-compat — `require('chokidar').watch()` works |
| `express` | Dev server | v5 |
| `http-proxy-middleware` | Proxy to staging S3 in dev | v4 |
| `merge` | Deep merge for EJS template data | — |
| `colors` | ANSI colors in build log output | — |

---

## npm Scripts

| Script | Description |
|---|---|
| `npm start` | Dev server at localhost:3000 with file watching and proxy to staging for external data |
| `npm run build` | Production build to `/package` |
| `npm run build:golden` | Golden build (no gzip/hash) to `/golden` for visual diff |
| `npm run deploy` | Deploy production build to S3 |
| `npm run stage` | Deploy staging build to S3 |
| `npm test` | Run tests (requires Node 26 — use nvm first) |
| `npm run typecheck` | Run strict `tsc --noEmit` on `tsconfig.json` and `tsconfig.browser.json` |
| `npm run convert-js` | Convert any legacy `.js`/`.mjs` files (e.g. from older branches) to `.ts`/`.mts` under `src/ts/` |
| `npm run lint` | ESLint on TypeScript sources across root, `build/`, `src/ts/`, `bin/`, `scaffold/` (check only; `lint:src` / `lint:build` auto-fix) |
| `npm run preview:production` | Serve the production build locally |
| `npm run scaffold -- --path=/path` | Create new page boilerplate |
| `npm run screenshot -- /path/ ...` | Contact-sheet screenshots of the built site at 360/600/768/960/1024/1440px, plus a viewport-edge layout check that exits 2 on a flag (see AGENTS.md §1) |
| `npm run og-images -- /path/ ...` | Capture social preview images from the production build into `src/images/og/` (see SEO and Social Previews). No paths: every page |
| `npm run visual-diff` | Run visual regression tests (Brian's machine only) |

### Deployment

Branch flow: feature branch (from `staging`) → PR into `staging` → `staging` promoted to `main`. `sync-staging.yml` merges `main` back into `staging` after every push to `main`.

- **Production**: Push to `main` branch triggers GitHub Actions → builds → deploys to `www.briananders.com` S3 bucket → invalidates CloudFront cache → creates a deploy tag
- **Staging**: Push to `staging` branch triggers GitHub Actions → builds → deploys to `staging.briananders.com` S3 bucket
- **PR validation**: All PRs run build + tests, and fail if the build changed `src/images/` (an uncommitted AVIF)
- **`@claude` in GitHub**: `claude.yml` installs dependencies and Chromium, lets Claude run build, test, lint and screenshot, and uploads `screenshots/` as a workflow artifact
- The `s3-upload-allowlist.json` preserves `/band-news/`, `/last-fm-history/`, `/data/`, and `/movies/` paths during deploy

---

## Content Types Produced

1. **Interactive experiments** — Canvas animations (lissajous curves, cellular automata, moire patterns, polar clock), browser games (minesweeper, yahtzee, coin flip), audio visualizations (polyrhythm, sound frequency slider)
2. **Developer tools** — Wordle solver, Wordscapes solver, browser diagnostics
3. **Music features** — Last.fm listening dashboards (recent windows + full history, with artist/album drill-downs), music news aggregation from followed bands
4. **CSS/HTML demos** — Layout examples, animation techniques, design system documentation
5. **Personal content** — Drum cover videos (Banders Drums YouTube channel), podcast links (Bat Lessons), about/contributions page
6. **Developer notes** — Git tips, aliases, configuration guides

## Social & External Links

| Platform | Handle/URL |
|---|---|
| GitHub | [briananders](https://github.com/briananders) |
| Last.fm | [imbanders](https://www.last.fm/user/imbanders) |
| YouTube (drums) | [@bandersdrums](https://www.youtube.com/@bandersdrums) |
| Bat Lessons | [batlessons.com](https://batlessons.com) / [@batlessons](https://www.youtube.com/@batlessons) |
| Bluesky | [imbanders.bsky.social](https://bsky.app/profile/imbanders.bsky.social) |
| Mastodon | [@banders@mastodon.social](https://mastodon.social/@banders) |
| LinkedIn | [andersbrian](https://www.linkedin.com/in/andersbrian/) |
| Instagram | [imbanders](https://instagram.com/imbanders) |
