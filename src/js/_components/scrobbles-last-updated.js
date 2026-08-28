const scrobblesLastUpdatedStyles = require('./scrobbles-last-updated.scss');

const template = `
  <style>${scrobblesLastUpdatedStyles}</style>
  <span class="label">Last updated:</span>
  <time id="datetime" class="loading">Loading\u2026</time>
`;

const SOURCE_URLS = {
  scrobbles: '/last-fm-history/reports/last_updated.json',
  'band-news': '/band-news/last_updated.json',
};

class ScrobblesLastUpdated extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = template;
  }

  connectedCallback() {
    this.fetchLastUpdated();
  }

  getUrl() {
    const source = this.getAttribute('source');
    return SOURCE_URLS[source] || SOURCE_URLS.scrobbles;
  }

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

  renderError() {
    const timeEl = this.shadowRoot.getElementById('datetime');
    timeEl.classList.remove('loading');
    timeEl.removeAttribute('datetime');
    timeEl.textContent = 'Unknown';
  }
}

module.exports.init = () => {
  customElements.define('scrobbles-last-updated', ScrobblesLastUpdated);
};
