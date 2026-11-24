interface HtmlTemplateOptions {
  className: string;
  pageName: string;
}

/**
 * Generates initial EJS/HTML frontmatter and template boilerplate for a newly scaffolded page.
 */
function htmlTemplate({ className, pageName }: HtmlTemplateOptions): string {
  return `---
title: ""
description: ""
date: ${(new Date()).toISOString().split('T')[0]}
priority: 0.8
# Social preview: point selector at the element that makes this page recognizable,
# then run \`npm run build && npm run og-images -- /${pageName}/\`.
ogImage:
  selector: 'main'
  alt: ''
pageClasses:
  - '${className}'
layout: base
styles:
  - 'main'
  - '${pageName}'
scripts:
  - '${pageName}'
---

`;
}

module.exports = htmlTemplate;

