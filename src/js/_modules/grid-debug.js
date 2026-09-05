/**
 * Grid-debug overlay.
 *
 * A dev/design aid. Press Ctrl+G (or Cmd+G on macOS) anywhere on the site to
 * toggle a translucent overlay showing the 12-column design-system grid on
 * top of the page — including the correct column count for the current
 * breakpoint (4 → 8 → 12 columns), the gutters, and the content max-width.
 *
 * Not shown by default; nothing renders until the user asks for it. Uses a
 * capture-phase listener with `code === 'KeyG'` so browser layouts and
 * default shortcuts don't swallow the keystroke.
 */

const OVERLAY_ID = 'grid-debug-overlay';
const STYLE_ID = 'grid-debug-overlay-styles';

/**
 * Inject the stylesheet the overlay depends on. Idempotent.
 * The container is a single-row grid so the columns run from top to bottom
 * of the viewport; columns beyond the current tier's count are hidden via
 * media queries.
 */
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      pointer-events: none;
      display: none;
    }
    #${OVERLAY_ID}[data-active="true"] { display: block; }

    #${OVERLAY_ID} .grid-debug__container {
      position: relative;
      width: 100%;
      max-width: var(--content-max, 1200px);
      height: 100%;
      margin: 0 auto;
      padding: 0 var(--gutter-mobile, 16px);
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      grid-template-rows: 100%;
      gap: var(--grid-gap-mobile, 12px);
    }
    @media (min-width: 600px) {
      #${OVERLAY_ID} .grid-debug__container {
        grid-template-columns: repeat(8, minmax(0, 1fr));
        padding: 0 24px;
      }
    }
    @media (min-width: 960px) {
      #${OVERLAY_ID} .grid-debug__container {
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: var(--grid-gap-desktop, 16px);
        padding: 0 var(--gutter-desktop, 32px);
      }
    }
    #${OVERLAY_ID} .grid-debug__col {
      background: rgba(249, 115, 22, 0.16);
      border-left: 1px dashed rgba(249, 115, 22, 0.75);
      border-right: 1px dashed rgba(249, 115, 22, 0.75);
      height: 100%;
    }

    /* Hide columns beyond the current tier's count. */
    #${OVERLAY_ID} .grid-debug__col:nth-child(n+5)  { display: none; }
    @media (min-width: 600px) {
      #${OVERLAY_ID} .grid-debug__col:nth-child(n+5)  { display: block; }
      #${OVERLAY_ID} .grid-debug__col:nth-child(n+9)  { display: none; }
    }
    @media (min-width: 960px) {
      #${OVERLAY_ID} .grid-debug__col:nth-child(n+9)  { display: block; }
    }

    #${OVERLAY_ID} .grid-debug__label {
      position: fixed;
      right: 12px;
      bottom: 12px;
      padding: 8px 12px;
      background: #0B0D10;
      color: #F97316;
      border: 1px solid #F97316;
      border-radius: 8px;
      font: 600 12px/1.2 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Build the overlay element with 12 columns; the extras are hidden by CSS at
 * smaller breakpoints.
 */
function buildOverlay() {
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('aria-hidden', 'true');

  const container = document.createElement('div');
  container.className = 'grid-debug__container';
  for (let i = 0; i < 12; i += 1) {
    const col = document.createElement('span');
    col.className = 'grid-debug__col';
    container.appendChild(col);
  }
  overlay.appendChild(container);

  const label = document.createElement('div');
  label.className = 'grid-debug__label';
  overlay.appendChild(label);

  return { overlay, label };
}

/**
 * Return the current grid tier as a string based on the viewport width.
 */
function currentTier() {
  const w = window.innerWidth;
  if (w >= 960) return '12 cols · desktop';
  if (w >= 600) return '8 cols · tablet';
  return '4 cols · mobile';
}

/**
 * Determines if a keyboard event originated from a form field or editable element.
 *
 * @param {EventTarget} target - The target element of the event.
 * @returns {boolean} True if the target is an editable input.
 */
function isEditableElement(target) {
  if (!target || !target.tagName) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  return false;
}

/**
 * Checks whether the pressed key matches the grid toggle shortcut.
 * Supports Ctrl+G, Cmd+G, Alt+G, Shift combinations, or a bare 'g' outside inputs.
 *
 * @param {KeyboardEvent} evt - The keydown event.
 * @returns {boolean} True if the key combination should toggle the grid.
 */
function isGridKey(evt) {
  if (evt.repeat) {
    return false;
  }

  const isGKey = evt.code === 'KeyG' || evt.key === 'g' || evt.key === 'G';
  if (!isGKey) {
    return false;
  }

  // If a modifier is held (Ctrl, Cmd/Meta, or Alt/Option), trigger unconditionally.
  // We do not block Shift so that Ctrl+Shift+G or Cmd+Shift+G still works.
  if (evt.ctrlKey || evt.metaKey || evt.altKey) {
    return true;
  }

  // If no modifier is held, allow bare 'g' or 'G' as long as the user is not typing in an input.
  if (!isEditableElement(evt.target)) {
    return true;
  }

  return false;
}

module.exports.init = () => {
  let overlay;
  let label;
  let active = false;

  const toggle = () => {
    if (!overlay) {
      injectStyles();
      const built = buildOverlay();
      overlay = built.overlay;
      label = built.label;
      document.body.appendChild(overlay);
      window.addEventListener('resize', () => {
        if (active && label) {
          label.textContent = currentTier();
        }
      });
    }
    active = !active;
    overlay.dataset.active = String(active);
    label.textContent = currentTier();
  };

  const handleKeydown = (evt) => {
    if (!isGridKey(evt)) {
      return;
    }
    evt.preventDefault();
    evt.stopPropagation();
    toggle();
  };

  // Register in capture phase on both window and document to intercept before page listeners.
  window.addEventListener('keydown', handleKeydown, true);

  /**
   * Checks for the "grid" query parameter in the URL.
   * If present and not explicitly set to "false" or "0", automatically activate the overlay.
   */
  const checkQueryParameter = () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('grid')) {
      return;
    }
    const paramValue = urlParams.get('grid');
    if (paramValue === 'false' || paramValue === '0') {
      return;
    }
    toggle();
  };

  if (document.body) {
    checkQueryParameter();
  } else {
    document.addEventListener('DOMContentLoaded', checkQueryParameter);
  }
};
