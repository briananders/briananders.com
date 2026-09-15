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
 * Constructs the base image URL for a poster basename.
 *
 * @param {string} basename - The poster image basename from the API.
 * @returns {string} Image endpoint path.
 */
function getImageUrl(basename) {
  return `${API_BASE}/images/${basename}`;
}

const TV_CONTENT_TYPES = new Set(['tvSeries', 'tvMiniSeries', 'tvMovie']);

const MPAA_RANK = { G: 0, PG: 1, 'PG-13': 2, R: 3, 'NC-17': 4 };

/**
 * Parses a runtime string like "2h 15m" or "45m" into total minutes.
 *
 * @param {string} runtime - Runtime string from the movie data.
 * @returns {number} Total minutes, or 0 if unparseable.
 */
function parseRuntime(runtime) {
  if (!runtime) return 0;
  const hours = runtime.match(/(\d+)h/);
  const mins = runtime.match(/(\d+)m/);
  return (hours ? parseInt(hours[1], 10) * 60 : 0) + (mins ? parseInt(mins[1], 10) : 0);
}

/**
 * Returns a comparator function for sorting movies by the given sort key.
 *
 * @param {string} sortKey - Sort key in the format "field-direction" (e.g. "title-asc").
 * @returns {function(Object, Object): number} Comparator function.
 */
function getSortComparator(sortKey) {
  const [field, direction] = sortKey.split('-');
  const dir = direction === 'desc' ? -1 : 1;

  switch (field) {
    case 'title':
      return (a, b) => dir * a.title.localeCompare(b.title);
    case 'year':
      return (a, b) => dir * ((parseInt(a.year, 10) || 0) - (parseInt(b.year, 10) || 0));
    case 'mpaa':
      return (a, b) => {
        const ra = MPAA_RANK[a.contentRating] !== undefined ? MPAA_RANK[a.contentRating] : 99;
        const rb = MPAA_RANK[b.contentRating] !== undefined ? MPAA_RANK[b.contentRating] : 99;
        return dir * (ra - rb);
      };
    case 'runtime':
      return (a, b) => dir * (parseRuntime(a.runtime) - parseRuntime(b.runtime));
    default:
      return (a, b) => dir * ((parseInt(a.year, 10) || 0) - (parseInt(b.year, 10) || 0));
  }
}

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
 * @param {Object} movie.image - Poster image metadata.
 * @param {string} movie.image.basename - Poster basename shared by all image formats.
 * @param {number} movie.image.width - Intrinsic poster width.
 * @param {number} movie.image.height - Intrinsic poster height.
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
  const imageBase = getImageUrl(movie.image.basename);

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
      <api-image src="${imageBase}" alt="${movie.title} poster" loading="lazy" width="${movie.image.width}" height="${movie.image.height}" style="--poster-aspect-ratio: ${movie.image.width} / ${movie.image.height}"></api-image>
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
  const sortDropdown = document.getElementById('sort-dropdown');
  const grid = document.getElementById('movies-grid');
  const loading = document.getElementById('movies-loading');
  const count = document.getElementById('movies-count');

  const params = new URLSearchParams(window.location.search);
  const initialSort = params.get('sort');
  if (initialSort && sortDropdown.querySelector('option[value="' + initialSort + '"]')) {
    sortDropdown.value = initialSort;
  }

  let cachedRating = null;
  let cachedMovies = null;

  /**
   * Sorts, filters, and displays the list of movie items in the DOM grid.
   *
   * @param {Array<Object>} movies - Array of movie objects to display.
   * @param {string} contentTypeFilter - Selected content type filter.
   * @param {string} sortKey - Sort key (e.g. "year-asc", "title-desc").
   */
  function renderMoviesList(movies, contentTypeFilter, sortKey) {
    const field = sortKey.split('-')[0];
    const sorted = movies.slice().filter((m) => {
      if (!m.year && !m.runtime && !m.contentRating) return false;
      if (field === 'year') return !!m.year;
      if (field === 'runtime') return !!m.runtime;
      if (field === 'mpaa') return !!m.contentRating;
      return true;
    }).sort(getSortComparator(sortKey));
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
    const sortKey = sortDropdown.value;

    const url = new URL(window.location);
    if (sortKey === 'year-asc') {
      url.searchParams.delete('sort');
    } else {
      url.searchParams.set('sort', sortKey);
    }
    window.history.replaceState(null, '', url);

    if (cachedRating === rating && cachedMovies) {
      loading.style.display = 'none';
      renderMoviesList(cachedMovies, contentTypeFilter, sortKey);
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
        renderMoviesList(movies, contentTypeFilter, sortKey);
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
  sortDropdown.addEventListener('change', refreshList);

  refreshList();
});
