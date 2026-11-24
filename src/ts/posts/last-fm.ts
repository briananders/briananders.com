const ready = require('../_modules/document-ready.ts');
const dashboard = require('../_modules/last-fm/dashboard.ts');
require('../_components/api-image.ts').init();
require('../_components/last-updated.ts').init();

/**
 * Boots the recent-listening dashboard (rolling windows) on DOM ready.
 */
ready.document(() => {
  dashboard.init();
});
