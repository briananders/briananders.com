const ready = require('../_modules/document-ready');

ready.document(() => {
  const frameContainer = document.getElementById('frame-container');
  const numberOfFrames = 16 * 16;
  let number = 0;
  let lastKnownScrollPosition = 0;

  function updateEarth(value) {
    number = ((number + value) + (numberOfFrames * 100)) % numberOfFrames;
    frameContainer.dataset.number = number;
  }

  document.addEventListener('scroll', (event) => {
    const scrollPosition = Math.floor(window.scrollY);
    const movementY = Math.abs(scrollPosition - lastKnownScrollPosition);
    lastKnownScrollPosition = scrollPosition;

    window.requestAnimationFrame(() => {
      updateEarth(movementY);
    });
  });
});
