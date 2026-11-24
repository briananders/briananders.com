interface CssTemplateOptions {
  className: string;
}

/**
 * Generates initial SCSS template boilerplate for a newly scaffolded page.
 */
function cssTemplate({ className }: CssTemplateOptions): string {
  return `@import "system/utilities";

${className} {

}
`;
}

module.exports = cssTemplate;

