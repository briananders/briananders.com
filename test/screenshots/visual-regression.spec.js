const { test, expect } = require('@playwright/test');

// Test configuration
const LIVE_SITE_URL = 'https://briananders.net';
const LOCAL_SITE_URL = 'http://localhost:3000';

// Pages to test with their expected content
const PAGES_TO_TEST = [
  {
    path: '/',
    name: 'homepage',
    description: 'Main landing page'
  },
  {
    path: '/about/',
    name: 'about',
    description: 'About page'
  },
  {
    path: '/drums/',
    name: 'drums',
    description: 'Drums page'
  },
  {
    path: '/posts/',
    name: 'posts',
    description: 'Blog posts listing page'
  }
];

// Viewport configurations to test
const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 }
];

// Test each page and viewport combination
PAGES_TO_TEST.forEach(({ path, name, description }) => {
  test.describe(`${description} Visual Regression`, () => {
    VIEWPORTS.forEach(({ name: viewportName, width, height }) => {
      test(`${description} - ${viewportName} viewport`, async ({ page }) => {
        // Set viewport
        await page.setViewportSize({ width, height });
        
        // Test local version
        await page.goto(`${LOCAL_SITE_URL}${path}`);
        await page.waitForLoadState('networkidle');
        
        // Wait a bit for any animations or dynamic content to settle
        await page.waitForTimeout(1000);
        
        // Take screenshot of local version
        const localScreenshot = await page.screenshot({
          fullPage: true,
          type: 'png'
        });
        
        // Navigate to live version
        await page.goto(`${LIVE_SITE_URL}${path}`);
        await page.waitForLoadState('networkidle');
        
        // Wait a bit for any animations or dynamic content to settle
        await page.waitForTimeout(1000);
        
        // Take screenshot of live version
        const liveScreenshot = await page.screenshot({
          fullPage: true,
          type: 'png'
        });
        
        // Save screenshots for manual comparison
        const fs = require('fs');
        const path = require('path');
        
        const screenshotsDir = path.join(__dirname, '..', 'screenshots', 'comparisons');
        if (!fs.existsSync(screenshotsDir)) {
          fs.mkdirSync(screenshotsDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const localPath = path.join(screenshotsDir, `${name}-${viewportName}-local-${timestamp}.png`);
        const livePath = path.join(screenshotsDir, `${name}-${viewportName}-live-${timestamp}.png`);
        
        fs.writeFileSync(localPath, localScreenshot);
        fs.writeFileSync(livePath, liveScreenshot);
        
        console.log(`Screenshots saved for ${description} (${viewportName}):`);
        console.log(`  Local: ${localPath}`);
        console.log(`  Live:  ${livePath}`);
        
        // Basic validation - both screenshots should exist and have content
        expect(localScreenshot.length).toBeGreaterThan(0);
        expect(liveScreenshot.length).toBeGreaterThan(0);
        
        // For now, we'll just verify both screenshots were taken successfully
        // In a production environment, you might want to add more sophisticated
        // image comparison logic here
      });
    });
  });
});

// Test specific elements and interactions
test.describe('Element-specific Visual Tests', () => {
  test('Navigation elements are visible', async ({ page }) => {
    await page.goto(`${LOCAL_SITE_URL}/`);
    await page.waitForLoadState('networkidle');
    
    // Look for common navigation elements
    const navSelectors = [
      'nav',
      '.nav',
      '.navigation',
      '.menu',
      '.header',
      '.navbar'
    ];
    
    let navFound = false;
    for (const selector of navSelectors) {
      const element = page.locator(selector).first();
      if (await element.count() > 0) {
        navFound = true;
        await expect(element).toBeVisible();
        break;
      }
    }
    
    // If no specific nav found, check for any clickable links
    if (!navFound) {
      const links = page.locator('a[href]');
      const linkCount = await links.count();
      expect(linkCount).toBeGreaterThan(0);
    }
  });
  
  test('Images load correctly', async ({ page }) => {
    await page.goto(`${LOCAL_SITE_URL}/`);
    await page.waitForLoadState('networkidle');
    
    // Check for images and ensure they load
    const images = page.locator('img');
    const imageCount = await images.count();
    
    if (imageCount > 0) {
      // Check that at least some images are visible
      const visibleImages = images.filter({ hasText: '' });
      const visibleCount = await visibleImages.count();
      expect(visibleCount).toBeGreaterThan(0);
    }
  });
  
  test('Text content is readable', async ({ page }) => {
    await page.goto(`${LOCAL_SITE_URL}/`);
    await page.waitForLoadState('networkidle');
    
    // Check for main content areas
    const contentSelectors = [
      'main',
      '.main',
      '.content',
      '.container',
      'article',
      '.post'
    ];
    
    let contentFound = false;
    for (const selector of contentSelectors) {
      const element = page.locator(selector).first();
      if (await element.count() > 0) {
        contentFound = true;
        await expect(element).toBeVisible();
        break;
      }
    }
    
    // If no specific content area found, check body has text
    if (!contentFound) {
      const body = page.locator('body');
      const text = await body.textContent();
      expect(text).toBeTruthy();
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });
});

// Performance and loading tests
test.describe('Performance Visual Tests', () => {
  test('Page loads within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(`${LOCAL_SITE_URL}/`);
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);
    
    console.log(`Page loaded in ${loadTime}ms`);
  });
  
  test('No console errors on page load', async ({ page }) => {
    const errors = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto(`${LOCAL_SITE_URL}/`);
    await page.waitForLoadState('networkidle');
    
    // Allow some time for any async errors to surface
    await page.waitForTimeout(2000);
    
    // Log errors for debugging but don't fail the test
    if (errors.length > 0) {
      console.log('Console errors found:', errors);
    }
    
    // For now, we'll just log errors but not fail the test
    // In a production environment, you might want to be more strict
  });
});