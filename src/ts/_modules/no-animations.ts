const urlParams = new URLSearchParams(window.location.search);

module.exports = {
  /**
   * Adds the 'no-animations' CSS class to the body if the 'disable-animations' query parameter is present.
   *
   * @returns {void}
   */
  initBodyClass() {
    if (urlParams.get('disable-animations') !== null) {
      document.body.classList.add('no-animations');
    }
  },

  /**
   * Indicates whether animations are disabled via the 'disable-animations' URL query parameter.
   *
   * @type {boolean}
   */
  areAnimationsDisabled: (urlParams.get('disable-animations') !== null),
};
