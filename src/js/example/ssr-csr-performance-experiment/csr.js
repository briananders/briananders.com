const ready = require('../../_modules/document-ready');

const csrContainer = require('./csr-container');
const csrSquare = require('./csr-square');

csrContainer.init();
csrSquare.init();

/**
 * Initializes CSR experiment page once the document is ready.
 */
ready.document(() => {
  console.log('here');
});
