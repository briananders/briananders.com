# briananders.com
My personal website, built as a custom static site generator.

## Documentation
- **[AGENTS.md](AGENTS.md)** — rules for AI agents working in this repo
  (engineering directives, definition of done, screenshots and layout checks,
  design system, branch flow).
- **[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)** — full programmer reference for
  the dark-first, token-driven design system that ships with the site
  (tokens, mixins, class utilities, connective tissue, authoring guide).
- **[design-system.html](design-system.html)** — standalone visual reference
  at the repo root, or the in-site version at
  [`/posts/design-system/`](https://briananders.com/posts/design-system/).

## Tech Stack
- **Runtime**: Node.js 26.13.1 (native TypeScript execution via built-in type stripping)
- **Templating**: EJS (Embedded JavaScript) for HTML generation
- **Styling**: Dart Sass (`sass`) for CSS pre-processing
- **Scripting**: TypeScript (`src/ts/`), bundled with Browserify + Babel 8 (`@babel/preset-typescript`, `@babel/preset-env`, `@babel/preset-react`)
- **Linting & Types**: TypeScript 6 (`npm run typecheck`) + ESLint 10 flat config (`eslint.config.mjs`)
- **Local Dev**: Express + http-proxy-middleware for local serving

## Project Structure
- `src/`: Core source files including TypeScript (`src/ts/`), Sass styles (`src/styles/`), and EJS templates (`src/templates/`).
- `build/`: The custom Node.js TypeScript build system tools (bundlers, asset movers, page mappings).
- `test/`: Node.js native test runner suites (`test/*.test.mts`).
- `package/`: The output directory for the optimized production build.
- `golden/`: The output directory for the unoptimized golden build (skips gzip/hashing).
- `.githooks/`: Committed git hooks (activated automatically by `npm install`), including `post-merge` to auto-convert incoming legacy JavaScript from older branches into TypeScript.

## Installation steps
1. Install XCode command line tools: `xcode-select --install`
2. Install homebrew. (see: [brew.sh](https://brew.sh/))
3. Install homebrew dependencies: `brew bundle`
4. Install node: `nvm install`
5. Set node version: `nvm use`
6. Install npm packages: `npm install`

## Scripts

### Development
- `npm start`: Build and launch the dev site at [http://localhost:3000](http://localhost:3000). (Stop the server with `Ctrl+C`.)
- `npm run scaffold --path=/my-page`: Scaffolds boilerplate CSS, EJS, and JS files for a new page.
- Adding or changing an image in `src/images/`: any build writes its `.avif` next to it and updates `src/images/avif-manifest.json`. Commit both.
- `npm run typecheck`: Run strict TypeScript checking across Node (`tsconfig.json`) and browser (`tsconfig.browser.json`) code.
- `npm run convert-js`: Convert any legacy `.js`/`.mjs` files (for example after merging an older branch) into TypeScript under `src/ts/` and `.ts`/`.mts`. Also runs automatically via `.githooks/post-merge`.
- `npm run lint`: Run ESLint on TypeScript sources across root, `build/`, `src/ts/`, `bin/`, and `scaffold/` without fixing anything.
- `npm run lint:src` / `npm run lint:build`: Run ESLint with `--fix` on `src/ts/` or `build/`.
- `npm run screenshot -- /path/ ...`: Screenshot pages of the production build at 360, 600, 768, 960, 1024, and 1440px into contact sheets under `screenshots/<page>/`, and flag content cut off at the viewport edge (exits 2 if any). Run `npx playwright install chromium` once first.
- `npm run og-images -- /path/ ...`: Capture each page's social preview (`og:image`) from the production build. Every page's front matter names its signature element in an `ogImage` recipe; the capture is fitted to 1200×630 and written to `src/images/og/`. With no paths, captures every page. Build afterwards and commit the images, their AVIFs and `src/images/avif-manifest.json`.
- `npm run visual-diff`: Runs the visual regression diffing script using Playwright/Puppeteer.

### Building
- `npm run build`: Build the site for production into the `/package` folder, including file compression and gzip.
- `npm run build:golden`: Build the site into the `/golden` folder without gzip compression and asset hashing. Build time, commit hash, and build-time randomness are pinned, so regenerating only changes files whose pages changed.

### Testing
- `npm test`: Runs the Node.js native test runner suite on the build processes.

## Branches
Branch from `staging` and open PRs against `staging`. `staging` is promoted to `main`, which deploys production.

## Deploy the static site
My website uses AWS as the host, and the deploy uses the modular **AWS SDK for JavaScript v3** (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `@aws-sdk/client-cloudfront`). For this to work you need credentials saved as bash variables:
- `CLOUDFRONT_ID`
- `AWS_ACCESS_KEY`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (optional; defaults to `us-east-1` for S3—set this if your bucket lives in another region)

**DO NOT SHARE YOUR CREDENTIALS WITH ANYONE.**
**DO NOT COMMIT THEM TO A PUBLIC REPO.**

- `npm run stage`: Deploys the site to the staging S3 bucket.
- `npm run deploy`: Deploys the site to the production S3 bucket.
