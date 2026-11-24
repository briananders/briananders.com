export interface SerializedItem {
  playcount?: number | string;
  max?: number;
  [key: string]: unknown;
}

export interface ItemApiOptions<T extends SerializedItem = SerializedItem> {
  scope: string;
  count?: number;
  customSerialize: (data: Record<string, unknown>) => T[];
  renderItems: (items: T[], container: HTMLElement) => void;
}

let period = '30day'; // default
const rawCache: Record<string, Record<string, unknown>> = {};
const pendingRequests: Record<string, Array<() => void>> = {};

const PERIOD_MAP: Record<string, string> = {
  '7day': 'rolling_last-7-days.json',
  '30day': 'rolling_last-30-days.json',
  '90day': 'rolling_last-90-days.json',
  '6month': 'rolling_last-6-months.json',
  '12month': 'rolling_last-12-months.json',
  '2year': 'rolling_last-2-years.json',
};

module.exports = {
  /**
   * Initializes a Last.fm report module by wiring data fetching, period selector changes,
   * data serialization, and rendering within the target container element.
   *
   * @param {ItemApiOptions} opts - Configuration options for the module.
   * @returns {void}
   */
  init<T extends SerializedItem = SerializedItem>(opts: ItemApiOptions<T>): void {
    const containerElement = document.querySelector<HTMLElement>(opts.scope);
    if (!containerElement) {
      return;
    }
    const maxItems = opts.count || 4; // defaults
    opts.count = maxItems;

    /**
     * Resolves the JSON report URL for the active time period.
     *
     * @returns {string} The relative path to the report JSON file.
     */
    function getURL(): string {
      const reportFile = PERIOD_MAP[period] || PERIOD_MAP['30day'];
      return `/last-fm-history/reports/${reportFile}`;
    }

    /**
     * Renders the serialized items into the target DOM container.
     *
     * @returns {void}
     */
    function render(): void {
      const url = getURL();
      const rawData = rawCache[url];
      const items = serialize(rawData);

      containerElement!.innerHTML = '';
      opts.renderItems(items, containerElement!);
    }

    /**
     * Serializes raw report data into item models, attaching the max play count for bar scaling.
     *
     * @param {Record<string, unknown> | undefined} data - Raw JSON report data.
     * @returns {T[]} List of serialized and bounded items.
     */
    function serialize(data: Record<string, unknown> | undefined): T[] {
      if (!data) return [];
      const defaultImage = containerElement!.getAttribute('src');
      const dataWithDefault = { ...data, defaultImage };
      const items = opts.customSerialize(dataWithDefault);
      const maxPlayCount = Math.max(...items.map((item) => Number(item.playcount || 0)));
      items.forEach((item) => { item.max = maxPlayCount; });
      return items.filter((_item, index) => index < maxItems);
    }

    /**
     * Retrieves the JSON report data for the current period, using in-memory cache
     * or deduplicating concurrent HTTP requests via the pendingRequests queue.
     *
     * @returns {void}
     */
    function getData(): void {
      const url = getURL();
      if (rawCache[url]) {
        render();
      } else if (pendingRequests[url]) {
        // Queue this render call if a request for this URL is already in flight
        pendingRequests[url].push(render);
      } else {
        pendingRequests[url] = [render];
        const request = new XMLHttpRequest();
        request.open('GET', url, true);

        /**
         * Processes the successful HTTP response and triggers queued render callbacks.
         */
        request.onload = (): void => {
          if (request.status >= 200 && request.status < 400) {
            try {
              const data = JSON.parse(request.response) as Record<string, unknown>;
              rawCache[url] = data;
              const callbacks = pendingRequests[url];
              delete pendingRequests[url];
              if (callbacks) {
                callbacks.forEach((cb) => cb());
              }
            } catch (err) {
              console.error(`Failed to parse response from ${url}:`, err);
              delete pendingRequests[url];
            }
          }
        };

        /**
         * Handles network errors during the request.
         */
        request.onerror = (): void => {};

        request.send();
      }
    }

    /**
     * Watches for changes on the period selection dropdown and re-fetches data accordingly.
     *
     * @returns {void}
     */
    function watchPeriod(): void {
      const periodElement = document.querySelector<HTMLSelectElement>('select[name=period]');
      if (periodElement !== null) {
        period = periodElement.value;
        periodElement.addEventListener('change', () => {
          period = periodElement.value;
          getData();
        });
      }
    }

    watchPeriod();
    getData();
  },
};
