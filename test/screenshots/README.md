# Screenshot Testing

This directory contains screenshot testing utilities for comparing the local build against the live website at https://briananders.net.

## Overview

The screenshot testing setup uses Playwright to:
- Take screenshots of key pages from both local and live versions
- Compare visual differences between versions
- Test across multiple viewports (desktop, tablet, mobile)
- Generate comparison reports

## Test Files

- `screenshot-tests.spec.js` - Basic screenshot comparison tests
- `visual-regression.spec.js` - Advanced visual regression testing with multiple viewports
- `utils/screenshot-comparison.js` - Utility functions for managing and comparing screenshots

## Running Tests

### Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

3. Build the site:
   ```bash
   npm run build
   ```

### Running Screenshot Tests

```bash
# Run all screenshot tests
npm run test:screenshots

# Run tests with UI (interactive mode)
npm run test:screenshots:ui

# Run tests in headed mode (see browser)
npm run test:screenshots:headed

# Generate comparison report
npm run test:screenshots:report

# Generate HTML report
npm run test:screenshots:html

# Clean up old screenshots
npm run test:screenshots:cleanup
```

## Test Configuration

### Pages Tested

The following pages are automatically tested:
- `/` - Homepage
- `/about/` - About page
- `/drums/` - Drums page
- `/posts/` - Blog posts listing

### Viewports Tested

- Desktop: 1920x1080
- Tablet: 768x1024
- Mobile: 375x667

### Browsers Tested

- Chromium
- Firefox
- WebKit

## Output

### Screenshots

Screenshots are saved in `test/screenshots/comparisons/` with the following naming convention:
```
{page-name}-{viewport}-{local|live}-{timestamp}.png
```

Example:
```
homepage-desktop-local-2024-01-15.png
homepage-desktop-live-2024-01-15.png
```

### Reports

- `comparison-report.json` - Machine-readable comparison data
- `comparison-report.html` - Human-readable HTML report with side-by-side comparisons

## CI/CD Integration

The screenshot tests are automatically run in GitHub Actions on:
- Push to main/develop branches
- Pull requests
- Manual workflow dispatch

### Artifacts

The CI workflow generates:
- Screenshot comparison files
- Playwright test report
- HTML comparison report

## Troubleshooting

### Common Issues

1. **Browser dependencies missing**: Run `npx playwright install-deps`
2. **Local server not starting**: Ensure port 3000 is available
3. **Screenshots not generating**: Check that both local and live sites are accessible

### Debug Mode

Run tests with debug output:
```bash
DEBUG=pw:api npm run test:screenshots
```

### Viewing Screenshots

1. Run the tests to generate screenshots
2. Open `test/screenshots/comparison-report.html` in a browser
3. Compare local vs live screenshots side by side

## Customization

### Adding New Pages

Edit `PAGES_TO_TEST` in the test files:

```javascript
const PAGES_TO_TEST = [
  // ... existing pages
  {
    path: '/new-page/',
    name: 'new-page',
    description: 'New page description'
  }
];
```

### Adding New Viewports

Edit `VIEWPORTS` in `visual-regression.spec.js`:

```javascript
const VIEWPORTS = [
  // ... existing viewports
  { name: 'large-desktop', width: 2560, height: 1440 }
];
```

### Modifying Test Behavior

- Change screenshot options in `takeFullPageScreenshot()`
- Adjust wait times in `page.waitForTimeout()`
- Modify comparison logic in `compareScreenshots()`

## Best Practices

1. **Run tests regularly** - Catch visual regressions early
2. **Review differences** - Not all differences are bugs
3. **Update baselines** - When intentional changes are made
4. **Clean up old files** - Use the cleanup script regularly
5. **Test across browsers** - Ensure consistency

## Performance Considerations

- Screenshots are large files - clean up regularly
- Tests can be slow - consider running in parallel
- Network timeouts - ensure stable internet connection
- Resource usage - tests use significant CPU/memory