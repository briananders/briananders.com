'use strict';

require('colors');

const dir = require('./build/constants/directories')(__dirname);

const timestamp = require(`${dir.build}helpers/timestamp`);
const express = require('express');
const serve = require('express-static');
const app = express();

app.use(serve(dir.package));

// Start the HTTP server to preview the production package build
const server = app.listen(3000, () => {
  console.log(`${timestamp.stamp()}: server is running at http://localhost:%s`, server.address().port);
});

