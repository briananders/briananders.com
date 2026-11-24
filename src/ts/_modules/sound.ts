export interface SoundInstance {
  isPlaying: () => boolean;
  start: () => void;
  stop: () => void;
  setFrequency: (newFrequency: number) => void;
}

/**
 * Sound synthesizer controller utilizing the Web Audio API oscillator and gain nodes.
 *
 * @constructor
 */
module.exports = function Sound(this: SoundInstance): void {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error('Web Audio API is not supported in this browser.');
  }
  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  let frequency = 20;
  // types: Sine Square Triangle Sawtooth
  oscillator.type = 'sine';
  oscillator.connect(gain);
  gain.gain.value = 0.00001;
  setFrequency(frequency);
  oscillator.start();

  let isPlaying = false;

  /**
   * Internal recurring loop running while sound is actively playing.
   *
   * @returns {void}
   */
  function runLoop(): void {
    if (isPlaying) {
      // console.log(frequency);
      // setFrequency(frequency + 5);
      setTimeout(() => {
        runLoop();
      }, 100);
    }
  }

  /**
   * Starts audio playback by ramping gain up and connecting output to audio destination.
   *
   * @returns {void}
   */
  function start(): void {
    if (isPlaying) { return; }
    isPlaying = true;
    runLoop();
    // console.info(gain.gain.value);
    context.resume().then(() => {
      gain.connect(context.destination);
      gain.gain.exponentialRampToValueAtTime(1, context.currentTime + 0.04);
    });
  }

  /**
   * Stops audio playback by ramping down gain to silence and disconnecting audio output.
   *
   * @returns {void}
   */
  function stop(): void {
    // console.info(gain.gain.value);
    gain.gain.exponentialRampToValueAtTime(0.00001, context.currentTime + 0.04);
    setTimeout(() => {
      try {
        gain.disconnect(context.destination);
      } catch {
        // Disconnecting an already-disconnected gain node is harmless; ignore.
      }
      isPlaying = false;
    }, 200);
  }

  /**
   * Sets the oscillator frequency in Hertz.
   *
   * @param {number} newFrequency - Frequency in Hz.
   * @returns {void}
   */
  function setFrequency(newFrequency: number): void {
    frequency = newFrequency;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime); // value in hertz
  }

  /**
   * Returns whether audio is currently playing.
   *
   * @returns {boolean}
   */
  this.isPlaying = (): boolean => isPlaying;

  /**
   * Starts sound playback.
   */
  this.start = start;

  /**
   * Stops sound playback.
   */
  this.stop = stop;

  /**
   * Updates oscillator pitch.
   */
  this.setFrequency = setFrequency;
};
