const fs = require('fs-extra');
const copy = require('copy');
const pngToIco = require('png-to-ico');

const BUILD_EVENTS = require('./constants/build-events');

const { log } = console;

function makeFaviconIco({ dir, timestamp }) {
  pngToIco(`${dir.src}images/favicon_base.png`)
    .then((buffer) => {
      fs.writeFileSync(`${dir.package}favicon.ico`, buffer);
      log(`${timestamp.stamp()} favicon.ico: ${'MOVED'.bold.green}`);
    })
    .catch(console.error);
}

module.exports = function moveImages({ dir, completionFlags, buildEvents }) {
  completionFlags.IMAGES_ARE_MOVED = false;
  completionFlags.VIDEOS_ARE_MOVED = false;

  const timestamp = require(`${dir.build}timestamp`);

  log(`${timestamp.stamp()} moveImages()`);
  log(`${timestamp.stamp()} moveVideos()`);
  log(`${timestamp.stamp()} moveTxt()`);

  // move images over
  fs.copy(`${dir.src}images/`, `${dir.package}images/`, (err) => {
    if (err) throw err;

    makeFaviconIco({ dir, timestamp })

    log(`${timestamp.stamp()} moveImages(): ${'DONE'.bold.green}`);
    completionFlags.IMAGES_ARE_MOVED = true;
    buildEvents.emit(BUILD_EVENTS.imagesMoved);
  });

  // move videos over
  fs.copy(`${dir.src}videos/`, `${dir.package}videos/`, (err) => {
    if (err) throw err;
    log(`${timestamp.stamp()} moveVideos(): ${'DONE'.bold.green}`);
    completionFlags.VIDEOS_ARE_MOVED = true;
    buildEvents.emit(BUILD_EVENTS.videosMoved);
  });

  // move humans and robots text files
  copy(`${dir.src}*.txt`, `${dir.package}`, (err) => {
    if (err) throw err;
    log(`${timestamp.stamp()} moveTxt(): ${'DONE'.bold.green}`);
  });

};
