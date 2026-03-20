# Claude Context — briananders.com

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
| [briananders/briananders.com-visual-diffs](https://github.com/briananders/briananders.com-visual-diffs) | Visual regression testing (git submodule at `visual-diffs/`) |
| [briananders/sublime-text-dublicate](https://github.com/briananders/sublime-text-dublicate) | VSCode extension: Sublime Duplicate Text |
| [briananders/pageweight](https://github.com/briananders/pageweight) | NPM CLI tool for measuring webpage weight |
| [briananders/two-way-merge](https://github.com/briananders/two-way-merge) | NPM CLI tool for two-way directory sync |

### External Data Sources (hosted on S3, managed outside this repo)

These paths are **preserved during deploys** via `s3-upload-allowlist.json` and are **not built from this repo**. In local dev, they are proxied from the staging S3 bucket.

| S3 Path | Description | Consumer |
|---|---|---|
| `/last-fm-history/` | Pre-processed Last.fm scrobble data (JSON files + images) for the Music Listening History page | `src/js/posts/last-fm-scrobbles.js` |
| `/band-news/` | Aggregated music news articles matching followed bands (`articles.json`) | `src/js/posts/music-news.js` |
| `/data/` | Static JSON datasets (word lists for Wordle/Wordscapes solvers) | Various post scripts |
| `/movies/` | Movie/IMDb ratings data | `src/js/posts/imdb-ratings.js` |

### Last.fm API Integration

The site also calls the **Last.fm API** directly from the browser for the real-time scrobbles page:
- API endpoint: `https://ws.audioscrobbler.com/2.0/`
- User: `imbanders`
- Configuration: `src/js/_modules/last-fm/config.js`

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22.21.0 (see `.nvmrc`) — **must use nvm** |
| Templates | EJS with gray-matter YAML front matter |
| Styles | SCSS (Dart Sass via `sass` package), minified with CleanCSS |
| JavaScript | CommonJS modules bundled with Browserify + Babel (preset-env, preset-react) |
| Hosting | AWS S3 + CloudFront |
| Deployment | Custom `s3-uploader.js` using AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `@aws-sdk/client-cloudfront`) |
| Dev server | Express with express-static and http-proxy-middleware |
| Linting | ESLint 8 (airbnb-base config — pinned to v8, airbnb does not support ESLint 9/10) |
| Build optimization | HTML minification (html-minifier-terser), JS minification (uglify-js), SVG optimization (svgo), WebP conversion (webp-converter), gzip compression, content-hash asset naming (xxhash) |
| Analytics | Google Tag Manager (production only) |

## Project Structure

```
├── index.js                    # Main entry: build pipeline + dev server
├── s3-uploader.js              # AWS S3 deploy script
├── s3-upload-allowlist.json    # S3 paths preserved during deploy
├── scaffold.js                 # New page scaffolding tool
├── preview-production.js       # Serve production build locally
├── package.json
├── .nvmrc                      # Node 22.21.0
├── .eslintrc.json              # Airbnb-base ESLint config
│
├── build/                      # Build pipeline (all files have full JSDoc as of March 2026)
│   ├── bundlers/
│   │   ├── bundle-ejs.js       # EJS → HTML renderer (two-pass: template then layout)
│   │   ├── bundle-js.js        # Browserify + Babelify bundler; watchify in dev
│   │   ├── bundle-scss.js      # Dart Sass compiler + CleanCSS minifier
│   │   └── sitemap.js          # Renders sitemap.json.ejs + sitemap.xml.ejs
│   ├── constants/
│   │   ├── build-events.js     # String constants for all EventEmitter event names
│   │   ├── completion-flags.js # Shared mutable booleans tracking stage completion
│   │   ├── directories.js      # Path factory (package/ vs golden/ depending on mode)
│   │   ├── file-formats.js     # Image/video extension lists, webpCandidates
│   │   └── site-data.js        # Author metadata, social links, domain, commitHash
│   ├── helpers/
│   │   ├── check-done.js       # Gate: exits process when all completion flags are true
│   │   ├── clean.js            # Empties the output directory (returns Promise)
│   │   ├── ejs-functions.js    # 15 template helper functions available in all EJS templates
│   │   ├── exit-message.js     # ASCII-art success banner printed on build completion
│   │   ├── generate-build-txt.js # Writes build.txt (date + commit hash) to output dir
│   │   ├── production.js       # Boolean: NODE_ENV === 'production'
│   │   └── timestamp.js        # Returns grey [HH:MM:SS] stamp for build log lines
│   ├── hashing/
│   │   ├── asset-hashing.js    # XXHash JS files + image/video files; emits two events
│   │   ├── finish-hashing.js   # Rewrites HTML+JSON to reference hashed filenames
│   │   ├── hash-css.js         # XXHash CSS files (runs after CSS is updated with image hashes)
│   │   └── update-css-with-image-hashes.js  # Rewrites CSS url() before CSS is hashed
│   ├── optimize/
│   │   ├── convert-to-webp.js  # webp-converter cwebp; skips non-candidates
│   │   ├── gzip-files.js       # zlib gzip on html/xml/css/js/txt/json
│   │   ├── minify-html.js      # html-minifier-terser (async minify())
│   │   ├── minify-js.js        # UglifyJS
│   │   └── optimize-svgs.js    # svgo preset-default; getSVG() for inline use
│   ├── move-assets.js          # Copies images (SVG→SVGO, raster→WebP+copy), videos, txt, downloads
│   ├── page-mapping-data.js    # Front-matter index compiled from all EJS templates
│   ├── prod-builder.js         # Production event listener wiring
│   ├── preview-builder.js      # Dev mode: chokidar watchers + previewReady gate
│   └── golden-builder.js       # Golden build: minify only, hashing/gzip flags pre-set
│
├── src/
│   ├── templates/              # EJS page templates (one per output page)
│   │   ├── index.html.ejs      # Homepage
│   │   ├── about.ejs           # About page
│   │   ├── drums.ejs           # Banders Drums page
│   │   ├── 404.html.ejs        # 404 page
│   │   ├── posts/              # Blog-style posts and experiments
│   │   └── example/            # Example/demo pages
│   ├── partials/               # Reusable EJS partials (header, footer, nav, etc.)
│   ├── layout/                 # Layout templates (base.ejs, blank.ejs, empty.ejs)
│   ├── styles/                 # SCSS source
│   │   ├── system/             # Design system (variables, mixins, functions)
│   │   │   ├── _utilities.scss # @forward aggregator — import this in all consumer files
│   │   │   ├── variables/      # Colors, fonts, viewports, spacing, grid (all.scss aggregates)
│   │   │   ├── mixins/         # Media queries, typography, elements, grid, colors (all.scss aggregates)
│   │   │   └── functions/      # Sass utility functions (all.scss aggregates)
│   │   ├── modules/            # Shared module styles
│   │   └── posts/              # Per-post styles
│   ├── js/                     # JavaScript source
│   │   ├── _modules/           # Shared modules (lazy-loader, analytics, dark-mode, etc.)
│   │   ├── _components/        # Reusable components (album-listing, year-listing, etc.)
│   │   └── posts/              # Per-post entry scripts
│   ├── images/                 # Source images
│   ├── videos/                 # Source videos
│   ├── data/                   # Static JSON data files
│   ├── downloads/              # Downloadable files
│   ├── sitemap.json.ejs        # Sitemap template (receives pageMappingData + siteData)
│   ├── sitemap.xml.ejs         # Sitemap XML template
│   ├── robots.txt
│   └── humans.txt
│
├── .github/workflows/          # CI/CD
│   ├── deploy-production.yml   # Push to main → build → deploy → tag
│   ├── deploy-staging.yml      # Push to staging → build → deploy
│   ├── build-validation.yml    # PRs → build + test
│   ├── claude-code-review.yml  # AI-powered PR reviews
│   └── claude.yml              # Claude workflow
│
├── test/                       # Tests (build.test.mjs, golden.test.mjs)
├── scaffold/                   # Templates for `npm run scaffold`
└── visual-diffs/               # Git submodule for visual regression
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
| `noWidows(str)` | Replaces last space with `&nbsp;`; `__` → ` ` |
| `formattedDate(dateString)` | Formats as `YYYY-MM-DD` |
| `getChildPages(parentPath)` | Returns direct children from `pageMappingData` |
| `defaultLastFMModule(albums)` | Last.fm loading placeholder markup |
| `inlineScss(src)` | Compiles SCSS file to CSS string for inline `<style>` use |
| `getFileContents(src)` | Returns file as string; SVGs are run through svgo first |
| `dasherize(str)` | `fooBar` → `foo-bar` |
| `camelize(str)` | `foo-bar` → `fooBar` |

**Important:** `img()`, `lazyImage()`, and `lazyVideo()` read from the **output** directory (`dir.package`) not the source. This is why `bundleEJS` cannot start until both `imagesMoved` and `videosMoved` flags are true.

### JavaScript Conventions

- CommonJS modules (`require`/`module.exports`), bundled by Browserify
- Underscore-prefixed directories (`_modules/`, `_components/`) are shared/private — not entry points
- Entry scripts (no underscore) in `src/js/` or `src/js/posts/` map to page `scripts` front matter
- `document-ready` module wraps DOM-ready callbacks: `require('../_modules/document-ready').document(() => { ... })`

### SCSS Conventions

- Use `@use "system/utilities" as *` at the top of every SCSS file (migrated from `@import` in March 2026)
- Design system variables in `src/styles/system/variables/` (colors, fonts, viewports, spacing, grid)
- Mixins in `src/styles/system/mixins/` (media queries, typography, elements, grid, colors)
- Page classes in front matter scope styles (e.g., `.posts.last-fm { ... }`)
- Use `sass:color`, `sass:map`, `sass:math`, `sass:string` modules for built-in functions

---

## Build System Deep Dive

### Running the Build (Node Version Required)

**Always activate Node 22 before running any build command:**
```bash
source ~/.nvm/nvm.sh && nvm use v22.21.0
```

Chokidar v5 and other packages require Node 22. Running under Node 18 will fail with `ERR_REQUIRE_ESM`.

### Build Modes

| Mode | Command | Output dir | Minify | Hash | Gzip | Watchers |
|---|---|---|---|---|---|---|
| Dev | `npm start` | `package/` | No | No | No | Yes (chokidar + live reload) |
| Production | `npm run build` | `package/` | Yes | Yes | Yes | No |
| Golden | `npm run build:golden` | `golden/` | Yes | No | No | No |

The golden build is used for visual regression tests — it produces realistic HTML without hashes or gzip so the output can be diff'd against a reference snapshot.

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
| `.jpg`, `.jpeg`, `.png` | Converted to a sibling `.webp` AND copied as-is (both formats kept) |
| `.webp` and others | Copied as-is |
| `favicon_base.png` | Also generates `favicon.ico` via png-to-ico |

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
| `indexWatcher` | `index.js` | `process.exit()` — forces manual restart |
| `sourceWatcher` | `src/` directory | Incremental rebuild of changed asset type only |

Source file changes dispatch by path:
- `src/js/**` → `bundleJS(configs)`
- `src/styles/**` → `bundleSCSS` + `compilePageMappingData` (both, because inlined SCSS may change)
- `src/templates/**`, `src/partials/**`, `src/layout/**` → `compilePageMappingData`
- `src/images/**` → `moveOneImage`
- `src/videos/**` → `moveOneVideo`
- `src/downloads/**` → `moveOneDownload`
- `src/data/**` or `.txt` → `moveOneTxtFile`

### How to Extend the Build

#### Adding a new image/video format
1. Add the extension to `build/constants/file-formats.js` in the `images` or `videos` array.
2. If it should also produce a `.webp` sibling, add it to `webpCandidates` too.

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
| `babelify` | Babel transform for Browserify | Presets: preset-env + preset-react |
| `watchify` | Incremental rebuild plugin for Browserify | Dev mode only |
| `sass` | Dart Sass compiler | Uses `compileAsync()` with `loadPaths` |
| `clean-css` | CSS minifier | Production only |
| `ejs` | Template engine | v5 — CJS compat |
| `gray-matter` | YAML front matter parser | — |
| `glob` | File globbing | v13 — use `const { globSync } = require('glob')` |
| `xxhash` | Fast content hashing for asset filenames | Native addon, compiles via node-gyp |
| `html-minifier-terser` | HTML minification | v7 — `minify()` is async (returns Promise) |
| `uglify-js` | JS minification | — |
| `svgo` | SVG optimization | v4 — use `preset-default` only, no overrides |
| `webp-converter` | PNG/JPG → WebP conversion | Wraps `cwebp` binary |
| `image-size` | Read image dimensions at template render time | v2 — `sizeOf(fs.readFileSync(path))` |
| `png-to-ico` | favicon.ico generation | v3 ESM — call `pngToIco.default(path)` |
| `chokidar` | File system watcher | v5 ESM-compat — `require('chokidar').watch()` works |
| `express` | Dev server | v5 |
| `http-proxy-middleware` | Proxy to staging S3 in dev | — |
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
| `npm test` | Run tests (requires Node 22 — use nvm first) |
| `npm run preview:production` | Serve the production build locally |
| `npm run scaffold -- --path=/path` | Create new page boilerplate |
| `npm run visual-diff` | Run visual regression tests |

### Deployment

- **Production**: Push to `main` branch triggers GitHub Actions → builds → deploys to `www.briananders.com` S3 bucket → invalidates CloudFront cache → creates a deploy tag
- **Staging**: Push to `staging` branch triggers GitHub Actions → builds → deploys to `staging.briananders.com` S3 bucket
- **PR validation**: All PRs run build + tests
- The `s3-upload-allowlist.json` preserves `/band-news/`, `/last-fm-history/`, `/data/`, and `/movies/` paths during deploy

---

## Content Types Produced

1. **Interactive experiments** — Canvas animations (lissajous curves, cellular automata, moire patterns, polar clock), browser games (minesweeper, yahtzee, coin flip), audio visualizations (polyrhythm, sound frequency slider)
2. **Developer tools** — Wordle solver, Wordscapes solver, browser diagnostics
3. **Music features** — Last.fm scrobble visualizations (real-time API + historical data), music listening history breakdowns, music news aggregation from followed bands
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
