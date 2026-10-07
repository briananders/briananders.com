const ready = require('../_modules/document-ready');
const dashboard = require('../_modules/last-fm/dashboard');
require('../_components/api-image').init();
require('../_components/last-updated').init();

/**
 * Boots the listening-history dashboard (every period type) on DOM ready.
 */
ready.document(() => {
  dashboard.init();
});
