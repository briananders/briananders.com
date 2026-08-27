function stylesReadyWatcher(callback) {
  const styleSheets = Array.from(document.querySelectorAll('link[href*=".css"]'));

  let count = 0;

  function checkCount() {
    if (count >= styleSheets.length) {
      callback();
    }
  }

  styleSheets.forEach((link) => {
    if (link.sheet) count++;
    else {
      link.addEventListener('load', () => {
        count++;
        checkCount();
      });
    }
    checkCount();
  });
}

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
  all: (callback) => {
    let documentReady = false;
    let stylesReady = false;

    documentReadyWatcher(() => {
      documentReady = true;
      if (stylesReady) {
        callback();
      }
    });

    stylesReadyWatcher(() => {
      stylesReady = true;
      if (documentReady) {
        callback();
      }
    });
  },

  document: documentReadyWatcher,

  styles: stylesReadyWatcher,
};
