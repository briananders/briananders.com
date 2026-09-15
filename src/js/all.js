const analytics = require('./_modules/analytics');
const gridDebug = require('./_modules/grid-debug');
const noAnimations = require('./_modules/no-animations');
const ready = require('./_modules/document-ready');
const stickyStack = require('./_modules/sticky-stacky');

/**
 * Sets up event listeners and state management for mobile navigation drawer,
 * including menu toggle button, overlay clicks, and Escape key dismissal.
 *
 * @returns {void}
 */
function setupNavEvents() {
  const menuButton = document.getElementById('activate-menu');
  const navTray = document.getElementById('nav-tray');
  const navOverlay = document.getElementById('nav-overlay');

  /**
   * Opens the navigation drawer with animations and tracks the analytics event.
   *
   * @returns {void}
   */
  function openMenu() {
    analytics.pushEvent({
      category: 'nav',
      action: 'menu open',
    });
    menuButton.setAttribute('aria-expanded', 'true');
    navTray.setAttribute('aria-hidden', 'false');
    navOverlay.classList.add('visible');

    setTimeout(() => {
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
      action: 'menu close',
    });
    navTray.classList.remove('slide-in');
    navOverlay.classList.remove('visible');

    setTimeout(() => {
      menuButton.setAttribute('aria-expanded', 'false');
      navTray.setAttribute('aria-hidden', 'true');
    }, 300);
  }

  navOverlay.addEventListener('click', () => {
    closeMenu();
  });

  menuButton.addEventListener('click', () => {
    if (menuButton.getAttribute('aria-expanded') === 'true') { // it’s open
      closeMenu();
    } else { // it’s closed
      openMenu();
    }
  });

  document.addEventListener('keydown', (evt) => {
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
  const skipNavContainer = document.getElementById('skip-nav');
  const skipNavButton = skipNavContainer.querySelector('button');
  const nonNavContainerSelectors = ['main', 'footer'];
  const interactiveElements = ['a', 'input', 'button', 'textarea', 'select'];
  const querySelectors = nonNavContainerSelectors.map((container) => interactiveElements.map((input) => `${container} ${input}`));

  skipNavButton.addEventListener('focus', () => {
    skipNavContainer.dataset.state = 'active';
  });
  skipNavButton.addEventListener('blur', () => {
    skipNavContainer.dataset.state = 'inactive';
  });
  skipNavButton.addEventListener('click', () => {
    const firstInput = document.querySelector(querySelectors.join(', '));
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
  const formElements = document.querySelectorAll('form');
  formElements.forEach((element) => {
    element.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') evt.preventDefault();
    });
  });
}

/**
 * Global site-wide bootstrapping function executed when the DOM is ready.
 */
ready.document(() => {
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
