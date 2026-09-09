const scrobblesLastUpdatedStyles = require('./last-updated.scss');

const template = `
  <style>${scrobblesLastUpdatedStyles}</style>
  <span class="label">Last updated:</span>
  <time id="datetime" class="loading">Loading\u2026</time>
`;

const SOURCE_URLS = {
  scrobbles: '/last-fm-history/reports/last_updated.json',
  'band-news': '/band-news/last_updated.json',
};

/**
 * Custom Web Component that fetches and formats the last-updated timestamp from JSON endpoints.
 *
 * @class ScrobblesLastUpdated
 * @extends {HTMLElement}
 */
class ScrobblesLastUpdated extends HTMLElement {
  /**
   * Initializes the ScrobblesLastUpdated component and sets up the shadow root.
   */
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = template;
  }

  /**
   * Lifecycle hook triggered when element is added to DOM; initiates data fetching.
   */
  connectedCallback() {
    this.fetchLastUpdated();
  }

  /**
   * Resolves the JSON metadata endpoint URL based on the 'source' attribute.
   *
   * @returns {string} Target URL to fetch metadata from.
   */
  getUrl() {
    const source = this.getAttribute('source');
    return SOURCE_URLS[source] || SOURCE_URLS.scrobbles;
  }

  /**
   * Fetches the last updated JSON metadata and triggers formatting or error display.
   */
  fetchLastUpdated() {
    fetch(this.getUrl())
      .then((response) => {
        if (!response.ok) {
          this.renderError();
          return undefined;
        }
        return response.json();
      })
      .then((data) => {
        if (data) this.renderDate(data);
      })
      .catch(() => {
        this.renderError();
      });
  }

  /**
   * Parses various timestamp formats from API response and renders the localized date string.
   *
   * @param {Object} data - API response payload containing a timestamp or date field.
   */
  renderDate(data) {
    const rawValue = data.last_updated !== undefined ? data.last_updated
      : data.epoch !== undefined ? data.epoch
        : data.timestamp !== undefined ? data.timestamp
          : data.updated_at !== undefined ? data.updated_at
            : data.datetime !== undefined ? data.datetime
              : data.date;

    if (rawValue === undefined || rawValue === null) {
      this.renderError();
      return;
    }

    let date;
    if (typeof rawValue === 'number') {
      date = new Date(rawValue * 1000);
    } else {
      date = new Date(rawValue);
    }

    if (isNaN(date.getTime())) {
      this.renderError();
      return;
    }

    const timeEl = this.shadowRoot.getElementById('datetime');
    timeEl.classList.remove('loading');
    timeEl.setAttribute('datetime', date.toISOString());
    timeEl.textContent = date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  }

  /**
   * Displays fallback 'Unknown' state when data fetching or date parsing fails.
   */
  renderError() {
    const timeEl = this.shadowRoot.getElementById('datetime');
    timeEl.classList.remove('loading');
    timeEl.removeAttribute('datetime');
    timeEl.textContent = 'Unknown';
  }
}

/**
 * Registers the <last-updated> custom element definition.
 */
module.exports.init = () => {
  customElements.define('last-updated', ScrobblesLastUpdated);
};
