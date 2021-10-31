const analytics = require('./_modules/analytics.js');
const lazyLoader = require('./_modules/lazy-loader.js');
const queryParameters = require('./_modules/queryParameters.js');
const parameters = queryParameters();

(function all() {
  function setupNavEvents() {
    const menuButton = document.querySelector('#activate-menu');
    const mainNavContent = document.querySelector('nav.main .content');
    const mobileNavTray = mainNavContent.querySelector('.mobile-nav-tray');
    menuButton.addEventListener('click', () => {
      if (mainNavContent.classList.contains('mobile-active')) {
        analytics.pushEvent({
          category: 'nav',
          action: 'menu close',
        });
        menuButton.setAttribute('aria-expanded', 'false');
        mainNavContent.classList.remove('mobile-active');
        setTimeout(() => {
          mobileNavTray.setAttribute('aria-hidden', 'true');
        }, 250);
      } else {
        analytics.pushEvent({
          category: 'nav',
          action: 'menu open',
        });
        menuButton.setAttribute('aria-expanded', 'true');
        mobileNavTray.setAttribute('aria-hidden', 'false');
        setTimeout(() => {
          mainNavContent.classList.add('mobile-active');
        }, 1);
      }
    });
  }

  function setUpSkipNav() {
    const skipNavContainer = document.getElementById('skip-nav');
    const skipNavButton = skipNavContainer.querySelector('button');
    const nonNavContainerSelectors = ['main', 'footer'];
    const interactableElements = ['a', 'input', 'button', 'textarea', 'select'];
    const querySelectors = nonNavContainerSelectors.map((container) => interactableElements.map((input) => `${container} ${input}`));

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

  function navScrollWatcher() {
    const mainNav = document.querySelector('nav.main');

    const checkScrollDepth = () => {
      if (window.scrollY <= 0) {
        mainNav.classList.remove('shadow');
      } else {
        mainNav.classList.add('shadow');
      }
    };

    window.addEventListener('scroll', checkScrollDepth);
    checkScrollDepth();
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

      mainElement.style.minHeight = `${height + heightDelta}px`;
    };

    calculateMinHeight();
    window.addEventListener('resize', calculateMinHeight);
    window.addEventListener('orientationchange', calculateMinHeight);
  }

  setupNavEvents(analytics);

  testForTouch();

  navScrollWatcher();

  setMainMinHeight();

  setUpSkipNav();

  lazyLoader.init();
  analytics.watchElements();
}());
