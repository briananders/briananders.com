// -----------------------------------------------------------------------------
// Minimal DOM helpers for the Last.fm dashboards.
//
// Report data (artist and album names) is untrusted, so nothing here builds
// markup from strings: text always goes through textContent.
// -----------------------------------------------------------------------------

/**
 * Creates an element.
 *
 * @param {string} tag - Tag name.
 * @param {Object} [props] - `class`, `text`, `style` (custom properties
 *   allowed), `dataset`, `on<event>` listeners, or plain attributes.
 * @param {Array|Node|string} [children] - Child nodes or text.
 * @returns {HTMLElement} The element.
 */
function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) return;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'style') Object.entries(value).forEach(([prop, val]) => el.style.setProperty(prop, val));
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (/^on[a-z]/.test(key)) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  });
  append(el, children);
  return el;
}

/**
 * Appends children, turning strings into text nodes and skipping empties.
 *
 * @param {HTMLElement} el - Parent.
 * @param {Array|Node|string} children - Children.
 * @returns {HTMLElement} The parent.
 */
function append(el, children) {
  [].concat(children).forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return el;
}

/**
 * Replaces an element's children.
 *
 * @param {HTMLElement} el - Parent.
 * @param {Array|Node|string} children - New children.
 * @returns {HTMLElement} The parent.
 */
function replace(el, children) {
  el.replaceChildren();
  return append(el, children);
}

/**
 * Creates an SVG element.
 *
 * @param {string} tag - SVG tag name.
 * @param {Object} [attrs] - Attributes.
 * @returns {SVGElement} The element.
 */
function svg(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

// -- Tooltip ------------------------------------------------------------------

let tooltipEl = null;

/**
 * Lazily creates the single shared tooltip element.
 *
 * @returns {HTMLElement} Tooltip element.
 */
function tooltipElement() {
  if (!tooltipEl) {
    tooltipEl = h('div', {
      class: 'lfm-tooltip', role: 'status', 'aria-live': 'polite', hidden: true,
    });
    document.body.append(tooltipEl);
    // The tooltip is fixed-position; once the page scrolls it no longer points at its mark.
    window.addEventListener('scroll', hideTooltip, { passive: true });
  }
  return tooltipEl;
}

/**
 * Shows the tooltip above a viewport point. Values lead; labels follow.
 *
 * @param {{x: number, y: number}} point - Viewport coordinates of the anchor.
 * @param {{value: string, label: string, note?: string}} content - Text rows.
 */
function showTooltip(point, content) {
  const tip = tooltipElement();
  // A modal <dialog> sits in the top layer; the tooltip must live inside it to paint above it.
  const host = document.querySelector('dialog[open]') || document.body;
  if (tip.parentNode !== host) host.append(tip);
  replace(tip, [
    h('strong', { class: 'lfm-tooltip__value', text: content.value }),
    h('span', { class: 'lfm-tooltip__label', text: content.label }),
    content.note ? h('span', { class: 'lfm-tooltip__note', text: content.note }) : null
  ]);
  tip.hidden = false;
  const { width, height } = tip.getBoundingClientRect();
  const margin = 8;
  const left = Math.min(Math.max(point.x - width / 2, margin), window.innerWidth - width - margin);
  let top = point.y - height - 10;
  if (top < margin) top = point.y + 16;
  tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

/**
 * Hides the shared tooltip.
 */
function hideTooltip() {
  if (tooltipEl) tooltipEl.hidden = true;
}

/**
 * Wires hover and keyboard focus on `el` to the shared tooltip.
 *
 * @param {HTMLElement} el - Target (the hit area, not just the painted mark).
 * @param {function(): {value: string, label: string, note?: string}} getContent - Content factory.
 */
function bindTooltip(el, getContent) {
  const show = () => {
    const rect = el.getBoundingClientRect();
    showTooltip({ x: rect.left + rect.width / 2, y: rect.top }, getContent());
  };
  el.addEventListener('pointerenter', (event) => { if (event.pointerType !== 'touch') show(); });
  el.addEventListener('pointerleave', hideTooltip);
  el.addEventListener('focus', show);
  el.addEventListener('blur', hideTooltip);
}

module.exports = {
  append,
  bindTooltip,
  h,
  hideTooltip,
  replace,
  showTooltip,
  svg,
};
