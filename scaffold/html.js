module.exports = ({ className, pageName }) => `---
title: ""
description: ""
date: ${(new Date()).toISOString().split('T')[0]}
priority: 0.8
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
