import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  RedirectEntry,
  S3RedirectMatch,
  S3RoutingRule
} from '../build/helpers/generate-redirects.ts';

interface GenerateRedirectsModule {
  (configs: {
    dir: { root: string; build: string; dist: string };
    sourcePath?: string;
    outputPath?: string;
    hostName?: string;
  }): S3RoutingRule[];
  S3_MAX_ROUTING_RULES: number;
  DEFAULT_REDIRECT_CODE: string;
  parseRedirectsDictionary: (rawContent: string) => RedirectEntry[];
  buildS3RoutingRules: (entries: RedirectEntry[], hostName: string) => S3RoutingRule[];
  evaluateS3Redirect: (rules: S3RoutingRule[], requestPath: string) => S3RedirectMatch | null;
}

const require = createRequire(import.meta.url);
require('colors');

const generateRedirects: GenerateRedirectsModule = require('../build/helpers/generate-redirects.ts');
const {
  S3_MAX_ROUTING_RULES,
  parseRedirectsDictionary,
  buildS3RoutingRules,
  evaluateS3Redirect,
} = generateRedirects;

const projectRoot = path.resolve(process.cwd());

describe('redirects dictionary parser', () => {
  test('parses whitespace-separated mappings while ignoring blank lines and comments', () => {
    const raw = [
      '# Historical redirects',
      '',
      '/coyote-drums/ /drums/',
      '  /experience/    /about/  ',
      '# Another comment',
      '/thoughts/ /posts/'
    ].join('\n');

    const entries = parseRedirectsDictionary(raw);
    assert.deepEqual(entries, [
      {
        from: '/coyote-drums/',
        to: '/drums/',
        sourceKey: 'coyote-drums',
        targetKey: 'drums/',
      },
      {
        from: '/experience/',
        to: '/about/',
        sourceKey: 'experience',
        targetKey: 'about/',
      },
      {
        from: '/thoughts/',
        to: '/posts/',
        sourceKey: 'thoughts',
        targetKey: 'posts/',
      }
    ]);
  });

  test('rejects malformed lines, root sources, self-redirects, duplicates, and chains', () => {
    assert.throws(() => parseRedirectsDictionary('/only-one-token/'), /Invalid redirect dictionary entry/);
    assert.throws(() => parseRedirectsDictionary('/a/ /b/ /c/'), /Invalid redirect dictionary entry/);
    assert.throws(() => parseRedirectsDictionary('/ /posts/'), /cannot be the site root/);
    assert.throws(() => parseRedirectsDictionary('/about/ /about/'), /Self-redirect/);
    assert.throws(
      () => parseRedirectsDictionary('/coyote-drums/ /drums/\n/coyote-drums/ /music/'),
      /Duplicate redirect source/,
    );
    assert.throws(
      () => parseRedirectsDictionary('/a/ /b/\n/b/ /c/'),
      /Redirect chain detected/,
    );
  });
});

describe('S3 routing rule generation', () => {
  test('emits the exact AWS S3 rule schema for simple redirects', () => {
    const entries = parseRedirectsDictionary('/coyote-drums/ /drums/\n');
    const rules = buildS3RoutingRules(entries, 'briananders.com');

    assert.deepEqual(rules, [
      {
        Redirect: {
          HostName: 'briananders.com',
          HttpRedirectCode: '301',
          ReplaceKeyWith: 'drums/',
        },
        Condition: {
          KeyPrefixEquals: 'coyote-drums',
        },
      }
    ]);
  });

  test('collapses identical-slug directory children via ReplaceKeyPrefixWith and sorts longest-prefix-first', () => {
    const raw = [
      '/thoughts/ /posts/',
      '/thoughts/paint/ /posts/paint/',
      '/thoughts/yahtzee/ /posts/yahtzee/',
      '/thoughts/last-fm/ /music/listening-history/',
      '/thoughts/last-fm-scrobbles/ /music/listening-history/'
    ].join('\n');

    const entries = parseRedirectsDictionary(raw);
    const rules = buildS3RoutingRules(entries, 'briananders.com');

    // 2 custom overrides + 1 prefix rule (thoughts/) + 1 root rule (thoughts) = 4 rules.
    assert.equal(rules.length, 4);
    assert.deepEqual(
      rules.map((rule) => rule.Condition.KeyPrefixEquals),
      ['thoughts/last-fm-scrobbles', 'thoughts/last-fm', 'thoughts/', 'thoughts'],
    );
    assert.equal(rules[2].Redirect.ReplaceKeyPrefixWith, 'posts/');
    assert.equal(rules[2].Redirect.ReplaceKeyWith, undefined);
    assert.equal(rules[3].Redirect.ReplaceKeyWith, 'posts/');

    assert.equal(evaluateS3Redirect(rules, '/thoughts/paint/')?.targetKey, 'posts/paint/');
    assert.equal(evaluateS3Redirect(rules, '/thoughts/paint')?.targetKey, 'posts/paint');
    assert.equal(evaluateS3Redirect(rules, '/thoughts/')?.targetKey, 'posts/');
    assert.equal(evaluateS3Redirect(rules, '/thoughts')?.targetKey, 'posts/');
    assert.equal(evaluateS3Redirect(rules, '/thoughts/last-fm/')?.targetKey, 'music/listening-history/');
    assert.equal(evaluateS3Redirect(rules, '/thoughts/last-fm-scrobbles')?.targetKey, 'music/listening-history/');
  });

  test('keeps an identical-slug child explicit when a shorter custom override would shadow it', () => {
    const raw = [
      '/thoughts/ /posts/',
      '/thoughts/foo/ /posts/bar/',
      '/thoughts/foo-extended/ /posts/foo-extended/'
    ].join('\n');

    const entries = parseRedirectsDictionary(raw);
    const rules = buildS3RoutingRules(entries, 'briananders.com');

    // thoughts/foo-extended must stay ahead of thoughts/foo so it is not misdirected to posts/bar/.
    assert.equal(rules[0].Condition.KeyPrefixEquals, 'thoughts/foo-extended');
    assert.equal(evaluateS3Redirect(rules, '/thoughts/foo-extended/')?.targetKey, 'posts/foo-extended/');
    assert.equal(evaluateS3Redirect(rules, '/thoughts/foo-extended')?.targetKey, 'posts/foo-extended/');
    assert.equal(evaluateS3Redirect(rules, '/thoughts/foo/')?.targetKey, 'posts/bar/');
  });

  test('enforces AWS S3 50-rule ceiling', () => {
    const lines: string[] = [];
    for (let i = 1; i <= S3_MAX_ROUTING_RULES + 1; i += 1) {
      lines.push(`/old-${i}/ /new-${i}/`);
    }
    const entries = parseRedirectsDictionary(lines.join('\n'));
    assert.throws(
      () => buildS3RoutingRules(entries, 'briananders.com'),
      /exceeding AWS S3's limit of 50/,
    );
  });

  test('generateRedirects writes formatted JSON to the configured dist directory', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'redirects-test-'));
    try {
      const sourcePath = path.join(tempDir, 'redirects.txt');
      const distDir = `${path.join(tempDir, 'dist')}/`;
      writeFileSync(sourcePath, '/coyote-drums/ /drums/\n', 'utf8');

      const rules = generateRedirects({
        dir: {
          root: `${tempDir}/`,
          build: `${path.join(projectRoot, 'build')}/`,
          dist: distDir,
        },
        hostName: 'briananders.com',
      });

      const writtenRaw = readFileSync(path.join(distDir, 'redirects.json'), 'utf8');
      const parsed = JSON.parse(writtenRaw) as S3RoutingRule[];
      assert.deepEqual(parsed, rules);
      assert.equal(parsed[0].Redirect.HostName, 'briananders.com');
      assert.equal(parsed[0].Redirect.HttpRedirectCode, '301');
      assert.equal(parsed[0].Redirect.ReplaceKeyWith, 'drums/');
      assert.equal(parsed[0].Condition.KeyPrefixEquals, 'coyote-drums');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('repository redirects.txt to dist/redirects.json integration', () => {
  test('compiles all 60 repository redirects into <= 50 S3 rules that accurately resolve every URL', () => {
    const raw = readFileSync(path.join(projectRoot, 'redirects.txt'), 'utf8');
    const entries = parseRedirectsDictionary(raw);
    const rules = buildS3RoutingRules(entries, 'briananders.com');

    assert.equal(entries.length, 60, 'expected all 60 historical redirects in redirects.txt');
    assert.ok(
      rules.length <= S3_MAX_ROUTING_RULES,
      `expected <= ${S3_MAX_ROUTING_RULES} S3 rules, got ${rules.length}`,
    );
    assert.equal(rules.length, 25, 'expected 25 collapsed S3 routing rules');

    const coyoteRule = rules.find((rule) => rule.Condition.KeyPrefixEquals === 'coyote-drums');
    assert.deepEqual(coyoteRule, {
      Redirect: {
        HostName: 'briananders.com',
        HttpRedirectCode: '301',
        ReplaceKeyWith: 'drums/',
      },
      Condition: {
        KeyPrefixEquals: 'coyote-drums',
      },
    });

    for (const entry of entries) {
      for (const candidatePath of [`/${entry.sourceKey}/`, `/${entry.sourceKey}`]) {
        const match = evaluateS3Redirect(rules, candidatePath);
        assert.ok(match, `expected redirect match for ${candidatePath}`);
        assert.equal(match.hostName, 'briananders.com');
        assert.equal(match.statusCode, '301');
        assert.equal(
          match.targetKey.replace(/^\/+|\/+$/g, ''),
          entry.targetKey.replace(/^\/+|\/+$/g, ''),
          `mismatch for ${candidatePath}`,
        );
      }
    }
  });
});
