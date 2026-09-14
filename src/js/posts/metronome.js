const ready = require('../_modules/document-ready');

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function createClick({ audioCtx, time, accent = false }) {
  // Short percussive click using oscillator + gain envelope.
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  // Accent uses a higher frequency and slightly louder envelope.
  const frequency = accent ? 1600 : 1000;
  const peak = accent ? 0.22 : 0.14;
  const duration = 0.035;

  osc.type = 'square';
  osc.frequency.setValueAtTime(frequency, time);

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(time);
  osc.stop(time + duration + 0.01);
}

ready.document(() => {
  const toggleButton = document.getElementById('metronome-toggle');
  const bpmInput = document.getElementById('metronome-bpm');
  const bpmRange = document.getElementById('metronome-bpm-range');
  const tsTop = document.getElementById('metronome-ts-top');
  const tsBottom = document.getElementById('metronome-ts-bottom');
  const accentCheckbox = document.getElementById('metronome-accent');
  const beatValue = document.getElementById('metronome-beat');
  const dots = document.getElementById('metronome-dots');

  const widget = document.querySelector('.metronome-widget');

  if (!toggleButton || !bpmInput || !bpmRange || !tsTop || !tsBottom || !accentCheckbox || !beatValue || !dots || !widget) {
    return;
  }

  // State
  let bpm = clampInt(bpmInput.value, 30, 240, 120);
  let beatsPerBar = clampInt(tsTop.value, 1, 32, 4);
  let beatUnit = clampInt(tsBottom.value, 1, 32, 4); // 2,4,8...
  let accentDownbeat = accentCheckbox.checked;

  let isRunning = false;

  // Audio scheduling
  let audioCtx = null;
  let nextNoteTime = 0;
  let currentBeatInBar = 0; // 0-indexed
  let schedulerTimer = null;
  const uiTimers = new Set();

  // Scheduler tuning: keep this conservative; browsers throttle timers in background tabs.
  const lookaheadMs = 25;
  const scheduleAheadTimeSec = 0.12;

  function secondsPerBeat() {
    // Treat BPM as quarter-note BPM; adjust for chosen beat unit.
    // e.g. 120 BPM at /8 => eighth note is half a quarter => 0.25s.
    const base = 60 / bpm;
    return base * (4 / beatUnit);
  }

  function clearUiTimers() {
    uiTimers.forEach((id) => clearTimeout(id));
    uiTimers.clear();
  }

  function renderDots() {
    dots.innerHTML = '';
    for (let i = 0; i < beatsPerBar; i++) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.dataset.index = String(i);
      dots.appendChild(dot);
    }
  }

  function setActiveDot(index) {
    const dotEls = dots.querySelectorAll('.dot');
    dotEls.forEach((el) => {
      el.classList.toggle('active', el.dataset.index === String(index));
      el.classList.toggle('downbeat', el.dataset.index === '0');
    });
  }

  function updateBeatUi(beatIndex) {
    // Display 1-indexed beat number.
    beatValue.textContent = String(beatIndex + 1);
    setActiveDot(beatIndex);
    widget.dataset.pulse = String(Date.now());
  }

  function scheduleUiUpdate(beatIndex, time) {
    // Align UI flash with scheduled audio time.
    const deltaMs = Math.max(0, (time - audioCtx.currentTime) * 1000);
    const id = setTimeout(() => {
      uiTimers.delete(id);
      updateBeatUi(beatIndex);
    }, deltaMs);
    uiTimers.add(id);
  }

  function advanceBeat() {
    const spb = secondsPerBeat();
    nextNoteTime += spb;
    currentBeatInBar = (currentBeatInBar + 1) % beatsPerBar;
  }

  function scheduler() {
    if (!isRunning || !audioCtx) return;

    while (nextNoteTime < audioCtx.currentTime + scheduleAheadTimeSec) {
      const isDownbeat = currentBeatInBar === 0;
      const accent = accentDownbeat && isDownbeat;

      createClick({ audioCtx, time: nextNoteTime, accent });
      scheduleUiUpdate(currentBeatInBar, nextNoteTime);

      advanceBeat();
    }

    schedulerTimer = setTimeout(scheduler, lookaheadMs);
  }

  async function ensureAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
  }

  async function start() {
    if (isRunning) return;

    bpm = clampInt(bpmInput.value, 30, 240, bpm);
    beatsPerBar = clampInt(tsTop.value, 1, 32, beatsPerBar);
    beatUnit = clampInt(tsBottom.value, 1, 32, beatUnit);
    accentDownbeat = !!accentCheckbox.checked;

    renderDots();

    await ensureAudioContext();

    isRunning = true;
    widget.dataset.state = 'running';
    toggleButton.textContent = 'Stop';

    currentBeatInBar = 0;
    nextNoteTime = audioCtx.currentTime + 0.05;

    clearUiTimers();
    updateBeatUi(0);

    scheduler();
  }

  function stop() {
    if (!isRunning) return;
    isRunning = false;
    widget.dataset.state = 'stopped';
    toggleButton.textContent = 'Start';

    if (schedulerTimer) {
      clearTimeout(schedulerTimer);
      schedulerTimer = null;
    }

    clearUiTimers();
    beatValue.textContent = '—';
    setActiveDot(-1);
  }

  function setBpm(nextBpm) {
    bpm = clampInt(nextBpm, 30, 240, bpm);
    bpmInput.value = String(bpm);
    bpmRange.value = String(bpm);
  }

  function syncTimeSignature() {
    beatsPerBar = clampInt(tsTop.value, 1, 32, beatsPerBar);
    beatUnit = clampInt(tsBottom.value, 1, 32, beatUnit);
    renderDots();
    if (currentBeatInBar >= beatsPerBar) currentBeatInBar = 0;
  }

  // Initial render
  setBpm(bpm);
  renderDots();
  setActiveDot(-1);

  // Events
  toggleButton.addEventListener('click', () => {
    if (isRunning) stop();
    else start();
  });

  bpmInput.addEventListener('change', () => setBpm(bpmInput.value));
  bpmInput.addEventListener('input', () => setBpm(bpmInput.value));
  bpmRange.addEventListener('input', () => setBpm(bpmRange.value));

  tsTop.addEventListener('change', () => syncTimeSignature());
  tsBottom.addEventListener('change', () => syncTimeSignature());
  accentCheckbox.addEventListener('change', () => { accentDownbeat = accentCheckbox.checked; });

  document.addEventListener('visibilitychange', () => {
    // Avoid running a metronome in the background (timers can be throttled heavily).
    if (document.hidden) stop();
  });
});

