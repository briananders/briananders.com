const ready = require('../_modules/document-ready');

ready.document(() => {
  const userAgent = window.navigator.userAgent.toString();
  const userAgentElement = document.getElementById('userAgent');
  userAgentElement.innerText = userAgent.toString();

  const inputElement = document.getElementById('url');
  const errorElement = document.getElementById('error');

  const hashElement = document.getElementById('hash');
  const hostElement = document.getElementById('host');
  const hostnameElement = document.getElementById('hostname');
  const hrefElement = document.getElementById('href');
  const originElement = document.getElementById('origin');
  const pathnameElement = document.getElementById('pathname');
  const portElement = document.getElementById('port');
  const protocolElement = document.getElementById('protocol');
  const searchElement = document.getElementById('search');

  const devicePixelRatioElement = document.getElementById('devicePixelRatio');
  devicePixelRatioElement.innerText = devicePixelRatio.toString();

  const heightElement = document.getElementById('height');
  const widthElement = document.getElementById('width');
  const scaleElement = document.getElementById('scale');

  inputElement.value = window.location.href.toString();

  const calculateURL = (urlParam) => {
    let url = window.location;
    if (urlParam !== undefined && urlParam !== '') {
      try {
        url = new URL(urlParam);
        errorElement.classList.remove('visible');
      } catch (e) {
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

  const updateViewport = () => {
    const viewport = window.visualViewport;

    const height = viewport.height.toString();
    const width = viewport.width.toString();
    const scale = viewport.scale.toString();

    heightElement.innerText = height;
    widthElement.innerText = width;
    scaleElement.innerText = scale;
  };

  const init = () => {
    inputElement.addEventListener('keyup', () => {
      const url = inputElement.value.toString();

      calculateURL(url);
    });

    visualViewport.addEventListener('resize', updateViewport);

    calculateURL();
    updateViewport();
  };

  init();
});
