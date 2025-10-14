# Pikachu API Documentation

## Overview

Pikachu API - AI-powered PowerPoint presentation generator. Bu API AI yordamida avtomatik taqdimotlar yaratadi.

**Base URL:** `http://localhost:3000/api`

## Table of Contents

- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
  - [Health Check](#health-check)
  - [Slide Generation](#slide-generation)
  - [Templates](#templates)
  - [Presentations](#presentations)

---

## Authentication

API ixtiyoriy API key autentifikatsiyasini qo'llab-quvvatlaydi. Agar `.env` faylida `API_KEY` o'rnatilgan bo'lsa, barcha so'rovlar uchun autentifikatsiya talab qilinadi.

### API Key bilan ishlash

```bash
# Request header
X-API-Key: your_api_key_here
```

**Example:**
```bash
curl -H "X-API-Key: your_api_key_here" \
  http://localhost:3000/api/presentations/list
```

---

## Rate Limiting

API so'rovlar sonini cheklaydi:

| Endpoint Type | Limit | Time Window |
|--------------|-------|-------------|
| General API | 100 requests | 15 minutes |
| Slide Generation | 10 requests | 15 minutes |
| File Upload | 20 requests | 1 hour |

**Rate Limit Headers:**
```
RateLimit-Limit: 100
RateLimit-Remaining: 99
RateLimit-Reset: 1234567890
```

---

## Error Handling

Barcha xatoliklar quyidagi formatda qaytariladi:

```json
{
  "success": false,
  "error": {
    "message": "Error message here",
    "statusCode": 400,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "path": "/api/slide/generate"
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - API key required |
| 403 | Forbidden - Invalid API key |
| 404 | Not Found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## Endpoints

### Health Check

Server holatini tekshirish uchun.

**Endpoint:** `GET /health`

**Authentication:** Not required

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 12345.67,
  "environment": "development"
}
```

**Example:**
```bash
curl http://localhost:3000/health
```

---

### Slide Generation

AI yordamida taqdimot yaratish.

#### Generate Presentation

**Endpoint:** `POST /api/slide/generate`

**Authentication:** Optional (depends on configuration)

**Rate Limit:** 10 requests per 15 minutes

**Request Body:**
```json
{
  "template": "template-name.sxema.json",
  "language": "Uzbek",
  "page": 10,
  "topic": "Artificial Intelligence in Healthcare",
  "author": "John Doe"
}
```

**Parameters:**

| Parameter | Type | Required | Description | Constraints |
|-----------|------|----------|-------------|-------------|
| template | string | Yes | Template file name | Must exist in templates folder |
| language | string | Yes | Presentation language | 2-50 characters |
| page | number | Yes | Number of slides | 1-100 |
| topic | string | Yes | Presentation topic | 3-200 characters |
| author | string | No | Author name | Max 100 characters |

**Response:**
```json
{
  "success": true,
  "slidePath": "/path/to/generated/presentation.pptx",
  "slideName": "1234567890-Artificial-Intelligence.pptx",
  "sessionId": 1234567890,
  "jsonFilePath": "/path/to/generated/data.json",
  "jsonFileName": "1234567890-Artificial-Intelligence.full-filled-slides.json",
  "message": "Slide generated successfully",
  "validation": {
    "totalSlides": 10,
    "validSlides": 10,
    "fixedSlides": 2,
    "issuesFound": 2,
    "fixesApplied": 2
  },
  "overlapOptimization": {
    "slidesOptimized": 3,
    "totalSlides": 10,
    "fixesApplied": 5
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/slide/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key_here" \
  -d '{
    "template": "modern-template.sxema.json",
    "language": "Uzbek",
    "page": 10,
    "topic": "Artificial Intelligence",
    "author": "John Doe"
  }'
```

**JavaScript Example:**
```javascript
const response = await fetch('http://localhost:3000/api/slide/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key_here'
  },
  body: JSON.stringify({
    template: 'modern-template.sxema.json',
    language: 'Uzbek',
    page: 10,
    topic: 'Artificial Intelligence',
    author: 'John Doe'
  })
});

const data = await response.json();
console.log(data);
```

**Python Example:**
```python
import requests

url = 'http://localhost:3000/api/slide/generate'
headers = {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key_here'
}
data = {
    'template': 'modern-template.sxema.json',
    'language': 'Uzbek',
    'page': 10,
    'topic': 'Artificial Intelligence',
    'author': 'John Doe'
}

response = requests.post(url, headers=headers, json=data)
print(response.json())
```

---

### Templates

Template bilan ishlash endpointlari.

#### Get All Templates

Barcha mavjud templatelarni olish.

**Endpoint:** `GET /api/template/templates`

**Authentication:** Optional

**Response:**
```json
{
  "success": true,
  "templates": [
    {
      "name": "modern-template.sxema.json",
      "fullPath": "/path/to/templates/modern-template.sxema.json",
      "size": 12345,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

**Example:**
```bash
curl http://localhost:3000/api/template/templates
```

#### Upload Template

Yangi template yuklash.

**Endpoint:** `POST /api/template/import`

**Authentication:** Optional

**Rate Limit:** 20 requests per hour

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | PPTX file |

**Response:**
```json
{
  "success": true,
  "message": "Template uploaded successfully",
  "templatePath": "/path/to/template.json",
  "schemaPath": "/path/to/template.sxema.json"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/template/import \
  -H "X-API-Key: your_api_key_here" \
  -F "file=@/path/to/template.pptx"
```

---

### Presentations

Yaratilgan taqdimotlar bilan ishlash.

#### List All Presentations

Barcha yaratilgan taqdimotlarni ko'rish.

**Endpoint:** `GET /api/presentations/list`

**Authentication:** Optional

**Response:**
```json
{
  "success": true,
  "presentations": [
    {
      "filename": "1234567890-Artificial-Intelligence.pptx",
      "path": "/path/to/generated/1234567890-Artificial-Intelligence.pptx",
      "size": 1234567,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "jsonFile": "1234567890-Artificial-Intelligence.full-filled-slides.json"
    }
  ],
  "count": 1
}
```

**Example:**
```bash
curl http://localhost:3000/api/presentations/list
```

#### Download Presentation

Taqdimotni yuklab olish.

**Endpoint:** `GET /api/presentations/download/:filename`

**Authentication:** Optional

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filename | string | Yes | Presentation filename |

**Response:** File download (PPTX or JSON)

**Example:**
```bash
curl -O http://localhost:3000/api/presentations/download/1234567890-Artificial-Intelligence.pptx
```

#### Delete Presentation

Taqdimotni o'chirish.

**Endpoint:** `DELETE /api/presentations/:filename`

**Authentication:** Optional

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filename | string | Yes | Presentation filename |

**Response:**
```json
{
  "success": true,
  "message": "Presentation deleted successfully",
  "deletedFiles": ["presentation.pptx", "presentation.json"]
}
```

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/presentations/1234567890-Artificial-Intelligence.pptx
```

#### Get Statistics

Taqdimotlar statistikasini olish.

**Endpoint:** `GET /api/presentations/stats`

**Authentication:** Optional

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalPresentations": 10,
    "totalSize": 12345678,
    "averageSize": 1234567,
    "oldestPresentation": "2024-01-01T10:30:00.000Z",
    "newestPresentation": "2024-01-15T10:30:00.000Z"
  }
}
```

**Example:**
```bash
curl http://localhost:3000/api/presentations/stats
```

---

## Integration Examples

### Node.js/Express Integration

```javascript
const axios = require('axios');

class PikachuAPIClient {
  constructor(baseURL, apiKey) {
    this.client = axios.create({
      baseURL: baseURL || 'http://localhost:3000/api',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      }
    });
  }

  async generatePresentation(options) {
    try {
      const response = await this.client.post('/slide/generate', options);
      return response.data;
    } catch (error) {
      console.error('Error generating presentation:', error.response?.data);
      throw error;
    }
  }

  async listPresentations() {
    try {
      const response = await this.client.get('/presentations/list');
      return response.data;
    } catch (error) {
      console.error('Error listing presentations:', error.response?.data);
      throw error;
    }
  }

  async downloadPresentation(filename) {
    try {
      const response = await this.client.get(
        `/presentations/download/${filename}`,
        { responseType: 'blob' }
      );
      return response.data;
    } catch (error) {
      console.error('Error downloading presentation:', error.response?.data);
      throw error;
    }
  }
}

// Usage
const client = new PikachuAPIClient('http://localhost:3000/api', 'your_api_key');

client.generatePresentation({
  template: 'modern-template.sxema.json',
  language: 'Uzbek',
  page: 10,
  topic: 'Artificial Intelligence',
  author: 'John Doe'
}).then(result => {
  console.log('Presentation generated:', result);
});
```

### Python Integration

```python
import requests
from typing import Dict, Any, Optional

class PikachuAPIClient:
    def __init__(self, base_url: str = 'http://localhost:3000/api', api_key: Optional[str] = None):
        self.base_url = base_url
        self.headers = {
            'Content-Type': 'application/json'
        }
        if api_key:
            self.headers['X-API-Key'] = api_key

    def generate_presentation(self, options: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a presentation"""
        response = requests.post(
            f'{self.base_url}/slide/generate',
            headers=self.headers,
            json=options
        )
        response.raise_for_status()
        return response.json()

    def list_presentations(self) -> Dict[str, Any]:
        """List all presentations"""
        response = requests.get(
            f'{self.base_url}/presentations/list',
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def download_presentation(self, filename: str) -> bytes:
        """Download a presentation"""
        response = requests.get(
            f'{self.base_url}/presentations/download/{filename}',
            headers=self.headers
        )
        response.raise_for_status()
        return response.content

# Usage
client = PikachuAPIClient(api_key='your_api_key')

result = client.generate_presentation({
    'template': 'modern-template.sxema.json',
    'language': 'Uzbek',
    'page': 10,
    'topic': 'Artificial Intelligence',
    'author': 'John Doe'
})

print('Presentation generated:', result)
```

---

## CORS Configuration

Tashqi domenlardan API ga murojaat qilish uchun `.env` faylida CORS ni sozlang:

```bash
# Allow all origins (development only)
ALLOWED_ORIGINS=*

# Allow specific origins (production)
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

---

## Security Best Practices

1. **API Key**: Production muhitida har doim `API_KEY` ni o'rnating
2. **CORS**: Production da faqat ishonchli domenlarni ruxsat bering
3. **HTTPS**: Production da faqat HTTPS dan foydalaning
4. **Rate Limiting**: Kerak bo'lsa rate limit qiymatlarini moslashtiring
5. **Environment Variables**: `.env` faylini hech qachon git ga commit qilmang

---

## Support

Muammolar yoki savollar bo'lsa, repository ga issue oching yoki quyidagi ma'lumotlardan foydalaning:

- **Repository:** [GitHub Link]
- **Issues:** [GitHub Issues]
- **Email:** support@example.com

---

## Changelog

### Version 2.0.0 (2024-01-15)
- ✨ CORS qo'shildi
- ✨ Helmet security headers qo'shildi
- ✨ Rate limiting qo'shildi
- ✨ API key authentication qo'shildi
- ✨ Input validation yaxshilandi
- ✨ Error handling yaxshilandi
- ✨ Health check endpoint qo'shildi
- 📚 API documentation yaratildi

### Version 1.0.0
- 🎉 Initial release
