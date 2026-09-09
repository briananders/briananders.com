const itemApi = require('./_modules/last-fm/item-api');
const ready = require('./_modules/document-ready');
require('./_components/album-listing').init();

/**
 * Initializes the Last.fm top albums module on the homepage when the DOM is ready.
 */
ready.document(() => {
  itemApi.init({
    count: 4,
    scope: '.last-fm-module[data-type=albums]',

    /**
     * Serializes raw album data into structured objects for rendering.
     *
     * @param {Object} data - Raw report JSON data containing album entries.
     * @returns {Array<Object>} List of formatted album item objects.
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
     * Renders custom `<album-listing>` elements for each album into the target container.
     *
     * @param {Array<Object>} items - Serialized album data items.
     * @param {HTMLElement} container - DOM container element.
     * @returns {void}
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
