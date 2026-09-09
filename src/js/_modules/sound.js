/**
 * Sound synthesizer controller utilizing the Web Audio API oscillator and gain nodes.
 *
 * @constructor
 */
module.exports = function Sound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContext();
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
  function runLoop() {
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
  function start() {
    if (isPlaying) { return; }
    isPlaying = true;
    runLoop();
    // console.info(gain.gain.value);
    context.resume().then(() => {
      gain.connect(context.destination);
      gain.gain.exponentialRampToValueAtTime(
        1, context.currentTime + 0.04
      );
    });
  }

  /**
   * Stops audio playback by ramping down gain to silence and disconnecting audio output.
   *
   * @returns {void}
   */
  function stop() {
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

  /**
   * Sets the oscillator frequency in Hertz.
   *
   * @param {number} newFrequency - Frequency in Hz.
   * @returns {void}
   */
  function setFrequency(newFrequency) {
    frequency = newFrequency;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime); // value in hertz
  }

  /**
   * Returns whether audio is currently playing.
   *
   * @returns {boolean}
   */
  this.isPlaying = () => isPlaying;

  /**
   * Starts sound playback.
   *
   * @type {Function}
   */
  this.start = start;

  /**
   * Stops sound playback.
   *
   * @type {Function}
   */
  this.stop = stop;

  /**
   * Updates oscillator pitch.
   *
   * @type {Function}
   */
  this.setFrequency = setFrequency;
};
