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

  function setFrequency(newFrequency) {
    frequency = newFrequency;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime); // value in hertz
  }

  this.isPlaying = () => isPlaying;
  this.start = start;
  this.stop = stop;
  this.setFrequency = setFrequency;
};
