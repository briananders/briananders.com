/**
 * class StickyStacky element controller
 */
class StickyStacky {
  #previousHeights;
  #containerElement;
  stickyElement;
  top;
  height;
  isStuck;

  /*
    Simply get the peeking value stored in the CSS variable
  */
  #getCurrentTransform() {
    const valueString = document.documentElement.style.getPropertyValue('--sticky-stacky-transform');
    return Number(valueString.slice(0, -2)); // slice removes the 'px' from the value.
  }

  /*
    Recalculates the sticky-container-height CSS variable
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

  /*
    Take the `heights` parameter and set it as a CSS variable.
    Note: this value will be different for each StickyStack instance. 
      It's the sum of the heights of the StickyStacks earlier in the DOM.
  */
  setPreviousHeights(heights) {
    this.#previousHeights = heights;
    this.#containerElement.style.setProperty('--previous-heights', `${heights}px`);
  }

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
 * class StickyController global controller for StickyStacky elements
 */
class StickyController {
  #scrollHeight;
  #transformTop;
  #maxTransform;
  #stickyStacks;

  /*
    Simply filter the stuck StickyStacks (isStuck === true) from all StickyStacks
  */
  #getStuckStacks() {
    return this.#stickyStacks.filter((stickyStack) => stickyStack.isStuck);
  }

  /*
    Take the StickyStacks that are stuck (isStuck === true), then
    sort them by visual order on the page. Finally, loop over
    them to apply the shadows appropriately, and set the previous 
    height for each stuck stack.
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

  /*
    Loop through the StickyStacks, accumulate the heights of each
    StickyStack and pass those previous height sums into the StickyStacks
  */
  #recalculateHeights() {
    let height = 0;
    this.#stickyStacks.forEach((stickyStack) => {
      stickyStack.update();
      stickyStack.setPreviousHeights(height);
      height += stickyStack.height;
    });
  }

  /*
    [Critical function] Calculates the scroll directin and adjusts
    the sticky stack peeking depth.
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





/*
  Module initializer function.
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
