const fs = require('fs-extra');
const glob = require('glob');

const { log } = console;

module.exports = function processExternalLinks({
  dir, completionFlags, buildEvents, debug,
}) {
  completionFlags.EXTERNAL_LINKS_PROCESSED = false;

  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);
  const siteData = require(`${dir.build}constants/site-data`)(dir);

  log(`${timestamp.stamp()} processExternalLinks()`);

  const htmlGlob = glob.sync(`${dir.package}**/*.html`);
  let processed = 0;

  // Extract domain from site data
  const currentDomain = siteData.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  
  htmlGlob.forEach((htmlFileName, index, array) => {
    if (debug) log(`${timestamp.stamp()} processExternalLinks - ${htmlFileName.split(dir.package)[1]}`);

    fs.readFile(htmlFileName, (error, data) => {
      if (error) throw error;

      let htmlContent = data.toString();
      let modified = false;
      
      // Regex to find anchor tags with href attributes that don't already have is-external
      const anchorRegex = /<a\s+([^>]*?)href\s*=\s*([^>\s]+)([^>]*?)(?<!is-external)([^>]*?)>/gi;
      
      htmlContent = htmlContent.replace(anchorRegex, (match, beforeHref, href, afterHref, rest) => {
        // Skip if already has is-external attribute
        if (match.includes('is-external')) {
          return match;
        }
        
        // Check if it's an external link
        if (isExternalLink(href, currentDomain)) {
          modified = true;
          // Add is-external attribute
          return `<a ${beforeHref}href="${href}"${afterHref} is-external${rest}>`;
        }
        
        return match;
      });
      
      if (modified) {
        fs.writeFile(htmlFileName, htmlContent, (err) => {
          if (err) throw err;
          processed++;
          checkComplete();
        });
      } else {
        processed++;
        checkComplete();
      }
    });
  });

  function checkComplete() {
    if (processed === htmlGlob.length) {
      log(`${timestamp.stamp()} processExternalLinks(): ${'DONE'.bold.green}`);
      completionFlags.EXTERNAL_LINKS_PROCESSED = true;
      buildEvents.emit(BUILD_EVENTS.externalLinksProcessed);
    }
  }
};

function isExternalLink(href, currentDomain) {
  // Skip empty, fragment-only, or javascript: links
  if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return false;
  }
  
  // Skip relative links (starting with / or ./ or ../)
  if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
    return false;
  }
  
  // Check if it's a full URL
  try {
    const url = new URL(href, 'https://example.com');
    const hostname = url.hostname.toLowerCase();
    
    // Compare with current domain (without www)
    const currentHostname = currentDomain.toLowerCase().replace(/^www\./, '');
    const linkHostname = hostname.replace(/^www\./, '');
    
    return linkHostname !== currentHostname;
  } catch (error) {
    // If URL parsing fails, treat as relative/internal
    return false;
  }
}