import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const babelTransform = require('../build/bundlers/babel-transform');

/**
 * Pipes a string through a Browserify transform stream and collects the UTF-8 output.
 *
 * @param {import('node:stream').Stream} stream - Transform or PassThrough stream.
 * @param {string} input - Source text to write into the stream.
 * @returns {Promise<string>} Output emitted by the stream.
 */
function runStream(stream, input) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.end(input);
  });
}

describe('babelTransform', () => {
  it('transpiles ES2022 private class fields and JSX for Browserify compatibility', async () => {
    const source = [
      'class Counter {',
      '  #count = 0;',
      '  inc() { this.#count += 1; return <span>{this.#count}</span>; }',
      '}',
      'module.exports = Counter;',
    ].join('\n');

    const stream = babelTransform('/tmp/example.js', {
      _flags: { debug: false },
      presets: [
        ['@babel/preset-env', { targets: { ie: '11' } }],
        '@babel/preset-react',
      ],
    });

    const output = await runStream(stream, source);
    assert.doesNotMatch(output, /#count/, 'private class fields should be compiled away for Acorn 7');
    assert.doesNotMatch(output, /<span>/, 'JSX should be compiled by @babel/preset-react');
    assert.match(output, /_jsx(?:DEV)?\("span"/, 'JSX should compile via @babel/preset-react v8 automatic runtime');
    assert.doesNotMatch(output, /sourceMappingURL=/, 'production transforms should omit inline source maps');
  });

  it('emits inline source maps when Browserify debug flag is enabled', async () => {
    const stream = babelTransform('/tmp/debug-entry.js', {
      _flags: { debug: true },
      presets: [['@babel/preset-env', { targets: { ie: '11' } }]],
    });

    const output = await runStream(stream, 'const value = () => 42;');
    assert.match(output, /sourceMappingURL=data:application\/json/, 'debug mode should include inline source maps');
  });

  it('passes non-JavaScript files through untouched', async () => {
    const jsonSource = '{"hello": "world"}';
    const jsonOutput = await runStream(
      babelTransform('/tmp/data.json', { presets: ['@babel/preset-env'] }),
      jsonSource,
    );
    assert.equal(jsonOutput, jsonSource);

    const cssSource = 'module.exports = ".box{color:red}";\n';
    const scssOutput = await runStream(
      babelTransform('/tmp/widget.scss', { presets: ['@babel/preset-env'] }),
      cssSource,
    );
    assert.equal(scssOutput, cssSource);
  });

  it('emits an error event when Babel encounters invalid syntax', async () => {
    const stream = babelTransform('/tmp/broken.js', {
      presets: [['@babel/preset-env', { targets: { ie: '11' } }]],
    });

    await assert.rejects(
      runStream(stream, 'const broken = (;'),
      /Unexpected token/,
    );
  });

  it('copy-to-clipboard v4 exposes its copy function on the default export', () => {
    const copyModule = require('copy-to-clipboard');
    assert.equal(typeof copyModule.default, 'function');
  });
});
