const urlParams = new URLSearchParams(window.location.search);

/**
 * Loads lazy-loaded attributes (data-src, data-srcset, data-lazy-style, or can-load event)
 * onto an element once it enters the viewport and unobserves it.
 *
 * @param {HTMLElement} element - The DOM element intersecting the viewport.
 * @param {IntersectionObserver} [observer] - The active IntersectionObserver instance.
 * @returns {void}
 */
function updateOnIntersect(element, observer) {
  if (element.tagName === 'IMG') {
    const picture = element.parentElement;
    if (picture && picture.tagName === 'PICTURE') {
      picture.querySelectorAll('source[data-srcset]').forEach((source) => {
        source.srcset = source.dataset.srcset;
      });
    }
    element.src = element.dataset.src;
  } else if (element.tagName === 'VIDEO') {
    element.dispatchEvent(new Event('can-load'));
  } else if (element.hasAttribute('data-lazy-style')) {
    element.style.cssText += element.dataset.lazyStyle;
  }
  if (observer) observer.unobserve(element);
}

/**
 * Configures responsive dimensions and source switching for a lazy-loaded video element
 * based on the viewport width and media queries.
 *
 * @param {HTMLVideoElement} element - The video element to monitor.
 * @returns {void}
 */
function watchVideoSizes(element) {
  const {
    mobileHeight, mobileWidth, mobilePoster, desktopHeight, desktopWidth, desktopPoster,
  } = element.dataset;
  const sourceElement = element.querySelector('source');
  const { mobileSrc, desktopSrc } = sourceElement.dataset;
  const matchMediaQuery = `(min-width: ${mobileWidth}px)`;
  const mediaQuery = window.matchMedia(matchMediaQuery);
  let includeSrcs = false;

  /**
   * Updates video dimensions, poster, and source attributes matching the current breakpoint.
   *
   * @returns {void}
   */
  const updateSize = () => {
    if (mediaQuery.matches) { // desktop
      element.setAttribute('width', desktopWidth);
      element.setAttribute('height', desktopHeight);
      if (includeSrcs) {
        sourceElement.setAttribute('src', desktopSrc);
        element.setAttribute('poster', desktopPoster);
        element.load();
      }
    } else { // mobile
      element.setAttribute('width', mobileWidth);
      element.setAttribute('height', mobileHeight);
      if (includeSrcs) {
        sourceElement.setAttribute('src', mobileSrc);
        element.setAttribute('poster', mobilePoster);
        element.load();
      }
    }
  };

  mediaQuery.addEventListener('change', updateSize);
  element.addEventListener('can-load', () => {
    includeSrcs = true;
    updateSize();
  });
}

module.exports = {
  /**
   * Initializes lazy loading on elements matching `[lazy]` within the specified DOM scope.
   * Uses IntersectionObserver if supported and not disabled via query parameter.
   *
   * @param {string} [specificQuery='body'] - CSS selector defining the container scope to search.
   * @returns {void}
   */
  init(specificQuery = 'body') {
    if (urlParams.get('disable-lazy') !== null || window.IntersectionObserver === undefined) {
      document.querySelectorAll(`${specificQuery} [lazy]`).forEach((element) => {
        updateOnIntersect(element);
      });
    } else if (window.IntersectionObserver) {
      const intersectionObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            updateOnIntersect(entry.target, observer);
          }
        });
      });

      document.querySelectorAll(`${specificQuery} [lazy]`).forEach((element) => {
        intersectionObserver.observe(element);
      });
    }

    document.querySelectorAll(`${specificQuery} video[lazy]`).forEach((element) => {
      watchVideoSizes(element);
    });
  },
};
