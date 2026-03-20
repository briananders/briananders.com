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
   * converted to WebP if they appear in `webpCandidates`.
   */
  images: ['svg', 'jpg', 'jpeg', 'webp', 'png'],

  /**
   * Video file extensions copied into the output directory.
   */
  videos: ['webm', 'mp4'],

  /**
   * Raster image formats that should also be converted to a `.webp` sibling.
   * The original file is kept alongside the new WebP version so browsers
   * without WebP support can fall back to it.
   */
  webpCandidates: ['jpg', 'png', 'jpeg'],
};
