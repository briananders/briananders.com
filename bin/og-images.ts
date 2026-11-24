'use strict';

/**
 * Captures each page's social preview image (`og:image`) from the built site.
 *
 * A page opts in with an `ogImage` recipe in its front matter that names the
 * element that makes the page recognizable: the canvas, the game board, the
 * chart. The capture is fitted to 1200×630 and written to
 * `src/images/og/<page>.jpg`, where `build/helpers/seo.ts` finds it. The next
 * build gives it a committed AVIF like every other source image.
 *
 * Captures are source files, not build output: animations and random seeds
 * make every run differ, so regenerate a page's image only when you mean to.
 *
 * Usage:
 *   npm run build
 *   npm run og-images                       # every page with a recipe
 *   npm run og-images -- /posts/coin-flip/  # just these pages
 *
 * Options:
 *   --dir=<path>   Built site to serve (default: package)
 *   --out=<path>   Review contact sheets (default: screenshots/og-images)
 *
 * Recipe (front matter):
 *   ogImage:
 *     selector: '#canvas'   # required: element to capture
 *     alt: 'Text'           # og:image:alt; defaults to "Screenshot of <title>"
 *     fit: cover            # cover (crop to fill, default) or contain (letterbox in the
 *                           # color most of the capture's corners share)
 *     position: centre      # cover crop anchor: centre, top, bottom, left, right…
 *     padding: 0            # CSS px of surrounding page to include
 *     width: 1200           # viewport width in CSS px
 *     height: 900           # viewport height in CSS px; the capture is clipped to it
 *     scale: 2              # device pixel ratio; raise it for small elements
 *     hideFixed: true       # hide fixed/sticky elements outside the element (the site header)
 *     wait: 1500            # ms to let animations run before capture
 *     actions:              # run in order before the wait
 *       - click: '#play'
 *       - click: ['#canvas', 0.25, 0.5]   # at a fraction of the element's box
 *       - fill: ['#input', 'stare']
 *       - press: ['#input', 'Enter']
 *       - select: ['#count', '8']
 *       - hover: '.card'
 *       - drag: ['#canvas', [[0.1, 0.5], [0.5, 0.2], [0.9, 0.5]]]
 *       - scroll: 1800                    # window y, or a selector to bring to the top
 *       - wait: 500
 */

import type { EventEmitter as NodeEventEmitter } from 'node:events';
import type { Browser, Page } from 'playwright';
import type { BuildDirectories, OgImageRecipe, PageMappingEntry } from '../build/types.ts';

const fs: typeof import('node:fs') = require('fs');
const path: typeof import('node:path') = require('path');
const EventEmitter: typeof import('node:events') = require('events');

const ROOT = path.join(__dirname, '..');
const {
  startServer,
  launchBrowser,
  routeRequests,
  svgText,
}: {
  startServer: (siteDir: string) => Promise<{ url: string; close: () => void }>;
  launchBrowser: () => Promise<Browser>;
  routeRequests: (
    page: Page,
    baseUrl: string,
    onFailure?: (requestUrl: string, message: string) => void,
  ) => Promise<void>;
  svgText: (text: string, width: number, height: number, fontSize: number, weight?: number) => Buffer;
} = require('./screenshot.ts');
const { ogImagePath, OG_IMAGE_SIZE }: {
  ogImagePath: (pagePath: string) => string;
  OG_IMAGE_SIZE: { width: number; height: number };
} = require('../build/helpers/seo.ts');

const { log } = console;

type OgImageFit = 'cover' | 'contain';
type RecipeAction = Record<string, unknown>;

interface NormalizedOgImageRecipe {
  selector: string;
  alt?: string;
  fit: OgImageFit;
  position: string;
  padding: number;
  width: number;
  height: number;
  scale: number;
  hideFixed: boolean;
  wait: number;
  actions: RecipeAction[];
}

interface OgImagesCliOptions {
  paths: string[];
  dir: string;
  out: string;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

interface RawImageInfo {
  width: number;
  height: number;
  channels: number;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface Point {
  x: number;
  y: number;
}

interface CaptureOutput {
  file: string;
  problems: string[];
}

interface CapturedResult {
  url: string;
  file: string;
}

const RECIPE_DEFAULTS = {
  fit: 'cover' as OgImageFit,
  position: 'centre',
  padding: 0,
  width: 1200,
  height: 900,
  scale: 2,
  hideFixed: true,
  wait: 1500,
  actions: [] as RecipeAction[],
};

const isSelector = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isFraction = (value: unknown): value is number => typeof value === 'number'
  && Number.isFinite(value) && value >= 0 && value <= 1;
const isPoint = (value: unknown): value is [number, number] => Array.isArray(value)
  && value.length === 2 && value.every(isFraction);
const isText = (value: unknown): value is string | number => typeof value === 'string'
  || (typeof value === 'number' && Number.isFinite(value));

/** What each action accepts; see the recipe reference at the top of this file. */
const ACTION_ARGUMENTS: Record<string, (value: unknown) => boolean> = {
  click: (value: unknown) => isSelector(value)
    || (Array.isArray(value) && value.length === 3 && isSelector(value[0]) && isPoint(value.slice(1))),
  fill: (value: unknown) => Array.isArray(value) && value.length === 2 && isSelector(value[0]) && isText(value[1]),
  press: (value: unknown) => Array.isArray(value) && value.length === 2
    && isSelector(value[0]) && isSelector(value[1]),
  select: (value: unknown) => Array.isArray(value) && value.length === 2 && isSelector(value[0]) && isText(value[1]),
  hover: isSelector,
  drag: (value: unknown) => Array.isArray(value) && value.length === 2 && isSelector(value[0])
    && Array.isArray(value[1]) && value[1].length >= 2 && value[1].every(isPoint),
  scroll: (value: unknown) => isSelector(value)
    || (typeof value === 'number' && Number.isFinite(value) && value >= 0),
  wait: (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0,
};

const ACTIONS = Object.keys(ACTION_ARGUMENTS);
const FITS: readonly string[] = ['cover', 'contain'];
const JPEG_OPTIONS = { quality: 84, mozjpeg: true };
const SHEET = {
  columns: 3, thumbWidth: 480, labelHeight: 36, pad: 24, background: '#1b1b1b',
};

/**
 * Parses CLI arguments.
 */
function parseArgs(argv: string[]): OgImagesCliOptions {
  const options: OgImagesCliOptions = { paths: [], dir: 'package', out: 'screenshots/og-images' };
  argv.forEach((arg) => {
    const match = arg.match(/^--([\w-]+)=(.*)$/);
    if (!match) {
      if (arg.startsWith('/')) {
        options.paths.push(arg);
      } else {
        options.paths.push(`/${arg}`);
      }
      return;
    }
    const [, key, value] = match;
    if (key === 'dir') options.dir = value;
    else if (key === 'out') options.out = value;
    else throw new Error(`Unknown option --${key}`);
  });
  return options;
}

/**
 * Validates a front-matter recipe and fills in defaults.
 */
function normalizeRecipe(recipe: Partial<OgImageRecipe> | undefined, where: string): NormalizedOgImageRecipe {
  if (!recipe || typeof recipe.selector !== 'string' || !recipe.selector) {
    throw new Error(`${where}: ogImage.selector is required`);
  }
  const full: NormalizedOgImageRecipe = {
    ...RECIPE_DEFAULTS,
    ...recipe,
    selector: recipe.selector,
  };
  if (!FITS.includes(full.fit)) throw new Error(`${where}: ogImage.fit must be ${FITS.join(' or ')}`);
  const nonNegativeKeys: Array<'padding' | 'wait'> = ['padding', 'wait'];
  nonNegativeKeys.forEach((key) => {
    if (!Number.isFinite(full[key]) || full[key] < 0) {
      throw new Error(`${where}: ogImage.${key} must be a non-negative number`);
    }
  });
  const positiveKeys: Array<'width' | 'height' | 'scale'> = ['width', 'height', 'scale'];
  positiveKeys.forEach((key) => {
    if (!Number.isFinite(full[key]) || full[key] <= 0) {
      throw new Error(`${where}: ogImage.${key} must be a positive number`);
    }
  });
  if (typeof full.hideFixed !== 'boolean') throw new Error(`${where}: ogImage.hideFixed must be true or false`);
  if (!Array.isArray(full.actions)) throw new Error(`${where}: ogImage.actions must be a list`);
  full.actions.forEach((action) => {
    const keys = Object.keys(action || {});
    if (keys.length !== 1 || !ACTIONS.includes(keys[0])) {
      throw new Error(`${where}: each ogImage action needs exactly one of ${ACTIONS.join(', ')}`);
    }
    // Recipes are hand-written YAML: catch a malformed argument here, not as a
    // Playwright timeout halfway through a capture run.
    const actionKey = keys[0];
    if (!ACTION_ARGUMENTS[actionKey](action[actionKey])) {
      const argument = JSON.stringify(action[actionKey]);
      throw new Error(`${where}: ogImage action ${actionKey} has an invalid argument (${argument})`);
    }
  });
  return full;
}

/**
 * Lists every page, in URL order, from the build's own front-matter index so
 * URLs match the built site exactly.
 */
function allPages(): PageMappingEntry[] {
  require('colors');
  const getDirectories: (appRoot: string, isGoldenBuild?: boolean) => BuildDirectories = require(
    '../build/constants/directories.ts',
  );
  const compilePageMappingData: (configs: {
    dir: BuildDirectories;
    buildEvents: NodeEventEmitter;
    pageMappingData: PageMappingEntry[];
  }) => void = require('../build/page-mapping-data.ts');
  const dir = getDirectories(ROOT);
  const pageMappingData: PageMappingEntry[] = [];
  compilePageMappingData({ dir, buildEvents: new EventEmitter(), pageMappingData });
  return pageMappingData
    .map((page) => ({ ...page, url: `/${page.url}` }))
    .sort((a, b) => a.url.localeCompare(b.url));
}

/**
 * Lists every page that has a capture recipe.
 */
function pagesWithRecipes(): PageMappingEntry[] {
  return allPages().filter((page) => Boolean(page.data.ogImage));
}

/**
 * Expands an element's box by `padding` and clamps it to the viewport.
 *
 * Captures never use Playwright's full-page mode: it resizes the viewport,
 * which fires `resize` and resets the canvas experiments mid-animation.
 */
function clipFor(box: Box, padding: number, viewport: ViewportSize): Box {
  const x = Math.max(0, Math.floor(box.x - padding));
  const y = Math.max(0, Math.floor(box.y - padding));
  const right = Math.min(viewport.width, Math.ceil(box.x + box.width + padding));
  const bottom = Math.min(viewport.height, Math.ceil(box.y + box.height + padding));
  return {
    x, y, width: right - x, height: bottom - y,
  };
}

/**
 * Picks the letterbox color for `fit: contain`: the color most of the
 * capture's four corners share, so the bars continue whatever surrounds the
 * element (a card, a gradient, the page) instead of a fixed color.
 */
function cornerColor(pixels: Buffer, { width, height, channels }: RawImageInfo): RgbColor {
  const corners: RgbColor[] = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]
    .map(([x, y]) => {
      const offset = (y * width + x) * channels;
      return { r: pixels[offset], g: pixels[offset + 1], b: pixels[offset + 2] };
    });
  const key = ({ r, g, b }: RgbColor): string => `${r},${g},${b}`;
  const counts = new Map<string, number>();
  corners.forEach((color) => counts.set(key(color), (counts.get(key(color)) || 0) + 1));
  // Ties go to the top-left corner, which comes first.
  return corners.reduce((best, color) => {
    const colorCount = counts.get(key(color)) || 0;
    const bestCount = counts.get(key(best)) || 0;
    if (colorCount > bestCount) {
      return color;
    }
    return best;
  });
}

/**
 * Converts a point given as fractions of an element's box into page coordinates.
 */
function pointIn(box: Box, [x, y]: [number, number]): Point {
  return { x: box.x + box.width * x, y: box.y + box.height * y };
}

/**
 * Runs one recipe action. Clicks and drags with coordinates use fractions of the element.
 */
async function runAction(page: Page, action: RecipeAction): Promise<void> {
  const [[name, value]] = Object.entries(action);
  if (name === 'click' && Array.isArray(value)) {
    const [selector, xFrac, yFrac] = value as [string, number, number];
    const box = await page.locator(selector).first().boundingBox();
    if (!box) throw new Error(`Element ${selector} has no bounding box`);
    const point = pointIn(box, [xFrac, yFrac]);
    await page.mouse.click(point.x, point.y);
  } else if (name === 'click' && typeof value === 'string') {
    await page.locator(value).first().click();
  } else if (name === 'hover' && typeof value === 'string') {
    await page.locator(value).first().hover();
  } else if (name === 'fill' && Array.isArray(value)) {
    const [selector, text] = value as [string, string | number];
    await page.locator(selector).first().fill(String(text));
  } else if (name === 'press' && Array.isArray(value)) {
    const [selector, keyName] = value as [string, string];
    await page.locator(selector).first().press(keyName);
  } else if (name === 'select' && Array.isArray(value)) {
    const [selector, option] = value as [string, string | number];
    await page.locator(selector).first().selectOption(String(option));
  } else if (name === 'drag' && Array.isArray(value)) {
    const [selector, rawPoints] = value as [string, Array<[number, number]>];
    const box = await page.locator(selector).first().boundingBox();
    if (!box) throw new Error(`Element ${selector} has no bounding box`);
    const [first, ...rest] = rawPoints.map((point) => pointIn(box, point));
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    await rest.reduce<Promise<void>>(
      (previous, point) => previous.then(() => page.mouse.move(point.x, point.y, { steps: 12 })),
      Promise.resolve(),
    );
    await page.mouse.up();
  } else if (name === 'scroll' && (typeof value === 'number' || typeof value === 'string')) {
    // A number scrolls the window to that y; a selector brings its element to the top.
    await page.evaluate((target: number | string) => {
      if (typeof target === 'number') {
        window.scrollTo(0, target);
        return;
      }
      const element = document.querySelector(target);
      if (element) {
        window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY);
      }
    }, value);
  } else if (name === 'wait' && typeof value === 'number') {
    await page.waitForTimeout(value);
  }
}

/**
 * Captures one page's preview image.
 */
async function capture(browser: Browser, baseUrl: string, { url, data }: PageMappingEntry): Promise<CaptureOutput> {
  const sharp: typeof import('sharp') = require('sharp');
  const recipe = normalizeRecipe(data.ogImage, url);
  const context = await browser.newContext({
    viewport: { width: recipe.width, height: recipe.height },
    deviceScaleFactor: recipe.scale,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const problems: string[] = [];
  await routeRequests(page, baseUrl, (requestUrl, message) => problems.push(`${message}: ${requestUrl}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));

  try {
    await page.goto(`${baseUrl}${url}`, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      problems.push('network did not go idle within 10s');
    });
    await page.evaluate(() => document.fonts.ready);
    const target = page.locator(recipe.selector).first();
    await target.waitFor({ state: 'attached' });
    // Start the capture area at the top of the viewport, so a tall element shows its beginning.
    await target.evaluate((el, padding) => {
      window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - padding));
    }, recipe.padding);
    // Actions run in order: each may depend on the one before (type, then press Enter).
    await recipe.actions.reduce<Promise<void>>(
      (previous, action) => previous.then(() => runAction(page, action)),
      Promise.resolve(),
    );
    await page.waitForTimeout(recipe.wait);
    // Clicking can scroll the page (Playwright scrolls targets into view, pages
    // scroll themselves). Bring the element back if it fits but was pushed out.
    const moved = await target.evaluate((el, padding) => {
      const rect = el.getBoundingClientRect();
      const fits = rect.height + padding * 2 <= window.innerHeight;
      const clipped = rect.top - padding < 0 || rect.bottom + padding > window.innerHeight;
      if (fits && clipped) window.scrollBy(0, rect.top - padding);
      return fits && clipped;
    }, recipe.padding);
    if (moved) await page.waitForTimeout(100);

    const geometry = await target.evaluate((el, hideFixed) => {
      // The sticky site header would cover the capture; anything fixed or
      // sticky that isn't part of the element (or around it) is hidden.
      if (hideFixed) {
        document.querySelectorAll('body *').forEach((node) => {
          const { position } = getComputedStyle(node);
          if (['fixed', 'sticky'].includes(position) && !node.contains(el) && !el.contains(node)) {
            if (node instanceof HTMLElement || node instanceof SVGElement) {
              node.style.setProperty('visibility', 'hidden', 'important');
            }
          }
        });
      }
      const rect = el.getBoundingClientRect();
      return {
        box: {
          x: rect.left, y: rect.top, width: rect.width, height: rect.height,
        },
        viewport: { width: window.innerWidth, height: window.innerHeight },
      };
    }, recipe.hideFixed);
    if (!geometry.box.width || !geometry.box.height) throw new Error(`${url}: ${recipe.selector} has no size`);

    const clip = clipFor(geometry.box, recipe.padding, geometry.viewport);
    if (clip.width <= 0 || clip.height <= 0) throw new Error(`${url}: ${recipe.selector} is outside the viewport`);
    const shot = await page.screenshot({ clip });
    const raw = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const background = cornerColor(raw.data, raw.info);
    const file = path.join(ROOT, 'src', ogImagePath(url.slice(1)));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await sharp(shot)
      .resize({
        ...OG_IMAGE_SIZE, fit: recipe.fit, position: recipe.position, background,
      })
      .flatten({ background })
      .jpeg(JPEG_OPTIONS)
      .toFile(file);
    return { file, problems };
  } finally {
    await context.close();
  }
}

/**
 * Tiles captured images into labeled review sheets of up to 9 images.
 */
async function composeSheets(results: CapturedResult[], outDir: string): Promise<string[]> {
  const sharp: typeof import('sharp') = require('sharp');
  const thumbHeight = Math.round(SHEET.thumbWidth * (OG_IMAGE_SIZE.height / OG_IMAGE_SIZE.width));
  const cell = { width: SHEET.thumbWidth, height: thumbHeight + SHEET.labelHeight };
  const perSheet = SHEET.columns * 3;
  fs.mkdirSync(outDir, { recursive: true });
  // A smaller run would otherwise leave an earlier run's later sheets behind.
  fs.readdirSync(outDir)
    .filter((name) => /^sheet-\d+\.png$/.test(name))
    .forEach((name) => fs.unlinkSync(path.join(outDir, name)));
  const batches: CapturedResult[][] = [];
  for (let start = 0; start < results.length; start += perSheet) {
    batches.push(results.slice(start, start + perSheet));
  }
  return Promise.all(batches.map(async (batch, sheetIndex) => {
    const rows = Math.ceil(batch.length / SHEET.columns);
    const layers = await Promise.all(batch.flatMap((result, i) => {
      const left = SHEET.pad + (i % SHEET.columns) * (cell.width + SHEET.pad);
      const top = SHEET.pad + Math.floor(i / SHEET.columns) * (cell.height + SHEET.pad);
      return [
        Promise.resolve({ input: svgText(result.url, cell.width, SHEET.labelHeight, 18), left, top }),
        sharp(result.file).resize(SHEET.thumbWidth).toBuffer()
          .then((input) => ({ input, left, top: top + SHEET.labelHeight }))
      ];
    }));
    const file = path.join(outDir, `sheet-${String(sheetIndex + 1).padStart(2, '0')}.png`);
    await sharp({
      create: {
        width: SHEET.pad + SHEET.columns * (cell.width + SHEET.pad),
        height: SHEET.pad + rows * (cell.height + SHEET.pad),
        channels: 3,
        background: SHEET.background,
      },
    }).composite(layers).png().toFile(file);
    return path.relative(ROOT, file);
  }));
}

/**
 * CLI entry point that captures Open Graph preview images for matching pages
 * and writes labeled review contact sheets.
 */
async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const siteDir = path.resolve(ROOT, options.dir);
  if (!fs.existsSync(path.join(siteDir, 'index.html'))) {
    throw new Error(`${options.dir}/ has no index.html. Run \`npm run build\` first.`);
  }
  const all = pagesWithRecipes();
  let pages = all;
  if (options.paths.length) {
    pages = options.paths.map((wanted) => {
      const found = all.find((page) => page.url === wanted);
      if (!found) throw new Error(`${wanted} has no ogImage recipe in its front matter`);
      return found;
    });
  }

  const server = await startServer(siteDir);
  const browser = await launchBrowser();
  const results: CapturedResult[] = [];
  const failures: string[] = [];
  try {
    // One page at a time: parallel pages compete for CPU and stall each other's animations.
    // A broken recipe is reported at the end instead of abandoning the pages after it.
    await pages.reduce<Promise<void>>((previous, page) => previous
      .then(() => capture(browser, server.url, page))
      .then(({ file, problems }) => {
        results.push({ url: page.url, file });
        log(`${page.url} → ${path.relative(ROOT, file)}`);
        problems.forEach((problem) => log(`  ${problem}`));
      }, (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${page.url}: ${message.split('\n')[0]}`);
        log(`${page.url} FAILED`);
      }), Promise.resolve());
  } finally {
    await browser.close();
    server.close();
  }

  const sheets = await composeSheets(results, path.resolve(ROOT, options.out));
  log('\nReview sheets:');
  sheets.forEach((sheet) => log(`  ${sheet}`));
  log('\nRun a build to generate their AVIFs, then commit src/images/og/ and src/images/avif-manifest.json.');
  if (failures.length) {
    log('\nFailed (fix the ogImage recipe and rerun these paths):');
    failures.forEach((failure) => log(`  ${failure}`));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    log(message);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  normalizeRecipe,
  clipFor,
  cornerColor,
  pointIn,
  allPages,
  pagesWithRecipes,
  RECIPE_DEFAULTS,
};
