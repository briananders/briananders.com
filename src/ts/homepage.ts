const itemApi = require('./_modules/last-fm/item-api.ts');
const ready = require('./_modules/document-ready.ts');
require('./_components/album-listing.ts').init();

interface RawAlbumEntry {
  artist?: string;
  album?: string;
  count?: number;
  albumImage?: string;
}

interface AlbumReportPayload {
  albums?: Array<RawAlbumEntry | null>;
  defaultImage?: string | null;
}

interface SerializedAlbumItem {
  name: string;
  artist: { name: string };
  playcount: number;
  url: string;
  imageSrc: string | null;
  max?: number;
}

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
     * @param {AlbumReportPayload | null} data - Raw report JSON data containing album entries.
     * @returns {SerializedAlbumItem[]} List of formatted album item objects.
     */
    customSerialize(data: AlbumReportPayload | null): SerializedAlbumItem[] {
      if (!data || !data.albums) return [];
      const serialized: SerializedAlbumItem[] = [];
      data.albums.forEach((item) => {
        if (!item) return;
        const artistName = item.artist || '';
        const albumName = item.album || '';
        serialized.push({
          name: albumName,
          artist: { name: artistName },
          playcount: item.count || 0,
          url: `https://www.last.fm/music/${encodeURIComponent(artistName)}/${encodeURIComponent(albumName)}`,
          imageSrc: item.albumImage ? `/last-fm-history/images/${item.albumImage}` : (data.defaultImage || null),
        });
      });
      return serialized;
    },

    /**
     * Renders custom `<album-listing>` elements for each album into the target container.
     *
     * @param {SerializedAlbumItem[]} items - Serialized album data items.
     * @param {HTMLElement} container - DOM container element.
     * @returns {void}
     */
    renderItems(items: SerializedAlbumItem[], container: HTMLElement): void {
      items.forEach((item) => {
        const el = document.createElement('album-listing');
        el.innerHTML = item.name;
        el.setAttribute('name', item.name);
        el.setAttribute('artist', item.artist.name);
        el.setAttribute('count', String(item.playcount));
        el.setAttribute('max', String(item.max ?? 0));
        if (item.imageSrc) el.setAttribute('img', item.imageSrc);
        container.appendChild(el);
      });
    },
  });
});
