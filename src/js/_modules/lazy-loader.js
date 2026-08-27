const urlParams = new URLSearchParams(window.location.search);

function updateOnIntersect(element, observer) {
  if (element.tagName === 'IMG') {
    element.src = element.dataset.src;
  } else if (element.tagName === 'VIDEO') {
    element.dispatchEvent(new Event('can-load'));
  } else if (element.hasAttribute('data-lazy-style')) {
    element.style.cssText += element.dataset.lazyStyle;
  }
  if (observer) observer.unobserve(element);
}

function watchVideoSizes(element) {
  const {
    mobileHeight, mobileWidth, mobilePoster, desktopHeight, desktopWidth, desktopPoster,
  } = element.dataset;
  const sourceElement = element.querySelector('source');
  const { mobileSrc, desktopSrc } = sourceElement.dataset;
  const matchMediaQuery = `(min-width: ${mobileWidth}px)`;
  const mediaQuery = window.matchMedia(matchMediaQuery);
  let includeSrcs = false;

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
