const path = require('path');
const { PassThrough, Transform } = require('node:stream');
const sass = require('sass');

/**
 * Browserify transform: compiles a `.scss` file to a JS module that exports
 * the compiled CSS string (`module.exports = "..."`). Used by web components
 * that inject styles into shadow DOM while still using the central Sass stack.
 *
 * Load paths match {@link bundle-scss.js}: `src/styles/` and `node_modules/`.
 *
 * @param {string} file - Absolute path of the file being transformed.
 * @returns {import('node:stream').Transform | import('node:stream').PassThrough}
 */
module.exports = function scssStringifyTransform(file) {
  if (!file.endsWith('.scss')) {
    return new PassThrough();
  }

  const chunks = [];
  return new Transform({
    transform(chunk, _enc, cb) {
      chunks.push(chunk);
      cb();
    },
    flush(cb) {
      try {
        const result = sass.compile(path.resolve(file), {
          loadPaths: [
            path.join(__dirname, '..', '..', 'src', 'styles'),
            path.join(__dirname, '..', '..', 'node_modules'),
          ],
        });
        const escaped = JSON.stringify(result.css);
        this.push(Buffer.from(`module.exports = ${escaped};\n`, 'utf8'));
        cb();
      } catch (err) {
        cb(err);
      }
    },
  });
};
