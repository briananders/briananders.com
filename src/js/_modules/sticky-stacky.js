/**
 * Class representing an individual StickyStacky element controller.
 * Manages sticky positioning, stuck states, and CSS custom properties for a sticky container.
 */
class StickyStacky {
  #previousHeights;
  #containerElement;
  stickyElement;
  top;
  height;
  isStuck;

  /**
   * Retrieves the current peeking translation value from the document CSS variable.
   *
   * @private
   * @returns {number} The transform value in pixels (without 'px').
   */
  #getCurrentTransform() {
    const valueString = document.documentElement.style.getPropertyValue('--sticky-stacky-transform');
    return Number(valueString.slice(0, -2)); // slice removes the 'px' from the value.
  }

  /**
   * Recalculates stuck status and updates the `--sticky-container-height` CSS variable on the container.
   *
   * @returns {void}
   */
  update() {
    /* 
      Determine if the bar should be stuck by comparing the (scroll position 
      of page) + (how much the stack is peeking) to the top of the .sticky-container element.
    */
    this.isStuck = window.pageYOffset + (this.#previousHeights + this.#getCurrentTransform()) > this.top;

    // add/remove .fixed class based on stuck status.
    if (this.isStuck) {
      this.stickyElement.classList.add('fixed');
    } else {
      this.stickyElement.classList.remove('fixed');
    }

    // update top value, height value, and set the container height CSS variable.
    this.top = window.pageYOffset + this.#containerElement.getBoundingClientRect().top;
    this.height = this.stickyElement.offsetHeight;
    this.#containerElement.style.setProperty('--sticky-container-height', `${this.height}px`);
  }

  /**
   * Sets the accumulated previous heights as a CSS custom property on the container element.
   * Note: this value will be different for each StickyStack instance.
   * It's the sum of the heights of the StickyStacks earlier in the DOM.
   *
   * @param {number} heights - The accumulated height of prior sticky elements in pixels.
   * @returns {void}
   */
  setPreviousHeights(heights) {
    this.#previousHeights = heights;
    this.#containerElement.style.setProperty('--previous-heights', `${heights}px`);
  }

  /**
   * Creates an instance of StickyStacky.
   *
   * @param {HTMLElement} containerElement - The container DOM element with class `.sticky-container`.
   */
  constructor(containerElement) {
    this.#containerElement = containerElement;
    this.#previousHeights = 0;
    this.stickyElement = this.#containerElement.querySelector('.sticky-stacky');
    this.top = window.pageYOffset + this.#containerElement.getBoundingClientRect().top;
    this.height = this.stickyElement.offsetHeight;
    this.isStuck = false;
  }
}

/**
 * Class representing the global controller for StickyStacky elements on the page.
 * Manages scroll tracking, z-indices, stacking order, and accumulated offsets.
 */
class StickyController {
  #scrollHeight;
  #transformTop;
  #maxTransform;
  #stickyStacks;

  /**
   * Filters all managed StickyStacky instances to return only those currently stuck.
   *
   * @private
   * @returns {Array<StickyStacky>} Array of stuck StickyStacky instances.
   */
  #getStuckStacks() {
    return this.#stickyStacks.filter((stickyStack) => stickyStack.isStuck);
  }

  /**
   * Takes the StickyStacks that are stuck (isStuck === true), then
   * sorts them by visual order on the page. Finally, loops over
   * them to set the previous height for each stuck stack.
   *
   * @private
   * @returns {void}
   */
  #calculateMaxTransform() {
    let height = 0;
    const stuckStacks = this.#getStuckStacks()
      .sort((stackA, stackB) => (stackA.top < stackB.top ? -1 : 1));
    
    stuckStacks.forEach((stuckStack, index) => {
      if (index === stuckStacks.length - 1) { 
        // last stuck element gets the shadow
        this.#maxTransform = 0 - height; // set global variable. Must be a negative number.
        // stuckStack.stickyElement.classList.add('shadow');
      } else {
        // other stuck elements lose the shadow
        // stuckStack.stickyElement.classList.remove('shadow');
      }
      // accumulate heights and set them, just like in recalculateHeights()
      stuckStack.setPreviousHeights(height);
      height += stuckStack.height;
    });
  }

  /**
   * Loops through all StickyStacks, accumulates their heights,
   * and updates each instance's previous height value.
   *
   * @private
   * @returns {void}
   */
  #recalculateHeights() {
    let height = 0;
    this.#stickyStacks.forEach((stickyStack) => {
      stickyStack.update();
      stickyStack.setPreviousHeights(height);
      height += stickyStack.height;
    });
  }

  /**
   * [Critical function] Calculates the scroll direction and adjusts
   * the sticky stack peeking depth.
   *
   * @private
   * @returns {void}
   */
  #update() {
    this.#calculateMaxTransform(); // sets maxTransform value.

    // Don't make any changes if the scroll depth hasn't changed.
    if (this.#scrollHeight !== window.pageYOffset) { 
      // determine the scroll depth difference
      const diff = this.#scrollHeight - window.pageYOffset; 
      // set global variable value for next time. Effectively caching the current value for later.
      this.#scrollHeight = window.pageYOffset; 
      // calculate the peeking depth. It cannot be greater than zero or less than the maxTransform
      this.#transformTop = Math.max(Math.min(this.#transformTop + diff, 0), this.#maxTransform);
      // set the peeking depth in the CSS variable
      document.documentElement.style.setProperty('--sticky-stacky-transform', `${this.#transformTop}px`);
    }

    this.#recalculateHeights(); // update the StickyStack height and previousHeights again
  }

  /**
   * Creates an instance of StickyController.
   *
   * @param {NodeList|Array<HTMLElement>} containerNodeList - List of `.sticky-container` elements.
   */
  constructor(containerNodeList) {
    /* 
      Since the querySelectorAll function returns NodeLists,
      convert this to an Array so we can use .map and .forEach on it.
    */
    const containerArray = Array.from(containerNodeList);
    this.#scrollHeight = 0;
    this.#transformTop = 0;
    this.#maxTransform = 0;

    /*
      Sort the sticky stack elements in visual order from top to bottom.
    */
    this.#stickyStacks = containerArray
      .map((containerElement) => new StickyStacky(containerElement))
      .sort((stackA, stackB) => (stackA.top < stackB.top ? -1 : 1));

    /*
      Set incrementally higher z-index values to ensure the 
      shadows cascade without overlapping
    */
    this.#stickyStacks.forEach((stack, index) => {
      stack.stickyElement.style.zIndex = 10000 + index;
    });

    /*
      Update _AFTER_ the scroll event fires. I tried using other kinds of run loops,
      but this one performs the best without odd delayed overlaps.
      Do not debounce.
    */
    window.addEventListener('scroll', this.#update.bind(this));

    /*
      Running this twice at the beginning with these spaces seems to work well.
    */
    setTimeout(this.#update.bind(this), 0);
    setTimeout(this.#update.bind(this), 100);
  }
}

/**
 * Initializes sticky stack controller on all `.sticky-container` elements found in the document.
 *
 * @returns {void}
 */
module.exports.init = () => {
  /* get all of the .sticky-container elements on the page */
  const stickyContainers = document.querySelectorAll('.sticky-container');

  /*
    Instantiating a StickyController class with the stickyContainers
    triggers the calculation and update of all sticky stacky elements
  */
  new StickyController(stickyContainers);
};
