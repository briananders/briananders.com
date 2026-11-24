const ready = require('../_modules/document-ready.ts');

/**
 * Initializes browser and device diagnostic tool displays when the document is ready.
 */
ready.document(() => {
  const userAgent = window.navigator.userAgent.toString();
  const userAgentElement = document.getElementById('userAgent') as HTMLElement;
  userAgentElement.innerText = userAgent.toString();

  const inputElement = document.getElementById('url') as HTMLInputElement;
  const errorElement = document.getElementById('error') as HTMLElement;

  const hashElement = document.getElementById('hash') as HTMLElement;
  const hostElement = document.getElementById('host') as HTMLElement;
  const hostnameElement = document.getElementById('hostname') as HTMLElement;
  const hrefElement = document.getElementById('href') as HTMLElement;
  const originElement = document.getElementById('origin') as HTMLElement;
  const pathnameElement = document.getElementById('pathname') as HTMLElement;
  const portElement = document.getElementById('port') as HTMLElement;
  const protocolElement = document.getElementById('protocol') as HTMLElement;
  const searchElement = document.getElementById('search') as HTMLElement;

  const devicePixelRatioElement = document.getElementById('devicePixelRatio') as HTMLElement;
  devicePixelRatioElement.innerText = devicePixelRatio.toString();

  const heightElement = document.getElementById('height') as HTMLElement;
  const widthElement = document.getElementById('width') as HTMLElement;
  const scaleElement = document.getElementById('scale') as HTMLElement;

  inputElement.value = window.location.href.toString();

  /**
   * Parses the given URL string (or falls back to window.location) and updates
   * individual URL component elements in the DOM.
   *
   * @param {string} [urlParam] - The URL string to decompose.
   */
  const calculateURL = (urlParam?: string): void => {
    let url: Location | URL = window.location;
    if (urlParam !== undefined && urlParam !== '') {
      try {
        url = new URL(urlParam);
        errorElement.classList.remove('visible');
      } catch {
        errorElement.classList.add('visible');
        return;
      }
    }

    const hash = url.hash.toString();
    const host = url.host.toString();
    const hostname = url.hostname.toString();
    const href = url.href.toString();
    const origin = url.origin.toString();
    const pathname = url.pathname.toString();
    const port = url.port.toString();
    const protocol = url.protocol.toString();
    const search = url.search.toString();

    hashElement.innerText = hash;
    hostElement.innerText = host;
    hostnameElement.innerText = hostname;
    hrefElement.innerText = href;
    originElement.innerText = origin;
    pathnameElement.innerText = pathname;
    portElement.innerText = port;
    protocolElement.innerText = protocol;
    searchElement.innerText = search;
  };

  /**
   * Reads visualViewport metrics (height, width, scale) and renders them in the DOM.
   */
  const updateViewport = (): void => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const height = viewport.height.toString();
    const width = viewport.width.toString();
    const scale = viewport.scale.toString();

    heightElement.innerText = height;
    widthElement.innerText = width;
    scaleElement.innerText = scale;
  };

  /**
   * Binds event listeners for URL input typing and viewport resizing, and runs initial measurements.
   */
  const init = (): void => {
    inputElement.addEventListener('keyup', () => {
      const url = inputElement.value.toString();

      calculateURL(url);
    });

    window.visualViewport?.addEventListener('resize', updateViewport);

    calculateURL();
    updateViewport();
  };

  init();
});
