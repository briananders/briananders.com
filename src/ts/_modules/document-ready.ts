type ReadyCallback = () => void;

/**
 * Watches all external stylesheet link tags in the document and invokes the
 * provided callback once all stylesheets are confirmed to be loaded.
 *
 * @param {ReadyCallback} callback - Function invoked when all stylesheets have loaded.
 * @returns {void}
 */
function stylesReadyWatcher(callback: ReadyCallback): void {
  const styleSheets = Array.from(document.querySelectorAll<HTMLLinkElement>('link[href*=".css"]'));

  let count = 0;

  /**
   * Checks whether all tracked stylesheet link tags have loaded and fires the callback if so.
   *
   * @returns {void}
   */
  function checkCount(): void {
    if (count >= styleSheets.length) {
      callback();
    }
  }

  styleSheets.forEach((link) => {
    // If the stylesheet object is already attached, it is already loaded
    if (link.sheet) count++;
    else {
      link.addEventListener('load', () => {
        count++;
        checkCount();
      });
    }
    checkCount();
  });
}

/**
 * Invokes the callback once the DOM is interactive or complete.
 * If already ready, schedules execution on the next event loop tick.
 *
 * @param {ReadyCallback} callback - Function invoked when the DOM is ready.
 * @returns {void}
 */
function documentReadyWatcher(callback: ReadyCallback): void {
  // see if DOM is already available
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    // call on next available tick
    setTimeout(callback, 1);
  } else {
    document.addEventListener('DOMContentLoaded', callback);
  }
}

module.exports = {
  /**
   * Invokes the callback when both the DOM and all CSS stylesheets have completed loading.
   *
   * @param {ReadyCallback} callback - Function invoked when both DOM and stylesheets are ready.
   * @returns {void}
   */
  all: (callback: ReadyCallback): void => {
    let documentReady = false;
    let stylesReady = false;

    documentReadyWatcher(() => {
      documentReady = true;
      if (stylesReady) {
        callback();
      }
    });

    stylesReadyWatcher(() => {
      stylesReady = true;
      if (documentReady) {
        callback();
      }
    });
  },

  /**
   * @see documentReadyWatcher
   */
  document: documentReadyWatcher,

  /**
   * @see stylesReadyWatcher
   */
  styles: stylesReadyWatcher,
};
