const scrobblesLastUpdatedStyles = require('./last-updated.scss');

const template = `
  <style>${scrobblesLastUpdatedStyles}</style>
  <span class="label">Last updated:</span>
  <time id="datetime" class="loading">Loading\u2026</time>
`;

const SOURCE_URLS: Record<string, string> = {
  scrobbles: '/last-fm-history/reports/last_updated.json',
  'band-news': '/band-news/last_updated.json',
};

type LastUpdatedPayload = Record<string, string | number | null | undefined>;

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
  connectedCallback(): void {
    this.fetchLastUpdated();
  }

  /**
   * Resolves the JSON metadata endpoint URL based on the 'source' attribute.
   *
   * @returns {string} Target URL to fetch metadata from.
   */
  getUrl(): string {
    const source = this.getAttribute('source') || '';
    return SOURCE_URLS[source] || SOURCE_URLS.scrobbles;
  }

  /**
   * Fetches the last updated JSON metadata and triggers formatting or error display.
   */
  fetchLastUpdated(): void {
    fetch(this.getUrl())
      .then((response) => {
        if (!response.ok) {
          this.renderError();
          return undefined;
        }
        return response.json() as Promise<LastUpdatedPayload>;
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
   * @param {LastUpdatedPayload} data - API response payload containing a timestamp or date field.
   */
  renderDate(data: LastUpdatedPayload): void {
    const fields = ['last_updated', 'epoch', 'timestamp', 'updated_at', 'datetime', 'date'];
    const field = fields.find((key) => data[key] !== undefined);
    const rawValue = field !== undefined ? data[field] : undefined;

    if (rawValue === undefined || rawValue === null) {
      this.renderError();
      return;
    }

    let date: Date;
    if (typeof rawValue === 'number') {
      date = new Date(rawValue * 1000);
    } else {
      date = new Date(rawValue);
    }

    if (Number.isNaN(date.getTime())) {
      this.renderError();
      return;
    }

    const timeEl = this.shadowRoot?.getElementById('datetime');
    if (!timeEl) return;
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
  renderError(): void {
    const timeEl = this.shadowRoot?.getElementById('datetime');
    if (!timeEl) return;
    timeEl.classList.remove('loading');
    timeEl.removeAttribute('datetime');
    timeEl.textContent = 'Unknown';
  }
}

/**
 * Registers the <last-updated> custom element definition.
 */
module.exports.init = (): void => {
  customElements.define('last-updated', ScrobblesLastUpdated);
};
