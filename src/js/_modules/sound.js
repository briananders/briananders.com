module.exports = function Sound() {
  const {
    getAudioContext,
    unlockAudioContext,
    installGlobalAudioUnlock,
  } = require('./audio-context');

  // Make sure iOS has a chance to unlock audio before any playback attempt.
  installGlobalAudioUnlock();

  let context = null;
  let oscillator = null;
  let gain = null;
  let frequency = 20;

  let isPlaying = false;

  function ensureInitialized() {
    if (context && oscillator && gain) return true;

    context = getAudioContext();
    if (!context) return false;

    oscillator = context.createOscillator();
    gain = context.createGain();

    // types: Sine Square Triangle Sawtooth
    oscillator.type = 'sine';
    oscillator.connect(gain);
    gain.gain.value = 0.00001;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);

    // Starting an oscillator before the first user gesture can break audio on iOS.
    // We only create + start nodes after a playback attempt (which should be gesture-driven).
    oscillator.start();

    return true;
  }

  function runLoop() {
    if (isPlaying) {
      // console.log(frequency);
      // setFrequency(frequency + 5);
      setTimeout(() => {
        runLoop();
      }, 100);
    }
  }

  function start() {
    if (isPlaying) { return; }
    if (!ensureInitialized()) { return; }
    isPlaying = true;
    runLoop();
    // console.info(gain.gain.value);
    // iOS Safari: resume/unlock must be initiated from a user gesture.
    unlockAudioContext().then(() => {
      try {
        gain.connect(context.destination);
      } catch {}
      gain.gain.exponentialRampToValueAtTime(1, context.currentTime + 0.04);
    }).catch(() => {});
  }

  function stop() {
    if (!context || !gain) {
      isPlaying = false;
      return;
    }
    // console.info(gain.gain.value);
    gain.gain.exponentialRampToValueAtTime(
      0.00001, context.currentTime + 0.04
    );
    setTimeout(() => {
      try {
        gain.disconnect(context.destination);
      } catch {}
      isPlaying = false;
    }, 200);
  }

  function setFrequency(newFrequency) {
    frequency = newFrequency;
    if (oscillator && context) {
      oscillator.frequency.setValueAtTime(frequency, context.currentTime); // value in hertz
    }
  }

  this.isPlaying = () => isPlaying;
  this.start = start;
  this.stop = stop;
  this.setFrequency = setFrequency;
};
