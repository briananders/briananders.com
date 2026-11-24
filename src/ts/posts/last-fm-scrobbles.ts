const ready = require('../_modules/document-ready.ts');
const dashboard = require('../_modules/last-fm/dashboard.ts');
require('../_components/api-image.ts').init();
require('../_components/last-updated.ts').init();

/**
 * Boots the listening-history dashboard (every period type) on DOM ready.
 */
ready.document(() => {
  dashboard.init();
});
