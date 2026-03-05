const ready = require('./_modules/document-ready');

function escapeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function renderArticle(article) {
  const bands = article.matched_bands
    .map((band) => `<span class="band-tag">${escapeHTML(band)}</span>`)
    .join('');

  return `
    <a href="${escapeHTML(article.link)}"
       class="article-card"
       role="listitem"
       rel="noopener"
       target="blank"
       itemprop="url"
       itemscope
       itemtype="https://schema.org/Article">
      <h2 class="article-title" itemprop="headline">${escapeHTML(article.title)}</h2>
      <p class="article-summary" itemprop="description">${escapeHTML(article.summary)}</p>
      <div class="article-bands">${bands}</div>
      <div class="article-footer">
        <span class="article-source" itemprop="publisher">${escapeHTML(article.source)}</span>
        <time datetime="${escapeHTML(article.published)}" itemprop="datePublished">
          ${escapeHTML(article.published_formatted)}
        </time>
      </div>
    </a>
  `;
}

function renderMeta(data) {
  return `Tracking ${data.bands_tracked} bands across ${data.feeds_checked} feeds`;
}

ready.document(() => {
  const listEl = document.getElementById('articles-list');
  const metaEl = document.getElementById('articles-meta');
  const emptyEl = document.getElementById('articles-empty');

  fetch('/data/articles.json')
    .then((response) => response.json())
    .then((data) => {
      if (data.articles && data.articles.length > 0) {
        metaEl.innerHTML = renderMeta(data);
        listEl.innerHTML = data.articles.map(renderArticle).join('');
      } else {
        emptyEl.style.display = 'block';
      }
    })
    .catch(() => {
      emptyEl.style.display = 'block';
    });
});
