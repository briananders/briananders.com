const ready = require('../_modules/document-ready');

function getData(year, callback) {
  const request = new XMLHttpRequest();
  const url = `/data/last-fm/${year}.json`;
  request.open('GET', url, true);

  request.onload = () => {
    if (request.status >= 200 && request.status < 400) {
      // Success!
      const data = JSON.parse(request.response);
      if (callback) callback(data);
    } else {
      // We reached our target server, but it returned an error
      // log(`${url} returned ${request.status}`);
    }
  };

  request.onerror = () => {
    // There was a connection error of some sort
  };

  request.send();
}

ready.document(() => {
  require('../_components/album-listing').init();
  require('../_components/artist-listing').init();
  require('../_components/year-listing').init();
  require('../_components/year-selector').init();
  const yearSelector = document.getElementById('year-selector');
  const albumsElement = document.getElementById('albums');
  const artistsElement = document.getElementById('artists');

  function selectorChanged() {
    const year = yearSelector.getAttribute('value');

    getData(year, (data) => {
      const sortedAlbums = data.albums.sort((a, b) => { a.count > b.count ? -1 : 1; });
      const sortedArtists = data.artists.sort((a, b) => { a.count > b.count ? -1 : 1; });
      const maxAlbum = sortedAlbums.at(0).count;
      const maxArtist = sortedArtists.at(0).count;

      for (let i = 0; i < 10; i++) {
        const album = sortedAlbums.at(i);
        const artist = sortedArtists.at(i);
        const albumElement = Array.from(albumsElement.children).at(i);
        const artistElement = Array.from(artistsElement.children).at(i);

        albumElement.setAttribute('name', album.name);
        albumElement.setAttribute('artist', album.artist);
        albumElement.setAttribute('count', album.count);
        albumElement.setAttribute('max', maxAlbum);
        albumElement.setAttribute('img', album.img);
        albumElement.innerText = album.name;

        artistElement.setAttribute('name', artist.name);
        artistElement.setAttribute('count', artist.count);
        artistElement.setAttribute('max', maxArtist);
        artistElement.setAttribute('img', artist.img);
        artistElement.innerText = artist.name;
      }

      document.querySelector('.more.albums').setAttribute('href', data.sources.album);
      document.querySelector('.more.artists').setAttribute('href', data.sources.artist);
    });
  }

  function initEventListeners() {
    yearSelector.addEventListener('change', selectorChanged);
  }

  initEventListeners();
  selectorChanged();
});
