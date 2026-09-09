/**
 * Interactions for the design-system post:
 *   - swatch → clipboard
 *   - tab list (arrow-key navigation)
 *   - accordion (aria-expanded + data-open panel toggle)
 *   - modal (open / close, scrim + Esc)
 *   - toast region
 *   - range → progress bar
 */
const ready = require('../_modules/document-ready');

/**
 * Displays a temporary toast notification message inside the toast region element.
 *
 * @param {string} message - The message text to display in the toast.
 */
function toast(message) {
  const region = document.getElementById('dsToastRegion');
  if (!region) return;
  const el = document.createElement('div');
  el.className = 'ds-toast';
  el.textContent = message;
  region.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 300ms, transform 300ms';
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
  }, 2700);
  setTimeout(() => el.remove(), 3100);
}

/**
 * Attaches click event listeners to color swatches to copy CSS custom property strings to clipboard.
 */
function wireSwatches() {
  document.querySelectorAll('.ds-swatch[data-var]').forEach((el) => {
    el.addEventListener('click', async () => {
      const v = el.dataset.var;
      try {
        await navigator.clipboard.writeText(`var(${v})`);
        toast(`Copied var(${v})`);
      } catch (_e) {
        toast(`Couldn't copy — ${v}`);
      }
    });
  });
}

/**
 * Configures accessible tab lists, supporting mouse selection and keyboard navigation (arrows, Home, End).
 */
function wireTabs() {
  document.querySelectorAll('[data-tabs]').forEach((root) => {
    const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));

    /**
     * Activates the tab at index `i` and updates aria attributes and panel visibility.
     *
     * @param {number} i - The 0-based index of the tab to activate.
     */
    const select = (i) => {
      tabs.forEach((t, idx) => {
        const active = idx === i;
        t.setAttribute('aria-selected', String(active));
        t.setAttribute('tabindex', active ? '0' : '-1');
        if (panels[idx]) panels[idx].hidden = !active;
      });
      tabs[i].focus();
    };

    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', (evt) => {
        if (evt.key === 'ArrowRight') { evt.preventDefault(); select((i + 1) % tabs.length); }
        if (evt.key === 'ArrowLeft') { evt.preventDefault(); select((i - 1 + tabs.length) % tabs.length); }
        if (evt.key === 'Home') { evt.preventDefault(); select(0); }
        if (evt.key === 'End') { evt.preventDefault(); select(tabs.length - 1); }
      });
    });
  });
}

/**
 * Attaches click event handlers to accordion headers to toggle panel visibility and aria-expanded state.
 */
function wireAccordion() {
  document.querySelectorAll('[data-accordion]').forEach((root) => {
    root.querySelectorAll('.ds-accordion__trigger').forEach((btn) => {
      btn.addEventListener('click', () => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        const panel = document.getElementById(btn.getAttribute('aria-controls'));
        if (panel) panel.dataset.open = String(!expanded);
      });
    });
  });
}

/**
 * Initializes modal dialog opening, closing, keyboard accessibility (Escape), and focus management.
 */
function wireModal() {
  const modal = document.getElementById('dsModal');
  if (!modal) return;
  const openBtns = document.querySelectorAll('[data-open-modal="dsModal"]');
  const closeBtns = modal.querySelectorAll('[data-close-modal]');

  /**
   * Closes the modal and removes the keydown listener.
   */
  const close = () => {
    modal.setAttribute('hidden', '');
    document.removeEventListener('keydown', onKey);
  };

  /**
   * Handles keyboard events when the modal is open, closing on Escape key press.
   *
   * @param {KeyboardEvent} evt - The keyboard event object.
   */
  function onKey(evt) { if (evt.key === 'Escape') close(); }

  /**
   * Opens the modal dialog, focuses primary button, and attaches keydown listener.
   */
  const open = () => {
    modal.removeAttribute('hidden');
    const primary = modal.querySelector('.primary');
    if (primary) primary.focus();
    document.addEventListener('keydown', onKey);
  };

  openBtns.forEach((b) => b.addEventListener('click', open));
  closeBtns.forEach((b) => b.addEventListener('click', close));
}

/**
 * Wires buttons with data-toast attributes to trigger toast notifications with their specified messages.
 */
function wireToastButtons() {
  document.querySelectorAll('[data-toast]').forEach((btn) => {
    btn.addEventListener('click', () => toast(btn.dataset.toast));
  });
}

/**
 * Wires range slider input to update width of progress bar in real time.
 */
function wireRangeProgress() {
  const input = document.getElementById('rangeProgressInput');
  const bar = document.getElementById('rangeProgress');
  if (!input || !bar) return;
  input.addEventListener('input', () => {
    bar.style.width = `${input.value}%`;
  });
}

/**
 * Initializes all design system component interactions once DOM is ready.
 */
ready.document(() => {
  wireSwatches();
  wireTabs();
  wireAccordion();
  wireModal();
  wireToastButtons();
  wireRangeProgress();
});
