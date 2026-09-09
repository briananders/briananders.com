const inView = require('../_modules/in-view');
const ready = require('../_modules/document-ready');

/**
 * Updates the 'in-view' attribute on a target element based on its viewport visibility.
 *
 * @param {HTMLElement} element - The DOM element being observed.
 * @param {boolean} isInView - Whether the element is currently visible in the viewport.
 */
const inViewOutOfView = (element, isInView) => {
  element.setAttribute('in-view', isInView);
};

/**
 * Initializes viewport intersection tracking for heading and paragraph elements on DOM ready.
 */
ready.document(() => {
  const querySelector = 'h1, h2, h3, h4, h5, h6, p';
  Array.from(document.querySelectorAll(querySelector)).forEach((element) => {
    inView(element, inViewOutOfView, {
      rootMargin: '-70px 0px -20px 0px',
    });
  });
});
