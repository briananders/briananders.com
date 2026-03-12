let sharedContext = null;
let isUnlocked = false;
let unlockInFlight = null;
let globalUnlockInstalled = false;

function getAudioContext() {
  if (sharedContext) return sharedContext;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;

  sharedContext = new AudioContext();
  return sharedContext;
}

async function unlockAudioContext() {
  const ctx = getAudioContext();
  if (!ctx) return null;

  if (isUnlocked) return ctx;
  if (unlockInFlight) return unlockInFlight;

  unlockInFlight = (async () => {
    // iOS Safari often requires an explicit resume() that is initiated from a user gesture.
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch {}

    // "Prime" the audio pipeline with a tiny (silent) buffer.
    // This is a common workaround for iOS where resume() alone can be unreliable.
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      source.stop(0);
      source.disconnect();
    } catch {}

    isUnlocked = true;
    return ctx;
  })();

  try {
    return await unlockInFlight;
  } finally {
    unlockInFlight = null;
  }
}

function installGlobalAudioUnlock() {
  if (globalUnlockInstalled) return;
  if (typeof document === 'undefined') return;

  globalUnlockInstalled = true;

  const events = ['touchstart', 'touchend', 'pointerdown', 'mousedown', 'keydown'];
  const opts = { passive: true, capture: true };

  const handler = () => {
    // Best-effort; if this runs without a gesture it just won't unlock.
    unlockAudioContext();
    events.forEach((evt) => document.removeEventListener(evt, handler, opts));
    globalUnlockInstalled = false;
  };

  events.forEach((evt) => document.addEventListener(evt, handler, opts));

  // If the page is backgrounded and returned, iOS may suspend audio again.
  // Re-arm unlock listeners when we become visible.
  document.addEventListener('visibilitychange', () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (document.visibilityState !== 'visible') return;

    if (ctx.state !== 'running') {
      isUnlocked = false;
      installGlobalAudioUnlock();
    }
  });
}

module.exports = {
  getAudioContext,
  unlockAudioContext,
  installGlobalAudioUnlock,
};

