import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const packageDir = path.join(projectRoot, 'package');
const screenshotsDir = path.join(projectRoot, 'test', 'screenshots');
const localScreenshotsDir = path.join(screenshotsDir, 'local');
const productionScreenshotsDir = path.join(screenshotsDir, 'production');
const diffScreenshotsDir = path.join(screenshotsDir, 'diff');
const viewports = [
  { width: 1280, height: 800, name: '1280px' },
  { width: 400, height: 800, name: '400px' },
];
const productionBaseUrl = 'https://briananders.com';

// Helper to find all HTML files recursively
async function findHtmlFiles(dir) {
  const files = [];
  async function walk(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        files.push(fullPath);
      }
    }
  }
  await walk(dir);
  return files;
}

// Helper to get relative path from package directory
function getRelativePath(fullPath, baseDir) {
  return path.relative(baseDir, fullPath);
}

// Helper to convert file path to URL path
function filePathToUrlPath(filePath, baseDir) {
  const relative = getRelativePath(filePath, baseDir);
  // Convert to URL path (forward slashes, remove index.html if it's the last segment)
  let urlPath = relative.replace(/\\/g, '/');
  if (urlPath.endsWith('/index.html')) {
    urlPath = urlPath.slice(0, -10); // Remove '/index.html'
  } else if (urlPath.endsWith('.html')) {
    urlPath = urlPath.slice(0, -5); // Remove '.html'
  }
  return urlPath || '/';
}

// Helper to take screenshot
async function takeScreenshot(page, filePath, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle');
  // Wait a bit more for any animations or dynamic content
  await page.waitForTimeout(1000);
  
  const screenshot = await page.screenshot({
    fullPage: true,
    type: 'png',
  });
  return screenshot;
}

// Helper to save screenshot
async function saveScreenshot(screenshot, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, screenshot);
}

// Helper to load PNG from buffer
function loadPNG(buffer) {
  return new Promise((resolve, reject) => {
    const img = new PNG();
    img.parse(buffer, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}

// Helper to perform pixel diff
async function pixelDiff(localBuffer, productionBuffer, outputPath) {
  const localImg = await loadPNG(localBuffer);
  const productionImg = await loadPNG(productionBuffer);
  
  const { width, height } = localImg;
  const diff = new PNG({ width, height });
  
  const numDiffPixels = pixelmatch(
    localImg.data,
    productionImg.data,
    diff.data,
    width,
    height,
    {
      threshold: 0.1,
    }
  );
  
  await saveScreenshot(diff.pack(), outputPath);
  
  return {
    numDiffPixels,
    totalPixels: width * height,
    diffPercentage: (numDiffPixels / (width * height)) * 100,
  };
}

// Run the production build
async function runProductionBuild() {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, NODE_ENV: 'production' };
    const child = spawn('node', ['index.js'], {
      cwd: projectRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Build timed out. Stdout: ${stdout.slice(-2000)}\nStderr: ${stderr.slice(-2000)}`));
    }, 5 * 60 * 1000); // 5 minutes

    child.on('exit', (code, signal) => {
      clearTimeout(timeout);
      if (signal) return reject(new Error(`Build terminated by signal: ${signal}`));
      if (code === 0) return resolve({ stdout, stderr });
      reject(new Error(`Build exited with code ${code}. Stdout: ${stdout.slice(-2000)}\nStderr: ${stderr.slice(-2000)}`));
    });
  });
}

let browser;
let htmlFiles = [];

before(async () => {
  // Clean and create screenshot directories
  await fs.rm(screenshotsDir, { recursive: true, force: true });
  await fs.mkdir(localScreenshotsDir, { recursive: true });
  await fs.mkdir(productionScreenshotsDir, { recursive: true });
  await fs.mkdir(diffScreenshotsDir, { recursive: true });
  
  // Run production build
  console.log('Running production build...');
  await runProductionBuild();
  
  // Verify package directory exists
  try {
    await fs.access(packageDir);
  } catch {
    throw new Error(`Package directory does not exist: ${packageDir}`);
  }
  
  // Find all HTML files
  console.log('Finding HTML files...');
  htmlFiles = await findHtmlFiles(packageDir);
  console.log(`Found ${htmlFiles.length} HTML files`);
  
  if (htmlFiles.length === 0) {
    throw new Error('No HTML files found in package directory');
  }
  
  // Launch browser
  console.log('Launching WebKit browser...');
  browser = await webkit.launch();
});

after(async () => {
  if (browser) {
    await browser.close();
  }
});

test('screenshot comparison test', async (t) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const results = [];
  
  for (const htmlFile of htmlFiles) {
    const relativePath = getRelativePath(htmlFile, packageDir);
    const urlPath = filePathToUrlPath(htmlFile, packageDir);
    
    // Local file URL
    const localFileUrl = `file://${htmlFile}`;
    
    // Production URL
    const productionUrl = `${productionBaseUrl}${urlPath}`;
    
    console.log(`\nTesting: ${relativePath}`);
    console.log(`  Local: ${localFileUrl}`);
    console.log(`  Production: ${productionUrl}`);
    
    for (const viewport of viewports) {
      const viewportName = viewport.name;
      
      // Generate screenshot file names
      const safePath = relativePath.replace(/[^a-zA-Z0-9]/g, '_').replace(/\.html$/, '');
      const localScreenshotPath = path.join(
        localScreenshotsDir,
        `${safePath}_${viewportName}.png`
      );
      const productionScreenshotPath = path.join(
        productionScreenshotsDir,
        `${safePath}_${viewportName}.png`
      );
      const diffScreenshotPath = path.join(
        diffScreenshotsDir,
        `${safePath}_${viewportName}.png`
      );
      
      try {
        // Take screenshot of local file
        console.log(`  Taking local screenshot at ${viewportName}...`);
        await page.goto(localFileUrl, { waitUntil: 'networkidle' });
        const localScreenshot = await takeScreenshot(page, localFileUrl, viewport);
        await saveScreenshot(localScreenshot, localScreenshotPath);
        
        // Take screenshot of production site
        console.log(`  Taking production screenshot at ${viewportName}...`);
        await page.goto(productionUrl, { waitUntil: 'networkidle' });
        const productionScreenshot = await takeScreenshot(page, productionUrl, viewport);
        await saveScreenshot(productionScreenshot, productionScreenshotPath);
        
        // Perform pixel diff
        console.log(`  Performing pixel diff at ${viewportName}...`);
        const diffResult = await pixelDiff(
          localScreenshot,
          productionScreenshot,
          diffScreenshotPath
        );
        
        results.push({
          file: relativePath,
          viewport: viewportName,
          urlPath,
          diffPixels: diffResult.numDiffPixels,
          totalPixels: diffResult.totalPixels,
          diffPercentage: diffResult.diffPercentage,
          localPath: localScreenshotPath,
          productionPath: productionScreenshotPath,
          diffPath: diffScreenshotPath,
        });
        
        console.log(`    Diff: ${diffResult.numDiffPixels} pixels (${diffResult.diffPercentage.toFixed(2)}%)`);
        
      } catch (error) {
        console.error(`  Error processing ${relativePath} at ${viewportName}:`, error.message);
        results.push({
          file: relativePath,
          viewport: viewportName,
          urlPath,
          error: error.message,
        });
      }
    }
  }
  
  await context.close();
  
  // Print summary
  console.log('\n=== Screenshot Test Summary ===');
  const successful = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);
  const withDiffs = successful.filter(r => r.diffPixels > 0);
  
  console.log(`Total tests: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`With differences: ${withDiffs.length}`);
  
  if (withDiffs.length > 0) {
    console.log('\nPages with differences:');
    withDiffs.forEach(r => {
      console.log(`  ${r.file} (${r.viewport}): ${r.diffPixels} pixels (${r.diffPercentage.toFixed(2)}%)`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\nFailed tests:');
    failed.forEach(r => {
      console.log(`  ${r.file} (${r.viewport}): ${r.error}`);
    });
  }
  
  // Save results to JSON
  const resultsPath = path.join(screenshotsDir, 'results.json');
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${resultsPath}`);
  
  // Assert that all tests completed (allow some differences, but no errors)
  if (failed.length > 0) {
    throw new Error(`${failed.length} screenshot tests failed. Check the output above for details.`);
  }
  
  // Optionally fail if differences are too large
  // Uncomment the following to fail on any differences:
  // if (withDiffs.length > 0) {
  //   throw new Error(`${withDiffs.length} pages have visual differences. Check diff screenshots.`);
  // }
});
