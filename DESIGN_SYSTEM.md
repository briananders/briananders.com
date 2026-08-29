# Banders Design System

> Programmer documentation for the token-driven, dark-first, mobile-first,
> 12-column design system that powers **briananders.com**.

If you want a visual tour, open the standalone reference at the repo root:

```bash
open design-system.html          # standalone HTML — no build required
```

Or the same content rendered inside the site's own chrome at
[`/posts/design-system/`](https://briananders.com/posts/design-system/).

This document is the *authoring* reference: what each layer of the system is,
how the layers connect, and what conventions you should follow when adding a
new page, post, component, or JS interaction.

---

## Table of contents

- [1. TL;DR](#1-tldr)
- [2. Design principles](#2-design-principles)
- [3. File map](#3-file-map)
- [4. The three layers](#4-the-three-layers)
- [5. Foundations — the tokens](#5-foundations--the-tokens)
  - [5.1 Color](#51-color)
  - [5.2 Typography](#52-typography)
  - [5.3 Spacing](#53-spacing)
  - [5.4 Grid & breakpoints](#54-grid--breakpoints)
  - [5.5 Column-width tokens](#55-column-width-tokens)
  - [5.6 Radii](#56-radii)
  - [5.7 Elevation & focus](#57-elevation--focus)
  - [5.8 Motion](#58-motion)
  - [5.9 Legacy `--palette--*` aliases](#59-legacy---palette---aliases)
- [6. Mixin layer](#6-mixin-layer)
- [7. Class layer](#7-class-layer)
- [8. Element defaults](#8-element-defaults)
- [9. Play / Pause icon component](#9-play--pause-icon-component)
- [10. Site-wide JS behaviours](#10-site-wide-js-behaviours)
- [11. Connective tissue — how it all links up](#11-connective-tissue--how-it-all-links-up)
- [12. Authoring guide](#12-authoring-guide)
  - [12.1 Adding a new page or post](#121-adding-a-new-page-or-post)
  - [12.2 Building a layout with the grid](#122-building-a-layout-with-the-grid)
  - [12.3 Adding a new component](#123-adding-a-new-component)
  - [12.4 Adding a new token](#124-adding-a-new-token)
  - [12.5 Writing a shadow-DOM web component](#125-writing-a-shadow-dom-web-component)
- [13. Currently unused pieces](#13-currently-unused-pieces)
- [14. Migration notes](#14-migration-notes)
- [15. Debugging tips](#15-debugging-tips)

---

## 1. TL;DR

- **Everything is a token.** Colours, radii, spaces, font sizes, motion — all
  live as CSS custom properties on `:root` in
  [`src/styles/system/_tokens.scss`](src/styles/system/_tokens.scss).
- **Every mixin reads tokens.** No component hard-codes a colour or a pixel value.
- **Every class is either a mixin wrapper or a small utility.** So the same
  primitive is reachable from SCSS *and* from an EJS template.
- **Dark-first, mobile-first, 12 columns.** 4 columns under 600 px, 8
  columns 600–959 px, 12 columns at 960 px+.
- **Zero breaking-changes to per-post SCSS.** Every legacy mixin and variable
  name from before the 2026 overhaul still resolves — it just reads from
  tokens under the hood.
- **Press `Ctrl+G` / `Cmd+G`** anywhere on the site to see the live grid.

---

## 2. Design principles

1. **Compose, don't customize.** Reach for a mixin or a class before writing
   raw CSS. If nothing fits, add a component to the system rather than
   sprinkling ad-hoc rules through a post.
2. **Tokens are the API.** Every consumer — SCSS, JS shadow DOM, per-post
   overrides — talks to the system through `var(--…)`. Never hard-code a
   colour or a pixel value.
3. **The public SCSS API is a compatibility contract.** Names like `space()`,
   `@include palette--base`, `@include type--heading-3`, `$palette--primary-grey`
   are load-bearing; changing them breaks every post. Add new tokens
   alongside them; don't rename.
4. **Mobile is the default.** Type, gutters, columns, and every layout
   starts at mobile and *steps up* via `@include mq($medium)` / `mq($large)`.
5. **Motion is optional.** Every animation honours `prefers-reduced-motion`.

---

## 3. File map

Everything below is under `src/styles/` unless otherwise noted.

```
src/styles/
├── main.scss                       ← entrypoint bundled on every page
├── base.scss                       ← paints the page canvas (inlined in <head>)
├── homepage.scss                   ← homepage-only overrides
├── drums.scss                      ← drums-only overrides
├── _four-oh-four.scss              ← 404 page
├── vendor/
│   └── normalize.scss              ← third-party CSS reset
├── system/                         ← THE DESIGN SYSTEM
│   ├── _tokens.scss                ← :root { --color-… --space-… … }  ★
│   ├── _utilities.scss             ← @forward for tokens + mixins
│   ├── _styles.scss                ← @use styles + classes (side effects)
│   ├── variables/
│   │   ├── all.scss                ← @forward every variables/* file
│   │   ├── _colors.scss            ← raw $color-* palette (SCSS-side)
│   │   ├── _palettes.scss          ← $palette--* legacy aliases
│   │   ├── _defaults.scss          ← $base-unit, $border-radius, transitions
│   │   ├── _fonts.scss             ← $serif / $sans-serif / $mono
│   │   ├── _grid.scss              ← $grid--gutter / $grid--max-width / breakpoints
│   │   ├── _spaces.scss            ← space() SCSS helper
│   │   └── _viewports.scss         ← $small / $medium / $large / $wide
│   ├── functions/
│   │   └── all.scss                ← css-min(), css-max()
│   ├── mixins/                     ← the component API
│   │   ├── all.scss
│   │   ├── _colors.scss            ← palette--base, orange-gradient, …
│   │   ├── _grid.scss              ← grid(), columns(), readingWidth
│   │   ├── _media-queries.scss     ← mq(), mq-max(), dark-mode()
│   │   ├── _type.scss              ← font-size(), type--heading-N, …
│   │   ├── _elements.scss          ← button-link, card, input, …  (all component mixins)
│   │   ├── _utilities.scss         ← @mixin box  (unused, see §13)
│   │   └── _animations.scss        ← empty placeholder (see §13)
│   ├── styles/                     ← element defaults (fire once)
│   │   ├── all.scss
│   │   ├── _defaults.scss          ← *, ::selection reset
│   │   ├── _attributes.scss        ← [aria-hidden], [role=list]
│   │   └── _elements.scss          ← html, body, h1-h6, input, button, …
│   └── classes/                    ← utility classes for EJS templates
│       ├── all.scss
│       ├── _type.scss              ← .h1 .. .h6
│       └── _elements.scss          ← .container, .card, .button, .col-*, .play, …
├── modules/                        ← site-chrome modules
│   ├── header.scss
│   ├── footer.scss
│   ├── _nav.scss
│   ├── _skip-nav.scss
│   ├── _sticky-stacky.scss
│   ├── _contributions.scss
│   ├── _posts-list.scss
│   ├── _youtube-modal.scss
│   └── code/                       ← code-block styling
├── articles/index.scss             ← /articles/ list styling
├── about/index.scss                ← /about/ styling
└── posts/                          ← one .scss per experiment
    ├── color-canvas.scss
    ├── polyrhythm.scss
    ├── moire-pattern-colors.scss
    ├── … ~40 more
    └── design-system.scss          ← styles for the in-site design-system post
```

### JS

```
src/js/
├── all.js                          ← wired into every page
├── _modules/
│   ├── grid-debug.js               ← Ctrl+G overlay (see §10)
│   ├── analytics.js
│   ├── document-ready.js
│   ├── sticky-stacky.js
│   ├── window-resize.js
│   ├── lazy-loader.js
│   ├── no-animations.js
│   ├── youtube-modal.js
│   └── …
├── _components/                    ← shadow-DOM web components
│   ├── year-listing.js             ← Last.fm yearly plays bar (uses --palette--* aliases)
│   ├── year-selector.js
│   ├── album-listing.js
│   ├── artist-listing.js
│   └── scrobbles-last-updated.js
└── posts/                          ← one .js per interactive post
    └── …
```

### Reference pages

```
design-system.html                  ← standalone reference at repo root
src/templates/posts/design-system.ejs ← in-site version at /posts/design-system/
src/styles/posts/design-system.scss ← styles scoped to the .design-system page
src/js/posts/design-system.js       ← interactions for the in-site version
DESIGN_SYSTEM.md                    ← this file
```

---

## 4. The three layers

The system stacks in three layers, each with a distinct job:

```
┌──────────────────────────────────────────────────────────┐
│  1. TOKENS       — the source of truth                   │
│     :root { --color-*, --space-*, --fs-*, --dur-*, … }   │
│     src/styles/system/_tokens.scss                       │
└──────────────────────────────────────────────────────────┘
                            ▲
                            │ every rule below reads from tokens
                            │
┌──────────────────────────────────────────────────────────┐
│  2. MIXINS       — the component API                     │
│     @mixin card, button-link, palette--base, grid, …     │
│     src/styles/system/mixins/*                           │
└──────────────────────────────────────────────────────────┘
                            ▲
                            │ classes are thin wrappers over mixins
                            │
┌──────────────────────────────────────────────────────────┐
│  3. CLASSES      — HTML/EJS-facing utilities             │
│     .container, .card, .button, .col-*, .play, .text-*   │
│     src/styles/system/classes/*                          │
└──────────────────────────────────────────────────────────┘
```

**Why three layers instead of one?**

- **Tokens** need to be reachable from *anywhere* — including shadow-DOM
  web components that can't `@use` an SCSS file.
- **Mixins** let a per-post SCSS file compose components without writing
  markup. Great for canvas experiments where the JS builds the DOM.
- **Classes** let an EJS template compose the same components in HTML,
  without dropping into SCSS at all.

An additional side-layer, [`styles/`](src/styles/system/styles/), fires once
at import time and sets element defaults for `html`, `body`, `h1`-`h6`,
`input`, `button`, and so on. See §8.

---

## 5. Foundations — the tokens

All tokens live in
[`src/styles/system/_tokens.scss`](src/styles/system/_tokens.scss) and are
emitted on `:root`. That means they inherit through the entire document
including shadow DOM, so a web component's inline `<style>` block can just
`var(--color-text)` and get the current theme.

### 5.1 Color

Neutrals + surfaces (dark ramp):

| Token                        | Value     | Use                                    |
| ---------------------------- | --------- | -------------------------------------- |
| `--color-bg`                 | `#0B0D10` | Page canvas                            |
| `--color-surface-1`          | `#12161C` | Cards, elevated blocks                 |
| `--color-surface-2`          | `#1A2029` | Inputs, buttons, elevated surface tier |
| `--color-surface-3`          | `#232B36` | Hover / active state                   |
| `--color-border`             | `#2A3341` | Card border, input border              |
| `--color-border-strong`      | `#3A4657` | Hover input border                     |
| `--color-divider`            | `rgba(255,255,255,0.08)` | Horizontal rules   |

Text:

| Token                | Value     | Contrast on `--color-bg` | Use               |
| -------------------- | --------- | ------------------------ | ----------------- |
| `--color-text`       | `#F2F5F8` | 15.6 : 1                 | Body, headings    |
| `--color-text-muted` | `#A6B0BE` | 8.7 : 1                  | Supporting copy   |
| `--color-text-subtle`| `#6C7784` | 4.6 : 1                  | Placeholders      |
| `--color-text-inverse`| `#0B0D10`|                          | Text on primary   |

Brand — orange ramp:

| Token                 | Value     | Use                                    |
| --------------------- | --------- | -------------------------------------- |
| `--color-primary-50`  | `#FFE9D6` | Very light tint                        |
| `--color-primary-100` | `#FFC79B` |                                        |
| `--color-primary-300` | `#FF9955` | Gradient light stop                    |
| `--color-primary-500` | `#F97316` | **Primary CTA — the workhorse orange** |
| `--color-primary-600` | `#E85D0F` | Hover of primary-500                   |
| `--color-primary-700` | `#B24408` | Deep-tint                              |

Accents (secondary highlights — use sparingly):

| Token                 | Value     | Use                             |
| --------------------- | --------- | ------------------------------- |
| `--color-accent-teal` | `#22D3EE` | Inline links                    |
| `--color-accent-lime` | `#A3E635` | Success, code highlight         |
| `--color-accent-plum` | `#C084FC` | Editorial gradient stop         |

Semantic — status:

| Token             | Value     | Tint variant             |
| ----------------- | --------- | ------------------------ |
| `--color-success` | `#34D399` | `--color-success-tint`   |
| `--color-warning` | `#FBBF24` | `--color-warning-tint`   |
| `--color-danger`  | `#F87171` | `--color-danger-tint`    |
| `--color-info`    | `#60A5FA` | `--color-info-tint`      |
| `--color-primary-tint` | `rgba(249,115,22,0.12)` | badge / alert bg |

**Contrast guarantee.** Every text token on `--color-bg` meets WCAG AA. If
you introduce a new tint, run its contrast check on `--color-bg` and
`--color-surface-1`.

### 5.2 Typography

Three families:

| Token           | Family                                    | Use                    |
| --------------- | ----------------------------------------- | ---------------------- |
| `--font-sans`   | Inter, system UI stack                    | Headings, UI, controls |
| `--font-serif`  | Source Serif 4, Georgia                   | Body copy, long reads  |
| `--font-mono`   | JetBrains Mono, `ui-monospace`, Menlo     | Code, kbd              |

Sizes (mobile-first, step up at 960 px):

| Token       | Mobile     | ≥ 960 px | Approx. use          |
| ----------- | ---------- | -------- | -------------------- |
| `--fs-2xs`  | 0.75rem    | —        | caption, badge       |
| `--fs-xs`   | 0.8125rem  | —        | small copy           |
| `--fs-sm`   | 0.875rem   | —        | dense UI             |
| `--fs-md`   | 1rem       | —        | body                 |
| `--fs-lg`   | 1.125rem   | —        | lede                 |
| `--fs-xl`   | 1.375rem   | 1.5rem   | h4                   |
| `--fs-2xl`  | 1.75rem    | 2rem     | h3                   |
| `--fs-3xl`  | 2.25rem    | 2.75rem  | h2                   |
| `--fs-4xl`  | 3rem       | 3.75rem  | h1                   |
| `--fs-5xl`  | 3.75rem    | 4.75rem  | hero display         |

Line-heights (`--lh-tight`, `--lh-snug`, `--lh-normal`, `--lh-loose`) map
to the `--fs-*` steps via the `font-size(N)` mixin — see §6.

Weights (`--fw-regular` 400, `--fw-medium` 500, `--fw-semibold` 600,
`--fw-bold` 700). Note that historically `$bold: 500` referred to Roboto
Medium; the new tokens use canonical CSS weight names. The old SCSS
variables `$bold` (700) and `$fw-medium` (500) are kept for back-compat.

### 5.3 Spacing

**Rule: never write raw `px` or `rem` for margin, padding, or gap.**

All spacing derives from `--unit` (4 px):

| Token         | Value (px) |
| ------------- | ---------- |
| `--space-1`   | 4          |
| `--space-2`   | 8          |
| `--space-3`   | 12         |
| `--space-4`   | 16         |
| `--space-5`   | 20         |
| `--space-6`   | 24         |
| `--space-8`   | 32         |
| `--space-10`  | 40         |
| `--space-12`  | 48         |
| `--space-16`  | 64         |
| `--space-20`  | 80         |
| `--space-24`  | 96         |

**SCSS side.** The `space(N)` helper (in
[`variables/_spaces.scss`](src/styles/system/variables/_spaces.scss)) still
uses a **6 px** base — that's a deliberate compatibility choice, because
~50 per-post stylesheets already assume 6 px steps. Rule of thumb:

- **New components + templates:** use `var(--space-N)` (4 px scale).
- **Editing an existing post SCSS:** use `space(N)` for consistency with
  its neighbours.

Both scales converge visually within a couple of pixels.

### 5.4 Grid & breakpoints

Three tiers, all mobile-first:

| Tier    | Min width | Cols | Gap                            | Gutter                          |
| ------- | --------- | ---- | ------------------------------ | ------------------------------- |
| mobile  | —         | 4    | `--grid-gap-mobile` (12 px)    | `--gutter-mobile` (16 px)       |
| tablet  | 600 px    | 8    | ↑                              | `space(4)` in `.content`        |
| desktop | 960 px    | 12   | `--grid-gap-desktop` (16 px)   | `--gutter-desktop` (32 px)      |
| wide    | 1280 px   | 12   | (same)                         | content maxes at 1200 px        |

Breakpoint SCSS variables (from `variables/_viewports.scss`):

```scss
$small:  320px;
$medium: 600px;   // tablet — 8 cols
$large:  960px;   // desktop — 12 cols
$wide:   1280px;
```

Used everywhere via `@include mq($medium) { … }`.

### 5.5 Column-width tokens

Every desktop column is 80 px wide with 16 px gaps. That gives a set of
derived max-widths for capping a card or list to an integer column count
without hand-authoring a pixel value:

```css
--col-width:      80px;
--col-gap:        16px;
--max-1-column:   var(--col-width);                                 /*   80 */
--max-2-columns:  calc(2  * var(--col-width) + 1  * var(--col-gap)); /*  176 */
--max-3-columns:  calc(3  * var(--col-width) + 2  * var(--col-gap)); /*  272 */
--max-4-columns:  …                                                  /*  368 */
--max-5-columns:  …                                                  /*  464 */
--max-6-columns:  …                                                  /*  560 */
--max-7-columns:  …                                                  /*  656 */
--max-8-columns:  …                                                  /*  752 */
--max-9-columns:  …                                                  /*  848 */
--max-10-columns: …                                                  /*  944 */
--max-11-columns: …                                                  /* 1040 */
--max-12-columns: …                                                  /* 1136 */
```

Use it:

```scss
.recommended-list {
  max-width: var(--max-6-columns);   // 560 px — nice reading-plus width
}
```

`#albums, #artists, #yearly-scrobbles` on the last-fm-scrobbles page use
`var(--max-8-columns)`.

### 5.6 Radii

| Token          | Value  | Use                                           |
| -------------- | ------ | --------------------------------------------- |
| `--radius-xs`  | 4 px   | Input checkmark box, code inline              |
| `--radius-sm`  | 8 px   | Small buttons, nav pills                      |
| `--radius-md`  | 12 px  | Buttons, inputs, cards (default)              |
| `--radius-lg`  | 20 px  | Elevated cards, modal                         |
| `--radius-pill`| 999 px | Progress, toggle track, badges                |

Also exposed as `--border-radius` (aliased to `--radius-md`) for legacy
callers.

### 5.7 Elevation & focus

```css
--elev-1: 0 1px 2px  rgba(0,0,0,0.5);                           /* card */
--elev-2: 0 4px 12px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.5); /* raised */
--elev-3: 0 12px 32px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.6); /* modal */
--elev-glow-primary: 0 0 0 1px rgba(249,115,22,0.4),
                     0 8px 24px rgba(249,115,22,0.18);          /* CTA glow */

--focus-ring: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-primary-500);
```

`--focus-ring` is applied via `@include link-focus` (which resolves to
`&:focus-visible { box-shadow: var(--focus-ring); }`), so **every
interactive element gets a consistent focus treatment for free** — as long
as it goes through the mixin.

### 5.8 Motion

| Token   | Value  | Use                              |
| ------- | ------ | -------------------------------- |
| `--dur-1` | 120 ms | Micro-feedback (button flash) |
| `--dur-2` | 200 ms | Buttons, links, hover         |
| `--dur-3` | 320 ms | Panel expand, tab switch      |
| `--dur-4` | 480 ms | Modal, page-level             |

Easings:

```css
--ease-standard:  cubic-bezier(0.2, 0.0, 0.0, 1.0);   /* default */
--ease-emphasized: cubic-bezier(0.2, 0.0, 0.0, 1.2);  /* arrows, expand */
```

Legacy aliases: `--transition-speed` → `--dur-2`,
`--transition-timing` → `--ease-standard`.

**Reduced motion.** The `_tokens.scss` file emits a
`@media (prefers-reduced-motion: reduce)` block that flattens every duration
to 0.01 ms and adds a universal `*` reset — so any component that respects
these tokens automatically respects the user preference.

### 5.9 Legacy `--palette--*` aliases

The pre-refactor site used `--palette--primary-color-light` etc. via CSS
custom properties inside a handful of shadow-DOM web components (see
[`src/js/_components/`](src/js/_components/)). After the refactor those
names were kept as **aliases** so the components render correctly without
their internal styles being touched:

```css
--palette--primary-white       : var(--color-text);
--palette--primary-grey        : var(--color-bg);
--palette--hover-grey          : var(--color-surface-3);
--palette--secondary-grey      : var(--color-text-muted);
--palette--divider-color       : var(--color-border);
--palette--error               : var(--color-danger);
--palette--primary-color-dark  : var(--color-primary-600);
--palette--primary-color-light : var(--color-primary-300);
--palette--accent-color        : var(--color-accent-lime);
```

**Don't add new callers of these** in new code. They exist purely so
`year-listing`, `year-selector`, `trends-bar-chart` and friends can pick up
the new palette without a rewrite.

---

## 6. Mixin layer

Mixins are the *component API*. Names live in
[`src/styles/system/mixins/`](src/styles/system/mixins/) and are re-exported
through `@use "system/utilities" as *`, so from any post SCSS you can:

```scss
@use "system/utilities" as *;

.my-thing {
  @include card;
  @include type--heading-3;
  padding-top: space(4);
}
```

### Colour & surface

| Mixin                        | What it does                                       |
| ---------------------------- | -------------------------------------------------- |
| `palette--base`              | canvas bg + primary text (page default)            |
| `palette--base--inverted`    | text-inverse on text — for a light overlay         |
| `palette--primary`           | primary CTA colours                                |
| `palette--header`            | frosted-glass nav treatment (blur + translucent)   |
| `orange-gradient`            | `linear-gradient` — primary-300 → primary-600      |
| `surface`                    | just the surface-1 background                      |
| `border--light`              | 1 px border-color from `--color-border`            |

### Layout & grid

| Mixin              | What it does                                    |
| ------------------ | ----------------------------------------------- |
| `grid($no-padding)`| Full 4/8/12-column grid with tier-specific gaps |
| `columns($d,$t,$m)`| `grid-column: span N` at each tier              |
| `content` / `content-width` | Max-width + gutters (`.content` class hook) |
| `section`          | Full-width max container with `$section-spacer` |
| `readingWidth`     | Cap width at `~68ch` — for body copy            |
| `default-margins`  | `margin-left/right: auto`                       |
| `left-margins`     | `margin-left: 0; margin-right: auto`            |
| `text-center` / `text-left` | Alignment (fixed from pre-refactor bug)|

### Type

| Mixin                          | Notes                                            |
| ------------------------------ | ------------------------------------------------ |
| `font-size(0..10)`             | Numeric scale; maps to `--fs-*` + `--lh-*`       |
| `type--regular-serif`          | `--font-serif` + `--fw-regular`                  |
| `type--regular-sans-serif`     | `--font-sans` + `--fw-regular`                   |
| `type--bold-serif`             |                                                  |
| `type--bold-sans-serif`        |                                                  |
| `italic`                       |                                                  |
| `type--headings`               | Common heading base (sans, semibold, tight)      |
| `type--title`                  | Hero-scale (9)                                   |
| `type--heading-1..6`           | h1 = 4xl, h6 = xs uppercase caption              |
| `type--body` / `type--body-small` / `type--body-tiny` | serif, `font-size(2/1/0)` |

### Media queries

| Mixin              | Use                                                   |
| ------------------ | ----------------------------------------------------- |
| `mq($query)`       | `@media (min-width: $query)`                          |
| `mq-max($query)`   | `@media (max-width: $query - 1px)`                    |
| `dark-mode()`      | `@media (prefers-color-scheme: dark)` — **unused**    |

### Element primitives

All in [`mixins/_elements.scss`](src/styles/system/mixins/_elements.scss).

| Mixin                | Emits                                                        |
| -------------------- | ------------------------------------------------------------ |
| `html`               | The page's base styling (font, background, overflow, etc.)   |
| `selection`          | Text-selection colours                                       |
| `paragraph` / `paragraph-margin` | Body-copy width + margin                         |
| `citation`           | `<cite>` treatment (float-right, small)                      |
| `quotation`          | `<blockquote>` treatment (card + left orange stripe)         |
| `label`              | `<label>` element defaults                                   |
| `list` / `list-item` | `<ul>` / `<li>` defaults                                     |
| `checkbox`           | Custom check + radio input                                   |
| `button-element`     | Base `<button>` styling                                      |
| `input`              | Text-input styling                                           |
| `input-range`        | Custom `<input type=range>` (webkit + moz)                   |
| `select`             | `<select>` styling                                           |
| **`link-base`**      | Shared base for every link                                   |
| **`link-hover`**     | Adds `background-color` hover with the token transition      |
| **`link-focus`**     | Adds the standard focus ring on `:focus-visible`             |
| `inline-link`        | Teal link inside a paragraph                                 |
| `block-link`         | Padded block-style link with animated arrow                  |
| `button-link`        | Full `.button` treatment — the CTA workhorse                 |
| `card-link`          | Wrap a whole card in a link (hover elevates)                 |
| `card`               | Card surface with border + shadow                            |
| `mega-button`        | Adds min-height + padding for oversized CTAs                 |

**The `link-*` triad.** `link-base` sets shared plumbing, `link-hover` adds
the hover treatment, `link-focus` adds the focus ring. Every link-style
mixin composes all three.

---

## 7. Class layer

The class layer lives in
[`src/styles/system/classes/_elements.scss`](src/styles/system/classes/_elements.scss)
and mirrors the mixin layer with `.class` hooks so an EJS template can compose
components in markup without dropping into SCSS.

Key wrappers:

| Class                    | Equivalent to                       |
| ------------------------ | ----------------------------------- |
| `.container` / `.content`| `@include content`                  |
| `.p` / `.paragraph`      | `@include paragraph`                |
| `.section`               | `@include section`                  |
| `.i` / `.italic`         | `@include italic`                   |
| `.card`                  | `@include card`                     |
| `.card-link`             | `@include card-link`                |
| `.button` / `.button-link`| `@include button-link`             |
| `.button.primary`        | Primary CTA (orange bg + glow)      |
| `.button.ghost`          | Chromeless button                   |
| `.button.mega-button`    | Oversized CTA                       |
| `.inline-link`           | `@include inline-link`              |
| `.block-link`            | `@include block-link`               |
| `.h1` … `.h6`            | Type mixin equivalents              |

### Grid utilities

Prefixed `.ds-` to avoid colliding with the existing `.grid` hook on the
`/posts/vertically-center-siblings/` page:

```scss
.ds-grid         // @include grid($no-padding: true)
.ds-grid-padded  // @include grid — adds gutters
```

Column-span utilities are **tiered**:

- `.col-1` .. `.col-4` — active on mobile (unconditionally applied)
- `.t-col-1` .. `.t-col-8` — active from 600 px up
- `.d-col-1` .. `.d-col-12` — active from 960 px up

Combine all three tiers to control every breakpoint:

```html
<div class="ds-grid">
  <a class="card card-link col-4 t-col-4 d-col-6" href="…">…</a>
  <a class="card card-link col-4 t-col-4 d-col-6" href="…">…</a>
</div>
```

### Alignment & tone

`.text-center`, `.text-left`, `.text-right`, `.center`, `.block-center`,
`.text-muted`, `.text-subtle`, `.text-primary`, `.error`.

### Layout primitives

- `.cluster` — flex wrap + gap; use for a row of buttons or chips.
- `.stack` — vertical rhythm; `> * + *` gets `margin-top: var(--stack, 12px)`.
  Override the rhythm with `style="--stack: 32px"` on the container.
- `.sr-only` — visually hide, keep for screen readers.
- `.hidden`, `.block`, `.inline-block`, `.flex`.

### Play / pause hooks

See [§9](#9-play--pause-icon-component).

---

## 8. Element defaults

The file [`system/styles/_elements.scss`](src/styles/system/styles/_elements.scss)
fires **once** at import time and reaches for the mixins:

```scss
html      { @include html; }
body      { @include type--body; margin: 0; overflow-x: hidden; }
main      { @include left-margins; z-index: 1; min-height: 100vh; }
section   { @include section; }
h1        { @include type--heading-1; }
h2        { @include type--heading-2; }
… etc.
p         { @include paragraph; }
a         { color: var(--color-accent-teal); text-decoration: none; }
button    { @include button-element; }
input[…]  { @include input; }
select    { @include select; }
input[type=checkbox], input[type=radio] { @include checkbox; }
input[type=range] { @include input-range; }
input[type=checkbox].toggle { … see toggle below … }
```

**Consequence:** on a fresh page, unstyled HTML already looks correct. A
new post can be a bare `.content` with paragraphs and headings and it will
render on-brand.

Special cases handled here:

- **`.toggle`.** A `<input type=checkbox class="toggle">` becomes a
  pill-style switch (see [`_elements.scss` L127+](src/styles/system/styles/_elements.scss)).
  Its dimensions are pinned with `box-sizing`, `min-width`, and
  `flex-shrink: 0`, and the base checkbox's `::after` checkmark is
  explicitly reset — a stray pseudo used to reflow the page on `:checked`.
- **`input[type=radio]:checked::after`** overrides the base checkmark with
  a filled circle.

---

## 9. Play / Pause icon component

Three modifier classes render a unicode media-control glyph via `::before`:

| Class         | Glyph | Codepoint            |
| ------------- | ----- | -------------------- |
| `.play`       | ▶     | U+25B6 / `&#9654;`   |
| `.pause`      | ⏸     | U+23F8 / `&#9208;`   |
| `.playpause`  | ⏯     | U+23EF / `&#9200;`   |

**Scoped to buttons.** The selector is `button.play, .button.play` (etc.),
so a nested `<span class="play">` inside a custom control does **not** pick
up the icon.

Compact icon-only variant — add `.play-pause` (historical container class,
kept for compatibility). It sets `min-width: 44px`, tight padding, and
hides any legacy `<span class="play/pause">` / `<img class="play/pause">`
children so old markup upgrades cleanly:

```html
<!-- Text + icon -->
<button class="button play">Start</button>
<button class="button pause">Pause</button>

<!-- Icon-only -->
<button class="button play-pause play" aria-label="Play/pause"></button>
```

**JS pattern.** Store state elsewhere, and swap classes based on it:

```js
btn.classList.toggle('play',  !isPlaying);   // paused → show ▶
btn.classList.toggle('pause',  isPlaying);   // playing → show ⏸
```

Applied by every playback control on the site — see
[polyrhythm.ejs](src/templates/posts/polyrhythm.ejs),
[moire-pattern-colors.ejs](src/templates/posts/moire-pattern-colors.ejs),
[color-canvas.ejs](src/templates/posts/color-canvas.ejs),
[circle-wave-illusion.ejs](src/templates/posts/circle-wave-illusion.ejs),
[moire-patterns.ejs](src/templates/posts/moire-patterns.ejs),
[sound-frequency-slider.ejs](src/templates/posts/sound-frequency-slider.ejs),
[making-animations-with-squares.ejs](src/templates/posts/making-animations-with-squares.ejs).

---

## 10. Site-wide JS behaviours

Wired into every page via [`src/js/all.js`](src/js/all.js).

- **Grid debug overlay.** Press `Ctrl+G` (or `Cmd+G` on macOS) to toggle a
  translucent orange overlay of the current grid tier (4, 8, or 12
  columns), with a mono label at the bottom-right naming the active tier.
  Implemented in [`_modules/grid-debug.js`](src/js/_modules/grid-debug.js)
  as a capture-phase listener matching on `evt.code === 'KeyG'` so browser
  defaults don't swallow it.
- **Sticky nav.** Frosted-glass sticky header with tray popover for mobile.
  Managed by [`_modules/sticky-stacky.js`](src/js/_modules/sticky-stacky.js).
- **Skip nav.** Visible only on keyboard focus.
- **Analytics.** All click/scroll events forwarded to GTM.
- **Lazy-loader** for `[lazy]` images/videos.
- **`no-animations` mode.** Append `?disable-animations` to any URL to add
  `body.no-animations` and switch off transitions during a screenshot pass.

---

## 11. Connective tissue — how it all links up

The chain from a token to a rendered page:

```
_tokens.scss  ──emit──▶  :root { --color-*, --space-*, --dur-*, … }
     │                        │
     │                        ├──▶  inherited into every element on the page
     │                        │      (including shadow DOM — see below)
     │                        │
     ▼                        ▼
mixins/*.scss  ──consume tokens──▶  component behaviour
     │
     ├──▶ classes/_elements.scss  ──▶  utility classes (.card, .button, …)
     │
     └──▶ styles/_elements.scss   ──▶  fires once, styles raw HTML tags

              ▼                            ▼
        per-post SCSS               EJS template
        `@include card`             `<div class="card">`
              ▼                            ▼
                         Rendered page
```

### Where each layer is imported

```
main.scss
├── @use "./vendor/normalize"          (CSS reset)
├── @use "./system/utilities" as *     (exposes tokens' SCSS side + mixins)
├── @use "./system/styles"             (fires element defaults + class layer)
└── @use "./four-oh-four"              (404 page rules)
```

`system/styles.scss` in turn `@use`s `./tokens` (emitting `:root`),
`./styles/all` (element defaults), and `./classes/all` (utility classes).

`base.scss` is a **separate, tiny bundle** that gets inlined in `<head>`
by the build system so the canvas is painted before the rest of the CSS
loads. It re-imports `system/tokens` for the same reason — the tokens need
to exist before any subsequent stylesheet references them.

### Shadow DOM crosses the boundary for free

CSS custom properties inherit through Shadow DOM. That means an inline
`<style>` block inside a web component can just:

```js
this.shadowRoot.innerHTML = `
  <style>
    .bar {
      background: linear-gradient(to right,
        var(--color-primary-600),
        var(--color-primary-300));
      border-radius: var(--radius-sm);
    }
  </style>
  …
`;
```

and get the theme automatically. This is exactly how `year-listing.js`,
`year-selector.js`, `album-listing.scss`, and `artist-listing.scss` pick
up the palette without their own token declarations.

### EJS templates → CSS

The EJS templates in `src/templates/` and `src/partials/` compose the
system via classes:

```ejs
<section class="posts" id="recent-posts">
  <div class="content">
    <header>
      <h2><%- noWidows(`Recent posts`) %></h2>
    </header>
    …
  </div>
</section>
```

Every class name that appears in a template resolves either to a mixin
wrapper (e.g. `.content` → `@include content`) or to an element default
that already fired (e.g. `<h2>` picks up `type--heading-2` automatically).

### JS → CSS

Two ways the JS layer talks to the design system:

1. **Class toggles.** Add/remove `.play`, `.pause`, `.slide-in`, `.visible`
   on an element and let CSS drive the visible state.
2. **Custom-property writes.** Set `element.style.setProperty('--bar-width',
   '42%')` and let a CSS rule animate that variable's transitions. See
   [`year-listing.js`](src/js/_components/year-listing.js).

**Never** poke at inline styles for something the design system already
covers — use a class hook instead.

---

## 12. Authoring guide

### 12.1 Adding a new page or post

The project has a scaffold script:

```bash
npm run scaffold --path=/posts/my-new-post
```

That produces:

- `src/templates/posts/my-new-post.ejs`
- `src/styles/posts/my-new-post.scss`
- `src/js/posts/my-new-post.js`

**Minimum viable post template** — front matter + a single `.content`:

```ejs
---
title: "My New Post"
description: "A one-sentence description."
date: 2026-08-29
priority: 0.8
pageClasses:
  - 'posts my-new-post'
layout: base
styles:
  - 'main'
  - 'posts/my-new-post'
scripts:
  - 'posts/my-new-post'
---

<section>
  <div class="content">
    <h2>Welcome</h2>
    <p>Everything already looks right — the element defaults did the work.</p>

    <div class="ds-grid">
      <a class="card card-link col-4 t-col-4 d-col-4" href="#">…</a>
      <a class="card card-link col-4 t-col-4 d-col-4" href="#">…</a>
      <a class="card card-link col-4 t-col-8 d-col-4" href="#">…</a>
    </div>
  </div>
</section>
```

**Minimum viable post SCSS** — this is often just an empty `@use`:

```scss
@use "system/utilities" as *;

.posts.my-new-post {
  // Only page-scoped overrides here. Reach for tokens & mixins.
}
```

### 12.2 Building a layout with the grid

Three ways, in order of preference:

1. **Utility classes in the template.** Works whenever the shape is a
   standard N-column split:

   ```html
   <div class="ds-grid">
     <div class="col-4 t-col-8 d-col-8">main</div>
     <aside class="col-4 t-col-8 d-col-4">side</aside>
   </div>
   ```

2. **`@include grid` in a post SCSS** when the containing element has a
   specific class:

   ```scss
   .contributions .deck {
     @include grid($no-padding: true);
     gap: space(3);
   }
   ```

3. **`@include columns($desktop, $tablet, $mobile)`** on a grid child when
   you need custom spans in SCSS:

   ```scss
   .card {
     @include columns(12);                // 12/12/12
   }
   @include mq($medium) {
     .card { @include columns(6, 4); }   // desktop 6, tablet 4
   }
   ```

### 12.3 Adding a new component

Add the mixin to
[`system/mixins/_elements.scss`](src/styles/system/mixins/_elements.scss),
then optionally expose a class in
[`system/classes/_elements.scss`](src/styles/system/classes/_elements.scss).

```scss
// mixins/_elements.scss
@mixin badge {
  display: inline-flex;
  align-items: center;
  gap: space(1);
  padding: 2px space(2);
  font-size: var(--fs-2xs);
  font-weight: var(--fw-semibold);
  border-radius: var(--radius-pill);
  background: var(--color-surface-3);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
```

```scss
// classes/_elements.scss
.badge { @include badge; }
```

Then any template can do `<span class="badge">Live</span>` and any post
SCSS can do `@include badge`.

**Reach for tokens for every declaration.** If a value doesn't have a
token yet, add one — see §12.4.

### 12.4 Adding a new token

Open [`system/_tokens.scss`](src/styles/system/_tokens.scss) and add the
custom property to the appropriate section:

```scss
:root {
  // …

  // New: a "warning tint" for editorial highlights
  --color-editorial-tint: rgba(192, 132, 252, 0.14);
}
```

That's it. Because tokens are on `:root`, they're immediately reachable
from:

- Every SCSS file (via `var(--color-editorial-tint)`)
- Every EJS template (via `style="…"` or via a class)
- Every shadow-DOM web component

Prefer `calc()` over hard-coding a derived value:

```scss
--max-2-columns: calc(2 * var(--col-width) + 1 * var(--col-gap));
```

That way `--col-width` and `--col-gap` remain the only truth.

### 12.5 Writing a shadow-DOM web component

Web components declare their internal styles inline. Since custom
properties inherit through the shadow boundary, you can reference tokens
directly:

```js
const template = `
  <style>
    :host { display: block; }

    .card {
      background: var(--color-surface-1);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: var(--space-4);
      box-shadow: var(--elev-1);
      transition: transform var(--dur-2) var(--ease-standard);
    }
    .card:hover { transform: translateY(-2px); }
  </style>
  <div class="card"><slot></slot></div>
`;

class MyCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = template;
  }
}
customElements.define('my-card', MyCard);
```

Do **not** re-declare tokens inside the component. They inherit. If a
component needs a value the tokens don't cover, add a token first, then
consume it.

---

## 13. Currently unused pieces

Callouts for pieces of the system that are defined but not consumed yet.
Leave them in — they're part of the intended API surface — but be aware
you're the first customer if you reach for them.

- **`@mixin dark-mode`** in
  [`system/mixins/_media-queries.scss`](src/styles/system/mixins/_media-queries.scss).
  Wraps `@media (prefers-color-scheme: dark)`. Currently unused because
  the site is dark-only. If a light theme is added, this is where its
  overrides go.

- **`@mixin box`** in
  [`system/mixins/_utilities.scss`](src/styles/system/mixins/_utilities.scss).
  Emits `box-sizing: border-box`. Redundant — the `*` reset in
  `styles/_defaults.scss` already applies border-box to everything.
  Consider deleting.

- **`@mixin surface`** in
  [`system/mixins/_colors.scss`](src/styles/system/mixins/_colors.scss).
  Emits `background-color: var(--color-surface-1)`. Nothing consumes it —
  most callers reach for `@include card` (which already includes a
  surface) or write `background: var(--color-surface-1)` directly.

- **`@mixin palette--primary`** in
  [`system/mixins/_colors.scss`](src/styles/system/mixins/_colors.scss).
  Legacy name, kept for compatibility. Callers use `.button.primary` or
  reach for `--color-primary-500` directly.

- **`@mixin palette--base--inverted`** in
  [`system/mixins/_colors.scss`](src/styles/system/mixins/_colors.scss).
  Kept for legacy call sites; nothing in the current tree consumes it
  after the music-news filters were rewritten.

- **`mixins/_animations.scss`** is an empty placeholder. Add reusable
  `@keyframes` here rather than sprinkling them across post SCSS.

- **`--color-primary-50`, `--color-primary-100`, `--color-primary-700`.**
  The ramp exists for symmetry with tint families, but currently nothing
  on the site reaches for the 50/100/700 stops — 300 (light), 500 (base),
  600 (hover) are the workhorses.

- **`--max-1-column` through `--max-12-columns` except `--max-6` and
  `--max-8`.** Currently only `--max-6-columns` (used in the
  design-system post's own docs) and `--max-8-columns` (used by
  `#albums, #artists, #yearly-scrobbles`) are consumed. The others are
  ready to go when you need them.

- **`.stack` utility.** Defined in the class layer but only used by the
  design-system post's own layout. Free to adopt.

- **`.cluster` utility.** Consumed by the homepage hero and the design-system
  post; open to adopt elsewhere for horizontal chip/button rows.

- **`--color-info` / `--color-info-tint`.** Defined but currently only
  rendered inside the design-system post. Available for a real info
  callout somewhere.

- **Font-size step 5 and step 9.** The `font-size(N)` map has 11 rows
  (0–10) but 5 and 9 aliases to the same tokens as their neighbours; if
  the type scale grows, they're the natural extension points.

- **`$grid--gutter-mobile`** in `variables/_grid.scss`. Currently only
  `$grid--gutter` (desktop-ish, 18 px) is consumed by `@include grid`;
  the mobile variant is defined for future use.

---

## 14. Migration notes

Everything below applies only if you're touching pre-refactor code.

### The public SCSS API is stable

Every SCSS variable and mixin name that existed before the 2026 overhaul
still resolves. The following continue to work indefinitely:

- `space(N)` (6-px base — see §5.3)
- `$palette--primary-grey`, `$palette--primary-white`,
  `$palette--hover-grey`, `$palette--divider-color`,
  `$palette--primary-color-dark/light`, `$palette--accent-color`,
  `$palette--secondary-grey`, `$palette--error`, `$palette--surface-color`
- `$color--grey-800`, `$color--grey-900` (aliases to the new dark ramp)
- `$nest-blue`
- `$section-spacer`, `$paragraph-bottom`, `$content-max-width`,
  `$full-bleed`, `$full-width-small`, `$full-width-medium`
- `$border-radius`, `$transition-speed`, `$transition-timing`,
  `$base-unit`
- Every mixin listed in §6

The **implementations** are rewritten to read from tokens, but the surface
is unchanged. Don't rename these; add new tokens alongside them.

### Common upgrades

If you find these patterns in a post, they're safe to modernize:

| Old                                          | New                                       |
| -------------------------------------------- | ----------------------------------------- |
| `background: #212121;`                       | `background: var(--color-bg);`            |
| `padding: 24px;`                             | `padding: var(--space-6);`                |
| `border-radius: 12px;`                       | `border-radius: var(--radius-md);`        |
| `transition-duration: 500ms;`                | `transition-duration: var(--dur-2);`      |
| `<img src="/images/icons/play.svg">`         | `<button class="button play">…`           |
| `<button style="transform: translate(-50%, -50%)">…` on `:active` | Use `translate: 0 1px;` in `:active` so it composes |
| `<section class="grid">` when you meant a display-grid utility | Rename the CSS or use `.ds-grid` |

### Deletable Material palette

`variables/_colors.scss` used to define the full Google Material palette
(~350 entries). It's now down to a lean set of aliases; only
`$color--grey-800` and `$color--grey-900` are still referenced from a
couple of posts. If you touch those posts, migrate them to
`var(--color-surface-2)` / `var(--color-bg)` and the whole Material file
can shrink further.

---

## 15. Debugging tips

- **See the grid.** `Ctrl+G` / `Cmd+G`. Tier label bottom-right names the
  active breakpoint.
- **Disable transitions during a screenshot pass.** Append
  `?disable-animations` to any URL. `body.no-animations` is added and any
  transition-property rules should stop.
- **Contrast-check text on a surface.** All text tokens meet WCAG AA on
  `--color-bg`. If you add a new tint, verify it with a tool or fall back
  to `--color-text-muted` for supporting copy.
- **A component looks wrong on a shadow-DOM element.** Check that its
  inline `<style>` references tokens by their canonical `--color-*`,
  `--radius-*` names. If it uses the legacy `--palette--*` names, it's
  reading from the compatibility aliases in §5.9.
- **A class isn't taking effect.** Two likely causes:
  1. The class layer isn't imported. Confirm `main.scss` reaches
     `system/styles`, which chains to `classes/all`.
  2. A more specific selector wins. `.card` in a post SCSS overrides
     the base mixin — use browser devtools to inspect the cascade.
- **CI is complaining about SCSS.** The build's `loadPaths` include
  `src/styles/` and `node_modules/`. If a `@use "highlight.js/…"` fails
  in `sass.compile` locally, run `npm install` first.
- **Golden snapshot changed.** `npm run build:golden` regenerates the
  reference build under `/golden`. Commit its output alongside your
  source changes so visual-diff testing has a fresh baseline.

---

## Cheat sheet

```scss
// SCSS: reach for tokens & mixins
@use "system/utilities" as *;

.my-block {
  @include card;
  padding: var(--space-6);
  color: var(--color-text-muted);
  border-radius: var(--radius-lg);

  @include mq($medium) {
    padding: var(--space-8);
  }
}
```

```html
<!-- EJS: compose with classes -->
<div class="content">
  <div class="ds-grid">
    <a class="card card-link col-4 t-col-4 d-col-6" href="/…">…</a>
    <a class="card card-link col-4 t-col-4 d-col-6" href="/…">…</a>
  </div>

  <div class="cluster">
    <button class="button primary play">Start</button>
    <button class="button ghost">Cancel</button>
  </div>
</div>
```

```js
// JS: state via class toggles + custom-property writes
btn.classList.toggle('play',  !isPlaying);
btn.classList.toggle('pause',  isPlaying);
bar.style.setProperty('--bar-width', `${percent}%`);
```

---

*Living document — updated when the system changes. Last significant
change: 2026-08-29 (design-system overhaul, PR #68).*
