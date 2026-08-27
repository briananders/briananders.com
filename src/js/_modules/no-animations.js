const urlParams = new URLSearchParams(window.location.search);

module.exports = {
  initBodyClass() {
    if (urlParams.get('disable-animations') !== null) {
      document.body.classList.add('no-animations');
    }
  },

  areAnimationsDisabled: (urlParams.get('disable-animations') !== null),
};
