# briananders.com
My personal site

## Installation steps
1. Install XCode command line tools: `xcode-select --install`
2. Install homebrew. (see: [brew.sh](https://brew.sh/))
3. Install homebrew dependencies: `brew bundle`
4. Install node: `nvm install`
5. Set node version: `nvm use`

## Build the static site
To build and launch the dev site at [localhost:3000](http://localhost:3000): `npm start`

(Stop the server with `Ctrl+C`.)

To build the site for production, compress and gzip files: `npm run build`

To build the site for golden (skips gzip compression and asset hashing): `npm run build:golden`

The site is built into the `/package` folder (production) or `/golden` folder (golden build).

## Deploy the static site
My website uses AWS as the host, and the deploy uses aws-cli. For this to work you need credentials saved as bash variables. `CLOUDFRONT_ID`, `AWS_ACCESS_KEY`, and `AWS_SECRET_ACCESS_KEY`. The deploy library uses these credentials for authentication.

DO NOT SHARE YOUR CREDENTIALS WITH ANYONE.

DO NOT COMMIT THEM TO A PUBLIC REPO.

To deploy to staging: `npm run stage`

To deploy to production: `npm run deploy`

## Testing

### Unit Tests
Run the existing unit tests: `npm test`

### Screenshot Testing
Compare the local build against the live website at https://briananders.net:

```bash
# Run all screenshot tests
npm run test:screenshots

# Generate comparison report
npm run test:screenshots:html
```

The screenshot tests will:
- Take screenshots of key pages from both local and live versions
- Compare visual differences across multiple viewports (desktop, tablet, mobile)
- Generate HTML reports for easy comparison

For more details, see [test/screenshots/README.md](test/screenshots/README.md).
