import type { BuildDirectories } from '../types.ts';

const fs: typeof import('fs-extra') = require('fs-extra');
const path: typeof import('node:path') = require('node:path');

const { log } = console;

/** AWS S3 Static Website Hosting enforces a hard maximum of 50 routing rules per bucket. */
const S3_MAX_ROUTING_RULES = 50;

/** Permanent HTTP redirect status code emitted for all dictionary entries. */
const DEFAULT_REDIRECT_CODE = '301';

export interface RedirectEntry {
  from: string;
  to: string;
  sourceKey: string;
  targetKey: string;
}

export interface S3RedirectTarget {
  HostName: string;
  HttpRedirectCode: string;
  ReplaceKeyWith?: string;
  ReplaceKeyPrefixWith?: string;
}

export interface S3RoutingRuleCondition {
  KeyPrefixEquals: string;
}

export interface S3RoutingRule {
  Redirect: S3RedirectTarget;
  Condition: S3RoutingRuleCondition;
}

export interface S3RedirectMatch {
  hostName: string;
  statusCode: string;
  targetKey: string;
  rule: S3RoutingRule;
}

interface GenerateRedirectsConfigs {
  dir: Pick<BuildDirectories, 'root' | 'build' | 'dist'>;
  sourcePath?: string;
  outputPath?: string;
  hostName?: string;
}

/**
 * Strips leading and trailing slashes from a URL path to derive an S3 key prefix.
 *
 * @param rawPath - Raw URL path from the redirects dictionary.
 * @returns Path without leading or trailing slashes.
 */
function stripEdgeSlashes(rawPath: string): string {
  return rawPath.replace(/^\/+|\/+$/g, '');
}

/**
 * Strips leading slashes from a destination path while preserving its trailing slash.
 *
 * @param rawPath - Raw destination path from the redirects dictionary.
 * @returns Relative S3 destination key.
 */
function stripLeadingSlashes(rawPath: string): string {
  return rawPath.replace(/^\/+/, '');
}

/**
 * Ensures a path is normalized with a single leading slash and trailing slash
 * for canonical dictionary comparison (chain and duplicate detection).
 *
 * @param keyWithoutEdges - Path with leading and trailing slashes removed.
 * @returns Canonical slash-bounded path (or `/` if empty).
 */
function toCanonicalPath(keyWithoutEdges: string): string {
  if (!keyWithoutEdges) {
    return '/';
  }
  return `/${keyWithoutEdges}/`;
}

/**
 * Parses a plain-text `<from> <to>` redirect dictionary into validated entries.
 *
 * Blank lines and `#`-prefixed comments are ignored. Rejects malformed lines,
 * root `/` sources, duplicate sources, self-redirects, and multi-hop chains.
 *
 * @param rawContent - UTF-8 contents of `redirects.txt`.
 * @returns Validated redirect entries in source order.
 */
function parseRedirectsDictionary(rawContent: string): RedirectEntry[] {
  const lines = rawContent.split(/\r?\n/);
  const entries: RedirectEntry[] = [];
  const seenSources = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const tokens = trimmed.split(/\s+/);
    if (tokens.length !== 2) {
      throw new Error(`Invalid redirect dictionary entry on line ${index + 1}: "${trimmed}"`);
    }

    const [from, to] = tokens;
    const sourceKey = stripEdgeSlashes(from);
    const targetKey = stripLeadingSlashes(to);

    if (!sourceKey) {
      throw new Error(`Redirect source on line ${index + 1} cannot be the site root: "${trimmed}"`);
    }

    const canonicalSource = toCanonicalPath(sourceKey);
    const canonicalTarget = toCanonicalPath(stripEdgeSlashes(targetKey));

    if (canonicalSource === canonicalTarget) {
      throw new Error(`Self-redirect on line ${index + 1}: "${trimmed}"`);
    }

    if (seenSources.has(canonicalSource)) {
      throw new Error(`Duplicate redirect source on line ${index + 1}: "${from}"`);
    }

    seenSources.add(canonicalSource);
    entries.push({
      from,
      to,
      sourceKey,
      targetKey,
    });
  }

  // Reject multi-hop redirect chains so every historical URL lands in a single 301 hop.
  for (const entry of entries) {
    const canonicalTarget = toCanonicalPath(stripEdgeSlashes(entry.targetKey));
    if (seenSources.has(canonicalTarget)) {
      throw new Error(`Redirect chain detected through "${entry.to}" (from "${entry.from}")`);
    }
  }

  return entries;
}

/**
 * Determines whether a child entry is an identical-suffix move beneath a directory root mapping.
 *
 * For example, given root `thoughts` → `posts/`, the child `thoughts/paint` → `posts/paint/`
 * preserves the exact `paint` suffix and can be served by a single `ReplaceKeyPrefixWith` rule.
 *
 * @param rootEntry - Candidate directory-level redirect entry.
 * @param candidate - Entry to test against `rootEntry`.
 * @returns True when `candidate` is an identical-suffix child of `rootEntry`.
 */
function isIdenticalSuffixChild(rootEntry: RedirectEntry, candidate: RedirectEntry): boolean {
  if (candidate.sourceKey === rootEntry.sourceKey) {
    return false;
  }

  const rootPrefix = `${rootEntry.sourceKey}/`;
  if (!candidate.sourceKey.startsWith(rootPrefix)) {
    return false;
  }

  if (!rootEntry.targetKey.endsWith('/')) {
    return false;
  }

  const remainder = candidate.sourceKey.slice(rootPrefix.length);
  const expectedTargetWithoutSlash = `${rootEntry.targetKey}${remainder}`;
  return candidate.targetKey === `${expectedTargetWithoutSlash}/`
    || candidate.targetKey === expectedTargetWithoutSlash;
}

/**
 * Sorts S3 routing rules so longer, more specific prefixes always evaluate before shorter ones.
 *
 * @param rules - Unsorted routing rules.
 * @returns Deterministically ordered copy of the rules.
 */
function sortS3RoutingRules(rules: S3RoutingRule[]): S3RoutingRule[] {
  return [...rules].sort((left, right) => {
    const lengthDiff = right.Condition.KeyPrefixEquals.length - left.Condition.KeyPrefixEquals.length;
    if (lengthDiff !== 0) {
      return lengthDiff;
    }

    const leftIsExact = left.Redirect.ReplaceKeyWith !== undefined;
    const rightIsExact = right.Redirect.ReplaceKeyWith !== undefined;
    if (leftIsExact !== rightIsExact) {
      if (leftIsExact) {
        return -1;
      }
      return 1;
    }

    if (left.Condition.KeyPrefixEquals < right.Condition.KeyPrefixEquals) {
      return -1;
    }
    if (left.Condition.KeyPrefixEquals > right.Condition.KeyPrefixEquals) {
      return 1;
    }
    return 0;
  });
}

/**
 * Simulates AWS S3 Static Website Hosting first-match prefix evaluation for a request path.
 *
 * @param rules - Ordered S3 routing rules.
 * @param requestPath - Request path (with or without leading slash).
 * @returns Matched redirect target details, or `null` when no rule matches.
 */
function evaluateS3Redirect(rules: S3RoutingRule[], requestPath: string): S3RedirectMatch | null {
  const requestKey = stripLeadingSlashes(requestPath);

  for (const rule of rules) {
    const prefix = rule.Condition.KeyPrefixEquals;
    if (!requestKey.startsWith(prefix)) {
      continue;
    }

    let targetKey = requestKey;
    if (rule.Redirect.ReplaceKeyWith !== undefined) {
      targetKey = rule.Redirect.ReplaceKeyWith;
    } else if (rule.Redirect.ReplaceKeyPrefixWith !== undefined) {
      targetKey = `${rule.Redirect.ReplaceKeyPrefixWith}${requestKey.slice(prefix.length)}`;
    }

    return {
      hostName: rule.Redirect.HostName,
      statusCode: rule.Redirect.HttpRedirectCode,
      targetKey,
      rule,
    };
  }

  return null;
}

/**
 * Checks whether two S3 destination keys refer to the same canonical route.
 *
 * A prefix rule (`thoughts/` → `posts/`) turns slashless `/thoughts/paint` into `posts/paint`
 * (which S3 serves as `posts/paint/`), so trailing-slash normalization verifies semantic equality.
 *
 * @param actualKey - Resulting key from S3 rule evaluation.
 * @param expectedKey - Target key declared in the dictionary.
 * @returns True when both keys resolve to the same destination.
 */
function keysMatchDestination(actualKey: string, expectedKey: string): boolean {
  return stripEdgeSlashes(actualKey) === stripEdgeSlashes(expectedKey);
}

/**
 * Compiles validated dictionary entries into an AWS S3 Static Website Hosting routing-rules array.
 *
 * Directory-level moves that have identical-suffix children (such as `/thoughts/<slug>/` →
 * `/posts/<slug>/`) collapse into a `ReplaceKeyPrefixWith` rule paired with a root
 * `ReplaceKeyWith` rule, keeping custom overrides above them via longest-prefix-first sorting.
 * Enforces S3's 50-rule hard limit and verifies every source path evaluates to its exact target.
 *
 * @param entries - Parsed redirect dictionary entries.
 * @param hostName - Destination hostname (e.g. `briananders.com`).
 * @returns Ordered AWS S3 routing rules ready to serialize as `redirects.json`.
 */
function buildS3RoutingRules(entries: RedirectEntry[], hostName: string): S3RoutingRule[] {
  if (!hostName) {
    throw new Error('Cannot generate S3 routing rules without a destination HostName');
  }

  const collapsedRoots = new Map<RedirectEntry, RedirectEntry[]>();
  const tentativelyAbsorbed = new Set<RedirectEntry>();

  for (const entry of entries) {
    if (!entry.targetKey.endsWith('/')) {
      continue;
    }
    const matchingChildren = entries.filter((candidate) => isIdenticalSuffixChild(entry, candidate));
    if (matchingChildren.length > 0) {
      collapsedRoots.set(entry, matchingChildren);
      for (const child of matchingChildren) {
        tentativelyAbsorbed.add(child);
      }
    }
  }

  // Keep any identical-suffix child as an explicit rule if a surviving custom rule's
  // slashless KeyPrefixEquals would shadow it and send it to a different target.
  const survivingSpecificEntries = entries.filter(
    (entry) => !collapsedRoots.has(entry) && !tentativelyAbsorbed.has(entry),
  );
  const absorbedChildren = new Set<RedirectEntry>();
  for (const child of tentativelyAbsorbed) {
    const isShadowedByDifferentTarget = survivingSpecificEntries.some(
      (specific) => child.sourceKey.startsWith(specific.sourceKey)
        && !keysMatchDestination(specific.targetKey, child.targetKey),
    );
    if (!isShadowedByDifferentTarget) {
      absorbedChildren.add(child);
    }
  }

  const rules: S3RoutingRule[] = [];

  for (const entry of entries) {
    if (absorbedChildren.has(entry)) {
      continue;
    }

    if (collapsedRoots.has(entry)) {
      // Prefix rule handles `/thoughts/` and `/thoughts/<slug>[/]` for identical-slug paths.
      rules.push({
        Redirect: {
          HostName: hostName,
          HttpRedirectCode: DEFAULT_REDIRECT_CODE,
          ReplaceKeyPrefixWith: entry.targetKey,
        },
        Condition: {
          KeyPrefixEquals: `${entry.sourceKey}/`,
        },
      });
    }

    rules.push({
      Redirect: {
        HostName: hostName,
        HttpRedirectCode: DEFAULT_REDIRECT_CODE,
        ReplaceKeyWith: entry.targetKey,
      },
      Condition: {
        KeyPrefixEquals: entry.sourceKey,
      },
    });
  }

  const sortedRules = sortS3RoutingRules(rules);

  if (sortedRules.length > S3_MAX_ROUTING_RULES) {
    throw new Error(
      `Generated ${sortedRules.length} S3 routing rules, exceeding AWS S3's limit of ${S3_MAX_ROUTING_RULES}`,
    );
  }

  // Verify every dictionary entry (with and without trailing slash) resolves to its target.
  for (const entry of entries) {
    const pathsToCheck = [`/${entry.sourceKey}/`, `/${entry.sourceKey}`];
    for (const candidatePath of pathsToCheck) {
      const match = evaluateS3Redirect(sortedRules, candidatePath);
      if (!match || !keysMatchDestination(match.targetKey, entry.targetKey)) {
        let actual = 'no match';
        if (match) {
          actual = match.targetKey;
        }
        throw new Error(
          `S3 redirect verification failed for "${candidatePath}": expected "${entry.targetKey}", got "${actual}"`,
        );
      }
    }
  }

  return sortedRules;
}

/**
 * Resolves the production redirect HostName from site metadata (`siteData.domain`).
 *
 * @param dir - Build directory paths containing `root` and `build`.
 * @returns Hostname string (e.g. `briananders.com`).
 */
function resolveHostName(dir: Pick<BuildDirectories, 'root' | 'build'>): string {
  const createSiteData: (d: Pick<BuildDirectories, 'root' | 'build'>) => { domain: string } = require(
    `${dir.build}constants/site-data.ts`,
  );
  const { domain } = createSiteData(dir);
  return new URL(domain).hostname;
}

/**
 * Reads `redirects.txt`, compiles S3 routing rules, and writes `dist/redirects.json`.
 *
 * @param configs - Build directories and optional path/hostname overrides for testing.
 * @returns The generated S3 routing rules array.
 */
function generateRedirects(configs: GenerateRedirectsConfigs): S3RoutingRule[] {
  const { dir } = configs;
  const timestamp: { stamp: () => string } = require(`${dir.build}helpers/timestamp.ts`);

  const sourcePath = configs.sourcePath || `${dir.root}redirects.txt`;
  const outputPath = configs.outputPath || `${dir.dist}redirects.json`;
  const hostName = configs.hostName || resolveHostName(dir);

  log(`${timestamp.stamp()} generateRedirects()`);

  const rawContent = fs.readFileSync(sourcePath, 'utf8');
  const entries = parseRedirectsDictionary(rawContent);
  const rules = buildS3RoutingRules(entries, hostName);

  fs.ensureDirSync(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${JSON.stringify(rules, null, 2)}\n`, 'utf8');

  log(`${timestamp.stamp()} generateRedirects(): ${'DONE'.green.bold} (${rules.length} rules)`);

  return rules;
}

if (require.main === module) {
  require('colors');
  const repoRoot = path.resolve(__dirname, '..', '..');
  const getDirectories: (appRoot: string, isGolden?: boolean) => BuildDirectories = require(
    '../constants/directories.ts',
  );
  const dir = getDirectories(repoRoot);
  generateRedirects({ dir });
}

module.exports = generateRedirects;
module.exports.S3_MAX_ROUTING_RULES = S3_MAX_ROUTING_RULES;
module.exports.DEFAULT_REDIRECT_CODE = DEFAULT_REDIRECT_CODE;
module.exports.parseRedirectsDictionary = parseRedirectsDictionary;
module.exports.buildS3RoutingRules = buildS3RoutingRules;
module.exports.evaluateS3Redirect = evaluateS3Redirect;
