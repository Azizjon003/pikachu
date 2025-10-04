# Image Replacer Service

Automatically replaces images marked as `isEdited: true` in the presentation schema by searching for relevant images online.

## Features

- Automatically detects images marked for replacement (`isEdited: true`)
- Generates intelligent search keywords based on slide content
- Searches for images using Bing Image Search
- Downloads and saves images to the local filesystem
- Updates the schema with new image paths
- Comprehensive error handling and logging
- Support for replacing individual images

## Installation

The service uses existing dependencies:
- `axios` - for HTTP requests and image downloads
- `fs/promises` - for file system operations
- `./image.search` - BingLinks class for image searching

## Usage

### Basic Usage - Replace All Edited Images

```typescript
import ImageReplacerService from './services/image-replacer';

const replacer = new ImageReplacerService(
  './Amir.sxema.json',  // Path to schema file
  './images',            // Image output directory
  true                   // Verbose logging
);

const results = await replacer.replaceEditedImages();

console.log(`Replaced ${results.successful}/${results.total} images`);
```

### Replace a Single Image

```typescript
import ImageReplacerService from './services/image-replacer';

const replacer = new ImageReplacerService();

// Replace image on slide 10, element index 0
const success = await replacer.replaceImageByIndex(
  10,                              // Slide number
  0,                               // Element index
  'brain tumor medical imaging'    // Optional custom keyword
);
```

### Run Tests

```bash
# Replace all edited images
npm run test:image-replacer

# Replace a single image
ts-node testImageReplacer.ts single

# Test keyword generation
ts-node testImageReplacer.ts keywords
```

## How It Works

### 1. Image Detection

The service scans the schema file for images with `isEdited: true`:

```json
{
  "type": "image",
  "src": "./images/slide9_img85.png",
  "hasImage": true,
  "isEdited": true,
  "elementIndex": 0
}
```

### 2. Context Extraction

For each edited image, the service extracts text content from the same slide:
- Shape elements with text content
- Table data cells
- Other text-containing elements

### 3. Keyword Generation

The service generates search keywords using:

1. **Medical/Scientific Terms**: Detects domain-specific keywords
   - Example: "tumor", "nervous system", "brain", "glioma"

2. **Slide Content**: Uses actual slide text
   - Title text, headings, body content

3. **Fallback**: Generic keywords if no specific terms found
   - Uses first meaningful words from slide content

### 4. Image Search

Uses BingLinks to search for images:
- Searches with generated keywords
- Retrieves multiple results as fallbacks
- Filters adult content

### 5. Image Download

- Downloads the first available image
- Falls back to subsequent results if download fails
- Saves with consistent naming: `slide{index}_img{elementIndex}.png`

### 6. Schema Update

- Updates the image `src` path in the schema
- Removes the `isEdited` flag
- Saves the updated schema file

## API Reference

### Constructor

```typescript
new ImageReplacerService(
  schemaPath?: string,    // Default: './Amir.sxema.json'
  imageBaseDir?: string,  // Default: './images'
  verbose?: boolean       // Default: true
)
```

### Methods

#### `replaceEditedImages()`

Replaces all images marked as edited in the schema.

**Returns:**
```typescript
{
  total: number;        // Total images found
  successful: number;   // Successfully replaced
  failed: number;       // Failed replacements
  errors: string[];     // Error messages
}
```

#### `replaceImageByIndex(slideNumber, elementIndex, customKeyword?)`

Replaces a single image by its location.

**Parameters:**
- `slideNumber: number` - The slide number (1-based)
- `elementIndex: number` - The element index on the slide
- `customKeyword?: string` - Optional custom search keyword

**Returns:** `Promise<boolean>` - Success status

## Configuration

### Search Settings

Modify the BingLinks configuration in `searchAndDownloadImage()`:

```typescript
const bingSearch = new BingLinks(
  keyword,
  5,        // Number of results to fetch
  'off',    // Adult content filter
  10,       // Timeout in seconds
  '',       // Image filter (e.g., 'photo', 'clipart')
  [],       // Blocked sites
  true      // Verbose mode
);
```

### Medical Terms Dictionary

Add more domain-specific terms in `generateSearchKeyword()`:

```typescript
const medicalTerms = [
  'tumor', 'nervous system', 'brain',
  // Add more terms here
];
```

## Error Handling

The service handles various error scenarios:

- **Schema read/write errors**: File system issues
- **Network errors**: Connection timeouts, failed downloads
- **Search failures**: No results found
- **Invalid paths**: Missing directories or files

All errors are logged and included in the results summary.

## Example Output

```
=== Starting Image Replacement Process ===
[INFO] Reading schema file...
[INFO] Found 1 image(s) marked as edited

--- Processing image 1/1 ---
[INFO] Slide: 10, Element: 0
[INFO] Slide context: Write a main idea here Lorem ipsum...
[INFO] Generated keyword from content: "nervous system tumor brain medical"
[🔎] Fetching page 1
[INFO] Found 5 images, attempting to download...
[INFO] Downloading image from: https://example.com/brain-tumor.jpg
[SUCCESS] Image saved to: C:\...\images\slide9_img85.png
[SUCCESS] Successfully replaced image 1/1

[INFO] Saving updated schema...
[SUCCESS] Schema updated successfully

=== Replacement Summary ===
[INFO] Total images: 1
[SUCCESS] Successful: 1
[INFO] Failed: 0
```

## Schema Structure

The service expects slides in this format:

```typescript
interface Slide {
  id: string;
  index: number;
  slide: number;
  elements: Array<ImageElement | ShapeElement | TableElement>;
  note: string;
}
```

## Best Practices

1. **Backup Schema**: Always backup your schema file before running replacements
2. **Custom Keywords**: Use custom keywords for specific or technical topics
3. **Verbose Mode**: Enable verbose logging during development/testing
4. **Error Review**: Check the errors array in results for failed replacements
5. **Image Quality**: Review downloaded images and manually replace if needed

## Troubleshooting

### No images found
- Check internet connection
- Try more specific or generic keywords
- Review slide content for keyword generation

### Download failures
- Network connectivity issues
- Image URL no longer available
- Increase timeout settings

### Schema not updating
- Check file permissions
- Verify schema path is correct
- Ensure valid JSON format

## Future Enhancements

Potential improvements:
- Support for multiple image search providers
- Image quality/resolution filtering
- Batch processing with progress indicators
- Custom keyword templates per slide type
- Image similarity comparison
- Automatic retry with fallback keywords

## License

Part of the Pikachu presentation generation system.
