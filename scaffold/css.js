/**
 * Generates initial SCSS template boilerplate for a newly scaffolded page.
 *
 * @param {Object} options - Template options.
 * @param {string} options.className - Root CSS class name for the page stylesheet.
 * @returns {string} Generated SCSS template string.
 */
module.exports = ({ className }) => `@import "system/utilities";

${className} {

}
`;

