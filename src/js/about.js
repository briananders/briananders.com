const YoutubeModal = require('./_modules/youtube-modal');
const ready = require('./_modules/document-ready');

ready.document(() => {
  const youtubeModal = new YoutubeModal();
  youtubeModal.init();
});
