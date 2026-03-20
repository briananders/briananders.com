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

### Last.fm API Integration

The site also calls the **Last.fm API** directly from the browser for the real-time scrobbles page:
- API endpoint: `https://ws.audioscrobbler.com/2.0/`
- User: `imbanders`
- Configuration: `src/js/_modules/last-fm/config.js`

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ (see `.nvmrc`) |
| Templates | EJS with gray-matter YAML front matter |
| Styles | SCSS (node-sass), minified with CleanCSS |
| JavaScript | CommonJS modules bundled with Browserify + Babel (preset-env, preset-react) |
| Hosting | AWS S3 + CloudFront |
| Deployment | Custom `s3-uploader.js` using AWS SDK for JavaScript v3 (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `@aws-sdk/client-cloudfront`) |
| Dev server | Express with express-static and http-proxy-middleware |
| Linting | ESLint (airbnb-base config) |
| Build optimization | HTML minification (html-minifier), JS minification (uglify-js), SVG optimization (svgo), WebP conversion, gzip compression, asset hashing |
| Analytics | Google Tag Manager (production only) |

## Project Structure

```
├── index.js                    # Main entry: build pipeline + dev server
├── s3-uploader.js              # AWS S3 deploy script
├── s3-upload-allowlist.json    # S3 paths preserved during deploy
├── scaffold.js                 # New page scaffolding tool
├── preview-production.js       # Serve production build locally
├── package.json
├── .nvmrc                      # Node 18.12.1
├── .eslintrc.json              # Airbnb-base ESLint config
│
├── build/                      # Build pipeline
│   ├── bundlers/               # EJS, JS, SCSS bundlers + sitemap generator
│   ├── constants/              # Directories, site data, file formats, build events
│   ├── helpers/                # Clean, production flag, timestamp, EJS functions
│   ├── hashing/                # CSS and image asset hashing
│   ├── optimize/               # HTML/JS minification, WebP, gzip, SVG optimization
│   ├── move-assets.js          # Copy images, videos, JSON, txt, downloads
│   ├── page-mapping-data.js    # Compile front matter from all templates
│   ├── prod-builder.js         # Production build orchestration
│   ├── preview-builder.js      # Dev mode with file watching
│   └── golden-builder.js       # Golden build (no gzip/hash, for visual diff)
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
│   │   ├── modules/            # Shared module styles
│   │   └── posts/              # Per-post styles
│   ├── js/                     # JavaScript source
│   │   ├── _modules/           # Shared modules (lazy-loader, analytics, dark-mode, etc.)
│   │   ├── _components/        # Reusable components (album-listing, year-listing, etc.)
│   │   └── posts/              # Per-post entry scripts
│   ├── images/                 # Source images (gitignored from cursor)
│   ├── videos/                 # Source videos (gitignored from cursor)
│   ├── data/                   # Static JSON data files (gitignored from cursor)
│   ├── downloads/              # Downloadable files
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

- `partial(name, data)` — Include an EJS partial from `src/partials/`
- `img({ src, alt, classes, width, height })` — Responsive image tag with auto-dimensions
- `lazyImage({ src, alt, classes })` — Lazy-loaded image with placeholder SVG
- `lazyVideo({ srcs, placeholders, attributes })` — Lazy-loaded responsive video
- `code(block, { language })` — Syntax-highlighted code block (highlight.js)
- `inlineLink(text, { href })` — Inline anchor link
- `blockLink(text, { href })` — Block-style navigation link
- `cardLink(text, { href })` — Card-style link
- `buttonLink(text, { href })` — Button-style link
- `noWidows(str)` — Prevents widowed words in headings
- `formattedDate(dateString)` — Formats dates as YYYY-MM-DD
- `getChildPages(parentPath)` — Gets child pages for navigation
- `defaultLastFMModule(albums)` — Last.fm loading placeholder markup
- `inlineScss(src)` — Compiles SCSS inline into templates
- `getFileContents(src)` — Reads file contents (primarily for inline SVGs)

### JavaScript Conventions

- CommonJS modules (`require`/`module.exports`), bundled by Browserify
- Underscore-prefixed directories (`_modules/`, `_components/`) are shared/private — not entry points
- Entry scripts (no underscore) in `src/js/` or `src/js/posts/` map to page `scripts` front matter
- `document-ready` module wraps DOM-ready callbacks: `require('../_modules/document-ready').document(() => { ... })`

### SCSS Conventions

- Import `system/utilities` at the top of every SCSS file for access to variables, mixins, and functions
- Design system variables in `src/styles/system/variables/` (colors, fonts, viewports, spacing, grid)
- Mixins in `src/styles/system/mixins/` (media queries, typography, elements, grid, colors)
- Page classes in front matter scope styles (e.g., `.posts.last-fm { ... }`)

### Build Pipeline

The build is event-driven using Node.js EventEmitter:

1. Clean output directory
2. Generate `build.txt` and compile page mapping data (front matter index)
3. Bundle JS (Browserify) and SCSS (node-sass) in parallel
4. Move assets (images, videos, JSON, downloads, txt files)
5. Bundle EJS templates (waits for images and videos to be moved)
6. Generate sitemap
7. Production only: minify HTML/JS, optimize SVGs, convert to WebP, hash assets, gzip

### Deployment

- **Production**: Push to `main` branch triggers GitHub Actions → builds → deploys to `www.briananders.com` S3 bucket → invalidates CloudFront cache → creates a deploy tag
- **Staging**: Push to `staging` branch triggers GitHub Actions → builds → deploys to `staging.briananders.com` S3 bucket
- **PR validation**: All PRs run build + tests
- The `s3-upload-allowlist.json` preserves `/band-news/`, `/last-fm-history/`, and `/data/` paths during deploy

## npm Scripts

| Script | Description |
|---|---|
| `npm start` | Dev server at localhost:3000 with file watching and proxy to staging for external data |
| `npm run build` | Production build to `/package` |
| `npm run build:golden` | Golden build (no gzip/hash) to `/golden` for visual diff |
| `npm run deploy` | Deploy production build to S3 |
| `npm run stage` | Deploy staging build to S3 |
| `npm test` | Run tests |
| `npm run preview:production` | Serve the production build locally |
| `npm run scaffold -- --path=/path` | Create new page boilerplate |
| `npm run visual-diff` | Run visual regression tests |

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
