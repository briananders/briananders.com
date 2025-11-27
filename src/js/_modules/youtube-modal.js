const { log } = require('./log');

module.exports = function YoutubeModal({ triggerScope } = { triggerScope: '.yt-modal-trigger' }) {
  let triggerElements = [];

  const MODAL_ELEMENTS = {
    container: document.createElement('div'),
    overlay: document.createElement('div'),
    closeButton: document.createElement('button'),
  };

  const CLASSES = {
    container: 'youtube-modal-container',
    overlay: 'youtube-modal-overlay',
    closeButton: 'youtube-modal-close',
    bodyOpen: 'youtube-modal-open',
  };

  const IFRAME_CONFIG = {
    srcPrepend: 'https://www.youtube.com/embed/',
    srcAppend: '&origin=https://briananders.com&autoplay=1&rel=0',
    width: '560',
    height: '315',
  };

  const init = () => {
    triggerElements = Array.from(document.querySelectorAll(triggerScope));
    addEventListeners();
    checkNodeNames();

    MODAL_ELEMENTS.closeButton.classList.add(CLASSES.closeButton);
    MODAL_ELEMENTS.closeButton.innerHTML = 'Close';
    MODAL_ELEMENTS.container.classList.add(CLASSES.container);
    MODAL_ELEMENTS.overlay.classList.add(CLASSES.overlay);

    MODAL_ELEMENTS.closeButton.addEventListener('click', closeModal);
    MODAL_ELEMENTS.overlay.addEventListener('click', closeModal);
    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape') {
        closeModal();
      }
    });
  };

  const destroy = () => {
    removeEventListeners();
  };

  const getIframeString = (triggerElement) => {
    const { videoId, playlistId } = triggerElement.dataset;
    let embedModifier = `${videoId}?`;

    if (playlistId) {
      embedModifier = `videoseries?list=${playlistId}`;
    }

    return `
    <iframe
      width="${IFRAME_CONFIG.width}"
      height="${IFRAME_CONFIG.height}"
      src="${IFRAME_CONFIG.srcPrepend}${embedModifier}${IFRAME_CONFIG.srcAppend}"
      title="YouTube video player"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen>
    </iframe>`.replace(/\n+\s+/g, ' ');
  };

  const openModal = (triggerElement) => {
    const iframeString = getIframeString(triggerElement);
    document.body.appendChild(MODAL_ELEMENTS.overlay);
    document.body.appendChild(MODAL_ELEMENTS.container);
    document.body.appendChild(MODAL_ELEMENTS.closeButton);
    MODAL_ELEMENTS.container.innerHTML = iframeString;

    setTimeout(() => {
      document.documentElement.classList.add(CLASSES.bodyOpen);
    }, 1);
  };

  const closeModal = () => {
    document.documentElement.classList.remove(CLASSES.bodyOpen);

    setTimeout(() => {
      document.body.removeChild(MODAL_ELEMENTS.overlay);
      document.body.removeChild(MODAL_ELEMENTS.container);
      document.body.removeChild(MODAL_ELEMENTS.closeButton);
      MODAL_ELEMENTS.container.innerHTML = '';
    }, 300);
  };

  const checkNodeNames = () => {
    triggerElements.forEach((element) => {
      if (element.nodeName !== 'BUTTON') {
        log('WARNING: YoutubeModal trigger, should be a <button>');
      }
    });
  };

  const addEventListeners = () => {
    triggerElements.forEach((element) => { element.addEventListener('click', () => openModal(element)); });
  };

  const removeEventListeners = () => {
    triggerElements.forEach((element) => { element.removeEventListener('click', () => openModal(element)); });
  };

  this.init = () => {
    init();
  };

  this.destroy = () => {
    destroy();
  };
};
