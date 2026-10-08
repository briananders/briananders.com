(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

/**
 * Watches all external stylesheet link tags in the document and invokes the
 * provided callback once all stylesheets are confirmed to be loaded.
 *
 * @param {Function} callback - Function invoked when all stylesheets have loaded.
 * @returns {void}
 */
function stylesReadyWatcher(callback) {
  var styleSheets = Array.from(document.querySelectorAll('link[href*=".css"]'));
  var count = 0;

  /**
   * Checks whether all tracked stylesheet link tags have loaded and fires the callback if so.
   *
   * @returns {void}
   */
  function checkCount() {
    if (count >= styleSheets.length) {
      callback();
    }
  }
  styleSheets.forEach(function (link) {
    // If the stylesheet object is already attached, it is already loaded
    if (link.sheet) count++;else {
      link.addEventListener('load', function () {
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
 * @param {Function} callback - Function invoked when the DOM is ready.
 * @returns {void}
 */
function documentReadyWatcher(callback) {
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
   * @param {Function} callback - Function invoked when both DOM and stylesheets are ready.
   * @returns {void}
   */
  all: function all(callback) {
    var documentReady = false;
    var stylesReady = false;
    documentReadyWatcher(function () {
      documentReady = true;
      if (stylesReady) {
        callback();
      }
    });
    stylesReadyWatcher(function () {
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
  styles: stylesReadyWatcher
};

},{}],2:[function(require,module,exports){
"use strict";

/**
 * Evaluates whether the current environment is production based on the window hostname.
 *
 * @type {boolean}
 */
module.exports.isProduction = function () {
  return window.location.hostname === 'briananders.com';
}();

},{}],3:[function(require,module,exports){
"use strict";

var _require = require('./environment'),
  isProduction = _require.isProduction;
var _console = console,
  _log = _console.log,
  _table = _console.table;
module.exports = {
  /**
   * Outputs tabular data to the console if the environment is not production.
   *
   * @param {...*} args - Arguments passed directly to `console.table`.
   * @returns {void}
   */
  table: function table() {
    if (!isProduction) _table.apply(void 0, arguments);
  },
  /**
   * Outputs messages or objects to the console if the environment is not production.
   *
   * @param {...*} args - Arguments passed directly to `console.log`.
   * @returns {void}
   */
  log: function log() {
    if (!isProduction) _log.apply(void 0, arguments);
  }
};

},{"./environment":2}],4:[function(require,module,exports){
"use strict";

var _require = require('./log'),
  log = _require.log;

/**
 * YouTube modal video player controller.
 * Manages modal overlay, iframe creation, trigger binding, and keyboard shortcuts.
 *
 * @constructor
 * @param {Object} [options={ triggerScope: '.yt-modal-trigger' }] - Configuration options.
 * @param {string} [options.triggerScope='.yt-modal-trigger'] - CSS selector for elements that trigger the modal.
 */
module.exports = function YoutubeModal() {
  var _this = this;
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
      triggerScope: '.yt-modal-trigger'
    },
    triggerScope = _ref.triggerScope;
  var triggerElements = [];
  var boundHandlers = new Map();
  var MODAL_ELEMENTS = {
    container: document.createElement('div'),
    overlay: document.createElement('div'),
    closeButton: document.createElement('button')
  };
  var CLASSES = {
    container: 'youtube-modal-container',
    overlay: 'youtube-modal-overlay',
    closeButton: 'youtube-modal-close',
    bodyOpen: 'youtube-modal-open'
  };
  var IFRAME_CONFIG = {
    srcPrepend: 'https://www.youtube.com/embed/',
    srcAppend: '&origin=https://briananders.com&autoplay=1&rel=0',
    width: '560',
    height: '315'
  };

  /**
   * Initializes modal elements, event listeners, and trigger validations.
   *
   * @returns {void}
   */
  var init = function init() {
    triggerElements = Array.from(document.querySelectorAll(triggerScope));
    addEventListeners();
    checkNodeNames();
    MODAL_ELEMENTS.closeButton.classList.add(CLASSES.closeButton);
    MODAL_ELEMENTS.closeButton.innerHTML = 'Close';
    MODAL_ELEMENTS.container.classList.add(CLASSES.container);
    MODAL_ELEMENTS.overlay.classList.add(CLASSES.overlay);
    MODAL_ELEMENTS.closeButton.addEventListener('click', closeModal);
    MODAL_ELEMENTS.overlay.addEventListener('click', closeModal);
    document.addEventListener('keydown', function (evt) {
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
  var destroy = function destroy() {
    removeEventListeners();
  };

  /**
   * Generates the YouTube iframe HTML embed markup based on data attributes on the trigger element.
   *
   * @param {HTMLElement} triggerElement - The element triggering the modal embed.
   * @returns {string} YouTube iframe HTML string.
   */
  var getIframeString = function getIframeString(triggerElement) {
    var _triggerElement$datas = triggerElement.dataset,
      videoId = _triggerElement$datas.videoId,
      playlistId = _triggerElement$datas.playlistId;
    var embedModifier = "".concat(videoId, "?");
    if (playlistId) {
      embedModifier = "videoseries?list=".concat(playlistId);
    }
    return "\n    <iframe\n      width=\"".concat(IFRAME_CONFIG.width, "\"\n      height=\"").concat(IFRAME_CONFIG.height, "\"\n      src=\"").concat(IFRAME_CONFIG.srcPrepend).concat(embedModifier).concat(IFRAME_CONFIG.srcAppend, "\"\n      title=\"YouTube video player\"\n      frameborder=\"0\"\n      allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" allowfullscreen>\n    </iframe>").replace(/\n+\s+/g, ' ');
  };

  /**
   * Opens the YouTube modal dialog and injects the video iframe.
   *
   * @param {HTMLElement} triggerElement - The DOM element that triggered opening the modal.
   * @returns {void}
   */
  var openModal = function openModal(triggerElement) {
    var iframeString = getIframeString(triggerElement);
    document.body.appendChild(MODAL_ELEMENTS.overlay);
    document.body.appendChild(MODAL_ELEMENTS.container);
    document.body.appendChild(MODAL_ELEMENTS.closeButton);
    MODAL_ELEMENTS.container.innerHTML = iframeString;
    setTimeout(function () {
      document.documentElement.classList.add(CLASSES.bodyOpen);
    }, 1);
  };

  /**
   * Closes the active YouTube modal and removes DOM elements after a transition delay.
   *
   * @returns {void}
   */
  var closeModal = function closeModal() {
    document.documentElement.classList.remove(CLASSES.bodyOpen);
    setTimeout(function () {
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
  var checkNodeNames = function checkNodeNames() {
    triggerElements.forEach(function (element) {
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
  var addEventListeners = function addEventListeners() {
    triggerElements.forEach(function (element) {
      var handler = openModal.bind(_this, element);
      boundHandlers.set(element, handler);
      element.addEventListener('click', handler);
    });
  };

  /**
   * Removes click event listeners from all trigger elements.
   *
   * @returns {void}
   */
  var removeEventListeners = function removeEventListeners() {
    triggerElements.forEach(function (element) {
      element.removeEventListener('click', boundHandlers.get(element));
      boundHandlers["delete"](element);
    });
  };

  /**
   * Initializes YouTube modal trigger bindings and modal DOM containers.
   *
   * @type {Function}
   */
  this.init = function () {
    init();
  };

  /**
   * Destroys all event listeners on trigger elements.
   *
   * @type {Function}
   */
  this.destroy = function () {
    destroy();
  };
};

},{"./log":3}],5:[function(require,module,exports){
"use strict";

var YoutubeModal = require('./_modules/youtube-modal');
var ready = require('./_modules/document-ready');

/**
 * Initializes the YouTube video modal on the About page when the DOM is ready.
 */
ready.document(function () {
  var youtubeModal = new YoutubeModal();
  youtubeModal.init();
});

},{"./_modules/document-ready":1,"./_modules/youtube-modal":4}]},{},[5]);
