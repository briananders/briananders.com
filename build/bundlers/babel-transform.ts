import type { TransformOptions } from '@babel/core';
import type { TransformCallback } from 'node:stream';

const path: typeof import('path') = require('path');
const { PassThrough, Transform }: typeof import('node:stream') = require('node:stream');
const babel: typeof import('@babel/core') = require('@babel/core');

const TRANSFORMABLE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.es6', '.es']);

interface BrowserifyTransformOptions extends TransformOptions {
  _flags?: {
    debug?: boolean;
  };
}

/**
 * Strips Browserify's internal metadata from transform options and builds the
 * options object accepted by `@babel/core`.
 *
 * @param file - Absolute path of the file being transformed.
 * @param transformOptions - Options passed by Browserify (including `_flags`).
 * @returns Babel transform options.
 */
function buildBabelOptions(file: string, transformOptions?: BrowserifyTransformOptions): TransformOptions {
  const safeOptions = transformOptions || {};
  const { _flags: browserifyFlags, ...userOptions } = safeOptions;
  let sourceMaps: boolean | 'inline' = false;
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
 * Non-JavaScript/TypeScript files (such as `.scss` or `.json`) pass through untouched.
 *
 * @param file - Absolute path of the file being transformed.
 * @param transformOptions - Presets and options passed via `bundler.transform()`.
 * @returns Transform or PassThrough stream.
 */
module.exports = function babelTransform(
  file: string,
  transformOptions?: BrowserifyTransformOptions,
): import('node:stream').Transform | import('node:stream').PassThrough {
  const extension = path.extname(file).toLowerCase();
  if (!TRANSFORMABLE_EXTENSIONS.has(extension)) {
    return new PassThrough();
  }

  const chunks: Buffer[] = [];
  const babelOptions = buildBabelOptions(file, transformOptions);

  return new Transform({
    /**
     * Buffers incoming source chunks until the full file is available for Babel.
     *
     * @param chunk - Incoming source bytes.
     * @param _encoding - Stream encoding (unused for buffers).
     * @param callback - Signals readiness for the next chunk.
     */
    transform(chunk: Buffer | string, _encoding: BufferEncoding, callback: TransformCallback): void {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      } else {
        chunks.push(Buffer.from(chunk));
      }
      callback();
    },

    /**
     * Runs `@babel/core` on the buffered source and emits the transpiled JavaScript.
     *
     * @param callback - Completes the stream or forwards a Babel error.
     */
    flush(callback: TransformCallback): void {
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
        .catch((error: unknown) => {
          if (error instanceof Error) {
            callback(error);
          } else {
            callback(new Error(String(error)));
          }
        });
    },
  });
};
