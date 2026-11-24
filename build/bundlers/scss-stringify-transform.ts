import type { TransformCallback } from 'node:stream';

const path: typeof import('path') = require('path');
const { PassThrough, Transform }: typeof import('node:stream') = require('node:stream');
const sass: typeof import('sass') = require('sass');
const { fileURLToPath }: typeof import('url') = require('url');

/**
 * Browserify transform: compiles a `.scss` file to a JS module that exports
 * the compiled CSS string (`module.exports = "..."`). Used by web components
 * that inject styles into shadow DOM while still using the central Sass stack.
 *
 * Load paths match `bundle-scss.ts`: `src/styles/` and `node_modules/`.
 *
 * @param file - Absolute path of the file being transformed.
 * @returns Transform or PassThrough stream.
 */
module.exports = function scssStringifyTransform(
  file: string,
): import('node:stream').Transform | import('node:stream').PassThrough {
  if (!file.endsWith('.scss')) {
    return new PassThrough();
  }

  const chunks: Buffer[] = [];
  return new Transform({
    /**
     * Collects data chunks from the input stream.
     *
     * @param chunk - Buffer chunk being read.
     * @param _enc - Encoding (unused).
     * @param cb - Callback to continue stream processing.
     */
    transform(chunk: Buffer | string, _enc: BufferEncoding, cb: TransformCallback): void {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      } else {
        chunks.push(Buffer.from(chunk));
      }
      cb();
    },
    /**
     * Compiles the accumulated SCSS content and flushes the CSS module export string.
     *
     * @param cb - Callback invoked when flush completes or fails with error.
     */
    flush(cb: TransformCallback): void {
      try {
        const result = sass.compile(path.resolve(file), {
          loadPaths: [
            path.join(__dirname, '..', '..', 'src', 'styles'),
            path.join(__dirname, '..', '..', 'node_modules')
          ],
        });
        result.loadedUrls.forEach((url: URL) => {
          if (url.protocol === 'file:') this.emit('file', fileURLToPath(url));
        });
        const escaped = JSON.stringify(result.css);
        this.push(Buffer.from(`module.exports = ${escaped};\n`, 'utf8'));
        cb();
      } catch (err: unknown) {
        if (err instanceof Error) {
          cb(err);
        } else {
          cb(new Error(String(err)));
        }
      }
    },
  });
};
