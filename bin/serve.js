'use strict';

// Usage: node bin/serve.js <directory> <port>

const express = require('express');
const serve = require('express-static');

const [,, dir, portArg] = process.argv;

if (!dir || !portArg) {
  console.error('Usage: node bin/serve.js <directory> <port>');
  process.exit(1);
}

const port = parseInt(portArg, 10);
const app = express();

app.use(serve(dir));

app.listen(port, () => {
  console.log(`Serving ${dir} on http://localhost:${port}`);
});
