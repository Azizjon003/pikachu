# Template Preview/Thumbnail Upload System - Testing Guide

## Overview

This system allows you to upload preview/thumbnail images for PowerPoint templates. The images are automatically resized, optimized, and served through the API.

## Features

- Upload preview images (JPG, PNG, WebP)
- Automatic image optimization with Sharp
- File size validation (max 5MB)
- Image resizing (max 800x600, maintains aspect ratio)
- Metadata tracking
- Integration with existing templates endpoint

## API Endpoints

### 1. Upload Preview Image

**Endpoint:** `POST /api/template/:templateName/preview`

**Description:** Upload a preview/thumbnail image for a specific template.

**Parameters:**
- `templateName` (URL parameter) - The name of the template (without .pptx extension)

**Body:**
- `preview` (file) - The image file to upload (form-data)

**Accepted File Types:**
- `image/jpeg`
- `image/jpg`
- `image/png`
- `image/webp`

**File Size Limit:** 5MB

**Response Success (200):**
```json
{
  "success": true,
  "previewUrl": "/templates/previews/template-name.jpg",
  "message": "Preview image uploaded successfully"
}
```

**Response Error (400):**
```json
{
  "success": false,
  "error": "No file uploaded"
}
```

**Response Error (500):**
```json
{
  "success": false,
  "error": "Image processing failed: [error details]"
}
```

### 2. Get All Templates (Updated)

**Endpoint:** `GET /api/template/templates`

**Description:** Get all available templates with their preview images.

**Response Success (200):**
```json
{
  "success": true,
  "templates": [
    {
      "name": "PR-4.pptx.sxema.json",
      "templateName": "PR-4.pptx",
      "previewImage": "/templates/previews/PR-4.pptx.jpg",
      "images": [...],
      "imageCount": 5
    },
    {
      "name": "PR-5.pptx.sxema.json",
      "templateName": "PR-5.pptx",
      "previewImage": null,
      "images": [...],
      "imageCount": 3
    }
  ],
  "totalTemplates": 2
}
```

## Testing with cURL

### Test 1: Upload a preview image

```bash
# Create a test image first (or use any existing image)
curl -X POST http://localhost:3000/api/template/PR-4.pptx/preview \
  -F "preview=@/path/to/your/image.jpg"
```

### Test 2: Get templates with preview images

```bash
curl -X GET http://localhost:3000/api/template/templates
```

### Test 3: Access the preview image directly

```bash
curl -X GET http://localhost:3000/templates/previews/PR-4.pptx.jpg --output preview.jpg
```

## Testing with Postman

### Upload Preview Image

1. Create a new POST request
2. URL: `http://localhost:3000/api/template/PR-4.pptx/preview`
3. Go to "Body" tab
4. Select "form-data"
5. Add key: `preview` (type: File)
6. Choose an image file
7. Send the request

### Get Templates

1. Create a new GET request
2. URL: `http://localhost:3000/api/template/templates`
3. Send the request

## Directory Structure

```
pikachu/
├── templates/
│   ├── previews/              # Preview images directory
│   │   ├── PR-4.pptx.jpg
│   │   ├── PR-5.pptx.jpg
│   │   └── ...
│   ├── metadata.json          # Metadata tracking file
│   ├── PR-4.pptx
│   ├── PR-4.pptx.json
│   └── PR-4.pptx.sxema.json
└── uploads/                   # Temporary upload directory
```

## Metadata File Format

The `templates/metadata.json` file tracks which preview images belong to which templates:

```json
{
  "PR-4.pptx": "PR-4.pptx.jpg",
  "PR-5.pptx": "PR-5.pptx.jpg",
  "PR-6.pptx": "PR-6.pptx.jpg"
}
```

## Image Processing

When you upload a preview image:

1. **Validation:** Checks file type and size
2. **Upload:** Saves to temporary directory
3. **Processing:**
   - Resizes to max 800x600 (maintains aspect ratio)
   - Converts to JPEG format
   - Compresses with 85% quality
4. **Storage:** Saves to `templates/previews/` directory
5. **Metadata:** Updates `metadata.json` file
6. **Cleanup:** Removes temporary file

## Error Handling

The system handles various error scenarios:

- **No file uploaded:** Returns 400 error
- **Invalid file type:** Rejected by multer (400 error)
- **File too large:** Returns 400 error
- **Image processing error:** Returns 500 error with details
- **Missing template name:** Returns 400 error

All errors include cleanup of temporary files.

## Rate Limiting

The upload endpoint is protected by rate limiting (same as template import):
- Default: 10 requests per 15 minutes per IP

## Example Usage Scenarios

### Scenario 1: Upload preview for existing template

```bash
# Check available templates
curl http://localhost:3000/api/template/templates

# Upload preview for "PR-4.pptx"
curl -X POST http://localhost:3000/api/template/PR-4.pptx/preview \
  -F "preview=@screenshot.png"

# Verify preview was added
curl http://localhost:3000/api/template/templates | jq '.templates[] | select(.templateName == "PR-4.pptx")'
```

### Scenario 2: Replace existing preview

```bash
# Upload a new preview (overwrites the old one)
curl -X POST http://localhost:3000/api/template/PR-4.pptx/preview \
  -F "preview=@new-screenshot.jpg"
```

### Scenario 3: View preview in browser

After uploading, you can view the preview at:
```
http://localhost:3000/templates/previews/PR-4.pptx.jpg
```

## Integration with Frontend

### Displaying Template Previews

```javascript
// Fetch templates
const response = await fetch('http://localhost:3000/api/template/templates');
const data = await response.json();

// Display templates with previews
data.templates.forEach(template => {
  if (template.previewImage) {
    const imgUrl = `http://localhost:3000${template.previewImage}`;
    // Display the preview image
    console.log(`Template: ${template.templateName}, Preview: ${imgUrl}`);
  } else {
    console.log(`Template: ${template.templateName}, No preview available`);
  }
});
```

### Uploading Preview from Frontend

```javascript
// HTML: <input type="file" id="previewFile" accept="image/*">

const uploadPreview = async (templateName, file) => {
  const formData = new FormData();
  formData.append('preview', file);

  const response = await fetch(
    `http://localhost:3000/api/template/${templateName}/preview`,
    {
      method: 'POST',
      body: formData
    }
  );

  const result = await response.json();

  if (result.success) {
    console.log('Preview uploaded:', result.previewUrl);
  } else {
    console.error('Upload failed:', result.error);
  }
};

// Usage
const fileInput = document.getElementById('previewFile');
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    uploadPreview('PR-4.pptx', file);
  }
});
```

## Troubleshooting

### Issue: "Invalid file type" error

**Solution:** Ensure you're uploading a valid image file (JPG, PNG, or WebP).

### Issue: "File size exceeds 5MB limit" error

**Solution:** Compress or resize your image before uploading.

### Issue: Preview not appearing after upload

**Solution:**
1. Check the response from the upload endpoint
2. Verify the file exists in `templates/previews/`
3. Check the `metadata.json` file

### Issue: 404 when accessing preview URL

**Solution:**
1. Ensure the server is running
2. Check that the file exists in `templates/previews/`
3. Verify the URL path is correct

## Security Considerations

1. **File Type Validation:** Only image files are accepted
2. **File Size Limit:** Maximum 5MB to prevent abuse
3. **Rate Limiting:** Prevents spam uploads
4. **Path Sanitization:** Template names are sanitized to prevent path traversal
5. **Automatic Cleanup:** Failed uploads are automatically cleaned up

## Performance

- Images are automatically optimized (resized and compressed)
- Sharp library provides fast image processing
- Static file serving is handled by Express
- Metadata is cached in memory after first load

## Future Enhancements

Possible improvements:

1. Add support for multiple preview sizes (thumbnail, medium, large)
2. Automatic preview generation from first slide of PPTX
3. Preview image versioning
4. Batch preview upload
5. CDN integration for preview serving
6. Image format conversion options (WebP for better compression)
