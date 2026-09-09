const ready = require('../_modules/document-ready');

/**
 * Initializes the scroll-driven earth rotating sprite animation on DOM ready.
 */
ready.document(() => {
  const frameContainer = document.getElementById('frame-container');
  const numberOfFrames = 16 * 16;
  let number = 0;
  let lastKnownScrollPosition = 0;

  /**
   * Advances the sprite frame index by the given delta, wrapping around within total frame count,
   * and updates the data-number attribute on the container.
   *
   * @param {number} value - The frame delta to add to current position.
   */
  function updateEarth(value) {
    // Add large multiple of numberOfFrames to safely handle negative values before modulo
    number = ((number + value) + (numberOfFrames * 100)) % numberOfFrames;
    frameContainer.dataset.number = number;
  }

  /**
   * Listens for window scroll events, calculates scroll distance delta, and schedules frame updates.
   */
  document.addEventListener('scroll', (event) => {
    const scrollPosition = Math.floor(window.scrollY);
    const movementY = Math.abs(scrollPosition - lastKnownScrollPosition);
    lastKnownScrollPosition = scrollPosition;

    window.requestAnimationFrame(() => {
      updateEarth(movementY);
    });
  });
});
