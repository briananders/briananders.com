(function mandelbrot() {
  const canvas = document.querySelector('canvas');
  const context = canvas.getContext('2d');
  const buttons = document.querySelectorAll('button');

  let magnification = 400;
  let panX = 1.85;
  let panY = 1.25;

  // Create Canvas
  canvas.width = 1000;
  canvas.height = 1000;

  let mouseOverCanvas = false;

  function belongsToMandelbrotSet(x, y) {
    let realComponentOfResult = x;
    let imaginaryComponentOfResult = y;
    const maxIterations = 100;
    for (let i = 0; i < maxIterations; i++) {
      const tempRealComponent = (
        (realComponentOfResult * realComponentOfResult)
        - (imaginaryComponentOfResult * imaginaryComponentOfResult)
      ) + x;
      const tempImaginaryComponent = (
        (2 * realComponentOfResult)
        * imaginaryComponentOfResult
      ) + y;
      realComponentOfResult = tempRealComponent;
      imaginaryComponentOfResult = tempImaginaryComponent;

      // Return a number as a percentage
      if (realComponentOfResult * imaginaryComponentOfResult > 5) {
        return ((i / maxIterations) * 100);
      }
    }
    return 0; // Return zero if in set
  }

  function draw() {
    console.info({
      magnification,
      panX,
      panY,
    });
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        const belongsToSet =
          belongsToMandelbrotSet(
            (x / magnification) - panX,
            (y / magnification) - panY
          );
        if (belongsToSet) {
          context.fillStyle = `rgb(${255 - belongsToSet * 5}, ${255 - belongsToSet * 5}, ${255 - belongsToSet * 5})`;
          context.fillRect(x, y, 1, 1); // Draw a black pixel
        } else {
          context.fillStyle = `rgb(0, 0, 0)`;
          context.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  function panChange() {
    return (50 / magnification);
  }

  function panRight() {
    panX -= panChange();
  }
  function panLeft() {
    panX += panChange();
  }
  function panUp() {
    panY += panChange();
  }
  function panDown() {
    panY -= panChange();
  }
  function zoomIn() {
    magnification += magnification / 5;
  }
  function zoomOut() {
    magnification -= magnification / 6;
  }

  buttons.forEach((button) => {
    button.addEventListener('click', ({ target }) => {
      switch (target.value) {
        case '+1':
          zoomIn();
          panRight();
          panDown();
          break;
        case '-1':
          zoomOut();
          panLeft();
          panUp();
          break;
        case 'up':
          panUp()
          break;
        case 'down':
          panDown();
          break;
        case 'left':
          panLeft();
          break;
        case 'right':
          panRight();
          break;
        default:
          return;
      }
      draw();
    });
  });

  document.addEventListener('keydown', (evt) => {
    switch (evt.keyCode) {
      case 38: // up
        evt.preventDefault();
        panUp();
        break;
      case 40: // down
        evt.preventDefault();
        panDown();
        break;
      case 37: // left
        evt.preventDefault();
        panLeft();
        break;
      case 39: // right
        evt.preventDefault();
        panRight();
        break;
      case 187: // plus
        evt.preventDefault();
        zoomIn();
        break;
      case 189: // plus
        evt.preventDefault();
        zoomOut();
        break;
      default:
        console.log(evt.keyCode);
        return;
    }
    draw();
  });

  // canvas.addEventListener('mouseover', () => {
  //   mouseOverCanvas = true;
  //   document.documentElement.style.overflow = 'hidden';
  //   console.info({ mouseOverCanvas });
  // });

  // canvas.addEventListener('mouseout', () => {
  //   mouseOverCanvas = false;
  //   document.documentElement.style.overflow = '';
  //   console.info({ mouseOverCanvas });
  // });

  // document.addEventListener('scroll', (evt) => {
  //   console.log(evt.eventPhase);
  //   if (mouseOverCanvas) {
  //     evt.preventDefault();
  //   }
  // });

  draw();
}());
