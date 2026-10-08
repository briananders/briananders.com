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

var ready = require('../_modules/document-ready');

/**
 * Initializes button click handlers to dynamically append random Lorem Ipsum sentences
 * to demonstrate vertical centering behavior when sibling content grows.
 */
ready.document(function () {
  var lipsum = ['Lorem ipsum dolor sit amet, consectetur adipiscing elit.', 'Vivamus tincidunt, felis mollis placerat finibus, ligula erat feugiat leo, ac cursus arcu velit vel lacus.', 'Morbi felis lorem, viverra eu nunc sed, dignissim ornare lorem.', 'Suspendisse nec est nec ipsum faucibus sagittis ut non neque.', 'Mauris luctus laoreet turpis ac blandit.', 'Sed nec nunc consectetur, tempor felis ut, tincidunt tortor.', 'In venenatis leo sed ante ullamcorper, sit amet ultricies nulla condimentum.', 'Quisque quis hendrerit massa, sed consequat lorem.', 'Etiam interdum mattis tincidunt.', 'Nulla pulvinar enim in rhoncus posuere.', 'Aenean porttitor finibus diam, in iaculis lacus.', 'Sed consectetur iaculis scelerisque.', 'Cras non nulla tincidunt sapien dapibus rhoncus vel condimentum arcu.', 'Vivamus interdum maximus augue et tincidunt.', 'Etiam mollis arcu augue, a elementum elit iaculis nec.', 'Curabitur purus elit, eleifend in fermentum quis, imperdiet a purus.', 'Integer dignissim sollicitudin dolor, varius sollicitudin ligula varius nec.', 'Aliquam quis pharetra sem, condimentum cursus nisi.', 'Suspendisse nibh turpis, volutpat in interdum at, pulvinar ut tortor.', 'Fusce est sapien, tempus in ex at, molestie feugiat odio.', 'Pellentesque sit amet nulla odio.'];
  var buttons = document.querySelectorAll('.button');
  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      // Append a randomly selected paragraph sentence to the preceding sibling element
      button.previousElementSibling.innerText += " ".concat(lipsum[Math.floor(Math.random() * lipsum.length)]);
    });
  });
});

},{"../_modules/document-ready":1}]},{},[2]);
