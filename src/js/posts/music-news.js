const ready = require('../_modules/document-ready');

function escapeHTML(str) {
  const tempElement = document.createElement('temp');
  tempElement.innerHTML = str;
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(tempElement.innerText));
  return tempElement.innerText;
}

function articleLink(link, content, classes = '') {
  return `<a href="${escapeHTML(link)}" class="${classes}" target="_blank" rel="noopener" itemprop="url">${content}</a>`;
}

function renderArticle(article) {
  const bands = article.matched_bands
    .map((band) => `<span class="band-tag">${escapeHTML(band)}</span>`)
    .join('');

  return `
    <div
       class="article-card"
       role="listitem"
       itemscope
       itemtype="https://schema.org/Article">
       ${article.image_url ? articleLink(article.link, `<img src="${escapeHTML(article.image_url)}" alt="${escapeHTML(article.title)}" class="article-image" />`, 'article-image-link') : ''}
      <h2 class="article-title" itemprop="headline">${articleLink(article.link, escapeHTML(article.title.toLowerCase()), 'article-title-link')}</h2>
      <div class="article-metadata">
        <span class="article-source" itemprop="publisher">${escapeHTML(article.source)}</span> -
        <time datetime="${escapeHTML(article.published)}" itemprop="datePublished">
          ${escapeHTML(article.published_formatted)}
        </time>
      </div>
      <div class="article-bands">${bands}</div>
      <p class="article-summary" itemprop="description">${escapeHTML(article.summary)}</p>
      ${articleLink(article.link, 'Read more&nbsp;<b>&gt;</b>', 'article-link block-link')}
    </div>
  `;
}

function renderMeta(data) {
  return `Tracking ${data.bands_tracked} bands across ${data.feeds_checked} feeds`;
}

ready.document(() => {
  const listEl = document.getElementById('music-news-list');
  const metaEl = document.getElementById('music-news-meta');
  const emptyEl = document.getElementById('articles-empty');

  fetch('/band-news/articles.json')
    .then((response) => response.json())
    .then((data) => {
      if (data.articles && data.articles.length > 0) {
        metaEl.innerHTML = renderMeta(data);
        listEl.innerHTML = data.articles.map(renderArticle).join('');
      } else {
        emptyEl.style.display = 'block';
      }
    })
    .catch((error) => {
      console.error(error);
      emptyEl.style.display = 'block';
    });
});
