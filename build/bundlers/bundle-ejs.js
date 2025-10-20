/* eslint-disable no-console */
/* eslint-disable no-loop-func */
const fs = require('fs-extra');
const glob = require('glob');
const path = require('path');
const merge = require('merge');
const ejs = require('ejs');
const matter = require('gray-matter');
const notifier = require('node-notifier');
const util = require('util');
const readFile = util.promisify(fs.readFile);

const { log } = console;

function processMarkdownInContent(content) {
  // This function processes text content and converts markdown to HTML
  // while preserving existing HTML structure
  
  let processedContent = content;
  
  // Process unordered lists (- item or * item)
  // First, find all list items
  const listItems = processedContent.match(/^[\s]*[-*]\s+(.+)$/gm);
  if (listItems) {
    // Replace list items with <li> tags
    processedContent = processedContent.replace(/^[\s]*[-*]\s+(.+)$/gm, '<li>$1</li>');
    // Wrap consecutive <li> tags in <ul>
    processedContent = processedContent.replace(/(<li>.*<\/li>)/s, '<ul>\n$1\n</ul>');
  }
  
  // Process ordered lists (1. item)
  const orderedListItems = processedContent.match(/^[\s]*\d+\.\s+(.+)$/gm);
  if (orderedListItems) {
    // Replace ordered list items with <li> tags
    processedContent = processedContent.replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li>$1</li>');
    // Wrap consecutive <li> tags in <ol>
    processedContent = processedContent.replace(/(<li>.*<\/li>)/s, '<ol>\n$1\n</ol>');
  }
  
  // Process bold text (**text** or __text__)
  processedContent = processedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  processedContent = processedContent.replace(/__(.*?)__/g, '<strong>$1</strong>');
  
  // Process italic text (*text* or _text_)
  processedContent = processedContent.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  processedContent = processedContent.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  // Process code (`code`)
  processedContent = processedContent.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Process links [text](url)
  processedContent = processedContent.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Process line breaks (double space + newline)
  processedContent = processedContent.replace(/  \n/g, '<br>\n');
  
  // Process paragraphs (double newline)
  processedContent = processedContent.replace(/\n\n/g, '</p>\n<p>');
  
  // Wrap in paragraph tags if content doesn't start with HTML and isn't a list
  if (!processedContent.trim().startsWith('<') && !processedContent.includes('<ul>') && !processedContent.includes('<ol>')) {
    processedContent = '<p>' + processedContent + '</p>';
  }
  
  return processedContent;
}

function handleTemplateError(e) {
  console.error(e.message.red);
  notifier.notify({
    title: 'Template Error',
    message: e.message,
  });
  return `
    <html>
      <head></head>
      <body>
        <h1>There was an error.</h1>
        <div style="color: red; font-family: monospace;">
          ${
  e.message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>')
    .replace(/\s\s/g, '&nbsp;&nbsp;')
}
        </div>
      </body>
    </html>`;
}

async function renderTemplate({
  templatePath,
  ejsFunctions,
  siteData,
  dir,
  production,
  ejsOptions,
  pagePath,
  frontMatter,
}) {
  return new Promise((resolve, reject) => {
    const templateData = merge({}, ejsFunctions, siteData, frontMatter.data, { path: pagePath });

    if (!production && !templateData.layout) {
      const errorMessage = `You are missing a template definition in ${templatePath}`;
      console.error(errorMessage.red);
      notifier.notify({
        title: 'Template undefined',
        message: errorMessage,
      });
      reject();
    }

    readFile(`${dir.src}layout/${templateData.layout}.ejs`).catch((error) => {
      if (error && production) throw error;
      else if (error) {
        console.error(error.message.red);
        notifier.notify({
          title: 'Template Error',
          message: error.message,
        });
        reject();
      }
    }).then(async (fileBuffer) => {
      const fileData = fileBuffer.toString();
      let html;
      try {
        // Process the front matter content with markdown conversion
        const processedContent = processMarkdownInContent(frontMatter.content);
        const renderedTemplate = ejs.render(processedContent, templateData, ejsOptions);
        html = ejs.render(fileData, merge({ content: renderedTemplate }, templateData), ejsOptions);
      } catch (e) {
        html = handleTemplateError(e);
      }

      if (matter.test(html)) {
        const nextFrontMatter = matter(html);
        frontMatter.content = nextFrontMatter.content;
        frontMatter.data = merge({}, frontMatter.data, nextFrontMatter.data);
        html = await renderTemplate({
          templatePath,
          ejsFunctions,
          siteData,
          dir,
          production,
          ejsOptions,
          pagePath,
          frontMatter,
        });
      }
      resolve(html);
    });
  });
}

// Export the markdown processing function for testing
module.exports.processMarkdownInContent = processMarkdownInContent;

module.exports = async function bundleEJS({
  dir, buildEvents, pageMappingData, debug,
}) {
  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const siteData = require(`${dir.build}constants/site-data`)(dir);
  const timestamp = require(`${dir.build}helpers/timestamp`);
  const templateGlob = glob.sync(`${dir.src}templates/**/[^_]*.ejs`);
  const production = require(`${dir.build}helpers/production`);

  log(`${timestamp.stamp()} bundleEJS()`);

  let processed = 0;

  for (let index = 0; index < templateGlob.length; index++) {
    const templatePath = templateGlob[index];
    if (debug) log(`${timestamp.stamp()} ${'REQUEST'.magenta} - Compiling Template - ${templatePath.split(/templates/)[1]}`);
    const ejsFunctions = require(`${dir.build}helpers/ejs-functions`)(dir, pageMappingData);
    const ejsOptions = {
      compileDebug: true,
      filename: templatePath,
      root: `${dir.src}templates/`,
    };
    const outputPath = templatePath.replace(`${dir.src}templates/`, dir.package).replace(/\.ejs$/, (templatePath.includes('.html.ejs')) ? '' : '/index.html');
    const pagePath = outputPath.replace(dir.package, '').replace('index.html', '');
    const frontMatter = matter.read(templatePath);

    const html = await renderTemplate({
      templatePath,
      ejsFunctions,
      siteData,
      dir,
      production,
      ejsOptions,
      pagePath,
      frontMatter,
    }).catch((err) => {
      if (err && production) throw err;
      else if (err) {
        console.error(err.message.red);
        notifier.notify({
          title: 'Template Error',
          message: err.message,
        });
      }
      processed++;
    });

    fs.mkdirp(path.dirname(outputPath), (err) => {
      if (err) throw err;

      fs.writeFile(outputPath, html, (e) => {
        if (e) throw e;

        if (debug) log(`${timestamp.stamp()} ${'SUCCESS'.bold.green} - Compiled Template - ${outputPath.split(/package/)[1]}`);
        processed++;

        if (processed >= templateGlob.length) {
          log(`${timestamp.stamp()} bundleEJS(): ${'DONE'.bold.green}`);
          buildEvents.emit(BUILD_EVENTS.templatesMoved);
        }
      });
    });
  }
};
