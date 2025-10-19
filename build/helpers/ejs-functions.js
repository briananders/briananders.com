const ejs = require('ejs');
const fs = require('fs');
const hljs = require('highlight.js');
const merge = require('merge');
const sass = require('node-sass');
const sizeOf = require('image-size');
const path = require('path');
const { camelize, dasherize } = require('underscore.string');

function squeakyClean(arr) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] == null || arr[i] === '') {
      arr.splice(i, 1);
    }
  }
  return arr;
}

function cleanUpString(str) {
  str = str.toString();
  str = str.replace(/^\s+/, '');
  str = str.replace(/\s+$/, '');
  return str.split(/\s/g).join(' ');
}

module.exports = (dir, pageMappingData) => ({
  partial(partialPath, data) {
    const newPath = path.join(dir.src, 'partials/', `${partialPath}.ejs`);

    return ejs.render(fs.readFileSync(newPath).toString(), data, {
      compileDebug: true,
    });
  },

  getChildPages(parentPath) {
    return pageMappingData.filter((page) => {
      const splitUrl = page.url.split('/');
      squeakyClean(splitUrl);
      const iOf = splitUrl.indexOf(parentPath);
      const len = splitUrl.length - 1;
      if (parentPath === '') {
        return len === 0 && !page.url.includes('.html');
      } if (iOf === -1) {
        return false;
      } if (len - iOf === 1) {
        return true;
      }
      return false;
    });
  },

  formattedDate(dateString) {
    const monthName = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ];
    const date = new Date(dateString);
    const month = monthName[date.getMonth()];
    return `${month} ${date.getFullYear()}`;
  },

  noWidows(str) {
    // replace the last space in a string with a &nbsp;
    // any double underscores are replaced with regular spaces
    return str.replace(/\s([^\s]+)$/, '&nbsp;$1').replace(/__/g, ' ');
  },

  code(block, locals = {}) {
    // https://github.com/highlightjs/highlight.js/blob/master/SUPPORTED_LANGUAGES.md
    const highlightedCode = (locals.language !== undefined)
      ? hljs.highlight(block, { language: locals.language }).value
      : hljs.highlightAuto(block).value;
    return `
      <pre class="code-container ${locals.class || ''}" style="${locals.style || ''}"><code>${highlightedCode}</code></pre>
    `;
  },

  img({
    src, alt = '', classes = [], width, height,
  } = {}) {
    if (!src) {
      throw new Error('img is missing src attribute');
    }
    const dimensions = sizeOf(path.join(dir.package, src));
    return `<img src="${src}" alt="${alt}" height="${height || dimensions.height}" width="${width || dimensions.width}" ${classes.length ? `class="${classes.join(' ')}"` : ''} />`;
  },

  lazyImage({
    src, alt = '', classes = [], width, height,
  } = {}) {
    if (!src) {
      throw new Error('lazyImage is missing src attribute');
    }
    const dimensions = sizeOf(path.join(dir.package, src));
    return `
      <link rel="preload" href="${src}" as="image" />
      <img lazy src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width || dimensions.width} ${height || dimensions.height}'%3E%3C/svg%3E" data-src="${src}" alt="${alt}" height="${height || dimensions.height}" width="${width || dimensions.width}" ${classes.length ? `class="${classes.join(' ')}"` : ''} />
    `;
  },

  lazyVideo({ srcs, placeholders, attributes = ['autoplay', 'muted', 'loop', 'playsinline'] } = {}) {
    if (!srcs) {
      throw new Error('lazyVideo is missing srcs attribute');
    }
    const desktopDimensions = sizeOf(path.join(dir.package, placeholders.desktop));
    const mobileDimensions = sizeOf(path.join(dir.package, placeholders.mobile));
    const videoType = path.extname(srcs.mobile).replace('.', '');
    return `
    <link rel="preload" href="${srcs.mobile}" as="video" type="video/${videoType}" />
    <link rel="preload" href="${srcs.desktop}" as="video" type="video/${videoType}" />
    <div class="video-container" style="padding-top: ${(desktopDimensions.height / desktopDimensions.width) * 100}%; --aspect-ratio: ${desktopDimensions.height / desktopDimensions.width};">
      <video lazy ${attributes.join(' ')}
        data-mobile-width="${mobileDimensions.width}"
        data-mobile-height="${mobileDimensions.height}"
        data-mobile-poster="${placeholders.mobile}"
        data-desktop-width="${desktopDimensions.width}"
        data-desktop-height="${desktopDimensions.height}"
        data-desktop-poster="${placeholders.desktop}"
      >
        <source
          data-mobile-src="${srcs.mobile}"
          data-desktop-src="${srcs.desktop}"
        type="video/${videoType}">
      </video>
    </div>`;
  },

  dasherize: (str) => dasherize(str),

  camelize: (str) => camelize(str, true),

  link(str, locals) {
    if (!locals.href) {
      throw new Error('externalLink is missing href attribute');
    }
    if (locals.class === undefined) locals.class = '';
    if (locals.external || /^http/.test(locals.href)) {
      locals = merge({ rel: 'noopener', target: 'blank' }, locals);
    }
    switch (locals.type) {
      case 'inline':
        locals.class += ' inline-link';
        break;
      case 'block':
        locals.class += ' block-link';
        break;
      case 'card':
        locals.class += ' card-link';
        break;
      case 'button':
        locals.class += ' button';
        break;
    }
    return `<a itemprop="url" ${Object.keys(locals).map((attr) => `${attr}="${cleanUpString(locals[attr])}"`).join(' ')}>${str}</a>`;
  },

  inlineLink(str, locals) {
    return this.link(str, merge({ type: 'inline' }, locals));
  },

  blockLink(str, locals) {
    return `<span class="block-link-wrapper">${this.link(`${str}&nbsp;<b>&gt;</b>`, merge({ type: 'block' }, locals))}</span>`;
  },

  cardLink(str, locals) {
    return this.link(str, merge({ type: 'card' }, locals));
  },

  buttonLink(str, locals) {
    return this.link(str, merge({ type: 'button' }, locals));
  },

  getFileContents(src) {
    const { getSVG } = require(`${dir.build}optimize/optimize-svgs`);

    if (path.extname(src) === '.svg') return getSVG(path.join(dir.src, src));
    return fs.readFileSync(path.join(dir.src, src)).toString();
  },

  defaultLastFMModule: (albums = true) => `
    <span class="item ${albums ? 'album' : 'artist'}">
      <span class="info">
        ${albums ? `
          <span class="name">
            Loading album name
          </span>
        ` : ''}
        <span class="name">
          Loading artist name
        </span>
        <span class="scrobbles">
          Loading scrobbles
        </span>
        <bar style="width: 100%;"></bar>
      </span>
      ${albums ? `
        <span>Loading album cover</span>
      ` : ''}
    </span>`,

  inlineScss(src) {
    const fileData = fs.readFileSync(path.join(dir.src, src)).toString();
    const results = sass.renderSync({
      data: fileData,
      includePaths: [`${dir.src}styles/`, dir.nodeModules],
    });
    return results.css;
  },
});
