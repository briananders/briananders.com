# Image Conversion Workflow

This project includes an automated GitHub Action that converts image files to modern formats (WebP and AVIF) and creates pull requests with the converted files.

## How it works

1. **Trigger**: The workflow runs on every push to any branch
2. **Detection**: Scans the `src/` directory for image files that can be converted
3. **Conversion**: Converts eligible images to both WebP and AVIF formats
4. **Pull Request**: Creates a new branch and opens a PR with the converted files

## Supported formats

### Input formats (converted from):
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif) - WebP only
- BMP (.bmp)
- TIFF (.tiff)

### Output formats (converted to):
- **WebP**: ~25-35% smaller than JPEG/PNG
- **AVIF**: ~50% smaller than JPEG/PNG

## Configuration

The conversion behavior is controlled by `build/constants/file-formats.js`:

```javascript
module.exports = {
  webpCandidates: ['jpg', 'png', 'jpeg'], // formats that will be converted
};
```

## Local testing

You can test the image conversion locally:

```bash
# Convert images in src directory
npm run convert:images

# Convert images in specific directory
node scripts/convert-images.js /path/to/images
```

## Workflow details

- **File**: `.github/workflows/convert-images.yml`
- **Script**: `scripts/convert-images.js`
- **Results**: `conversion-results.json` (created after conversion)

## Benefits

1. **Performance**: Smaller file sizes improve page load times
2. **Compatibility**: WebP has excellent browser support, AVIF is cutting-edge
3. **Automation**: No manual intervention required
4. **Safety**: Original files are preserved, new formats are additive

## Next steps after conversion

1. Review the converted files in the PR
2. Test the website with new image formats
3. Update HTML templates to use new formats with fallbacks:

```html
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="Description">
</picture>
```

4. Update build process to include new formats in the final output