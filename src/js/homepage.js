const itemApi = require('./_modules/last-fm/item-api');
const ready = require('./_modules/document-ready');

ready.document(() => {
  itemApi.init({
    count: 4,
    description: false,
    method: 'user.gettopalbums',
    scope: '.last-fm-module[data-type=albums]',
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
          imageSrc: item.albumImage ? `/last-fm-history/images/${item.albumImage}.webp` : (data.defaultImage || null),
        };
      }).filter(Boolean);
    },
  });
});
