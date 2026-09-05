/**
 * Supported file-format lists used by the asset pipeline.
 *
 * These arrays drive glob patterns so the build knows which files to copy,
 * hash, and convert. Keeping them centralised means adding a new format
 * only requires a change here.
 */
module.exports = {
  /**
   * Image file extensions that are copied (or optimised) into the output directory.
   * SVGs are optimised via SVGO; raster formats are copied as-is and also
   * converted to WebP and AVIF when they are conversion sources.
   */
  images: ['svg', 'jpg', 'jpeg', 'webp', 'avif', 'png'],

  /**
   * Video file extensions copied into the output directory.
   */
  videos: ['webm', 'mp4'],

  /**
   * Raster formats understood by the image pipeline. Every raster source is
   * copied to the output and the missing WebP/AVIF siblings are generated.
   */
  rasterImages: ['jpg', 'jpeg', 'png', 'webp', 'avif'],

  /** Raster source formats that are preferred over derived formats. */
  rasterSourceImages: ['jpg', 'jpeg', 'png'],
};
