# Design System Usage Guide

This document describes the design system used across the Brian Anders website. The system provides a consistent set of design tokens, SCSS mixins, utility classes, and EJS helper functions that should be used for all styling decisions.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Design Tokens](#design-tokens)
3. [Color System](#color-system)
4. [Typography](#typography)
5. [Spacing](#spacing)
6. [Breakpoints & Media Queries](#breakpoints--media-queries)
7. [Grid & Layout](#grid--layout)
8. [Shadows](#shadows)
9. [Z-Index Scale](#z-index-scale)
10. [Transitions](#transitions)
11. [Components](#components)
12. [Utility Classes](#utility-classes)
13. [EJS Template Helpers](#ejs-template-helpers)
14. [JavaScript Modules](#javascript-modules)
15. [Conventions](#conventions)

---

## Architecture

The design system lives in `src/styles/system/` and is structured in five layers:

```
src/styles/system/
├── variables/          Design tokens (raw values)
│   ├── _colors.scss        Google Material color palette
│   ├── _defaults.scss      Base unit, transition, border-radius
│   ├── _fonts.scss         Font families and weights
│   ├── _grid.scss          Grid dimensions
│   ├── _palettes.scss      Semantic color assignments
│   ├── _shadows.scss       Box-shadow tokens
│   ├── _spaces.scss        Spacing scale
│   ├── _viewports.scss     Breakpoint values
│   ├── _z-index.scss       Z-index scale
│   └── all.scss            Barrel import
├── functions/          SCSS helper functions
│   └── all.scss            css-min(), css-max()
├── mixins/             Reusable style patterns
│   ├── _animations.scss    Animation mixins (empty, extend as needed)
│   ├── _colors.scss        Palette application mixins
│   ├── _elements.scss      Component mixins (links, buttons, inputs, etc.)
│   ├── _grid.scss          Layout and grid mixins
│   ├── _media-queries.scss Media query helpers
│   ├── _type.scss          Typography mixins
│   ├── _utilities.scss     Box-sizing mixin
│   └── all.scss            Barrel import
├── styles/             Base element defaults
│   ├── _defaults.scss      Global *, ::selection
│   ├── _elements.scss      HTML element styling
│   ├── _attributes.scss    ARIA attribute rules
│   └── all.scss            Barrel import
└── classes/            Utility CSS classes
    ├── _display.scss       Display, flex, position utilities
    ├── _elements.scss      Component classes (.inline-link, .button, etc.)
    ├── _spacing.scss       Margin and padding utilities
    ├── _type.scss          Heading classes (.h1 through .h6)
    └── all.scss            Barrel import
```

### Import Chain

To access all tokens, functions, and mixins in any SCSS file:

```scss
@import "system/utilities";
```

This imports `variables/all`, `mixins/all`, and `functions/all`. The full system styles and classes are pulled in through `main.scss` via `@import "./system/styles"`.

---

## Design Tokens

All design decisions are rooted in token variables. Never use raw values — always reference the appropriate token.

### Base Unit

The foundation of the entire system:

| Token | Value | Description |
|-------|-------|-------------|
| `$base-unit` | `6px` | Every spacing, sizing, and typographic value derives from this |

---

## Color System

### Material Palette

The full Google Material Design palette is available in `_colors.scss`. Colors follow the naming pattern:

```scss
$color--{hue}-{shade}    // e.g. $color--red-500, $color--grey-900
$color--{hue}-a{shade}   // accent variants, e.g. $color--green-a200
```

### Semantic Palette

Use semantic palette tokens rather than raw Material colors:

| Token | Value | Role |
|-------|-------|------|
| `$palette--primary-white` | `#ffffff` | Primary text on dark backgrounds |
| `$palette--primary-grey` | `#212121` (grey-900) | Primary background |
| `$palette--hover-grey` | `#424242` (grey-800) | Hover state backgrounds |
| `$palette--secondary-grey` | `#757575` (grey-600) | Borders, secondary text |
| `$palette--divider-color` | `#f57f17` (yellow-900) | Links, accents, borders |
| `$palette--error` | `#ef5350` (red-400) | Error states |
| `$palette--primary-color-dark` | `darken(#e65100, 5)` | Header/footer gradients |
| `$palette--primary-color-light` | `#f57f17` (yellow-900) | Gradient endpoints, dividers |
| `$palette--accent-color` | `#69f0ae` (green-a200) | Toggles, accent elements |

### CSS Custom Properties

All palette tokens are also exposed as CSS custom properties on `html`:

```css
--palette--primary-white
--palette--primary-grey
--palette--hover-grey
--palette--secondary-grey
--palette--divider-color
--palette--error
--palette--primary-color-dark
--palette--primary-color-light
--palette--accent-color
--border-radius
--transition-speed
--transition-timing
```

### Palette Mixins

Apply predefined color combinations:

```scss
@include palette--base;              // white text on grey-900 background
@include palette--base--inverted;    // grey-900 text on white background
@include palette--primary;           // white text on dark orange background
@include palette--header;            // same as palette--primary
@include orange-gradient;            // linear-gradient from light to dark orange
```

---

## Typography

### Font Families

| Token | Value | Usage |
|-------|-------|-------|
| `$serif` | `'Source Serif Pro', serif` | Body copy, paragraphs |
| `$sans-serif` | `'Roboto', sans-serif` | Headings, UI elements |

### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `$regular` | `300` | Normal body text |
| `$bold` | `500` | Headings, strong emphasis |

### Type Mixins

Combine font-family and weight:

```scss
@include type--regular-serif;      // Source Serif Pro, 300
@include type--bold-serif;         // Source Serif Pro, 500
@include type--regular-sans-serif; // Roboto, 300
@include type--bold-sans-serif;    // Roboto, 500
@include italic;                   // font-style: italic
```

### Type Scale

All sizes are multiples of `$base-unit`. The `@include font-size($n)` mixin sets both `font-size` and `line-height` (1.5x):

| Level | Mixin | font-size(n) | Size | Line-height |
|-------|-------|-------------|------|-------------|
| Tiny | `type--body-tiny` | 0 | 12px | 18px |
| Small | `type--body-small` | 1 | 15px | 22.5px |
| Body | `type--body` | 2 | 18px | 27px |
| H6 | `type--heading-6` | 3 | 21px | 31.5px |
| H5 | `type--heading-5` | 4 | 24px | 36px |
| H4 | `type--heading-4` | 5 | 27px | 40.5px |
| H3 | `type--heading-3` | 6 | 30px | 45px |
| H2 | `type--heading-2` | 7 | 33px | 49.5px |
| H1 | `type--heading-1` | 8 | 36px | 54px |
| Title | `type--title` | 9 | 39px | 58.5px |

### Heading Styles

All headings share a base style via `@include type--headings` which sets:
- Font: bold sans-serif (Roboto 500)
- Text alignment: center
- Text shadow: `$shadow--text`

Individual heading mixins add the appropriate size and bottom margin:

```scss
@include type--title;      // 39px, margin-bottom: $s6
@include type--heading-1;  // 36px, margin-bottom: $s6
@include type--heading-2;  // 33px, margin-bottom: $s6
@include type--heading-3;  // 30px, margin-bottom: $s4
@include type--heading-4;  // 27px, margin-bottom: $s3
@include type--heading-5;  // 24px, margin-bottom: $s3
@include type--heading-6;  // 21px, margin-bottom: $s3
```

---

## Spacing

All spacing uses multiples of `$base-unit` (6px). Never use arbitrary pixel values.

### Spacing Scale

| Token | Value | Common Usage |
|-------|-------|-------------|
| `$s1` | 6px | Small gaps, icon spacing |
| `$s2` | 12px | Padding, small margins |
| `$s3` | 18px | List item margins, medium gaps |
| `$s4` | 24px | Section internal padding |
| `$s6` | 36px | Paragraph bottom margin, large gaps |
| `$s8` | 48px | Toggle width |
| `$s10` | 60px | Large spacing |
| `$s12` | 72px | Nav height, card gaps |
| `$s16` | 96px | Extra-large spacing |
| `$s20` | 120px | Section spacer |

### Named Spacing Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `$section-spacer` | 120px (`$s20`) | Between page sections |
| `$paragraph-bottom` | 36px (`$s6`) | Below paragraphs |

---

## Breakpoints & Media Queries

### Breakpoints

| Token | Value | Description |
|-------|-------|-------------|
| `$small` | `320px` | Small mobile |
| `$medium` | `600px` | Tablet / wide mobile |
| `$large` | `960px` | Desktop |

### Media Query Mixins

Mobile-first approach using `min-width`:

```scss
@include mq($medium) {
  // Styles for 600px and above
}

@include mq-max($medium) {
  // Styles for 599px and below
}

@include dark-mode() {
  // Styles for prefers-color-scheme: dark
}
```

---

## Grid & Layout

### Grid Tokens

| Token | Value | Description |
|-------|-------|-------------|
| `$grid--gutter` | `~1.875%` | Space between columns |
| `$grid--column` | `~7.5%` | Single column width |
| `$grid--copy-max-width` | `600px` | Max width for text content |
| `$grid--max-width` | `1320px` | Max width for grid containers |
| `$grid--start-break-point` | `$medium` (600px) | When grid layout activates |

### Content Width Tokens

| Token | Value | Description |
|-------|-------|-------------|
| `$content-max-width` | `1020px` | Standard content container |
| `$full-bleed` | `1020px` | Full-bleed sections |
| `$full-width-small` | `1008px` | Content minus small padding |
| `$full-width-medium` | `960px` | Content minus medium padding |

### Layout Mixins

```scss
@include content;          // Centered container, max-width, responsive padding
@include content-width;    // Max-width with auto margins (no padding)
@include section;          // Full-width section with bottom margin
@include sixHundred;       // Constrain to copy max-width (600px)
@include margin-center;    // Center block with auto left/right margins
@include columns($n);      // Set width to $n grid columns
@include text-center;      // text-align: center
@include text-left;        // text-align: left
```

---

## Shadows

Shadow tokens provide consistent elevation. Defined in `_shadows.scss`:

| Token | Value | Usage |
|-------|-------|-------|
| `$shadow--text` | `0 2px 4px black` | Heading text shadows |
| `$shadow--focus` | `0 0 0 2px $primary-grey, 0 0 0 4px $secondary-grey` | Focus ring for interactive elements |
| `$shadow--card` | `0 10px 90px 0 #111` | Card link elevation |
| `$shadow--elevated` | `0 0 12px black` | Skip nav, elevated panels |
| `$shadow--toggle` | `0 0 $s1 $grey-900` | Toggle switch thumb |
| `$shadow--nav-tray` | `0 0 0 2px $primary-color-light` | Navigation dropdown border |

---

## Z-Index Scale

A predefined z-index scale prevents stacking conflicts. Always use tokens:

| Token | Value | Usage |
|-------|-------|-------|
| `$z-index--base` | `1` | Standard positioned elements |
| `$z-index--sticky` | `1000` | Sticky nav, sticky containers |
| `$z-index--overlay` | `10000` | Overlays |
| `$z-index--modal` | `100000` | Modals (YouTube modal) |
| `$z-index--skip-nav` | `10000000` | Skip navigation (always on top) |

Use arithmetic for relative layers: `$z-index--modal - 1` for elements behind the modal.

---

## Transitions

### Global Defaults

All elements inherit from `*`:
- `transition-duration: $transition-speed` (500ms)
- `transition-timing-function: $transition-timing` (ease)
- `transition-property: none` (opt-in per element)

### Enabling Transitions

Set `transition-property` explicitly on elements that need animation:

```scss
.my-element {
  transition-property: background-color, transform;
}
```

### Link Hover Mixin

```scss
@include link-hover;  // Adds transition-property: background-color
                      // and hover state with $palette--hover-grey
```

---

## Components

### Links

Four link patterns cover all navigation needs:

#### Inline Link
Orange text with hover underline. For links within body copy.

```scss
// SCSS
@include inline-link;

// CSS class
.inline-link

// EJS
<%- inlineLink('Link text', { href: '/path' }); %>
```

#### Block Link
White text with orange arrow indicator. For standalone navigational links.

```scss
// SCSS
@include block-link;

// CSS class
.block-link

// EJS
<%- blockLink('Link text', { href: '/path' }); %>
```

#### Button Link
Bordered button with centered text. For call-to-action links.

```scss
// SCSS
@include button-link;

// CSS class
.button-link

// EJS
<%- buttonLink('Link text', { href: '/path' }); %>

// Mega variant (reduced padding)
.button-link.mega-button
```

#### Card Link
Card container with shadow and hover state. For content cards.

```scss
// SCSS
@include card-link;

// CSS class
.card-link

// EJS
<%- cardLink('<h3>Title</h3><p>Description</p>', { href: '/path' }); %>
```

### Form Controls

#### Text / Number Input
```scss
@include input;  // Applied automatically to input[type=text], input[type=number]
```

#### Select
```scss
@include select;  // Applied automatically to <select> elements
// CSS class: .select
```

#### Checkbox / Radio
```scss
@include checkbox;  // Applied automatically, 24x24px with focus ring
```

#### Toggle Switch
```html
<input type="checkbox" class="toggle" />
```
48x18px track with 24px green accent thumb. No additional SCSS needed.

#### Range Input
```scss
@include input-range;  // Applied automatically, cursor pointer + focus ring
```

### Navigation

The nav component uses the sticky-stacky pattern:

```html
<div class="sticky-container">
  <nav class="nav main sticky-stacky">
    <div class="content">
      <!-- brand logo, menu button, nav tray -->
    </div>
  </nav>
</div>
```

### Sections & Content

```html
<section>
  <div class="content">
    <!-- Section content here -->
  </div>
</section>
```

- `<section>` automatically gets `$section-spacer` bottom margin and `$grid--max-width` max-width
- `.content` / `.container` provides centered padding with `$content-max-width`

### Paragraphs

```html
<p>Automatically styled with body serif, 600px max-width, and 36px bottom margin.</p>

<!-- Or use the class on non-p elements -->
<div class="p">Same paragraph styling on a div.</div>
```

### Blockquote

```html
<blockquote>
  <p>Quoted text with automatic quotation marks.</p>
  <cite>— Source</cite>
</blockquote>
```

### Code

```html
<pre class="code-container"><code>Code content here</code></pre>
```

Use the EJS helper for syntax highlighting:

```ejs
<%- code('const x = 1;', { language: 'javascript' }); %>
```

### Inline Code Variable

```html
<var>variable-name</var>
```

Styled with courier font, grey border, 4px radius.

---

## Utility Classes

### Display & Layout

| Class | Property |
|-------|----------|
| `.d-block` | `display: block` |
| `.d-flex` | `display: flex` |
| `.d-inline-flex` | `display: inline-flex` |
| `.d-grid` | `display: grid` |
| `.d-none` | `display: none` |
| `.flex-row` | `flex-direction: row` |
| `.flex-column` | `flex-direction: column` |
| `.flex-wrap` | `flex-wrap: wrap` |
| `.justify-start` | `justify-content: flex-start` |
| `.justify-center` | `justify-content: center` |
| `.justify-between` | `justify-content: space-between` |
| `.align-center` | `align-items: center` |
| `.align-stretch` | `align-items: stretch` |
| `.gap-{n}` | `gap: $s{n}` (1, 2, 3, 4, 6, 8, 12) |
| `.text-left` | `text-align: left` |
| `.text-center` | `text-align: center` |
| `.text-right` | `text-align: right` |
| `.w-100` | `width: 100%` |
| `.h-100` | `height: 100%` |
| `.overflow-hidden` | `overflow: hidden` |
| `.relative` | `position: relative` |
| `.absolute` | `position: absolute` |
| `.fixed` | `position: fixed` |

### Spacing

Pattern: `.{property}-{size}` where sizes are: 0, 1, 2, 3, 4, 6, 8, 10, 12

| Prefix | Property |
|--------|----------|
| `.mt-` | `margin-top` |
| `.mb-` | `margin-bottom` |
| `.ml-` | `margin-left` |
| `.mr-` | `margin-right` |
| `.pt-` | `padding-top` |
| `.pb-` | `padding-bottom` |
| `.pl-` | `padding-left` |
| `.pr-` | `padding-right` |
| `.mx-auto` | `margin-left: auto; margin-right: auto` |

Example: `.mt-4` applies `margin-top: 24px` (4 × 6px).

### Component Classes

| Class | Description |
|-------|-------------|
| `.section` | Full-width section with section spacer |
| `.content` / `.container` | Centered content container |
| `.paragraph` / `.p` | Paragraph with max-width and margin |
| `.inline-link` | Orange inline link |
| `.block-link` | Block link with arrow |
| `.button` / `.button-link` | Bordered button link |
| `.card-link` | Card with shadow |
| `.error` | Red centered error text |
| `.center` | Center text and content |
| `.block-center` | Center block with auto margins |
| `.h1` through `.h6` | Heading styles on any element |

---

## EJS Template Helpers

Available in all EJS templates via the build system:

### Links

```ejs
<%- inlineLink('Text', { href: '/url' }) %>
<%- blockLink('Text', { href: '/url' }) %>
<%- buttonLink('Text', { href: '/url' }) %>
<%- cardLink('<h3>Title</h3><p>Desc</p>', { href: '/url' }) %>
<%- link('Text', { href: '/url', class: 'custom', type: 'inline' }) %>
```

External links (starting with `http`) automatically get `rel="noopener"` and `target="blank"`.

### Images

```ejs
<%- img({ src: '/images/photo.jpg', alt: 'Description' }) %>
<%- lazyImage({ src: '/images/photo.jpg', alt: 'Description' }) %>
```

### Video

```ejs
<%- lazyVideo({
  srcs: { mobile: '/video-mobile.mp4', desktop: '/video-desktop.mp4' },
  placeholders: { mobile: '/poster-mobile.jpg', desktop: '/poster-desktop.jpg' },
}) %>
```

### Code

```ejs
<%- code('const x = 1;', { language: 'javascript' }) %>
```

### Partials

```ejs
<%- partial('partialName', { data: value }) %>
```

### Content Helpers

```ejs
<%- noWidows('Prevents orphan words') %>      // Replaces last space with &nbsp;
<%- formattedDate('2024-01-15') %>            // Returns "January 2024"
<%- getChildPages('posts') %>                 // Returns child page data
<%- getFileContents('/images/icon.svg') %>    // Inline file contents (SVG)
<%- inlineScss('/styles/base.scss') %>        // Compile and inline SCSS
```

### Page Data

```ejs
<%- dasherize('camelCase') %>  // "camel-case"
<%- camelize('dash-case') %>   // "dashCase"
```

---

## JavaScript Modules

Core JS modules in `src/js/_modules/`:

| Module | Export | Description |
|--------|--------|-------------|
| `document-ready` | `.document(cb)`, `.styles(cb)`, `.all(cb)` | DOM and stylesheet ready watchers |
| `analytics` | `.pushEvent({})`, `.watchElements()` | Google Tag Manager event tracking |
| `lazy-loader` | `.init(scope?)` | IntersectionObserver-based lazy loading |
| `no-animations` | `.initBodyClass()`, `.areAnimationsDisabled` | Respects `?disable-animations` param |
| `sticky-stacky` | `.init()` | Sticky nav scroll behavior |
| `window-resize` | `(callback)` | Resize + orientation change listener |
| `in-view` | `(element, callback, options?)` | IntersectionObserver wrapper |
| `youtube-modal` | `new YoutubeModal({ triggerScope })` | YouTube embed modal |
| `dark-mode` | `.isDarkMode` | Dark mode media query check |
| `sound` | `new Sound()` | Web Audio oscillator |
| `scroll-to` | `(destination, options?)` | Smooth scroll with easings |
| `environment` | `.isProduction` | Production hostname check |

### Usage Pattern

```javascript
const ready = require('./_modules/document-ready');
const analytics = require('./_modules/analytics');

ready.document(() => {
  analytics.watchElements();
  // Page-specific initialization
});
```

### Lazy Loading

Add the `lazy` attribute to elements:

```html
<img lazy data-src="/images/photo.jpg" alt="..." />
```

Disable with `?disable-lazy` URL parameter.

### Analytics Events

```javascript
analytics.pushEvent({
  category: 'user action',
  action: 'button clicked',
  label: 'optional label',
});
```

---

## Conventions

### File Naming

- SCSS partials use underscore prefix: `_module-name.scss`
- Variables, mixins, and classes each have barrel `all.scss` files
- Post-specific styles go in `src/styles/posts/`
- Post-specific scripts go in `src/js/posts/`

### SCSS Conventions

1. Always import `"system/utilities"` at the top of module files
2. Use design tokens — never hardcode colors, spacing, or z-index values
3. Use mixins for component patterns rather than duplicating styles
4. Use `@include mq($breakpoint)` for responsive styles (mobile-first)
5. Set `transition-property` explicitly to enable transitions
6. Each mixin includes a `mixin: mixin-name;` declaration for debugging

### Template Conventions

1. Templates use EJS with front matter (YAML) for metadata
2. Layouts chain: template → `base.ejs` → `blank.ejs`
3. Use EJS helper functions for links and images
4. Use `noWidows()` for headings and short text
5. Use `partial()` for shared template fragments

### CSS Custom Properties

CSS variables on `html` mirror key SCSS tokens for runtime access:

```css
html {
  --palette--primary-white: #ffffff;
  --palette--primary-grey: #212121;
  --nav-height: 72px;
  --window-height: calc(100vh - 72px);
  --border-radius: 3px;
  --transition-speed: 500ms;
  --transition-timing: ease;
}
```

### Accessibility

- Skip navigation link at the top of every page
- Focus rings via `@include link-focus` on all interactive elements
- `aria-hidden`, `aria-expanded`, `aria-controls` used for navigation
- `prefers-reduced-motion` supported via `?disable-animations` parameter
- Semantic HTML elements (`nav`, `main`, `footer`, `section`)
- `role` and `aria-label` on navigation landmarks
