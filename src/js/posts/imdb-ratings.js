const ready = require('../_modules/document-ready');
require('../_components/api-image').init();

const API_BASE = '/movies';

/**
 * Constructs the JSON endpoint URL for a given rating tier.
 *
 * @param {string|number} rating - The IMDb star rating value (e.g., '10', '9').
 * @returns {string} URL to fetch rating JSON data.
 */
function getRatingUrl(rating) {
  return `${API_BASE}/rating-${rating}.json`;
}

/**
 * Constructs the base image URL for a given IMDb title/movie ID.
 *
 * @param {string} movieId - The unique IMDb movie identifier.
 * @returns {string} Image endpoint path.
 */
function getImageUrl(movieId) {
  return `${API_BASE}/images/${movieId}`;
}

const TV_CONTENT_TYPES = new Set(['tvSeries', 'tvMiniSeries', 'tvMovie']);

/**
 * Evaluates whether a movie object satisfies the given content type filter.
 *
 * @param {Object} movie - The movie data object.
 * @param {string} movie.contentType - Content type string (e.g. 'movie', 'tvSeries').
 * @param {string} filterKey - Selected filter key ('movies', 'tvSeries', or empty for all).
 * @returns {boolean} True if the movie matches the filter criteria.
 */
function movieMatchesContentTypeFilter(movie, filterKey) {
  if (!filterKey) return true;
  if (filterKey === 'movies') {
    return !TV_CONTENT_TYPES.has(movie.contentType);
  }
  return movie.contentType === filterKey;
}

/**
 * Generates an HTML string template for a single movie card.
 *
 * @param {Object} movie - The movie data object.
 * @param {string} movie.movieId - Unique movie ID.
 * @param {string} movie.imdbUrl - IMDb web URL.
 * @param {string} movie.title - Title of the movie or series.
 * @param {string} movie.contentType - Type classification (movie, tvSeries, etc.).
 * @param {string|number} [movie.year] - Release year.
 * @param {string} [movie.runtime] - Runtime string.
 * @param {string} [movie.contentRating] - Age / content rating (e.g., PG-13, R).
 * @param {string|number} [movie.imdbRating] - Numerical IMDb rating value.
 * @returns {string} HTML markup string for rendering the movie card.
 */
function renderMovie(movie) {
  const imageBase = getImageUrl(movie.movieId);

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
      <api-image src="${imageBase}" alt="${movie.title} poster" loading="lazy" width="240" height="356"></api-image>
      <div class="movie-info">
        <h2 class="h6">${movie.title} ${typeLabel}</h2>
        <p class="year-runtime">${yearRuntime}</p>
        <p class="ratings">${contentRating}${imdbRating}</p>
      </div>
    </a>
  `;
}

/**
 * Fetches movie rating data from the server via XMLHttpRequest.
 *
 * @param {string|number} rating - Rating tier to request.
 * @param {function(Array<Object>): void} onSuccess - Callback invoked on successful JSON parsing.
 * @param {function(Error): void} onError - Callback invoked on HTTP or network error.
 */
function fetchRating(rating, onSuccess, onError) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', getRatingUrl(rating), true);
  /** Parses response JSON and invokes success or error callback. */
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
  /** Handles network transport errors. */
  xhr.onerror = function () {
    onError(new Error('Network error'));
  };
  xhr.send();
}

/**
 * Sets up IMDb ratings filter controls, caching, and grid display on DOM ready.
 */
ready.document(() => {
  const ratingDropdown = document.getElementById('rating-dropdown');
  const contentTypeDropdown = document.getElementById('content-type-dropdown');
  const grid = document.getElementById('movies-grid');
  const loading = document.getElementById('movies-loading');
  const count = document.getElementById('movies-count');

  let cachedRating = null;
  let cachedMovies = null;

  /**
   * Sorts, filters, and displays the list of movie items in the DOM grid.
   *
   * @param {Array<Object>} movies - Array of movie objects to display.
   * @param {string} contentTypeFilter - Selected content type filter.
   */
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

  /**
   * Refreshes the movie list, utilizing cached data when available or making a network request.
   */
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
