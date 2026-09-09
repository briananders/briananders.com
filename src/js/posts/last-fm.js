const itemApi = require('../_modules/last-fm/item-api');
const ready = require('../_modules/document-ready');
require('../_components/last-updated').init();
require('../_components/album-listing').init();
require('../_components/artist-listing').init();

/**
 * Initializes the Last.fm top artists and top albums API modules on DOM ready.
 */
ready.document(() => {
  itemApi.init({
    count: 10,
    scope: '.last-fm-module[data-type=artists]',
    /**
     * Serializes artist response data into normalized item objects.
     *
     * @param {Object} data - Raw artist data object.
     * @param {Array<Object>} [data.artists] - List of artist objects.
     * @returns {Array<Object>} Normalized list of artist view objects.
     */
    customSerialize(data) {
      if (!data || !data.artists) return [];
      return data.artists.map((item) => {
        if (!item) return null;
        const name = item.name || '';
        return {
          name,
          playcount: item.count || 0,
          url: `https://www.last.fm/music/${encodeURIComponent(name)}`,
          imageSrc: item.image ? `/last-fm-history/images/${item.image}` : null,
        };
      }).filter(Boolean);
    },
    /**
     * Renders artist list elements into the specified container.
     *
     * @param {Array<Object>} items - Serialized artist objects.
     * @param {HTMLElement} container - DOM element to receive artist-listing tags.
     */
    renderItems(items, container) {
      items.forEach((item) => {
        const el = document.createElement('artist-listing');
        el.innerHTML = item.name;
        el.setAttribute('name', item.name);
        el.setAttribute('count', item.playcount);
        el.setAttribute('max', item.max);
        if (item.imageSrc) el.setAttribute('img', item.imageSrc);
        container.appendChild(el);
      });
    },
  });

  itemApi.init({
    count: 10,
    scope: '.last-fm-module[data-type=albums]',
    /**
     * Serializes album response data into normalized item objects.
     *
     * @param {Object} data - Raw album data object.
     * @param {Array<Object>} [data.albums] - List of album objects.
     * @param {string} [data.defaultImage] - Fallback image path.
     * @returns {Array<Object>} Normalized list of album view objects.
     */
    customSerialize(data) {
      if (!data || !data.albums) return [];
      return data.albums.map((item) => {
        if (!item) return null;
        const artistName = item.artist || '';
        const albumName = item.album || '';
        return {
          name: albumName,
          artist: { name: artistName },
          playcount: item.count || 0,
          url: `https://www.last.fm/music/${encodeURIComponent(artistName)}/${encodeURIComponent(albumName)}`,
          imageSrc: item.albumImage ? `/last-fm-history/images/${item.albumImage}` : (data.defaultImage || null),
        };
      }).filter(Boolean);
    },
    /**
     * Renders album list elements into the specified container.
     *
     * @param {Array<Object>} items - Serialized album objects.
     * @param {HTMLElement} container - DOM element to receive album-listing tags.
     */
    renderItems(items, container) {
      items.forEach((item) => {
        const el = document.createElement('album-listing');
        el.innerHTML = item.name;
        el.setAttribute('name', item.name);
        el.setAttribute('artist', item.artist.name);
        el.setAttribute('count', item.playcount);
        el.setAttribute('max', item.max);
        if (item.imageSrc) el.setAttribute('img', item.imageSrc);
        container.appendChild(el);
      });
    },
  });
});
