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

// Simple markdown parser - basic implementation
const marked = {
  parse: (markdown) => {
    let html = markdown
      // Code blocks first (to avoid conflicts)
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Blockquotes
      .replace(/^> (.*$)/gim, '<blockquote><p>$1</p></blockquote>')
      // Lists - handle both * and - 
      .replace(/^(\s*)[\*\-] (.*$)/gim, '$1<li>$2</li>')
      .replace(/^(\s*)(\d+)\. (.*$)/gim, '$1<li>$2. $3</li>')
      // Bold and italic
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // Horizontal rules
      .replace(/^---$/gim, '<hr>')
      .replace(/^\*\*\*$/gim, '<hr>');
    
    // Wrap list items in ul tags
    html = html.replace(/(<li>.*<\/li>)/gs, (match) => {
      // Check if already wrapped
      if (match.includes('<ul>')) return match;
      return '<ul>' + match + '</ul>';
    });
    
    // Split into lines and process paragraphs
    const lines = html.split('\n');
    const processedLines = [];
    let inCodeBlock = false;
    let inList = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Track code blocks
      if (line.includes('<pre>')) inCodeBlock = true;
      if (line.includes('</pre>')) inCodeBlock = false;
      
      // Track lists
      if (line.includes('<li>')) inList = true;
      if (inList && !line.includes('<li>') && !line.trim().startsWith('<ul>') && !line.trim().startsWith('</ul>')) inList = false;
      
      // Skip empty lines
      if (line.trim() === '') {
        processedLines.push('');
        continue;
      }
      
      // Don't wrap code blocks, headers, blockquotes, lists, or horizontal rules
      if (inCodeBlock || 
          line.match(/^<[h|b|u|o|d|p|h][1-6]|^<blockquote|^<li|^<ul|^<hr|^<pre/)) {
        processedLines.push(line);
      } else if (!inList && line.trim() !== '') {
        // Wrap in paragraph if not already wrapped
        if (!line.startsWith('<p>') && !line.startsWith('<ul>') && !line.startsWith('<li>')) {
          processedLines.push('<p>' + line + '</p>');
        } else {
          processedLines.push(line);
        }
      } else {
        processedLines.push(line);
      }
    }
    
    return processedLines.join('\n');
  }
};

function handleTemplateError(e, fileType = 'Template') {
  console.error(e.message.red);
  notifier.notify({
    title: `${fileType} Error`,
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
  fileType = 'EJS',
  isMdEjs = false,
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
        let content = frontMatter.content;
        
        // Process content based on file type
        if (fileType === 'Markdown' || fileType === 'Markdown+EJS') {
          // For .md.ejs files, process through EJS first, then markdown
          if (isMdEjs) {
            const renderedEjs = ejs.render(content, templateData, ejsOptions);
            content = marked.parse(renderedEjs);
          } else {
            // For .md files, just process through markdown
            content = marked.parse(content);
          }
        } else {
          // For .ejs files, process through EJS
          content = ejs.render(content, templateData, ejsOptions);
        }
        
        html = ejs.render(fileData, merge({ content }, templateData), ejsOptions);
      } catch (e) {
        html = handleTemplateError(e, fileType);
      }

      // Handle nested frontmatter (frontmatter within rendered content)
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
          fileType,
          isMdEjs,
        });
      }
      resolve(html);
    });
  });
}

module.exports = async function bundleTemplates({
  dir, buildEvents, pageMappingData, debug,
}) {
  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const siteData = require(`${dir.build}constants/site-data`)(dir);
  const timestamp = require(`${dir.build}helpers/timestamp`);
  const production = require(`${dir.build}helpers/production`);

  // Find all template files: .ejs, .md, and .md.ejs
  const templateGlob = glob.sync(`${dir.src}templates/**/[^_]*.{ejs,md,md.ejs}`);
  
  log(`${timestamp.stamp()} bundleTemplates()`);

  let processed = 0;

  for (let index = 0; index < templateGlob.length; index++) {
    const templatePath = templateGlob[index];
    
    // Determine file type and processing method
    let fileType, isMdEjs;
    if (templatePath.endsWith('.md.ejs')) {
      fileType = 'Markdown+EJS';
      isMdEjs = true;
    } else if (templatePath.endsWith('.md')) {
      fileType = 'Markdown';
      isMdEjs = false;
    } else {
      fileType = 'EJS';
      isMdEjs = false;
    }
    
    if (debug) log(`${timestamp.stamp()} ${'REQUEST'.magenta} - Compiling ${fileType} - ${templatePath.split(/templates/)[1]}`);
    
    const ejsFunctions = require(`${dir.build}helpers/ejs-functions`)(dir, pageMappingData);
    const ejsOptions = {
      compileDebug: true,
      filename: templatePath,
      root: `${dir.src}templates/`,
    };
    
    // Determine output path based on file type
    let outputPath;
    if (fileType === 'Markdown+EJS') {
      // .md.ejs files become .html
      outputPath = templatePath.replace(`${dir.src}templates/`, dir.package).replace(/\.md\.ejs$/, '/index.html');
    } else if (fileType === 'Markdown') {
      // .md files become .html
      outputPath = templatePath.replace(`${dir.src}templates/`, dir.package).replace(/\.md$/, '/index.html');
    } else {
      // .ejs files become .html
      outputPath = templatePath.replace(`${dir.src}templates/`, dir.package).replace(/\.ejs$/, (templatePath.includes('.html.ejs')) ? '' : '/index.html');
    }
    
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
      fileType,
      isMdEjs,
    }).catch((err) => {
      if (err && production) throw err;
      else if (err) {
        console.error(err.message.red);
        notifier.notify({
          title: `${fileType} Template Error`,
          message: err.message,
        });
      }
      processed++;
    });

    fs.mkdirp(path.dirname(outputPath), (err) => {
      if (err) throw err;

      fs.writeFile(outputPath, html, (e) => {
        if (e) throw e;

        if (debug) log(`${timestamp.stamp()} ${'SUCCESS'.bold.green} - Compiled ${fileType} - ${outputPath.split(/package/)[1]}`);
        processed++;

        if (processed >= templateGlob.length) {
          log(`${timestamp.stamp()} bundleTemplates(): ${'DONE'.bold.green}`);
          buildEvents.emit(BUILD_EVENTS.templatesMoved);
        }
      });
    });
  }
};