const analytics = require('./_modules/analytics');
const lazyLoader = require('./_modules/lazy-loader');
const noAnimations = require('./_modules/no-animations');
const ready = require('./_modules/document-ready');
const stickyStack = require('./_modules/sticky-stacky');
const windowResize = require('./_modules/window-resize');

function setupNavEvents() {
  const menuButton = document.getElementById('activate-menu');
  const navTray = document.getElementById('nav-tray');
  const navOverlay = document.getElementById('nav-overlay');

  parameters: queryParameters(),

  init() {
    const analytics = require('./_modules/analytics');

    this.setupNavEvents(analytics);
    this.testForTouch();
    this.navScrollWatcher();
    this.setMainMinHeight();
    this.setUpSkipNav();

    lazyLoader.init();
    analytics.watchElements();
  },

  setupNavEvents(analytics) {
    const menuButton = document.querySelector('#activate-menu');
    const mainNavContent = document.querySelector('nav.main .content');
    const mobileNavTray = mainNavContent.querySelector('.mobile-nav-tray');
    menuButton.addEventListener('click', () => {
      if (menuButton.getAttribute('aria-expanded') === 'true') {
        analytics.pushEvent({
          category: 'nav',
          action: 'menu close',
        });
        menuButton.setAttribute('aria-expanded', 'false');
        mobileNavTray.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
          mobileNavTray.style.display = 'none';
        }, 500);
      } else {
        analytics.pushEvent({
          category: 'nav',
          action: 'menu open',
        });
        mobileNavTray.style.display = '';
        setTimeout(() => {
          menuButton.setAttribute('aria-expanded', 'true');
          mobileNavTray.setAttribute('aria-hidden', 'false');
        }, 0);
      }
    });
    menuButton.setAttribute('aria-expanded', 'true');
    navTray.setAttribute('aria-hidden', 'false');
    navOverlay.classList.add('visible');

  setUpSkipNav() {
    const skipNavContainer = document.getElementById('skip-nav');
    const skipNavButton = skipNavContainer.querySelector('button');
    const nonNavContainerSelectors = ['main', 'footer'];
    const interactableElements = ['a', 'input', 'button', 'textarea', 'select'];
    const querySelectors = nonNavContainerSelectors.map((container) => interactableElements.map((input) => `${container} ${input}`));

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

function testForTouch() {
  if ('ontouchstart' in document.documentElement) {
    document.documentElement.classList.add('touch-events');
  } else {
    document.documentElement.classList.add('no-touch-events');
  }
}

function setMainMinHeight() {
  const mainElement = document.querySelector('main');
  const footerElement = document.querySelector('footer');

  const calculateMinHeight = () => {
    const docHeight = document.documentElement.clientHeight;
    const { bottom } = footerElement.getBoundingClientRect();
    const { height } = mainElement.getBoundingClientRect();

    const heightDelta = docHeight - bottom;

    mainElement.style.minHeight = `min(${height + heightDelta}px, 100vh)`;
  };

  calculateMinHeight();
  windowResize(calculateMinHeight.bind(this));
}

function preventFormSubmit() {
  const formElements = document.querySelectorAll('form');
  formElements.forEach((element) => {
    element.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') evt.preventDefault();
    });
  });
}

ready.document(() => {
  preventFormSubmit();
  setupNavEvents(analytics);
  testForTouch();
  // navScrollWatcher();
  setMainMinHeight();
  setUpSkipNav();
  noAnimations.initBodyClass();

  lazyLoader.init();
  analytics.watchElements();
  stickyStack.init();
});
