const ready = require('../_modules/document-ready');
require('../_components/album-listing').init();
require('../_components/artist-listing').init();
require('../_components/year-listing').init();

// const reportsDirUrl = 'http://staging.briananders.com.s3-website-us-east-1.amazonaws.com/last-fm-history/reports/';
const reportsDirUrl = '/last-fm-history/reports/';
const imageUrl = '/last-fm-history/images/';
const imageExtensions = ['jpg', 'avif', 'png', 'gif', 'webp'];
const LIST_LENGTH = 20;

let reportsData;
let typeSelector;
let selectorContainer;
let artistsContainer;
let albumsContainer;
let yearContainer;

function formatNumber(number) {
  return number.toLocaleString();
}

function getImageUrl(name, extension) {
  return `${imageUrl}${name}.${extension}`;
}

function getImage(name) {
  const imageElement = document.createElement('img');
  imageElement.setAttribute('src', getImageUrl(name, 'avif'));
  return imageElement;
}

function getData(fileName, callback) {
  const request = new XMLHttpRequest();
  const url = `${reportsDirUrl}${fileName}`;

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

function initSelects() {
  Object.keys(reportsData).forEach((type) => {
    if (type === 'all-time') {
      typeSelector.innerHTML += `<option selected value="${type}">${type}</option>`;
    } else {
      typeSelector.innerHTML += `<option value="${type}">${type} - ${reportsData[type].length}</option>`;
    }
  });
  typeSelector.addEventListener('change', updateSelects.bind(this));
  updateSelects();
}

function updateSelects() {
  const type = typeSelector.value;
  const reports = reportsData[type].sort((a,b) => a.label > b.label);
  let select;

  if (selectorContainer.dataset.type !== type) {
    selectorContainer.dataset.type = type;
    selectorContainer.innerHTML = '';

    if (type !== 'all-time') {
      select = document.createElement('select');
      select.setAttribute('name', type);

      reports.forEach((report, index) => {
        console.log(report);
        const option = document.createElement('option');
        option.value = report.filename;
        if (index === 0) {
          option.selected = 'selected';
          selectorContainer.dataset.filename = report.filename;
        }
        option.innerHTML = report.label;
        select.appendChild(option);
      });

      select.addEventListener('change', updateSelects.bind(this));
      selectorContainer.appendChild(select);
    } else {
      renderReport('all_time.json');
      return;
    }
  } else {
    select = selectorContainer.querySelector(`select[name=${type}]`);
  }

  renderReport(select.value);
}

function renderReport(fileName) {
  getData(fileName, (data) => {

    artistsContainer.innerHTML = '';
    albumsContainer.innerHTML = '';

    const artistMax = Math.max(...data.artists.map((artist) => Number(artist.count)).sort((a,b) => a > b));
    const albumMax = Math.max(...data.albums.map(album => Number(album.count)).sort((a,b) => a > b));

    data.artists.forEach((artist, index) => {
      if (index >= LIST_LENGTH) return;

      const artistElement = document.createElement('artist-listing');
      // ['name', 'count', 'max', 'img'];

      artistElement.innerHTML = artist.name;
      artistElement.setAttribute('name', artist.name);
      artistElement.setAttribute('count', artist.count);
      artistElement.setAttribute('img', getImageUrl(artist.image, 'avif'));
      artistElement.setAttribute('max', artistMax);

      artistsContainer.appendChild(artistElement);
    });

    data.albums.forEach((album, index) => {
      if (index >= LIST_LENGTH) return;

      const albumElement = document.createElement('album-listing');
      // ['name', 'artist', 'count', 'max', 'img'];

      albumElement.innerHTML = album.album;
      albumElement.setAttribute('name', album.album);
      albumElement.setAttribute('artist', album.artist);
      albumElement.setAttribute('count', album.count);
      albumElement.setAttribute('max', albumMax);
      albumElement.setAttribute('img', getImageUrl(album.albumImage, 'avif'));

      albumsContainer.appendChild(albumElement);
    });
  });
}

ready.document(() => {
  typeSelector = document.getElementById('type-selector');
  selectorContainer = document.getElementById('selector-container');
  artistsContainer = document.getElementById('artists');
  albumsContainer = document.getElementById('albums');
  yearContainer = document.getElementById('yearly-scrobbles');

  getData('index.json', (data) => {
    reportsData = data.reports;
    initSelects();
  });

  getData('year_totals.json', (data) => {
    const years = data.years.sort((a,b) => a.year > b.year);
    const yearMax = Math.max(...years.map(year => Number(year.total)));

    years.forEach((year) => {
      const yearElement = document.createElement('year-listing');
      // ["year", "value", "maximum"];

      yearElement.innerHTML = formatNumber(year.total);
      yearElement.setAttribute('year', year.year);
      yearElement.setAttribute('value', year.total);
      yearElement.setAttribute('maximum', yearMax);
      yearContainer.appendChild(yearElement);
    });
  });
});
