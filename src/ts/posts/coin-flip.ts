const ready = require('../_modules/document-ready.ts');

/**
 * Initializes the coin flip interactive component on DOM ready.
 */
ready.document(() => {
  const coin = document.getElementById('coin') as HTMLElement;
  const flipButton = document.getElementById('flip-button') as HTMLButtonElement;
  const resetButton = document.getElementById('reset-button') as HTMLButtonElement;
  const result = document.getElementById('result') as HTMLElement;
  const headsCount = document.getElementById('heads-count') as HTMLElement;
  const tailsCount = document.getElementById('tails-count') as HTMLElement;
  const totalCount = document.getElementById('total-count') as HTMLElement;

  let heads = 0;
  let tails = 0;
  let isFlipping = false;
  let currentFace: 'heads' | 'tails' = 'heads';
  let animEndHandler: (() => void) | null = null;

  /**
   * Updates the UI text nodes with the current counts for heads, tails, and total flips.
   */
  function updateStats(): void {
    headsCount.textContent = String(heads);
    tailsCount.textContent = String(tails);
    totalCount.textContent = String(heads + tails);
  }

  /**
   * Performs a coin flip by triggering CSS 3D keyframe animations and randomly picking heads/tails.
   */
  function flipCoin(): void {
    if (isFlipping) return;

    isFlipping = true;
    flipButton.disabled = true;
    result.textContent = 'Flipping...';
    result.classList.remove('show');

    const isHeads = Boolean(Math.round(Math.random()));
    const currentIsHeads = currentFace === 'heads';
    const changingSides = currentIsHeads !== isHeads;

    // Set the CSS variable so the keyframe knows where to start from
    coin.style.setProperty('--coin-start', currentIsHeads ? '0deg' : '180deg');
    coin.classList.add(changingSides ? 'flip-change' : 'flip-same');

    /**
     * Handles the animationend event to display results and update counters once the flip completes.
     */
    animEndHandler = (): void => {
      animEndHandler = null;
      coin.classList.remove('flip-same', 'flip-change');

      currentFace = isHeads ? 'heads' : 'tails';
      coin.style.transform = `rotateX(${isHeads ? 0 : 180}deg)`;

      if (isHeads) {
        heads++;
        result.textContent = '🎉 HEADS!';
        result.classList.add('heads-result');
        result.classList.remove('tails-result');
      } else {
        tails++;
        result.textContent = '🎉 TAILS!';
        result.classList.add('tails-result');
        result.classList.remove('heads-result');
      }

      result.classList.add('show');
      updateStats();
      isFlipping = false;
      flipButton.disabled = false;
    };

    coin.addEventListener('animationend', animEndHandler, { once: true });
  }

  /**
   * Resets all flip statistics, cancels running animations, and restores the coin to its initial state.
   */
  function resetStats(): void {
    if (animEndHandler) {
      coin.removeEventListener('animationend', animEndHandler);
      animEndHandler = null;
    }

    isFlipping = false;
    flipButton.disabled = false;
    heads = 0;
    tails = 0;
    currentFace = 'heads';
    updateStats();
    result.textContent = 'Stats reset! Click "Flip Coin" to start';
    result.classList.remove('show', 'heads-result', 'tails-result');

    coin.classList.remove('flip-same', 'flip-change');
    coin.style.transform = 'rotateX(0deg)';
  }

  flipButton.addEventListener('click', flipCoin);
  resetButton.addEventListener('click', resetStats);

  updateStats();
});
