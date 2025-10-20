'use strict';

require('colors');

const dir = require('./build/constants/directories')(__dirname);

const timestamp = require(`${dir.build}helpers/timestamp`);
const express = require('express');
const serve = require('express-static');
const app = express();

/* ---------------------------- Event Listeners ---------------------------- */

app.use(serve(dir.package));

const server = app.listen(3000, () => {
  console.log(`${timestamp.stamp()}: server is running at http://localhost:%s`, server.address().port);
});
