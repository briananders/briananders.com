const ready = require('../_modules/document-ready');

ready.document(() => {
  const coin = document.getElementById('coin');
  const flipButton = document.getElementById('flip-button');
  const resetButton = document.getElementById('reset-button');
  const result = document.getElementById('result');
  const headsCount = document.getElementById('heads-count');
  const tailsCount = document.getElementById('tails-count');
  const totalCount = document.getElementById('total-count');

  let heads = 0;
  let tails = 0;
  let isFlipping = false;

  /**
   * Updates the statistics display
   */
  function updateStats() {
    headsCount.textContent = heads;
    tailsCount.textContent = tails;
    totalCount.textContent = heads + tails;
  }

  /**
   * Flips the coin with animation
   */
  function flipCoin() {
    if (isFlipping) return;

    isFlipping = true;
    flipButton.disabled = true;
    result.textContent = 'Flipping...';
    result.classList.remove('show');

    // Random outcome
    const isHeads = Math.random() < 0.5;

    // Calculate rotation - always do at least 3 full rotations for effect
    const minRotations = 3;
    const extraRotation = Math.floor(Math.random() * 3); // 0-2 extra rotations
    const totalRotations = minRotations + extraRotation;

    // If heads, end on 0 or 360, if tails end on 180
    const finalPosition = isHeads ? 0 : 180;
    const totalDegrees = (totalRotations * 360) + finalPosition;

    // Apply the animation
    coin.style.transform = `rotateX(${totalDegrees * 360}deg)`;

    // Wait for animation to complete
    setTimeout(() => {
      // Update stats
      if (isHeads) {
        heads++;
        coin.style.transform = '';
        result.textContent = '🎉 HEADS!';
        result.classList.add('heads-result');
        result.classList.remove('tails-result');
      } else {
        tails++;
        coin.style.transform = '';
        result.textContent = '🎉 TAILS!';
        result.classList.add('tails-result');
        result.classList.remove('heads-result');
      }

      result.classList.add('show');
      updateStats();

      isFlipping = false;
      flipButton.disabled = false;
    }, 1000);
  }

  /**
   * Resets the statistics
   */
  function resetStats() {
    heads = 0;
    tails = 0;
    updateStats();
    result.textContent = 'Stats reset! Click "Flip Coin" to start';
    result.classList.remove('show', 'heads-result', 'tails-result');

    // Reset coin to initial position
    coin.style.transform = 'rotateX(0deg)';
  }

  // Attach event listeners
  flipButton.addEventListener('click', flipCoin);
  resetButton.addEventListener('click', resetStats);

  // Initialize stats
  updateStats();
});
