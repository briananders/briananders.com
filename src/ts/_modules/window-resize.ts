/**
 * Binds a callback function to both window resize and orientationchange events.
 *
 * @param {EventListener} callback - The event listener function to trigger on window resizing or orientation changes.
 * @returns {void}
 */
module.exports = (callback: EventListener): void => {
  window.addEventListener('resize', callback);
  window.addEventListener('orientationchange', callback);
};
