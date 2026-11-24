/**
 * Generates initial TypeScript client script boilerplate for a newly scaffolded page.
 */
function tsTemplate(): string {
  return `const ready = require('../_modules/document-ready.ts');

ready.document(() => {

});
`;
}

module.exports = tsTemplate;
