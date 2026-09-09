const { log } = require('./log');

/**
 * Pushes a custom analytics event to Google Tag Manager's dataLayer and logs it in development.
 *
 * @param {Object} [options={}] - The event details.
 * @param {string} [options.category] - Event category (gaCategory).
 * @param {string} [options.action] - Event action (gaAction).
 * @param {string} [options.label] - Optional event label (gaLabel).
 * @returns {void}
 */
const pushEvent = ({ category, action, label } = {}) => {
  const eventObject = {
    event: 'gaEvent',
    gaCategory: category,
    gaAction: action,
    gaLabel: label,
  };
  dataLayer.push(eventObject);
  log(eventObject);
};

module.exports = {
  pushEvent,

  /**
   * Attaches event listeners to track user interactions across the DOM,
   * including clicks on links, buttons, inputs, scroll depth milestones,
   * and initial viewport dimensions.
   *
   * @returns {void}
   */
  watchElements: () => {
    // Track clicks on all anchor links with the href as the action
    document.querySelectorAll('a').forEach((element) => {
      element.addEventListener('click', () => {
        pushEvent({
          category: 'anchor click',
          action: element.href,
        });
      });
    });

    // Track clicks on buttons using element ID or value as action
    document.querySelectorAll('button').forEach((element) => {
      element.addEventListener('click', () => {
        pushEvent({
          category: 'button click',
          action: element.id || element.value,
        });
      });
    });

    // Track clicks on form input elements using element ID as action
    document.querySelectorAll('input').forEach((element) => {
      element.addEventListener('click', () => {
        pushEvent({
          category: 'input click',
          action: element.id,
        });
      });
    });

    // Track vertical scroll depth milestones (10% increments)
    let scrollTrackerMilestones = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
    window.addEventListener('scroll', () => {
      const totalScrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const currentScroll = document.documentElement.scrollTop;
      let scrollTracker = scrollTrackerMilestones.map((value) => ({
        percent: value * 100,
        milestone: totalScrollHeight * value,
      }));

      // Fire events sequentially for reached milestones and remove them from future checks
      while (scrollTracker.length > 0 && currentScroll >= scrollTracker[0].milestone) {
        const scrollAchieved = scrollTracker[0].percent;
        scrollTracker = scrollTracker.splice(1);
        scrollTrackerMilestones = scrollTrackerMilestones.splice(1);

        pushEvent({
          category: 'scroll depth',
          action: `${scrollAchieved}%`,
        });
      }
    });

    // Capture initial viewport dimensions for screen-size analytics
    pushEvent({
      category: 'viewport width',
      action: `${window.innerWidth}px`,
    });

    pushEvent({
      category: 'viewport height',
      action: `${window.innerHeight}px`,
    });

    pushEvent({
      category: 'viewport width - height',
      action: `${window.innerWidth}px - ${window.innerHeight}px`,
    });
  },
};
