const ready = require('../_modules/document-ready');

ready.document(() => {
  const lipsum = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Vivamus tincidunt, felis mollis placerat finibus, ligula erat feugiat leo, ac cursus arcu velit vel lacus.',
    'Morbi felis lorem, viverra eu nunc sed, dignissim ornare lorem.',
    'Suspendisse nec est nec ipsum faucibus sagittis ut non neque.',
    'Mauris luctus laoreet turpis ac blandit.',
    'Sed nec nunc consectetur, tempor felis ut, tincidunt tortor.',
    'In venenatis leo sed ante ullamcorper, sit amet ultricies nulla condimentum.',
    'Quisque quis hendrerit massa, sed consequat lorem.',
    'Etiam interdum mattis tincidunt.',
    'Nulla pulvinar enim in rhoncus posuere.',
    'Aenean porttitor finibus diam, in iaculis lacus.',
    'Sed consectetur iaculis scelerisque.',
    'Cras non nulla tincidunt sapien dapibus rhoncus vel condimentum arcu.',
    'Vivamus interdum maximus augue et tincidunt.',
    'Etiam mollis arcu augue, a elementum elit iaculis nec.',
    'Curabitur purus elit, eleifend in fermentum quis, imperdiet a purus.',
    'Integer dignissim sollicitudin dolor, varius sollicitudin ligula varius nec.',
    'Aliquam quis pharetra sem, condimentum cursus nisi.',
    'Suspendisse nibh turpis, volutpat in interdum at, pulvinar ut tortor.',
    'Fusce est sapien, tempus in ex at, molestie feugiat odio.',
    'Pellentesque sit amet nulla odio.'
  ];

  const buttons = document.querySelectorAll('.button');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      button.previousElementSibling.innerText += ` ${lipsum[Math.floor(Math.random() * lipsum.length)]}`;
    });
  });
});
