const ready = require('../../_modules/document-ready');

const csrContainer = require('./csr-container');
const csrSquare = require('./csr-square');

csrContainer.init();
csrSquare.init();

ready.document(() => {
  console.log('here');
});
