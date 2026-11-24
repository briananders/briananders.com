type InViewCallback = (target: Element, isIntersecting: boolean) => void;

/**
 * Observes an element's visibility within the viewport using IntersectionObserver.
 * Triggers the provided callback and dispatches custom 'in-view' and 'out-of-view' events on the element.
 *
 * @param {Element} element - The DOM element to observe for visibility.
 * @param {InViewCallback} callback - Callback receiving (targetElement, isIntersecting).
 * @param {IntersectionObserverInit} [options={ rootMargin: '0px 0px 0px 0px' }] - IntersectionObserver options.
 * @returns {void}
 */
module.exports = (
  element: Element,
  callback: InViewCallback,
  options: IntersectionObserverInit = { rootMargin: '0px 0px 0px 0px' }
): void => {
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
