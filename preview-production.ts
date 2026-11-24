'use strict';

import type { BuildDirectories } from './build/types.ts';

require('colors');

const getDirectories: (appRoot: string, isGoldenBuild?: boolean) => BuildDirectories = require(
  './build/constants/directories.ts',
);
const dir = getDirectories(__dirname);

const timestamp: { stamp: () => string } = require(`${dir.build}helpers/timestamp.ts`);
const express: typeof import('express') = require('express');
const app = express();

app.use(express.static(dir.package));

let configuredPort = 3000;
if (process.env.PORT) {
  configuredPort = parseInt(process.env.PORT, 10);
}

// Start the HTTP server to preview the production package build
const server = app.listen(configuredPort);

server.on('error', (serverError: NodeJS.ErrnoException) => {
  if (serverError.code === 'EADDRINUSE') {
    console.error(`${timestamp.stamp()}: Port ${configuredPort} is already in use by another process.`.red.bold);
    const portHint = 'Stop the process using that port or specify a different port '
      + `(e.g. PORT=${configuredPort + 1} npm run preview:production).`;
    console.error(`${timestamp.stamp()}: ${portHint}`.yellow);
    process.exit(1);
  }

  console.error(`${timestamp.stamp()}: Server error: ${serverError.message}`.red.bold);
  process.exit(1);
});

server.on('listening', () => {
  const boundAddress = server.address();
  let boundPort: number | string = configuredPort;
  if (boundAddress && typeof boundAddress === 'object') {
    boundPort = boundAddress.port;
  }
  console.log(`${timestamp.stamp()}: server is running at http://localhost:%s`, boundPort);
});

