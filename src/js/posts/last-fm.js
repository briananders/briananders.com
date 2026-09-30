const ready = require('../_modules/document-ready');
const dashboard = require('../_modules/last-fm/dashboard');
require('../_components/api-image').init();
require('../_components/last-updated').init();

/**
 * Boots the recent-listening dashboard (rolling windows) on DOM ready.
 */
ready.document(() => {
  dashboard.init();
});
