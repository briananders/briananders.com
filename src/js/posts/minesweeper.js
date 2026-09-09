const ready = require('../_modules/document-ready');
const urlParams = new URLSearchParams(window.location.search);

/**
 * Initializes the Minesweeper iframe cross-document message listener on DOM ready.
 */
ready.document(() => {
  const iframeElement = document.getElementById('minesweeper-iframe');

  // if (urlParams.has('difficulty')) {
  //   const newDifficulty = urlParams.get('difficulty');
  //   iframeElement.contentWindow.postMessage(`difficulty=${newDifficulty}`, '*');
  // }

  /**
   * Handles postMessage events from the embedded Minesweeper iframe to synchronize difficulty setting.
   *
   * @param {MessageEvent} event - Incoming message event object.
   * @param {string} event.data - Message payload formatted as 'difficulty=<level>'.
   */
  window.addEventListener('message', ({ data }) => {
    if (data.indexOf('difficulty') === 0) {
      const [key, value] = data.split('=');
      const newDifficulty = value.toString();
      iframeElement.dataset.difficulty = newDifficulty;
      // urlParams.set('difficulty', newDifficulty);
      // history.pushState('', '', `?${urlParams.toString()}`);
      // urlParams = new URLSearchParams(window.location.search);
    }
  });
});
