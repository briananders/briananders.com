const ready = require('../_modules/document-ready');

const API_BASE = '/movies';

function getRatingUrl(rating) {
  return `${API_BASE}/rating-${rating}.json`;
}

function getImageUrl(movieId) {
  return `${API_BASE}/images/${movieId}.webp`;
}

const TV_CONTENT_TYPES = new Set(['tvSeries', 'tvMiniSeries', 'tvMovie']);

function movieMatchesContentTypeFilter(movie, filterKey) {
  if (!filterKey) return true;
  if (filterKey === 'movies') {
    return !TV_CONTENT_TYPES.has(movie.contentType);
  }
  return movie.contentType === filterKey;
}

function renderMovie(movie) {
  const imgUrl = getImageUrl(movie.movieId);

  const isSeries = movie.contentType === 'tvSeries'
    || movie.contentType === 'tvMiniSeries'
    || movie.contentType === 'tvMovie';
  const typeLabel = isSeries ? '<span class="content-type">TV</span>' : '';

  const yearRuntime = [
    movie.year ? `(${movie.year})` : '',
    movie.runtime || ''
  ].filter(Boolean).join(' · ');

  const contentRating = movie.contentRating
    ? `<span class="content-rating">${movie.contentRating}</span>` : '';
  const imdbRating = movie.imdbRating
    ? `<span class="imdb-rating">★ ${movie.imdbRating}</span>` : '';

  return `
    <a
      itemprop="url"
      href="${movie.imdbUrl}"
      class="movie card-link"
      target="_blank"
      rel="noopener noreferrer"
      role="listitem"
    >
      <img src="${imgUrl}" alt="${movie.title} poster" loading="lazy" width="240" height="356" />
      <div class="movie-info">
        <h2 class="h6">${movie.title} ${typeLabel}</h2>
        <p class="year-runtime">${yearRuntime}</p>
        <p class="ratings">${contentRating}${imdbRating}</p>
      </div>
    </a>
  `;
}

function fetchRating(rating, onSuccess, onError) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', getRatingUrl(rating), true);
  xhr.onload = function () {
    if (xhr.status >= 200 && xhr.status < 400) {
      try {
        onSuccess(JSON.parse(xhr.responseText));
      } catch (e) {
        onError(e);
      }
    } else {
      onError(new Error(`HTTP ${xhr.status}`));
    }
  };
  xhr.onerror = function () {
    onError(new Error('Network error'));
  };
  xhr.send();
}

ready.document(() => {
  const ratingDropdown = document.getElementById('rating-dropdown');
  const contentTypeDropdown = document.getElementById('content-type-dropdown');
  const grid = document.getElementById('movies-grid');
  const loading = document.getElementById('movies-loading');
  const count = document.getElementById('movies-count');

  let cachedRating = null;
  let cachedMovies = null;

  function renderMoviesList(movies, contentTypeFilter) {
    const sorted = movies.slice().sort((a, b) => {
      const ya = parseInt(a.year, 10) || 0;
      const yb = parseInt(b.year, 10) || 0;
      return ya - yb;
    });
    const filtered = sorted.filter((m) => movieMatchesContentTypeFilter(m, contentTypeFilter));
    count.textContent = `${filtered.length} result${filtered.length === 1 ? '' : 's'}`;
    grid.innerHTML = filtered.map(renderMovie).join('');
  }

  function refreshList() {
    const rating = ratingDropdown.value;
    const contentTypeFilter = contentTypeDropdown.value;

    if (cachedRating === rating && cachedMovies) {
      loading.style.display = 'none';
      renderMoviesList(cachedMovies, contentTypeFilter);
      return;
    }

    loading.style.display = 'block';
    grid.innerHTML = '';

    fetchRating(
      rating,
      (movies) => {
        cachedRating = rating;
        cachedMovies = movies;
        loading.style.display = 'none';
        renderMoviesList(movies, contentTypeFilter);
      },
      () => {
        cachedRating = null;
        cachedMovies = null;
        loading.style.display = 'none';
        grid.innerHTML = '<p class="error">Failed to load. Please try again.</p>';
      },
    );
  }

  ratingDropdown.addEventListener('change', refreshList);
  contentTypeDropdown.addEventListener('change', refreshList);

  refreshList();
});
