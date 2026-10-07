'use strict';

/**
 * Screenshots the built site at the widths AGENTS.md Directive 6 requires,
 * checks each capture for content escaping the viewport, and composes labeled
 * contact sheets per page (and per color scheme, when asked).
 *
 * Serves a built directory (default `package/`, so run `npm run build` first),
 * captures a full-page PNG for every page × width × scheme, then stitches the
 * widths side by side so a sheet shows how a page reflows. Widths are split
 * across sheets so the narrowest column stays legible once the sheet is scaled
 * down for chat. Contact sheets are what agents share: inline in a Claude Code
 * chat thread, or as a workflow artifact in GitHub Actions.
 *
 * Exits 2 when the layout check flags anything, after writing every sheet.
 *
 * Usage:
 *   npm run screenshot -- /posts/coin-flip/ /about/
 *   npm run screenshot -- --dir=golden /
 *
 * Options:
 *   --dir=<path>        Built site to serve (default: package)
 *   --out=<path>        Output directory (default: screenshots)
 *   --widths=360,600    Viewport widths in CSS px (default: 360,600,800,1024,1440)
 *   --schemes=dark      prefers-color-scheme values (default: dark; the site is
 *                       dark-only, so add light only once a light theme exists)
 *   --sheet-height=N    Crop each contact-sheet column to N px (default: 3000)
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const ROOT = path.join(__dirname, '..');
const STAGING = 'http://staging.briananders.com.s3-website-us-east-1.amazonaws.com';
/** S3-hosted data the dev server also proxies; see CLAUDE.md "External Data Sources". */
const PROXIED_PATHS = ['/last-fm-history', '/band-news', '/data', '/movies'];
/** Analytics must not record screenshot runs as page views. */
const BLOCKED_HOSTS = /googletagmanager\.com|google-analytics\.com/;
const FALLBACK_CHROMIUM = '/opt/pw-browsers/chromium';

const SHEET = {
  pad: 32,
  gap: 32,
  headerHeight: 64,
  labelHeight: 44,
  maxWidth: 1600,
  // Widest a sheet may be before scaling to maxWidth; past this, columns shrink
  // too far to read, so the remaining widths start a new sheet.
  maxNaturalWidth: 2600,
  background: '#1b1b1b',
  text: '#f5f5f5',
};

const { log } = console;

/**
 * Parses CLI arguments into screenshot options.
 *
 * @param {string[]} argv - Arguments after the script name.
 * @returns {object} `{ paths, dir, out, widths, schemes, sheetHeight }`
 */
function parseArgs(argv) {
  const options = {
    paths: [],
    dir: 'package',
    out: 'screenshots',
    widths: [360, 600, 800, 1024, 1440],
    schemes: ['dark'],
    sheetHeight: 3000,
  };

  argv.forEach((arg) => {
    const match = arg.match(/^--([\w-]+)=(.*)$/);
    if (!match) {
      options.paths.push(arg.startsWith('/') ? arg : `/${arg}`);
      return;
    }
    const [, key, value] = match;
    if (key === 'dir') options.dir = value;
    else if (key === 'out') options.out = value;
    else if (key === 'widths') options.widths = value.split(',').map(Number);
    else if (key === 'schemes') options.schemes = value.split(',');
    else if (key === 'sheet-height') options.sheetHeight = Number(value);
    else throw new Error(`Unknown option --${key}`);
  });

  if (options.paths.length === 0) options.paths.push('/');
  if (options.widths.some((width) => !Number.isInteger(width) || width <= 0)) {
    throw new Error('--widths must be positive integers');
  }
  if (options.schemes.some((scheme) => !['dark', 'light'].includes(scheme))) {
    throw new Error('--schemes accepts dark and light');
  }
  return options;
}

/**
 * Converts a URL path to a filesystem-safe directory name.
 *
 * @param {string} urlPath - e.g. `/posts/coin-flip/`
 * @returns {string} e.g. `posts-coin-flip`; `/` becomes `home`.
 */
function slugify(urlPath) {
  const slug = urlPath.replace(/[?#].*$/, '').split('/').filter(Boolean).join('-');
  return slug.replace(/[^\w.-]/g, '_') || 'home';
}

/**
 * Lays out contact-sheet columns side by side, cropping tall captures.
 *
 * Each column is `{ left, top, cropHeight, cropped }` in sheet pixels.
 *
 * @param {Array<{ width: number, height: number }>} shots - Full-page sizes, in display order.
 * @param {number} sheetHeight - Maximum column height before cropping.
 * @returns {{ width: number, height: number, columns: object[] }}
 */
function planSheet(shots, sheetHeight) {
  let left = SHEET.pad;
  const top = SHEET.pad + SHEET.headerHeight + SHEET.labelHeight;
  const columns = shots.map((shot) => {
    const cropHeight = Math.min(shot.height, sheetHeight);
    const column = {
      left, top, cropHeight, cropped: shot.height > sheetHeight,
    };
    left += shot.width + SHEET.gap;
    return column;
  });
  const tallest = Math.max(...columns.map((column) => column.cropHeight));
  return {
    width: left - SHEET.gap + SHEET.pad,
    height: top + tallest + SHEET.pad,
    columns,
  };
}

/**
 * Splits viewport widths into contact-sheet groups, in order, starting a new
 * sheet whenever the next column would push a sheet past
 * `SHEET.maxNaturalWidth`.
 *
 * @param {number[]} widths - Viewport widths in display order.
 * @returns {number[][]} e.g. `[[360, 600, 800], [1024, 1440]]`
 */
function packWidths(widths) {
  const groups = [];
  let current = [];
  let currentWidth = SHEET.pad * 2;
  widths.forEach((width) => {
    const added = width + (current.length ? SHEET.gap : 0);
    if (current.length && currentWidth + added > SHEET.maxNaturalWidth) {
      groups.push(current);
      current = [];
      currentWidth = SHEET.pad * 2;
    }
    currentWidth += width + (current.length ? SHEET.gap : 0);
    current.push(width);
  });
  if (current.length) groups.push(current);
  return groups;
}

/**
 * Names a contact sheet after its scheme and width range.
 *
 * @param {string} scheme - `dark` or `light`.
 * @param {number[]} group - Widths on the sheet.
 * @returns {string} e.g. `sheet-dark-360-800.png`
 */
function sheetName(scheme, group) {
  const range = group.length > 1 ? `${group[0]}-${group[group.length - 1]}` : `${group[0]}`;
  return `sheet-${scheme}-${range}.png`;
}

/**
 * Finds visible elements that cross the left or right edge of the viewport.
 *
 * The site clips horizontal overflow, so content that breaks out of the layout
 * never produces a scrollbar; it is silently cut off. Elements clipped or
 * scrolled by an ancestor inside the page (a scrollable code block) and
 * elements entirely off-screen (an off-canvas menu) are intentional and
 * ignored. Only the outermost escaping element is reported.
 *
 * Runs inside the page via `page.evaluate`, so it must be self-contained.
 *
 * @param {Window} [win] - Defaults to the page's window.
 * @returns {Array<{ selector: string, overflow: number }>} Worst first.
 */
function findEdgeOverflow(win = window) {
  const doc = win.document;
  const viewportWidth = win.innerWidth;

  function isClippedByAncestor(el) {
    const pageRoots = [doc.body, doc.documentElement];
    for (let a = el.parentElement; a && !pageRoots.includes(a); a = a.parentElement) {
      const style = win.getComputedStyle(a);
      const clips = ['hidden', 'auto', 'scroll', 'clip'].includes(style.overflowX);
      if (clips || (style.contain || '').includes('paint')) return true;
    }
    return false;
  }

  function selectorFor(el) {
    const classes = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean) : [];
    return el.tagName.toLowerCase()
      + (el.id ? `#${el.id}` : '')
      + classes.slice(0, 2).map((name) => `.${name}`).join('');
  }

  const escaping = new Map();
  Array.from(doc.body.querySelectorAll('*')).forEach((el) => {
    const rect = el.getBoundingClientRect();
    const style = win.getComputedStyle(el);
    if (!rect.width || !rect.height || style.display === 'none' || style.visibility === 'hidden') return;
    const right = rect.left < viewportWidth - 1 && rect.right > viewportWidth + 1;
    const left = rect.left < -1 && rect.right > 1;
    if ((right || left) && !isClippedByAncestor(el)) {
      escaping.set(el, Math.round(right ? rect.right - viewportWidth : -rect.left));
    }
  });

  const outermost = [];
  escaping.forEach((overflow, el) => {
    let ancestor = el.parentElement;
    while (ancestor && !escaping.has(ancestor)) ancestor = ancestor.parentElement;
    if (!ancestor) outermost.push({ selector: selectorFor(el), overflow });
  });
  return outermost.sort((a, b) => b.overflow - a.overflow);
}

function escapeXml(str) {
  return String(str).replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function svgText(text, width, height, fontSize, weight = 400) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
    + `<text x="0" y="${Math.round(height * 0.7)}" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" `
    + `font-size="${fontSize}" font-weight="${weight}" fill="${SHEET.text}">${escapeXml(text)}</text></svg>`);
}

/**
 * Stitches one page's captures (one per width) into a labeled contact sheet.
 *
 * @param {Array<{ file: string, width: number, height: number }>} shots
 * @param {string} title - Sheet heading.
 * @param {number} sheetHeight - Column crop height.
 * @param {string} outFile - PNG to write.
 */
async function composeSheet(shots, title, sheetHeight, outFile) {
  const sharp = require('sharp');
  const plan = planSheet(shots, sheetHeight);
  const layers = [{
    input: svgText(title, plan.width - SHEET.pad * 2, SHEET.headerHeight, 30, 700),
    left: SHEET.pad,
    top: SHEET.pad,
  }];

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const column = plan.columns[i];
    const label = column.cropped
      ? `${shot.width}px · top ${column.cropHeight} of ${shot.height}px`
      : `${shot.width}px`;
    layers.push({
      input: svgText(label, shot.width, SHEET.labelHeight, 20),
      left: column.left,
      top: column.top - SHEET.labelHeight,
    });
    layers.push({
      input: await sharp(shot.file)
        .extract({
          left: 0, top: 0, width: shot.width, height: column.cropHeight,
        })
        .toBuffer(),
      left: column.left,
      top: column.top,
    });
  }

  const sheet = await sharp({
    create: {
      width: plan.width, height: plan.height, channels: 3, background: SHEET.background,
    },
  }).composite(layers).png().toBuffer();

  await sharp(sheet)
    .resize({ width: Math.min(plan.width, SHEET.maxWidth) })
    .png()
    .toFile(outFile);
}

/**
 * Serves the built site, proxying S3-hosted data paths to staging like the dev server.
 *
 * @param {string} siteDir - Absolute path to the built site.
 * @returns {Promise<{ url: string, close: () => void }>}
 */
function startServer(siteDir) {
  const app = express();
  // Local files first; only misses under the data paths go to staging.
  app.use(express.static(siteDir));
  PROXIED_PATHS.forEach((route) => {
    app.use(route, createProxyMiddleware({ target: `${STAGING}${route}`, changeOrigin: true }));
  });
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve({ url: `http://localhost:${server.address().port}`, close: () => server.close() });
    });
  });
}

/**
 * Launches Chromium, falling back to the browser preinstalled in Claude Code
 * cloud containers when Playwright's own download is missing.
 *
 * @returns {Promise<import('playwright').Browser>}
 */
async function launchBrowser() {
  const { chromium } = require('playwright');
  try {
    return await chromium.launch();
  } catch (error) {
    const fallback = process.env.CHROMIUM_PATH || FALLBACK_CHROMIUM;
    if (!/Executable doesn't exist/.test(error.message) || !fs.existsSync(fallback)) {
      throw new Error(`Could not launch Chromium. Run \`npx playwright install chromium\`.\n${error.message}`);
    }
    return chromium.launch({ executablePath: fallback });
  }
}

/**
 * Captures one full-page screenshot and collects problems seen while loading.
 *
 * Chromium on Linux trusts only its own NSS store, so behind a TLS-inspecting
 * proxy (Claude Code cloud containers, corporate networks) third-party assets
 * like Google Fonts fail and pages render in fallback fonts. When Node has
 * extra CAs configured (`NODE_EXTRA_CA_CERTS`), third-party requests are
 * fetched through Node instead, which verifies TLS against those CAs.
 *
 * @param {import('playwright').Browser} browser
 * @param {{ baseUrl: string, urlPath: string, width: number, scheme: string, file: string }} shot
 * @returns {Promise<{ width: number, height: number, problems: string[], layout: object[] }>}
 */
async function capturePage(browser, {
  baseUrl, urlPath, width, scheme, file,
}) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: scheme,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const problems = [];
  const reported = new Set();
  let layout = [];
  const fetchThroughNode = Boolean(process.env.NODE_EXTRA_CA_CERTS);

  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url();
    if (BLOCKED_HOSTS.test(requestUrl)) return route.abort();
    if (!fetchThroughNode || requestUrl.startsWith(baseUrl)) return route.continue();
    try {
      return await route.fulfill({ response: await route.fetch() });
    } catch (error) {
      reported.add(requestUrl);
      problems.push(`request failed (${error.message.split('\n')[0]}): ${requestUrl}`);
      return route.abort();
    }
  });
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    // Resource failures are reported with their URL by the handlers below.
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
      problems.push(`console error: ${message.text()}`);
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  page.on('requestfailed', (request) => {
    if (BLOCKED_HOSTS.test(request.url()) || reported.has(request.url())) return;
    problems.push(`request failed (${request.failure().errorText}): ${request.url()}`);
  });

  try {
    await page.goto(`${baseUrl}${urlPath}`, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      problems.push('network did not go idle within 10s');
    });

    // Scroll through the page so native loading="lazy" images load before capture.
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
        window.scrollTo(0, y);
        await new Promise((resolve) => { setTimeout(resolve, 100); });
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(500);
    layout = await page.evaluate(findEdgeOverflow);
    await page.screenshot({ path: file, fullPage: true });
  } finally {
    await context.close();
  }

  const sharp = require('sharp');
  const { height } = await sharp(file).metadata();
  return {
    width, height, problems: [...new Set(problems)], layout,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const siteDir = path.resolve(ROOT, options.dir);
  if (!fs.existsSync(path.join(siteDir, 'index.html'))) {
    throw new Error(`${options.dir}/ has no index.html. Run \`npm run build\` first.`);
  }

  const outDir = path.resolve(ROOT, options.out);
  const server = await startServer(siteDir);
  const browser = await launchBrowser();
  const sheets = [];
  const report = [];
  const layoutReport = [];

  try {
    for (let p = 0; p < options.paths.length; p++) {
      const urlPath = options.paths[p];
      const slug = slugify(urlPath);
      fs.mkdirSync(path.join(outDir, slug), { recursive: true });

      for (let s = 0; s < options.schemes.length; s++) {
        const scheme = options.schemes[s];
        const groups = packWidths(options.widths);
        for (let g = 0; g < groups.length; g++) {
          const shots = [];
          for (let w = 0; w < groups[g].length; w++) {
            const width = groups[g][w];
            const file = path.join(outDir, slug, `${width}-${scheme}.png`);
            const result = await capturePage(browser, {
              baseUrl: server.url, urlPath, width, scheme, file,
            });
            shots.push({ file, ...result });
            const where = `${urlPath} @ ${width}px ${scheme}`;
            result.problems.forEach((problem) => report.push(`${where}: ${problem}`));
            result.layout.slice(0, 3).forEach(({ selector, overflow }) => {
              layoutReport.push(`${where}: ${selector} extends ${overflow}px past the viewport edge`);
            });
            if (result.layout.length > 3) layoutReport.push(`${where}: …and ${result.layout.length - 3} more`);
          }
          const sheetFile = path.join(outDir, slug, sheetName(scheme, groups[g]));
          const range = groups[g].length > 1 ? `${groups[g][0]}–${groups[g][groups[g].length - 1]}px` : `${groups[g][0]}px`;
          await composeSheet(shots, `${urlPath} · ${scheme} · ${range}`, options.sheetHeight, sheetFile);
          sheets.push(path.relative(ROOT, sheetFile));
        }
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  log('\nContact sheets (share these):');
  sheets.forEach((sheet) => log(`  ${sheet}`));
  log(`Full-page captures: ${path.relative(ROOT, outDir)}/<page>/<width>-<scheme>.png`);
  if (report.length) {
    log('\nProblems while loading (mention any that affect the screenshots):');
    [...new Set(report)].forEach((line) => log(`  ${line}`));
  }
  if (layoutReport.length) {
    log('\nLayout problems (AGENTS.md Directive 6): content is cut off at the viewport edge.');
    log('Fix the ones your change caused; report the rest as pre-existing.');
    layoutReport.forEach((line) => log(`  ${line}`));
    process.exitCode = 2;
  } else {
    log(`\nLayout check passed at ${options.widths.join(', ')}px.`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    log(error.message);
    process.exit(1);
  });
}

module.exports = {
  parseArgs, slugify, planSheet, packWidths, sheetName, findEdgeOverflow,
};
