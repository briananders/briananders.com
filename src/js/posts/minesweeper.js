const ready = require('../_modules/document-ready');
const urlParams = new URLSearchParams(window.location.search);

ready.document(() => {
  const iframeElement = document.getElementById('minesweeper-iframe');

  // if (urlParams.has('difficulty')) {
  //   const newDifficulty = urlParams.get('difficulty');
  //   iframeElement.contentWindow.postMessage(`difficulty=${newDifficulty}`, '*');
  // }

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
