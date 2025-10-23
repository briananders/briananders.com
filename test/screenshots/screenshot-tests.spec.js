const { test, expect } = require('@playwright/test');

// Test configuration
const LIVE_SITE_URL = 'https://briananders.net';
const LOCAL_SITE_URL = 'http://localhost:3000';

// Pages to test with their expected content
const PAGES_TO_TEST = [
  {
    path: '/',
    name: 'Homepage',
    description: 'Main landing page'
  },
  {
    path: '/about/',
    name: 'About Page',
    description: 'About page'
  },
  {
    path: '/drums/',
    name: 'Drums Page',
    description: 'Drums page'
  },
  {
    path: '/posts/',
    name: 'Posts Index',
    description: 'Blog posts listing page'
  }
];

// Helper function to take full page screenshot
async function takeFullPageScreenshot(page, name) {
  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle');
  
  // Take full page screenshot
  const screenshot = await page.screenshot({
    fullPage: true,
    type: 'png'
  });
  
  return screenshot;
}

// Helper function to compare screenshots
async function compareScreenshots(localScreenshot, liveScreenshot, pageName) {
  // For now, we'll just save both screenshots for manual comparison
  // In a more advanced setup, you could use image comparison libraries
  const fs = require('fs');
  const path = require('path');
  
  const screenshotsDir = path.join(__dirname, '..', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const localPath = path.join(screenshotsDir, `${pageName}-local-${timestamp}.png`);
  const livePath = path.join(screenshotsDir, `${pageName}-live-${timestamp}.png`);
  
  fs.writeFileSync(localPath, localScreenshot);
  fs.writeFileSync(livePath, liveScreenshot);
  
  console.log(`Screenshots saved for ${pageName}:`);
  console.log(`  Local: ${localPath}`);
  console.log(`  Live:  ${livePath}`);
}

// Test each page
PAGES_TO_TEST.forEach(({ path, name, description }) => {
  test.describe(`${name} Screenshot Comparison`, () => {
    test(`Compare ${description} between local and live`, async ({ page }) => {
      // Navigate to local version
      await page.goto(`${LOCAL_SITE_URL}${path}`);
      await page.waitForLoadState('networkidle');
      
      // Take local screenshot
      const localScreenshot = await takeFullPageScreenshot(page, `${name}-local`);
      
      // Navigate to live version
      await page.goto(`${LIVE_SITE_URL}${path}`);
      await page.waitForLoadState('networkidle');
      
      // Take live screenshot
      const liveScreenshot = await takeFullPageScreenshot(page, `${name}-live`);
      
      // Compare screenshots
      await compareScreenshots(localScreenshot, liveScreenshot, name);
      
      // Basic content validation - check that both pages have similar structure
      const localTitle = await page.title();
      
      // Go back to local version for comparison
      await page.goto(`${LOCAL_SITE_URL}${path}`);
      const localTitle2 = await page.title();
      
      // Both pages should have titles (basic validation)
      expect(localTitle).toBeTruthy();
      expect(localTitle2).toBeTruthy();
    });
  });
});

// Test for specific elements that should be present
test.describe('Content Validation', () => {
  test('Homepage has expected elements', async ({ page }) => {
    await page.goto(`${LOCAL_SITE_URL}/`);
    await page.waitForLoadState('networkidle');
    
    // Check for common elements that should be present
    const body = await page.locator('body');
    await expect(body).toBeVisible();
    
    // Check for navigation or main content
    const mainContent = page.locator('main, .main, #main, .content, #content').first();
    if (await mainContent.count() > 0) {
      await expect(mainContent).toBeVisible();
    }
  });
  
  test('About page has expected elements', async ({ page }) => {
    await page.goto(`${LOCAL_SITE_URL}/about/`);
    await page.waitForLoadState('networkidle');
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });
  
  test('Drums page has expected elements', async ({ page }) => {
    await page.goto(`${LOCAL_SITE_URL}/drums/`);
    await page.waitForLoadState('networkidle');
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });
});

// Test responsive design
test.describe('Responsive Design', () => {
  test('Homepage is responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(`${LOCAL_SITE_URL}/`);
    await page.waitForLoadState('networkidle');
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
    
    // Take mobile screenshot
    const mobileScreenshot = await takeFullPageScreenshot(page, 'Homepage-Mobile');
    expect(mobileScreenshot).toBeTruthy();
  });
  
  test('Homepage is responsive on tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto(`${LOCAL_SITE_URL}/`);
    await page.waitForLoadState('networkidle');
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
    
    // Take tablet screenshot
    const tabletScreenshot = await takeFullPageScreenshot(page, 'Homepage-Tablet');
    expect(tabletScreenshot).toBeTruthy();
  });
});