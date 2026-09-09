const { log } = require('./log');

/**
 * YouTube modal video player controller.
 * Manages modal overlay, iframe creation, trigger binding, and keyboard shortcuts.
 *
 * @constructor
 * @param {Object} [options={ triggerScope: '.yt-modal-trigger' }] - Configuration options.
 * @param {string} [options.triggerScope='.yt-modal-trigger'] - CSS selector for elements that trigger the modal.
 */
module.exports = function YoutubeModal({ triggerScope } = { triggerScope: '.yt-modal-trigger' }) {
  let triggerElements = [];
  const boundHandlers = new Map();

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

  /**
   * Initializes modal elements, event listeners, and trigger validations.
   *
   * @returns {void}
   */
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

  /**
   * Destroys event listeners bound to trigger elements.
   *
   * @returns {void}
   */
  const destroy = () => {
    removeEventListeners();
  };

  /**
   * Generates the YouTube iframe HTML embed markup based on data attributes on the trigger element.
   *
   * @param {HTMLElement} triggerElement - The element triggering the modal embed.
   * @returns {string} YouTube iframe HTML string.
   */
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

  /**
   * Opens the YouTube modal dialog and injects the video iframe.
   *
   * @param {HTMLElement} triggerElement - The DOM element that triggered opening the modal.
   * @returns {void}
   */
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

  /**
   * Closes the active YouTube modal and removes DOM elements after a transition delay.
   *
   * @returns {void}
   */
  const closeModal = () => {
    document.documentElement.classList.remove(CLASSES.bodyOpen);

    setTimeout(() => {
      document.body.removeChild(MODAL_ELEMENTS.overlay);
      document.body.removeChild(MODAL_ELEMENTS.container);
      document.body.removeChild(MODAL_ELEMENTS.closeButton);
      MODAL_ELEMENTS.container.innerHTML = '';
    }, 300);
  };

  /**
   * Validates that trigger elements are semantic `<button>` tags and logs a warning if not.
   *
   * @returns {void}
   */
  const checkNodeNames = () => {
    triggerElements.forEach((element) => {
      if (element.nodeName !== 'BUTTON') {
        log('WARNING: YoutubeModal trigger, should be a <button>');
      }
    });
  };

  /**
   * Attaches click event listeners to all identified trigger elements.
   *
   * @returns {void}
   */
  const addEventListeners = () => {
    triggerElements.forEach((element) => {
      const handler = openModal.bind(this, element);
      boundHandlers.set(element, handler);
      element.addEventListener('click', handler);
    });
  };

  /**
   * Removes click event listeners from all trigger elements.
   *
   * @returns {void}
   */
  const removeEventListeners = () => {
    triggerElements.forEach((element) => {
      element.removeEventListener('click', boundHandlers.get(element));
      boundHandlers.delete(element);
    });
  };

  /**
   * Initializes YouTube modal trigger bindings and modal DOM containers.
   *
   * @type {Function}
   */
  this.init = () => {
    init();
  };

  /**
   * Destroys all event listeners on trigger elements.
   *
   * @type {Function}
   */
  this.destroy = () => {
    destroy();
  };
};
