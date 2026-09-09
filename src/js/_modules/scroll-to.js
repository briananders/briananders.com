/**
 * Smoothly scrolls the window to a specified destination offset or DOM element using requestAnimationFrame and easing functions.
 *
 * @param {number|HTMLElement} destination - Destination vertical pixel offset or target DOM element.
 * @param {Object} [options={}] - Scrolling animation options.
 * @param {number} [options.duration=200] - Duration of the scroll animation in milliseconds.
 * @param {string} [options.easing='linear'] - Name of the easing formula to apply.
 * @param {Function} [options.callback] - Optional callback invoked once the scroll animation completes.
 * @returns {void}
 */
module.exports = function scrollTo(destination, { duration = 200, easing = 'linear', callback } = {}) {
  /**
   * Easing calculation functions mapping normalized time `t` (0 to 1) to progress (0 to 1).
   */
  const easings = {
    /** Linear interpolation without acceleration. */
    linear(t) {
      return t;
    },
    /** Accelerating from zero velocity (quadratic). */
    easeInQuad(t) {
      return t * t;
    },
    /** Decelerating to zero velocity (quadratic). */
    easeOutQuad(t) {
      return t * (2 - t);
    },
    /** Acceleration until halfway, then deceleration (quadratic). */
    easeInOutQuad(t) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    },
    /** Accelerating from zero velocity (cubic). */
    easeInCubic(t) {
      return t * t * t;
    },
    /** Decelerating to zero velocity (cubic). */
    easeOutCubic(t) {
      return (--t) * t * t + 1;
    },
    /** Acceleration until halfway, then deceleration (cubic). */
    easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    },
    /** Accelerating from zero velocity (quartic). */
    easeInQuart(t) {
      return t * t * t * t;
    },
    /** Decelerating to zero velocity (quartic). */
    easeOutQuart(t) {
      return 1 - (--t) * t * t * t;
    },
    /** Acceleration until halfway, then deceleration (quartic). */
    easeInOutQuart(t) {
      return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t;
    },
    /** Accelerating from zero velocity (quintic). */
    easeInQuint(t) {
      return t * t * t * t * t;
    },
    /** Decelerating to zero velocity (quintic). */
    easeOutQuint(t) {
      return 1 + (--t) * t * t * t * t;
    },
    /** Acceleration until halfway, then deceleration (quintic). */
    easeInOutQuint(t) {
      return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t;
    },
  };

  const start = window.pageYOffset;
  const startTime = 'now' in window.performance ? window.performance.now() : new Date().getTime();
  const { body, documentElement } = document;

  const documentHeight = Math.max(
    body.scrollHeight,
    body.offsetHeight,
    documentElement.clientHeight,
    documentElement.scrollHeight,
    documentElement.offsetHeight
  );
  const windowHeight = window.innerHeight || documentElement.clientHeight || document.querySelector('body').clientHeight;
  const destinationOffset = typeof destination === 'number' ? destination : destination.offsetTop;
  // Prevent scrolling past the bottom of the document
  const destinationOffsetToScroll = Math.round(
    (documentHeight - destinationOffset < windowHeight)
      ? documentHeight - windowHeight
      : destinationOffset
  );

  // Fallback for environments lacking requestAnimationFrame
  if ('requestAnimationFrame' in window === false) {
    window.scroll(0, destinationOffsetToScroll);
    if (callback) {
      callback();
    }
    return;
  }

  /**
   * Per-frame animation step function driving the smooth scroll progress.
   *
   * @returns {void}
   */
  function scroll() {
    const now = 'now' in window.performance ? window.performance.now() : new Date().getTime();
    const time = Math.min(1, ((now - startTime) / duration));
    const timeFunction = easings[easing](time);
    window.scroll(0, Math.ceil((timeFunction * (destinationOffsetToScroll - start)) + start));

    if (window.pageYOffset === destinationOffsetToScroll) {
      if (callback) {
        callback();
      }
      return;
    }

    window.requestAnimationFrame(scroll);
  }

  scroll();
};
