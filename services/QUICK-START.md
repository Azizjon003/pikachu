# Image Replacer - Quick Start Guide

## Installation

No additional installation needed! The service uses existing dependencies.

## Usage

### 1. Replace All Edited Images (Recommended)

```bash
npm run test:image-replacer
```

This will:
- Find all images with `isEdited: true`
- Generate smart search keywords from slide content
- Download relevant images from Bing
- Update your schema file

### 2. Replace a Single Image

```bash
npm run test:image-replacer:single
```

Or programmatically:

```typescript
import ImageReplacerService from './services/image-replacer';

const replacer = new ImageReplacerService();
await replacer.replaceImageByIndex(10, 0, 'brain tumor medical');
```

### 3. Test Mode (See what would happen)

```bash
npm run test:image-replacer:keywords
```

## Quick Example

```typescript
import ImageReplacerService from './services/image-replacer';

// Create service instance
const replacer = new ImageReplacerService();

// Replace all edited images
const results = await replacer.replaceEditedImages();

// Check results
console.log(`✓ Replaced ${results.successful} images`);
console.log(`✗ Failed ${results.failed} images`);
```

## Expected Output

```
=== Starting Image Replacement Process ===
[INFO] Reading schema file...
[INFO] Found 1 image(s) marked as edited

--- Processing image 1/1 ---
[INFO] Slide: 10, Element: 0
[INFO] Generated keyword: "nervous system tumor brain medical"
[🔎] Fetching page 1
[INFO] Found 5 images, attempting to download...
[INFO] Downloading image from: https://...
[SUCCESS] Image saved to: ./images/slide9_img85.png
[SUCCESS] Successfully replaced image 1/1

=== Replacement Summary ===
[INFO] Total images: 1
[SUCCESS] Successful: 1
[INFO] Failed: 0
```

## Important Notes

1. **Backup**: Schema is automatically updated, but keep a backup:
   ```bash
   cp Amir.sxema.json Amir.sxema.json.backup
   ```

2. **Internet Required**: Service downloads images from Bing

3. **Review Images**: Check downloaded images for quality/relevance

4. **Custom Keywords**: For better results, use specific medical terms:
   ```typescript
   replacer.replaceImageByIndex(10, 0, 'glioblastoma MRI scan');
   ```

## Files Modified

- `Amir.sxema.json` - Image paths updated, `isEdited` flags removed
- `./images/` - New images downloaded here

## Troubleshooting

**No images found?**
→ Check internet connection

**Download fails?**
→ Try again or use custom keywords

**Poor quality images?**
→ Manually replace or use more specific keywords

## Next Steps

1. Run `npm run test:image-replacer`
2. Review downloaded images in `./images/`
3. If needed, replace specific images with custom keywords
4. Generate your final PowerPoint

## Full Documentation

See `README.md` for complete API documentation and advanced usage.
