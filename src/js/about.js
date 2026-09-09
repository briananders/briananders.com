const YoutubeModal = require('./_modules/youtube-modal');
const ready = require('./_modules/document-ready');

/**
 * Initializes the YouTube video modal on the About page when the DOM is ready.
 */
ready.document(() => {
  const youtubeModal = new YoutubeModal();
  youtubeModal.init();
});
