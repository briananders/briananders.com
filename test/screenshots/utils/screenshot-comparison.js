const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Utility functions for screenshot comparison and management
 */

class ScreenshotComparison {
  constructor() {
    this.screenshotsDir = path.join(__dirname, '..', '..', 'screenshots');
    this.comparisonsDir = path.join(this.screenshotsDir, 'comparisons');
    this.baselineDir = path.join(this.screenshotsDir, 'baselines');
    
    this.ensureDirectories();
  }
  
  ensureDirectories() {
    [this.screenshotsDir, this.comparisonsDir, this.baselineDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }
  
  /**
   * Generate a comparison report between local and live screenshots
   */
  generateComparisonReport() {
    const comparisons = this.getComparisonFiles();
    const report = {
      timestamp: new Date().toISOString(),
      totalComparisons: comparisons.length,
      comparisons: comparisons.map(comp => ({
        name: comp.name,
        viewport: comp.viewport,
        localPath: comp.localPath,
        livePath: comp.livePath,
        localSize: this.getFileSize(comp.localPath),
        liveSize: this.getFileSize(comp.livePath),
        sizeDifference: this.getFileSizeDifference(comp.localPath, comp.livePath)
      }))
    };
    
    const reportPath = path.join(this.screenshotsDir, 'comparison-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`Comparison report generated: ${reportPath}`);
    return report;
  }
  
  /**
   * Get all comparison files from the comparisons directory
   */
  getComparisonFiles() {
    if (!fs.existsSync(this.comparisonsDir)) {
      return [];
    }
    
    const files = fs.readdirSync(this.comparisonsDir);
    const comparisons = [];
    
    // Group files by name and viewport
    const grouped = {};
    
    files.forEach(file => {
      const match = file.match(/^(.+)-(.+)-(local|live)-(.+)\.png$/);
      if (match) {
        const [, name, viewport, type, timestamp] = match;
        const key = `${name}-${viewport}`;
        
        if (!grouped[key]) {
          grouped[key] = { name, viewport, timestamp };
        }
        
        grouped[key][type] = path.join(this.comparisonsDir, file);
      }
    });
    
    return Object.values(grouped).filter(comp => comp.local && comp.live);
  }
  
  /**
   * Get file size in bytes
   */
  getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * Calculate size difference between two files
   */
  getFileSizeDifference(file1, file2) {
    const size1 = this.getFileSize(file1);
    const size2 = this.getFileSize(file2);
    const difference = size2 - size1;
    const percentage = size1 > 0 ? ((difference / size1) * 100).toFixed(2) : 0;
    
    return {
      bytes: difference,
      percentage: parseFloat(percentage)
    };
  }
  
  /**
   * Clean up old screenshot files (keep only last 5 runs)
   */
  cleanupOldScreenshots() {
    const files = fs.readdirSync(this.comparisonsDir);
    const grouped = {};
    
    // Group files by name and viewport
    files.forEach(file => {
      const match = file.match(/^(.+)-(.+)-(local|live)-(.+)\.png$/);
      if (match) {
        const [, name, viewport, type, timestamp] = match;
        const key = `${name}-${viewport}`;
        
        if (!grouped[key]) {
          grouped[key] = [];
        }
        
        grouped[key].push({
          file,
          timestamp: new Date(timestamp),
          type
        });
      }
    });
    
    // Keep only the 5 most recent for each group
    Object.values(grouped).forEach(group => {
      group.sort((a, b) => b.timestamp - a.timestamp);
      const toDelete = group.slice(5);
      
      toDelete.forEach(item => {
        const filePath = path.join(this.comparisonsDir, item.file);
        try {
          fs.unlinkSync(filePath);
          console.log(`Deleted old screenshot: ${item.file}`);
        } catch (error) {
          console.warn(`Failed to delete ${item.file}:`, error.message);
        }
      });
    });
  }
  
  /**
   * Create a simple HTML report for viewing screenshots
   */
  generateHTMLReport() {
    const report = this.generateComparisonReport();
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Screenshot Comparison Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .comparison { margin: 20px 0; padding: 20px; border: 1px solid #ddd; }
        .screenshots { display: flex; gap: 20px; }
        .screenshot { flex: 1; }
        .screenshot img { max-width: 100%; height: auto; border: 1px solid #ccc; }
        .metadata { margin-top: 10px; font-size: 12px; color: #666; }
        .size-diff { font-weight: bold; }
        .size-diff.positive { color: green; }
        .size-diff.negative { color: red; }
    </style>
</head>
<body>
    <h1>Screenshot Comparison Report</h1>
    <p>Generated: ${report.timestamp}</p>
    <p>Total Comparisons: ${report.totalComparisons}</p>
    
    ${report.comparisons.map(comp => `
        <div class="comparison">
            <h2>${comp.name} - ${comp.viewport}</h2>
            <div class="screenshots">
                <div class="screenshot">
                    <h3>Local</h3>
                    <img src="${path.relative(this.screenshotsDir, comp.localPath)}" alt="Local screenshot">
                    <div class="metadata">Size: ${this.formatFileSize(comp.localSize)}</div>
                </div>
                <div class="screenshot">
                    <h3>Live</h3>
                    <img src="${path.relative(this.screenshotsDir, comp.livePath)}" alt="Live screenshot">
                    <div class="metadata">Size: ${this.formatFileSize(comp.liveSize)}</div>
                </div>
            </div>
            <div class="metadata">
                Size difference: 
                <span class="size-diff ${comp.sizeDifference.percentage >= 0 ? 'positive' : 'negative'}">
                    ${comp.sizeDifference.percentage >= 0 ? '+' : ''}${comp.sizeDifference.percentage}%
                    (${comp.sizeDifference.bytes >= 0 ? '+' : ''}${this.formatFileSize(Math.abs(comp.sizeDifference.bytes))})
                </span>
            </div>
        </div>
    `).join('')}
</body>
</html>`;
    
    const htmlPath = path.join(this.screenshotsDir, 'comparison-report.html');
    fs.writeFileSync(htmlPath, html);
    console.log(`HTML report generated: ${htmlPath}`);
  }
  
  /**
   * Format file size in human readable format
   */
  formatFileSize(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const comparison = new ScreenshotComparison();
  
  switch (command) {
    case 'report':
      comparison.generateComparisonReport();
      break;
    case 'html':
      comparison.generateHTMLReport();
      break;
    case 'cleanup':
      comparison.cleanupOldScreenshots();
      break;
    case 'all':
      comparison.generateComparisonReport();
      comparison.generateHTMLReport();
      comparison.cleanupOldScreenshots();
      break;
    default:
      console.log('Usage: node screenshot-comparison.js [report|html|cleanup|all]');
      console.log('  report  - Generate JSON comparison report');
      console.log('  html    - Generate HTML comparison report');
      console.log('  cleanup - Clean up old screenshot files');
      console.log('  all     - Run all operations');
  }
}

module.exports = ScreenshotComparison;