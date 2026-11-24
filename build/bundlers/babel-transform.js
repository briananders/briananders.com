const path = require('path');
const { PassThrough, Transform } = require('node:stream');
const babel = require('@babel/core');

const TRANSFORMABLE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.es6', '.es']);

/**
 * Strips Browserify's internal metadata from transform options and builds the
 * options object accepted by `@babel/core`.
 *
 * @param {string} file - Absolute path of the file being transformed.
 * @param {object} [transformOptions] - Options passed by Browserify (including `_flags`).
 * @returns {object} Babel transform options.
 */
function buildBabelOptions(file, transformOptions) {
  const safeOptions = transformOptions || {};
  const { _flags: browserifyFlags, ...userOptions } = safeOptions;
  let sourceMaps = false;
  if (browserifyFlags && browserifyFlags.debug) {
    sourceMaps = 'inline';
  }
  return {
    ...userOptions,
    filename: file,
    sourceMaps,
  };
}

/**
 * Browserify transform powered directly by `@babel/core` v8.
 *
 * Replaces `babelify` (whose final v10 release pins `@babel/core` v7) so the
 * build pipeline can use Babel 8 presets while keeping Browserify and Watchify.
 * Non-JavaScript files (such as `.scss` or `.json`) pass through untouched.
 *
 * @param {string} file - Absolute path of the file being transformed.
 * @param {object} [transformOptions] - Presets and options passed via `bundler.transform()`.
 * @returns {import('node:stream').Transform | import('node:stream').PassThrough}
 */
module.exports = function babelTransform(file, transformOptions) {
  const extension = path.extname(file).toLowerCase();
  if (!TRANSFORMABLE_EXTENSIONS.has(extension)) {
    return new PassThrough();
  }

  const chunks = [];
  const babelOptions = buildBabelOptions(file, transformOptions);

  return new Transform({
    /**
     * Buffers incoming source chunks until the full file is available for Babel.
     *
     * @param {Buffer} chunk - Incoming source bytes.
     * @param {string} _encoding - Stream encoding (unused for buffers).
     * @param {Function} callback - Signals readiness for the next chunk.
     */
    transform(chunk, _encoding, callback) {
      chunks.push(chunk);
      callback();
    },

    /**
     * Runs `@babel/core` on the buffered source and emits the transpiled JavaScript.
     *
     * @param {Function} callback - Completes the stream or forwards a Babel error.
     */
    flush(callback) {
      const sourceCode = Buffer.concat(chunks).toString('utf8');
      babel.transformAsync(sourceCode, babelOptions)
        .then((result) => {
          let outputCode = sourceCode;
          if (result && typeof result.code === 'string') {
            outputCode = result.code;
          }
          this.push(Buffer.from(outputCode, 'utf8'));
          callback();
        })
        .catch((error) => {
          callback(error);
        });
    },
  });
};
