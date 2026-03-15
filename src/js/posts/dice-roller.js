const ready = require('../_modules/document-ready');

ready.document(() => {
  const numDiceInput = document.getElementById('num-dice');
  const numSidesSelect = document.getElementById('num-sides');
  const rollButton = document.getElementById('roll-button');
  const diceDisplay = document.getElementById('dice-display');
  const totalDisplay = document.getElementById('total-display');

  /**
   * Rolls a single die with the specified number of sides
   * @param {number} sides - Number of sides on the die
   * @returns {number} - Random number between 1 and sides
   */
  function rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
  }

  /**
   * Rolls multiple dice and returns an array of results
   * @param {number} numDice - Number of dice to roll
   * @param {number} numSides - Number of sides on each die
   * @returns {Array<number>} - Array of roll results
   */
  function rollDice(numDice, numSides) {
    const results = [];
    for (let i = 0; i < numDice; i++) {
      results.push(rollDie(numSides));
    }
    return results;
  }

  /**
   * Animates the rolling of dice
   * @param {number} numDice - Number of dice to roll
   * @param {number} numSides - Number of sides on each die
   */
  function animateRoll(numDice, numSides) {
    const ANIMATION_DURATION = 500;
    const ANIMATION_INTERVAL = 50;
    const startTime = Date.now();
    
    // Disable button during animation
    rollButton.disabled = true;
    rollButton.textContent = 'Rolling...';
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed < ANIMATION_DURATION) {
        // Show random values during animation
        const tempResults = rollDice(numDice, numSides);
        displayResults(tempResults, numSides, true);
        setTimeout(animate, ANIMATION_INTERVAL);
      } else {
        // Show final results
        const finalResults = rollDice(numDice, numSides);
        displayResults(finalResults, numSides, false);
        
        // Re-enable button
        rollButton.disabled = false;
        rollButton.textContent = 'Roll Dice';
      }
    };
    
    animate();
  }

  /**
   * Displays the dice results on the page
   * @param {Array<number>} results - Array of dice roll results
   * @param {number} numSides - Number of sides on each die
   * @param {boolean} isAnimating - Whether the dice are currently animating
   */
  function displayResults(results, numSides, isAnimating) {
    // Clear previous results
    diceDisplay.innerHTML = '';
    
    // Create a die element for each result
    results.forEach((result, index) => {
      const dieElement = document.createElement('div');
      dieElement.className = `die die-${numSides} ${isAnimating ? 'rolling' : ''}`;
      dieElement.textContent = result;
      diceDisplay.appendChild(dieElement);
    });
    
    // Calculate and display total
    const total = results.reduce((sum, value) => sum + value, 0);
    totalDisplay.innerHTML = `<strong>Total:</strong> ${total}`;
    
    if (!isAnimating) {
      totalDisplay.classList.add('show');
    } else {
      totalDisplay.classList.remove('show');
    }
  }

  /**
   * Handles the roll button click
   */
  function handleRoll() {
    const numDice = parseInt(numDiceInput.value, 10);
    const numSides = parseInt(numSidesSelect.value, 10);
    
    // Validate inputs
    if (numDice < 1 || numDice > 20) {
      alert('Please enter a number of dice between 1 and 20');
      return;
    }
    
    animateRoll(numDice, numSides);
  }

  // Attach event listeners
  rollButton.addEventListener('click', handleRoll);
  
  // Allow Enter key to roll
  numDiceInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleRoll();
    }
  });
  
  // Initial roll on page load
  handleRoll();
});
