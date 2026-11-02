/**
 * Generates initial EJS/HTML frontmatter and template boilerplate for a newly scaffolded page.
 *
 * @param {Object} options - Template options.
 * @param {string} options.className - Space-separated CSS class names for pageClasses.
 * @param {string} options.pageName - Name / relative path identifier of the page.
 * @returns {string} Generated frontmatter and markdown/HTML template string.
 */
module.exports = ({ className, pageName }) => `---
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

