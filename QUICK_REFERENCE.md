# Template Preview System - Quick Reference

## API Endpoints

### Upload Preview
```bash
POST /api/template/:templateName/preview
Content-Type: multipart/form-data

# cURL Example
curl -X POST http://localhost:3000/api/template/PR-4.pptx/preview \
  -F "preview=@image.jpg"
```

### Get Templates (with previews)
```bash
GET /api/template/templates

# cURL Example
curl http://localhost:3000/api/template/templates
```

### Access Preview Image
```bash
GET /templates/previews/{templateName}.jpg

# Example
http://localhost:3000/templates/previews/PR-4.pptx.jpg
```

## Response Formats

### Upload Success
```json
{
  "success": true,
  "previewUrl": "/templates/previews/PR-4.pptx.jpg",
  "message": "Preview image uploaded successfully"
}
```

### Get Templates Response
```json
{
  "success": true,
  "templates": [{
    "name": "PR-4.pptx.sxema.json",
    "templateName": "PR-4.pptx",
    "previewImage": "/templates/previews/PR-4.pptx.jpg",
    "images": [...],
    "imageCount": 8
  }],
  "totalTemplates": 5
}
```

## File Specifications

- **Accepted Formats:** JPG, PNG, WebP
- **Max File Size:** 5MB
- **Output Format:** JPEG (converted automatically)
- **Max Dimensions:** 800x600 (maintains aspect ratio)
- **Compression:** 85% quality

## Key Files

### Modified Files
- `src/services/api/utils/upload.ts` - Added uploadPreview multer config
- `src/services/api/controller/template.controller.ts` - Added uploadTemplatePreview()
- `src/services/api/routes/template.routes.ts` - Added preview route
- `src/services/api/api-client.ts` - Added static serving

### Created Files
- `templates/previews/` - Preview images directory
- `templates/metadata.json` - Preview tracking file

## Frontend Integration Example

```javascript
// Upload preview
const uploadPreview = async (templateName, file) => {
  const formData = new FormData();
  formData.append('preview', file);

  const res = await fetch(
    `http://localhost:3000/api/template/${templateName}/preview`,
    { method: 'POST', body: formData }
  );

  return await res.json();
};

// Display previews
const templates = await fetch('http://localhost:3000/api/template/templates')
  .then(r => r.json());

templates.templates.forEach(t => {
  if (t.previewImage) {
    console.log(`Preview: http://localhost:3000${t.previewImage}`);
  }
});
```

## Testing

```bash
# Run test script
node test-preview-upload.js

# Manual test with cURL
curl -X POST http://localhost:3000/api/template/test/preview \
  -F "preview=@test-image.jpg"

# Verify upload
curl http://localhost:3000/api/template/templates | grep "previewImage"
```

## Error Codes

- **400** - Bad request (no file, invalid type, too large)
- **404** - Template not found
- **500** - Server error (processing failed)

## Security Features

- File type validation (images only)
- Size limit enforcement (5MB)
- Rate limiting protection
- Path sanitization
- Automatic cleanup on errors

## Directory Structure

```
pikachu/
├── templates/
│   ├── previews/
│   │   └── PR-4.pptx.jpg
│   └── metadata.json
└── uploads/ (temp)
```

## Common Issues

### Issue: Preview not showing
**Solution:** Check metadata.json exists and contains template entry

### Issue: Upload fails with EPERM
**Solution:** Wait a moment and retry (Windows file locking)

### Issue: 404 when accessing preview
**Solution:** Ensure file exists in templates/previews/ directory

## Documentation Files

- `TEST_TEMPLATE_PREVIEW.md` - Complete testing guide
- `IMPLEMENTATION_SUMMARY.md` - Full implementation details
- `test-preview-upload.js` - Automated test script
