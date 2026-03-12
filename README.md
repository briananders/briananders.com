# briananders.com
My personal website, built as a custom static site generator.

## Tech Stack
- **Templating**: EJS (Embedded JavaScript) for HTML generation
- **Styling**: Node-Sass for CSS pre-processing
- **Scripting**: Browserify + Babel for JS bundling and transpilation
- **Local Dev**: Express + http-proxy-middleware for local serving

## Project Structure
- `src/`: Core source files including JS, Sass styles, and EJS templates.
- `build/`: The custom Node.js build system tools (bundlers, asset movers, page mappings).
- `test/`: Node.js native test scripts (`build.test.mjs`, `golden.test.mjs`).
- `package/`: The output directory for the optimized production build.
- `golden/`: The output directory for the unoptimized golden build (skips gzip/hashing).

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
- `npm run lint:src` / `npm run lint:build`: Run ESLint on the source or build directories.
- `npm run visual-diff`: Runs the visual regression diffing script using Playwright/Puppeteer.

### Building
- `npm run build`: Build the site for production into the `/package` folder, including file compression and gzip.
- `npm run build:golden`: Build the site into the `/golden` folder without gzip compression and asset hashing.

### Testing
- `npm test`: Runs the Node.js native test runner suite on the build processes.

## Deploy the static site
My website uses AWS as the host, and the deploy uses `aws-sdk`. For this to work you need credentials saved as bash variables:
- `CLOUDFRONT_ID`
- `AWS_ACCESS_KEY`
- `AWS_SECRET_ACCESS_KEY`

**DO NOT SHARE YOUR CREDENTIALS WITH ANYONE.**
**DO NOT COMMIT THEM TO A PUBLIC REPO.**

- `npm run stage`: Deploys the site to the staging S3 bucket.
- `npm run deploy`: Deploys the site to the production S3 bucket.
