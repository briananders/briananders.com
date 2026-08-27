const { log } = require('./log');

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

  watchElements: () => {
    document.querySelectorAll('a').forEach((element) => {
      element.addEventListener('click', () => {
        pushEvent({
          category: 'anchor click',
          action: element.href,
        });
      });
    });

    document.querySelectorAll('button').forEach((element) => {
      element.addEventListener('click', () => {
        pushEvent({
          category: 'button click',
          action: element.id || element.value,
        });
      });
    });

    document.querySelectorAll('input').forEach((element) => {
      element.addEventListener('click', () => {
        pushEvent({
          category: 'input click',
          action: element.id,
        });
      });
    });

    let scrollTrackerMilestones = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
    window.addEventListener('scroll', () => {
      const totalScrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const currentScroll = document.documentElement.scrollTop;
      let scrollTracker = scrollTrackerMilestones.map((value) => ({
        percent: value * 100,
        milestone: totalScrollHeight * value,
      }));

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
