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

To build the site for comparison (skips gzip compression and asset hashing): `npm run build:comparison`

The site is built into the `/package` folder (production) or `/comparison` folder (comparison build).

## Deploy the static site
My website uses AWS as the host, and the deploy uses aws-cli. For this to work you need credentials saved as bash variables. `CLOUDFRONT_ID`, `AWS_ACCESS_KEY`, and `AWS_SECRET_ACCESS_KEY`. The deploy library uses these credentials for authentication.

DO NOT SHARE YOUR CREDENTIALS WITH ANYONE.

DO NOT COMMIT THEM TO A PUBLIC REPO.

To deploy to staging: `npm run stage`

To deploy to production: `npm run deploy`
