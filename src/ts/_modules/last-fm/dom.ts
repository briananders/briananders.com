// -----------------------------------------------------------------------------
// Minimal DOM helpers for the Last.fm dashboards.
//
// Report data (artist and album names) is untrusted, so nothing here builds
// markup from strings: text always goes through textContent.
// -----------------------------------------------------------------------------

export type DomChild = Node | string | number | boolean | null | undefined;
export type DomChildren = DomChild | DomChild[];

export interface ElementProps {
  class?: string | null;
  text?: string | null;
  style?: Record<string, string | null>;
  dataset?: Record<string, string | undefined>;
  [key: string]: unknown;
}

export interface TooltipPoint {
  x: number;
  y: number;
}

export interface TooltipContent {
  value: string;
  label: string;
  note?: string | null;
}

/**
 * Creates an element.
 *
 * @param {string} tag - Tag name.
 * @param {ElementProps} [props] - `class`, `text`, `style` (custom properties
 *   allowed), `dataset`, `on<event>` listeners, or plain attributes.
 * @param {DomChildren} [children] - Child nodes or text.
 * @returns {HTMLElement} The element.
 */
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: ElementProps,
  children?: DomChildren
): HTMLElementTagNameMap[K];
function h(tag: string, props?: ElementProps, children?: DomChildren): HTMLElement;
function h(tag: string, props: ElementProps = {}, children: DomChildren = []): HTMLElement {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) return;
    if (key === 'class') el.className = String(value);
    else if (key === 'text') el.textContent = String(value);
    else if (key === 'style') {
      Object.entries(value as Record<string, string | null>).forEach(([prop, val]) => el.style.setProperty(prop, val));
    } else if (key === 'dataset') Object.assign(el.dataset, value as Record<string, string | undefined>);
    else if (/^on[a-z]/.test(key)) el.addEventListener(key.slice(2), value as EventListener);
    else el.setAttribute(key, value === true ? '' : String(value));
  });
  append(el, children);
  return el;
}

/**
 * Appends children, turning strings into text nodes and skipping empties.
 *
 * @param {HTMLElement} el - Parent.
 * @param {DomChildren} children - Children.
 * @returns {HTMLElement} The parent.
 */
function append(el: HTMLElement, children: DomChildren): HTMLElement {
  const list: DomChild[] = Array.isArray(children) ? children : [children];
  list.forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    const isNode = typeof child === 'object' && 'nodeType' in child;
    el.append(isNode ? child : document.createTextNode(String(child)));
  });
  return el;
}

/**
 * Replaces an element's children.
 *
 * @param {HTMLElement} el - Parent.
 * @param {DomChildren} children - New children.
 * @returns {HTMLElement} The parent.
 */
function replace(el: HTMLElement, children: DomChildren): HTMLElement {
  el.replaceChildren();
  return append(el, children);
}

/**
 * Creates an SVG element.
 *
 * @param {string} tag - SVG tag name.
 * @param {Record<string, string | number>} [attrs] - Attributes.
 * @returns {SVGElement} The element.
 */
function svg(tag: string, attrs: Record<string, string | number> = {}): SVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
  return el;
}

// -- Tooltip ------------------------------------------------------------------

let tooltipEl: HTMLDivElement | null = null;

/**
 * Lazily creates the single shared tooltip element.
 *
 * @returns {HTMLDivElement} Tooltip element.
 */
function tooltipElement(): HTMLDivElement {
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
 * @param {TooltipPoint} point - Viewport coordinates of the anchor.
 * @param {TooltipContent} content - Text rows.
 */
function showTooltip(point: TooltipPoint, content: TooltipContent): void {
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
function hideTooltip(): void {
  if (tooltipEl) tooltipEl.hidden = true;
}

/**
 * Wires hover and keyboard focus on `el` to the shared tooltip.
 *
 * @param {HTMLElement} el - Target (the hit area, not just the painted mark).
 * @param {() => TooltipContent} getContent - Content factory.
 */
function bindTooltip(el: HTMLElement, getContent: () => TooltipContent): void {
  const show = (): void => {
    const rect = el.getBoundingClientRect();
    showTooltip({ x: rect.left + rect.width / 2, y: rect.top }, getContent());
  };
  el.addEventListener('pointerenter', (event: PointerEvent) => { if (event.pointerType !== 'touch') show(); });
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
