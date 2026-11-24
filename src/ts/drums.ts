const YoutubeModal = require('./_modules/youtube-modal.ts');
const ready = require('./_modules/document-ready.ts');

/**
 * Initializes the YouTube video modal on the Drums page when the DOM is ready.
 */
ready.document(() => {
  const youtubeModal = new YoutubeModal();
  youtubeModal.init();
});
