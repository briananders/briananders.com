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
    callback(element, true);
    element.dispatchEvent(inViewEvent);
  }
};
