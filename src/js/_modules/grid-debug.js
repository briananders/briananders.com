/**
 * Grid-debug overlay.
 *
 * A dev/design aid. Press Ctrl+G (or Cmd+G on macOS) anywhere on the site to
 * toggle a translucent overlay showing the 12-column design-system grid on
 * top of the page — including the correct column count for the current
 * breakpoint (4 → 8 → 12 columns), the gutters, and the content max-width.
 *
 * Not shown by default; nothing renders until the user asks for it.
 */

const OVERLAY_ID = 'grid-debug-overlay';
const STYLE_ID = 'grid-debug-overlay-styles';

/**
 * Inject the stylesheet the overlay depends on. Idempotent.
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
      padding: 0;
      display: none;
    }
    #${OVERLAY_ID}[data-active="true"] { display: block; }

    #${OVERLAY_ID} .grid-debug__container {
      width: 100%;
      max-width: var(--content-max, 1200px);
      height: 100%;
      margin: 0 auto;
      padding: 0 var(--gutter-mobile, 16px);
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--grid-gap-mobile, 12px);
    }
    @media (min-width: 600px) {
      #${OVERLAY_ID} .grid-debug__container {
        grid-template-columns: repeat(8, minmax(0, 1fr));
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
      background: rgba(249, 115, 22, 0.14);
      border-left: 1px solid rgba(249, 115, 22, 0.55);
      border-right: 1px solid rgba(249, 115, 22, 0.55);
    }

    #${OVERLAY_ID} .grid-debug__label {
      position: fixed;
      right: 12px;
      bottom: 12px;
      padding: 6px 10px;
      background: #0B0D10;
      color: #F97316;
      border: 1px solid #F97316;
      border-radius: 8px;
      font: 600 12px/1 var(--font-mono, ui-monospace, "SF Mono", Menlo, monospace);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Build the overlay element (12 columns — the tail get hidden by CSS at
 * smaller breakpoints).
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
        if (active) label.textContent = currentTier();
      });
    }
    active = !active;
    overlay.dataset.active = String(active);
    label.textContent = currentTier();
  };

  document.addEventListener('keydown', (evt) => {
    // Ctrl+G on Windows/Linux, Cmd+G on macOS. Ignore repeats.
    if (evt.repeat) return;
    if ((evt.ctrlKey || evt.metaKey) && !evt.shiftKey && !evt.altKey
        && (evt.key === 'g' || evt.key === 'G')) {
      evt.preventDefault();
      toggle();
    }
  });
};
