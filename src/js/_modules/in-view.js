/**
 * Observes an element's visibility within the viewport using IntersectionObserver.
 * Triggers the provided callback and dispatches custom 'in-view' and 'out-of-view' events on the element.
 *
 * @param {HTMLElement} element - The DOM element to observe for visibility.
 * @param {Function} callback - Callback receiving (targetElement, isIntersecting).
 * @param {IntersectionObserverInit} [options={ rootMargin: '0px 0px 0px 0px' }] - IntersectionObserver options.
 * @returns {void}
 */
module.exports = (element, callback, options = { rootMargin: '0px 0px 0px 0px' }) => {
  const inViewEvent = new Event('in-view');
  const outOfViewEvent = new Event('out-of-view');

  if (window.IntersectionObserver) {
    const intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        callback(entry.target, entry.isIntersecting);
        if (entry.isIntersecting) {
          entry.target.dispatchEvent(inViewEvent);
        } else {
          entry.target.dispatchEvent(outOfViewEvent);
        }
      });
    }, options);

    intersectionObserver.observe(element);
  } else {
    // Fallback if IntersectionObserver is not supported: assume element is immediately in view
    callback(element, true);
    element.dispatchEvent(inViewEvent);
  }
};
