'use strict';

require('colors');

const dir = require('./build/constants/directories')(__dirname);

const timestamp = require(`${dir.build}helpers/timestamp`);
const express = require('express');
const app = express();

app.use(express.static(dir.package));

let configuredPort = 3000;
if (process.env.PORT) {
  configuredPort = parseInt(process.env.PORT, 10);
}

// Start the HTTP server to preview the production package build
const server = app.listen(configuredPort);

server.on('error', (serverError) => {
  if (serverError.code === 'EADDRINUSE') {
    console.error(`${timestamp.stamp()}: Port ${configuredPort} is already in use by another process.`.red.bold);
    console.error(`${timestamp.stamp()}: Stop the process using that port or specify a different port (e.g. PORT=${configuredPort + 1} npm run preview:production).`.yellow);
    process.exit(1);
  }

  console.error(`${timestamp.stamp()}: Server error: ${serverError.message}`.red.bold);
  process.exit(1);
});

server.on('listening', () => {
  const boundAddress = server.address();
  console.log(`${timestamp.stamp()}: server is running at http://localhost:%s`, boundAddress.port);
});

