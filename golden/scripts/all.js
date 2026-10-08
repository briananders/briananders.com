(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

var _require = require('./log'),
  log = _require.log;

/**
 * Pushes a custom analytics event to Google Tag Manager's dataLayer and logs it in development.
 *
 * @param {Object} [options={}] - The event details.
 * @param {string} [options.category] - Event category (gaCategory).
 * @param {string} [options.action] - Event action (gaAction).
 * @param {string} [options.label] - Optional event label (gaLabel).
 * @returns {void}
 */
var pushEvent = function pushEvent() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
    category = _ref.category,
    action = _ref.action,
    label = _ref.label;
  var eventObject = {
    event: 'gaEvent',
    gaCategory: category,
    gaAction: action,
    gaLabel: label
  };
  dataLayer.push(eventObject);
  log(eventObject);
};
module.exports = {
  pushEvent: pushEvent,
  /**
   * Attaches event listeners to track user interactions across the DOM,
   * including clicks on links, buttons, inputs, scroll depth milestones,
   * and initial viewport dimensions.
   *
   * @returns {void}
   */
  watchElements: function watchElements() {
    // Track clicks on all anchor links with the href as the action
    document.querySelectorAll('a').forEach(function (element) {
      element.addEventListener('click', function () {
        pushEvent({
          category: 'anchor click',
          action: element.href
        });
      });
    });

    // Track clicks on buttons using element ID or value as action
    document.querySelectorAll('button').forEach(function (element) {
      element.addEventListener('click', function () {
        pushEvent({
          category: 'button click',
          action: element.id || element.value
        });
      });
    });

    // Track clicks on form input elements using element ID as action
    document.querySelectorAll('input').forEach(function (element) {
      element.addEventListener('click', function () {
        pushEvent({
          category: 'input click',
          action: element.id
        });
      });
    });

    // Track vertical scroll depth milestones (10% increments)
    var scrollTrackerMilestones = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
    window.addEventListener('scroll', function () {
      var totalScrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      var currentScroll = document.documentElement.scrollTop;
      var scrollTracker = scrollTrackerMilestones.map(function (value) {
        return {
          percent: value * 100,
          milestone: totalScrollHeight * value
        };
      });

      // Fire events sequentially for reached milestones and remove them from future checks
      while (scrollTracker.length > 0 && currentScroll >= scrollTracker[0].milestone) {
        var scrollAchieved = scrollTracker[0].percent;
        scrollTracker = scrollTracker.splice(1);
        scrollTrackerMilestones = scrollTrackerMilestones.splice(1);
        pushEvent({
          category: 'scroll depth',
          action: "".concat(scrollAchieved, "%")
        });
      }
    });

    // Capture initial viewport dimensions for screen-size analytics
    pushEvent({
      category: 'viewport width',
      action: "".concat(window.innerWidth, "px")
    });
    pushEvent({
      category: 'viewport height',
      action: "".concat(window.innerHeight, "px")
    });
    pushEvent({
      category: 'viewport width - height',
      action: "".concat(window.innerWidth, "px - ").concat(window.innerHeight, "px")
    });
  }
};

},{"./log":5}],2:[function(require,module,exports){
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

},{}],3:[function(require,module,exports){
"use strict";

/**
 * Evaluates whether the current environment is production based on the window hostname.
 *
 * @type {boolean}
 */
module.exports.isProduction = function () {
  return window.location.hostname === 'briananders.com';
}();

},{}],4:[function(require,module,exports){
"use strict";

/**
 * Grid-debug overlay.
 *
 * A dev/design aid. Press Ctrl+G (or Cmd+G on macOS) anywhere on the site to
 * toggle a translucent overlay showing the 12-column design-system grid on
 * top of the page — including the correct column count for the current
 * breakpoint (4 → 8 → 12 columns), the gutters, and the content max-width.
 *
 * Not shown by default; nothing renders until the user asks for it. Uses a
 * capture-phase listener with `code === 'KeyG'` so browser layouts and
 * default shortcuts don't swallow the keystroke.
 */

var OVERLAY_ID = 'grid-debug-overlay';
var STYLE_ID = 'grid-debug-overlay-styles';

/**
 * Inject the stylesheet the overlay depends on. Idempotent.
 * The container is a single-row grid so the columns run from top to bottom
 * of the viewport; columns beyond the current tier's count are hidden via
 * media queries.
 *
 * @returns {void}
 */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  var style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = "\n    #".concat(OVERLAY_ID, " {\n      position: fixed;\n      inset: 0;\n      z-index: 2147483000;\n      pointer-events: none;\n      display: none;\n    }\n    #").concat(OVERLAY_ID, "[data-active=\"true\"] { display: block; }\n\n    #").concat(OVERLAY_ID, " .grid-debug__container {\n      position: relative;\n      width: 100%;\n      max-width: var(--content-max, 1200px);\n      height: 100%;\n      margin: 0 auto;\n      padding: 0 var(--gutter-mobile, 16px);\n      display: grid;\n      grid-template-columns: repeat(4, minmax(0, 1fr));\n      grid-template-rows: 100%;\n      gap: var(--grid-gap-mobile, 12px);\n    }\n    @media (min-width: 600px) {\n      #").concat(OVERLAY_ID, " .grid-debug__container {\n        grid-template-columns: repeat(8, minmax(0, 1fr));\n        padding: 0 24px;\n      }\n    }\n    @media (min-width: 960px) {\n      #").concat(OVERLAY_ID, " .grid-debug__container {\n        grid-template-columns: repeat(12, minmax(0, 1fr));\n        gap: var(--grid-gap-desktop, 16px);\n        padding: 0 var(--gutter-desktop, 32px);\n      }\n    }\n    #").concat(OVERLAY_ID, " .grid-debug__col {\n      background: rgba(249, 115, 22, 0.16);\n      border-left: 1px dashed rgba(249, 115, 22, 0.75);\n      border-right: 1px dashed rgba(249, 115, 22, 0.75);\n      height: 100%;\n    }\n\n    /* Hide columns beyond the current tier's count. */\n    #").concat(OVERLAY_ID, " .grid-debug__col:nth-child(n+5)  { display: none; }\n    @media (min-width: 600px) {\n      #").concat(OVERLAY_ID, " .grid-debug__col:nth-child(n+5)  { display: block; }\n      #").concat(OVERLAY_ID, " .grid-debug__col:nth-child(n+9)  { display: none; }\n    }\n    @media (min-width: 960px) {\n      #").concat(OVERLAY_ID, " .grid-debug__col:nth-child(n+9)  { display: block; }\n    }\n\n    #").concat(OVERLAY_ID, " .grid-debug__label {\n      position: fixed;\n      right: 12px;\n      bottom: 12px;\n      padding: 8px 12px;\n      background: #0B0D10;\n      color: #F97316;\n      border: 1px solid #F97316;\n      border-radius: 8px;\n      font: 600 12px/1.2 ui-monospace, \"SF Mono\", Menlo, Consolas, monospace;\n      letter-spacing: 0.08em;\n      text-transform: uppercase;\n      pointer-events: none;\n      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);\n    }\n  ");
  document.head.appendChild(style);
}

/**
 * Build the overlay element with 12 columns; the extras are hidden by CSS at
 * smaller breakpoints.
 *
 * @returns {{ overlay: HTMLElement, label: HTMLElement }} An object containing the overlay element and its label.
 */
function buildOverlay() {
  var overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('aria-hidden', 'true');
  var container = document.createElement('div');
  container.className = 'grid-debug__container';
  for (var i = 0; i < 12; i += 1) {
    var col = document.createElement('span');
    col.className = 'grid-debug__col';
    container.appendChild(col);
  }
  overlay.appendChild(container);
  var label = document.createElement('div');
  label.className = 'grid-debug__label';
  overlay.appendChild(label);
  return {
    overlay: overlay,
    label: label
  };
}

/**
 * Return the current grid tier as a string based on the viewport width.
 *
 * @returns {string} The description of the column count and breakpoint tier.
 */
function currentTier() {
  var w = window.innerWidth;
  if (w >= 960) return '12 cols · desktop';
  if (w >= 600) return '8 cols · tablet';
  return '4 cols · mobile';
}

/**
 * Determines if a keyboard event originated from a form field or editable element.
 *
 * @param {EventTarget} target - The target element of the event.
 * @returns {boolean} True if the target is an editable input.
 */
function isEditableElement(target) {
  if (!target || !target.tagName) {
    return false;
  }
  var tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  return false;
}

/**
 * Checks whether the pressed key matches the grid toggle shortcut.
 * Supports Ctrl+G, Cmd+G, Alt+G, Shift combinations, or a bare 'g' outside inputs.
 *
 * @param {KeyboardEvent} evt - The keydown event.
 * @returns {boolean} True if the key combination should toggle the grid.
 */
function isGridKey(evt) {
  if (evt.repeat) {
    return false;
  }
  var isGKey = evt.code === 'KeyG' || evt.key === 'g' || evt.key === 'G';
  if (!isGKey) {
    return false;
  }

  // If a modifier is held (Ctrl, Cmd/Meta, or Alt/Option), trigger unconditionally.
  // We do not block Shift so that Ctrl+Shift+G or Cmd+Shift+G still works.
  if (evt.ctrlKey || evt.metaKey || evt.altKey) {
    return true;
  }

  // If no modifier is held, allow bare 'g' or 'G' as long as the user is not typing in an input.
  if (!isEditableElement(evt.target)) {
    return true;
  }
  return false;
}

/**
 * Initializes the grid debugging overlay module, setting up keyboard listeners
 * and checking URL search parameters to activate if requested.
 *
 * @returns {void}
 */
module.exports.init = function () {
  var overlay;
  var label;
  var active = false;

  /**
   * Toggles the active state of the grid overlay, injecting styles and DOM if necessary.
   *
   * @returns {void}
   */
  var toggle = function toggle() {
    if (!overlay) {
      injectStyles();
      var built = buildOverlay();
      overlay = built.overlay;
      label = built.label;
      document.body.appendChild(overlay);
      window.addEventListener('resize', function () {
        if (active && label) {
          label.textContent = currentTier();
        }
      });
    }
    active = !active;
    overlay.dataset.active = String(active);
    overlay.setAttribute('aria-hidden', String(!active));
    label.textContent = currentTier();
  };

  /**
   * Handles keydown events to toggle the grid overlay when shortcut criteria are met.
   *
   * @param {KeyboardEvent} evt - The keydown event object.
   * @returns {void}
   */
  var handleKeydown = function handleKeydown(evt) {
    if (!isGridKey(evt)) {
      return;
    }
    evt.preventDefault();
    evt.stopPropagation();
    toggle();
  };

  // Register in capture phase on both window and document to intercept before page listeners.
  window.addEventListener('keydown', handleKeydown, true);

  /**
   * Checks for the "grid" query parameter in the URL.
   * If present and not explicitly set to "false" or "0", automatically activate the overlay.
   *
   * @returns {void}
   */
  var checkQueryParameter = function checkQueryParameter() {
    var urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('grid')) {
      return;
    }
    var paramValue = urlParams.get('grid');
    if (paramValue === 'false' || paramValue === '0') {
      return;
    }
    toggle();
  };
  if (document.body) {
    checkQueryParameter();
  } else {
    document.addEventListener('DOMContentLoaded', checkQueryParameter);
  }
};

},{}],5:[function(require,module,exports){
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

},{"./environment":3}],6:[function(require,module,exports){
"use strict";

var urlParams = new URLSearchParams(window.location.search);
module.exports = {
  /**
   * Adds the 'no-animations' CSS class to the body if the 'disable-animations' query parameter is present.
   *
   * @returns {void}
   */
  initBodyClass: function initBodyClass() {
    if (urlParams.get('disable-animations') !== null) {
      document.body.classList.add('no-animations');
    }
  },
  /**
   * Indicates whether animations are disabled via the 'disable-animations' URL query parameter.
   *
   * @type {boolean}
   */
  areAnimationsDisabled: urlParams.get('disable-animations') !== null
};

},{}],7:[function(require,module,exports){
"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _classPrivateMethodInitSpec(e, a) { _checkPrivateRedeclaration(e, a), a.add(e); }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _classPrivateFieldInitSpec(e, t, a) { _checkPrivateRedeclaration(e, t), t.set(e, a); }
function _checkPrivateRedeclaration(e, t) { if (t.has(e)) throw new TypeError("Cannot initialize the same private elements twice on an object"); }
function _classPrivateFieldSet(s, a, r) { return s.set(_assertClassBrand(s, a), r), r; }
function _classPrivateFieldGet(s, a) { return s.get(_assertClassBrand(s, a)); }
function _assertClassBrand(e, t, n) { if ("function" == typeof e ? e === t : e.has(t)) return arguments.length < 3 ? t : n; throw new TypeError("Private element is not present on this object"); }
var _previousHeights = /*#__PURE__*/new WeakMap();
var _containerElement = /*#__PURE__*/new WeakMap();
var _StickyStacky_brand = /*#__PURE__*/new WeakSet();
/**
 * Class representing an individual StickyStacky element controller.
 * Manages sticky positioning, stuck states, and CSS custom properties for a sticky container.
 */
var StickyStacky = /*#__PURE__*/function () {
  /**
   * Creates an instance of StickyStacky.
   *
   * @param {HTMLElement} containerElement - The container DOM element with class `.sticky-container`.
   */
  function StickyStacky(containerElement) {
    _classCallCheck(this, StickyStacky);
    /**
     * Retrieves the current peeking translation value from the document CSS variable.
     *
     * @private
     * @returns {number} The transform value in pixels (without 'px').
     */
    _classPrivateMethodInitSpec(this, _StickyStacky_brand);
    _classPrivateFieldInitSpec(this, _previousHeights, void 0);
    _classPrivateFieldInitSpec(this, _containerElement, void 0);
    _defineProperty(this, "stickyElement", void 0);
    _defineProperty(this, "top", void 0);
    _defineProperty(this, "height", void 0);
    _defineProperty(this, "isStuck", void 0);
    _classPrivateFieldSet(_containerElement, this, containerElement);
    _classPrivateFieldSet(_previousHeights, this, 0);
    this.stickyElement = _classPrivateFieldGet(_containerElement, this).querySelector('.sticky-stacky');
    this.top = window.pageYOffset + _classPrivateFieldGet(_containerElement, this).getBoundingClientRect().top;
    this.height = this.stickyElement.offsetHeight;
    this.isStuck = false;
  }
  return _createClass(StickyStacky, [{
    key: "update",
    value:
    /**
     * Recalculates stuck status and updates the `--sticky-container-height` CSS variable on the container.
     *
     * @returns {void}
     */
    function update() {
      /*
        Determine if the bar should be stuck by comparing the (scroll position
        of page) + (how much the stack is peeking) to the top of the .sticky-container element.
      */
      this.isStuck = window.pageYOffset + (_classPrivateFieldGet(_previousHeights, this) + _assertClassBrand(_StickyStacky_brand, this, _getCurrentTransform).call(this)) > this.top;

      // add/remove .fixed class based on stuck status.
      if (this.isStuck) {
        this.stickyElement.classList.add('fixed');
      } else {
        this.stickyElement.classList.remove('fixed');
      }

      // update top value, height value, and set the container height CSS variable.
      this.top = window.pageYOffset + _classPrivateFieldGet(_containerElement, this).getBoundingClientRect().top;
      this.height = this.stickyElement.offsetHeight;
      _classPrivateFieldGet(_containerElement, this).style.setProperty('--sticky-container-height', "".concat(this.height, "px"));
    }

    /**
     * Sets the accumulated previous heights as a CSS custom property on the container element.
     * Note: this value will be different for each StickyStack instance.
     * It's the sum of the heights of the StickyStacks earlier in the DOM.
     *
     * @param {number} heights - The accumulated height of prior sticky elements in pixels.
     * @returns {void}
     */
  }, {
    key: "setPreviousHeights",
    value: function setPreviousHeights(heights) {
      _classPrivateFieldSet(_previousHeights, this, heights);
      _classPrivateFieldGet(_containerElement, this).style.setProperty('--previous-heights', "".concat(heights, "px"));
    }
  }]);
}();
/**
 * Class representing the global controller for StickyStacky elements on the page.
 * Manages scroll tracking, z-indices, stacking order, and accumulated offsets.
 */
function _getCurrentTransform() {
  var valueString = document.documentElement.style.getPropertyValue('--sticky-stacky-transform');
  return Number(valueString.slice(0, -2)); // slice removes the 'px' from the value.
}
var _scrollHeight = /*#__PURE__*/new WeakMap();
var _transformTop = /*#__PURE__*/new WeakMap();
var _maxTransform = /*#__PURE__*/new WeakMap();
var _stickyStacks = /*#__PURE__*/new WeakMap();
var _StickyController_brand = /*#__PURE__*/new WeakSet();
var StickyController = /*#__PURE__*/_createClass(
/**
 * Creates an instance of StickyController.
 *
 * @param {NodeList|Array<HTMLElement>} containerNodeList - List of `.sticky-container` elements.
 */
function StickyController(containerNodeList) {
  _classCallCheck(this, StickyController);
  /**
   * Filters all managed StickyStacky instances to return only those currently stuck.
   *
   * @private
   * @returns {Array<StickyStacky>} Array of stuck StickyStacky instances.
   */
  _classPrivateMethodInitSpec(this, _StickyController_brand);
  _classPrivateFieldInitSpec(this, _scrollHeight, void 0);
  _classPrivateFieldInitSpec(this, _transformTop, void 0);
  _classPrivateFieldInitSpec(this, _maxTransform, void 0);
  _classPrivateFieldInitSpec(this, _stickyStacks, void 0);
  /*
    Since the querySelectorAll function returns NodeLists,
    convert this to an Array so we can use .map and .forEach on it.
  */
  var containerArray = Array.from(containerNodeList);
  _classPrivateFieldSet(_scrollHeight, this, 0);
  _classPrivateFieldSet(_transformTop, this, 0);
  _classPrivateFieldSet(_maxTransform, this, 0);

  /*
    Sort the sticky stack elements in visual order from top to bottom.
  */
  _classPrivateFieldSet(_stickyStacks, this, containerArray.map(function (containerElement) {
    return new StickyStacky(containerElement);
  }).sort(function (stackA, stackB) {
    return stackA.top < stackB.top ? -1 : 1;
  }));

  /*
    Set incrementally higher z-index values to ensure the
    shadows cascade without overlapping
  */
  _classPrivateFieldGet(_stickyStacks, this).forEach(function (stack, index) {
    stack.stickyElement.style.zIndex = 10000 + index;
  });

  /*
    Update _AFTER_ the scroll event fires. I tried using other kinds of run loops,
    but this one performs the best without odd delayed overlaps.
    Do not debounce.
  */
  window.addEventListener('scroll', _assertClassBrand(_StickyController_brand, this, _update).bind(this));

  /*
    Running this twice at the beginning with these spaces seems to work well.
  */
  setTimeout(_assertClassBrand(_StickyController_brand, this, _update).bind(this), 0);
  setTimeout(_assertClassBrand(_StickyController_brand, this, _update).bind(this), 100);
});
/**
 * Initializes sticky stack controller on all `.sticky-container` elements found in the document.
 *
 * @returns {void}
 */
function _getStuckStacks() {
  return _classPrivateFieldGet(_stickyStacks, this).filter(function (stickyStack) {
    return stickyStack.isStuck;
  });
}
/**
 * Takes the StickyStacks that are stuck (isStuck === true), then
 * sorts them by visual order on the page. Finally, loops over
 * them to set the previous height for each stuck stack.
 *
 * @private
 * @returns {void}
 */
function _calculateMaxTransform() {
  var _this = this;
  var height = 0;
  var stuckStacks = _assertClassBrand(_StickyController_brand, this, _getStuckStacks).call(this).sort(function (stackA, stackB) {
    return stackA.top < stackB.top ? -1 : 1;
  });
  stuckStacks.forEach(function (stuckStack, index) {
    if (index === stuckStacks.length - 1) {
      // last stuck element gets the shadow
      _classPrivateFieldSet(_maxTransform, _this, 0 - height); // set global variable. Must be a negative number.
      // stuckStack.stickyElement.classList.add('shadow');
    } else {
      // other stuck elements lose the shadow
      // stuckStack.stickyElement.classList.remove('shadow');
    }
    // accumulate heights and set them, just like in recalculateHeights()
    stuckStack.setPreviousHeights(height);
    height += stuckStack.height;
  });
}
/**
 * Loops through all StickyStacks, accumulates their heights,
 * and updates each instance's previous height value.
 *
 * @private
 * @returns {void}
 */
function _recalculateHeights() {
  var height = 0;
  _classPrivateFieldGet(_stickyStacks, this).forEach(function (stickyStack) {
    stickyStack.update();
    stickyStack.setPreviousHeights(height);
    height += stickyStack.height;
  });
}
/**
 * [Critical function] Calculates the scroll direction and adjusts
 * the sticky stack peeking depth.
 *
 * @private
 * @returns {void}
 */
function _update() {
  _assertClassBrand(_StickyController_brand, this, _calculateMaxTransform).call(this); // sets maxTransform value.

  // Don't make any changes if the scroll depth hasn't changed.
  if (_classPrivateFieldGet(_scrollHeight, this) !== window.pageYOffset) {
    // determine the scroll depth difference
    var diff = _classPrivateFieldGet(_scrollHeight, this) - window.pageYOffset;
    // set global variable value for next time. Effectively caching the current value for later.
    _classPrivateFieldSet(_scrollHeight, this, window.pageYOffset);
    // calculate the peeking depth. It cannot be greater than zero or less than the maxTransform
    _classPrivateFieldSet(_transformTop, this, Math.max(Math.min(_classPrivateFieldGet(_transformTop, this) + diff, 0), _classPrivateFieldGet(_maxTransform, this)));
    // set the peeking depth in the CSS variable
    document.documentElement.style.setProperty('--sticky-stacky-transform', "".concat(_classPrivateFieldGet(_transformTop, this), "px"));
  }
  _assertClassBrand(_StickyController_brand, this, _recalculateHeights).call(this); // update the StickyStack height and previousHeights again
}
module.exports.init = function () {
  /* get all of the .sticky-container elements on the page */
  var stickyContainers = document.querySelectorAll('.sticky-container');

  /*
    Instantiating a StickyController class with the stickyContainers
    triggers the calculation and update of all sticky stacky elements
  */
  new StickyController(stickyContainers);
};

},{}],8:[function(require,module,exports){
"use strict";

var analytics = require('./_modules/analytics');
var gridDebug = require('./_modules/grid-debug');
var noAnimations = require('./_modules/no-animations');
var ready = require('./_modules/document-ready');
var stickyStack = require('./_modules/sticky-stacky');

/**
 * Sets up event listeners and state management for mobile navigation drawer,
 * including menu toggle button, overlay clicks, and Escape key dismissal.
 *
 * @returns {void}
 */
function setupNavEvents() {
  var menuButton = document.getElementById('activate-menu');
  var navTray = document.getElementById('nav-tray');
  var navOverlay = document.getElementById('nav-overlay');

  /**
   * Opens the navigation drawer with animations and tracks the analytics event.
   *
   * @returns {void}
   */
  function openMenu() {
    analytics.pushEvent({
      category: 'nav',
      action: 'menu open'
    });
    menuButton.setAttribute('aria-expanded', 'true');
    navTray.setAttribute('aria-hidden', 'false');
    navOverlay.classList.add('visible');
    setTimeout(function () {
      navTray.classList.add('slide-in');
    }, 100);
  }

  /**
   * Closes the navigation drawer with animations and tracks the analytics event.
   *
   * @returns {void}
   */
  function closeMenu() {
    analytics.pushEvent({
      category: 'nav',
      action: 'menu close'
    });
    navTray.classList.remove('slide-in');
    navOverlay.classList.remove('visible');
    setTimeout(function () {
      menuButton.setAttribute('aria-expanded', 'false');
      navTray.setAttribute('aria-hidden', 'true');
    }, 300);
  }
  navOverlay.addEventListener('click', function () {
    closeMenu();
  });
  menuButton.addEventListener('click', function () {
    if (menuButton.getAttribute('aria-expanded') === 'true') {
      // it’s open
      closeMenu();
    } else {
      // it’s closed
      openMenu();
    }
  });
  document.addEventListener('keydown', function (evt) {
    if (evt.key === 'Escape') {
      closeMenu();
    }
  });
}

/**
 * Configures the accessibility skip-navigation component, allowing keyboard users
 * to quickly skip navigation headers and focus the first interactive main content element.
 *
 * @returns {void}
 */
function setUpSkipNav() {
  var skipNavContainer = document.getElementById('skip-nav');
  var skipNavButton = skipNavContainer.querySelector('button');
  var nonNavContainerSelectors = ['main', 'footer'];
  var interactiveElements = ['a', 'input', 'button', 'textarea', 'select'];
  var querySelectors = nonNavContainerSelectors.map(function (container) {
    return interactiveElements.map(function (input) {
      return "".concat(container, " ").concat(input);
    });
  });
  skipNavButton.addEventListener('focus', function () {
    skipNavContainer.dataset.state = 'active';
  });
  skipNavButton.addEventListener('blur', function () {
    skipNavContainer.dataset.state = 'inactive';
  });
  skipNavButton.addEventListener('click', function () {
    var firstInput = document.querySelector(querySelectors.join(', '));
    firstInput.focus();
  });
}

/**
 * Detects touch support and adds 'touch-events' or 'no-touch-events'
 * to the root HTML element.
 *
 * @returns {void}
 */
function testForTouch() {
  if ('ontouchstart' in document.documentElement) {
    document.documentElement.classList.add('touch-events');
  } else {
    document.documentElement.classList.add('no-touch-events');
  }
}

/**
 * Prevents accidental form submissions caused by pressing the Enter key inside input fields.
 *
 * @returns {void}
 */
function preventFormSubmit() {
  var formElements = document.querySelectorAll('form');
  formElements.forEach(function (element) {
    element.addEventListener('keydown', function (evt) {
      if (evt.key === 'Enter') evt.preventDefault();
    });
  });
}

/**
 * Global site-wide bootstrapping function executed when the DOM is ready.
 */
ready.document(function () {
  preventFormSubmit();
  setupNavEvents(analytics);
  testForTouch();
  // navScrollWatcher();
  setUpSkipNav();
  noAnimations.initBodyClass();
  analytics.watchElements();
  stickyStack.init();
  gridDebug.init();
});

},{"./_modules/analytics":1,"./_modules/document-ready":2,"./_modules/grid-debug":4,"./_modules/no-animations":6,"./_modules/sticky-stacky":7}]},{},[8]);
