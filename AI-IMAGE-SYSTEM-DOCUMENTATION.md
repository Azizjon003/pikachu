# AI Image System - Complete Documentation

## 📋 Overview

Bu loyihada to'liq AI-powered rasm tanlash va boshqarish tizimi yaratildi. Tizim har bir template uchun alohida rasm saqlash tuzilmasiga ega va barcha rasm tanlash jarayonlarini AI orqali avtomatlashtirilgan.

## 🏗️ Arxitektura

### Rasm Saqlash Strukturasi

```
images/
├── {templateName}/
│   └── images/
│       ├── {templateName}_{hash}.jpg
│       ├── {templateName}_{hash}.png
│       └── .metadata/
│           ├── {filename}.json
│           └── ...
└── {anotherTemplate}/
    └── images/
        └── ...
```

### Asosiy Komponentlar

#### 1. **AI Image Agent** (`ai-image-agent.ts`)
- **Vazifa**: AI orqali eng mos rasmni tanlash
- **Funksiyalar**:
  - GPT-4o yordamida 5 xil qidiruv strategiyasini yaratish
  - Bing API orqali rasmlarni qidirish
  - Rasmlarni relevance, quality va context bo'yicha baholash
  - Dublikatlarni oldini olish
  - Avtomatik qayta urinish strategiyalari

#### 2. **Image Storage Manager** (`image-storage-manager.ts`)
- **Vazifa**: Template-specific rasm saqlash
- **Funksiyalar**:
  - Rasmlarni yuklab olish va saqlash
  - Metadata boshqarish
  - Papka strukturasini avtomatik yaratish
  - Duplikatlarni aniqlash (hash orqali)
  - Eski rasmlarni tozalash
  - Statistika va analytics

#### 3. **Image Quality Validator** (`image-quality-validator.ts`)
- **Vazifa**: Rasm sifatini tekshirish
- **Funksiyalar**:
  - Technical analysis (Sharp library yordamida)
  - AI vision analysis (GPT-4 Vision)
  - Multi-dimensional scoring
  - Issue detection va recommendations
  - Batch validation

#### 4. **Integrated AI Image Service** (`integrated-ai-image-service.ts`)
- **Vazifa**: Barcha servislarni birlashtirib high-level API taqdim etish
- **Funksiyalar**:
  - Single va batch image generation
  - Template management
  - Image validation
  - Statistics va analytics

## 🚀 Qanday Ishlatish

### Environment Variables

`.env` fayliga qo'shing:

```env
OPENAI_API_KEY=your_openai_key_here
BING_API_KEY=your_bing_api_key_here
```

### 1. Single Image Generation (Bir rasm yaratish)

```typescript
import IntegratedAIImageService from './src/services/image/integrated-ai-image-service';

const service = new IntegratedAIImageService();

const result = await service.findAndDownloadImage({
  slideTitle: 'Market Growth',
  slideContent: 'Q4 revenue increased by 23%',
  slideIndex: 0,
  elementType: 'background',
  templateName: 'annual-report',
  presentationTitle: 'Annual Report 2024',
  presentationTheme: 'Corporate',
  desiredStyle: 'modern, professional',
  colorScheme: 'blue, white'
});

if (result.success) {
  console.log('Image URL:', result.imageUrl);
  console.log('Local Path:', result.localPath);
  console.log('Confidence:', result.confidence);
}
```

### 2. Batch Image Generation (Ko'p rasmlarni yaratish)

```typescript
const batchResult = await service.processBatchImages({
  templateName: 'tech-presentation',
  presentationTitle: 'Technology Trends 2025',
  presentationTheme: 'Modern',
  slides: [
    {
      slideIndex: 0,
      slideTitle: 'AI Revolution',
      slideContent: 'AI is transforming industries',
      elementType: 'background',
      desiredStyle: 'futuristic',
      colorScheme: 'blue, purple'
    },
    {
      slideIndex: 1,
      slideTitle: 'Cloud Computing',
      slideContent: 'Scalable infrastructure',
      elementType: 'background',
      desiredStyle: 'modern',
      colorScheme: 'white, blue'
    }
  ]
});

console.log('Success:', batchResult.successfulCount);
console.log('Failed:', batchResult.failedCount);
```

### 3. Keyword Search (Oddiy qidiruv)

```typescript
const result = await service.findImageByKeyword(
  'business team collaboration',
  'my-template',
  0
);
```

## 📡 API Endpoints

### Image Generation

#### POST `/api/images/generate`
Bitta slide uchun rasm yaratish

**Request Body:**
```json
{
  "slideTitle": "Market Growth",
  "slideContent": "Our Q4 revenue increased by 23%",
  "slideIndex": 0,
  "elementType": "background",
  "templateName": "annual-report",
  "presentationTitle": "Annual Report 2024",
  "presentationTheme": "Corporate",
  "desiredStyle": "modern, professional",
  "colorScheme": "blue, white"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "imageUrl": "https://...",
    "localPath": "/images/annual-report/images/annual-report_abc123.jpg",
    "confidence": 0.87,
    "aiReasoning": "Selected image scores: Quality 85%, Relevance 90%...",
    "alternatives": [
      {
        "url": "https://...",
        "score": 0.82,
        "reasoning": "..."
      }
    ],
    "validationResult": {
      "isValid": true,
      "overallScore": 0.85,
      "grade": "A",
      "issues": []
    },
    "processingTime": 5420
  }
}
```

#### POST `/api/images/generate-batch`
Ko'p slidelar uchun rasmlar yaratish

**Request Body:**
```json
{
  "templateName": "tech-presentation",
  "presentationTitle": "Technology Trends 2025",
  "presentationTheme": "Modern",
  "slides": [
    {
      "slideIndex": 0,
      "slideTitle": "AI Revolution",
      "slideContent": "AI is transforming industries",
      "elementType": "background",
      "desiredStyle": "futuristic",
      "colorScheme": "blue, purple"
    }
  ]
}
```

#### POST `/api/images/search`
Kalit so'z orqali rasm qidirish

**Request Body:**
```json
{
  "keyword": "business team collaboration",
  "templateName": "my-template",
  "slideIndex": 0
}
```

### Template Management

#### GET `/api/images/template/:templateName`
Template uchun barcha rasmlarni olish

#### GET `/api/images/stats/:templateName`
Template statistikasini olish

**Response:**
```json
{
  "success": true,
  "stats": {
    "templateName": "annual-report",
    "totalImages": 15,
    "totalSize": 45678900,
    "averageSize": 3045260,
    "oldestImage": "2025-01-15T10:30:00Z",
    "newestImage": "2025-01-20T14:45:00Z"
  }
}
```

#### POST `/api/images/cleanup/:templateName`
Eski rasmlarni tozalash

**Request Body:**
```json
{
  "olderThanDays": 30,
  "keepLatest": 10,
  "minQualityScore": 0.7
}
```

#### DELETE `/api/images/template/:templateName`
Template barcha rasmlarini o'chirish

### Image Validation

#### POST `/api/images/validate`
Rasm sifatini tekshirish

**Request Body:**
```json
{
  "imageUrl": "https://example.com/image.jpg",
  "context": {
    "minWidth": 1280,
    "minHeight": 720,
    "expectedContent": "business analytics",
    "expectedStyle": "professional"
  }
}
```

**Response:**
```json
{
  "success": true,
  "validation": {
    "isValid": true,
    "overallScore": 0.85,
    "grade": "A",
    "scores": {
      "technical": 0.9,
      "visual": 0.85,
      "usability": 0.8
    },
    "issues": [],
    "recommendations": [
      "Image quality is excellent",
      "Suitable for professional presentations"
    ]
  }
}
```

### Service Statistics

#### GET `/api/images/service/stats`
Service umumiy statistikasini olish

#### GET `/api/images/export/:templateName`
Template metadata eksport qilish

## 🧪 Testing

Test faylni ishga tushirish:

```bash
# TypeScript orqali
tsx src/tests/test-ai-image-system.ts

# Node orqali (compiled JS)
npm run test:ai-images
```

### Test Qamrovi

1. **Single Image Generation** - Bitta rasm yaratish
2. **Batch Image Generation** - Ko'p rasmlar yaratish
3. **Keyword Search** - Kalit so'z qidirish
4. **Template Management** - Template boshqarish
5. **Image Validation** - Rasm sifatini tekshirish

## 📊 AI Agent Qanday Ishlaydi

### 1. Content Analysis Phase
```
Slide kontentini tahlil qilish
↓
GPT-4o orqali 5 xil strategiya yaratish:
- Primary direct search (to'g'ridan-to'g'ri)
- Conceptual/metaphorical (kontseptual)
- Emotional/mood-based (his-tuyg'u)
- Industry/domain-specific (soha-specific)
- Alternative perspective (muqobil)
```

### 2. Search & Collection Phase
```
Har bir strategiya bo'yicha Bing API orqali qidirish
↓
Technical quality scoring (texnik baholash)
↓
Yetarli sifatli rasmlar topilsa to'xtatish
```

### 3. Intelligent Ranking Phase
```
Rasmlarni batch bo'yicha AI orqali baholash
↓
Relevance, Quality, Context scorelari
↓
Overall score hisoblash va saralash
```

### 4. Decision Making Phase
```
Threshold bo'yicha filtrlash
↓
Duplikatlarni tekshirish
↓
Eng yaxshi rasmni tanlash
↓
Confidence score hisoblash
```

### 5. Validation & Storage Phase
```
Rasm sifatini tekshirish (agar yoqilgan bo'lsa)
↓
Rasmni yuklab olish
↓
Template-specific papkaga saqlash
↓
Metadata yaratish va saqlash
```

## 🎯 Qanday Sifat Baholanadi

### Technical Score (30%)
- **Resolution**: HD, Full HD, 4K
- **Aspect Ratio**: 16:9, 4:3, square
- **File Size**: Optimal (1-5MB)
- **Format**: JPEG, PNG, WebP
- **Color Depth**: RGB, RGBA

### Visual Score (25%)
- **Clarity**: Aniqlik va o'tkirlik
- **Lighting**: Yoritish sifati
- **Composition**: Kompozitsiya
- **Color Balance**: Rang balansi

### Contextual Score (25%)
- **Content Match**: Kontentga mos kelishi
- **Style Match**: Stilga mos kelishi
- **Color Scheme**: Rang sxemasiga mos kelishi

### Semantic Score (20%)
- **Subject Relevance**: Mavzuga mos kelishi
- **Purpose Alignment**: Maqsadga mos kelishi
- **Professional Suitability**: Professional mos kelishi

### Grades
- **A+**: 95-100%
- **A**: 90-94%
- **B**: 80-89%
- **C**: 70-79%
- **D**: 60-69%
- **F**: <60%

## 🔧 Configuration

### Service Settings

```typescript
const service = new IntegratedAIImageService(
  'openai_key',
  'bing_key',
  'images'  // Base directory
);

// Validation o'chirish
service.setValidationEnabled(false);

// Strict quality check o'chirish
service.setQualityCheckEnabled(false);
```

### Agent Settings

```typescript
const agent = new AIImageAgent('openai_key', 'bing_key');

// Threshold o'zgartirish (default: 0.6)
agent['minQualityThreshold'] = 0.7;
agent['minRelevanceThreshold'] = 0.8;

// Max retries (default: 3)
agent['maxRetries'] = 5;
```

## 📈 Performance Tips

1. **Batch Processing** - Ko'p rasmlarni bitta API call da ishlating
2. **Caching** - Metadata cache yoqilgan
3. **Parallel Processing** - Rasmlar parallel yuklanadi
4. **Rate Limiting** - Har bir request orasida 1-2s kutish
5. **Cleanup** - Eski rasmlarni muntazam tozalash

## 🛠️ Troubleshooting

### "OPENAI_API_KEY is required"
`.env` fayliga API key qo'shing

### "BING_API_KEY is required"
Bing Image Search API key oling va `.env` ga qo'shing

### "No suitable images found"
- Qidiruv so'zlarini kengroq qiling
- Quality threshold pasayting
- Alternative strategiyalarni sinab ko'ring

### "Validation failed"
- Validation o'chiring: `service.setValidationEnabled(false)`
- Yoki quality check o'chiring: `service.setQualityCheckEnabled(false)`

### "Rate limit exceeded"
- Request orasidagi kutish vaqtini oshiring
- Batch sizeni kichiklashtiring

## 🎨 Best Practices

### 1. Template Naming
```typescript
// ✅ Yaxshi
templateName: 'annual-report-2024'
templateName: 'tech-presentation'

// ❌ Yomon
templateName: 'template1'
templateName: 'new'
```

### 2. Slide Content
```typescript
// ✅ Yaxshi - to'liq kontekst
slideTitle: 'Market Growth Analysis'
slideContent: 'Our Q4 revenue increased by 23% compared to last year'

// ❌ Yomon - kam kontekst
slideTitle: 'Growth'
slideContent: 'Increased'
```

### 3. Element Types
- `background`: Slide foni uchun
- `content`: Kontentdagi rasmlar
- `icon`: Kichik icon/piktogramma
- `illustration`: Illustratsiya/diagramma

### 4. Desired Style
```typescript
// ✅ Yaxshi
desiredStyle: 'modern, professional, clean'
desiredStyle: 'corporate, business, minimalist'

// ❌ Yomon
desiredStyle: 'nice'
desiredStyle: 'good'
```

## 📦 Dependencies

```json
{
  "openai": "^6.0.1",
  "axios": "^1.12.2",
  "sharp": "^0.33.5",
  "dotenv": "^17.2.3"
}
```

## 🚧 Future Enhancements

1. **Image Caching** - Tez-tez ishlatilgan rasmlarni cache qilish
2. **Custom Sources** - Unsplash, Pexels API integratsiyasi
3. **Style Transfer** - AI orqali rasm stilini o'zgartirish
4. **Face Detection** - Yuz aniqlash va privacy tekshirish
5. **Copyright Check** - Mualliflik huquqini tekshirish
6. **OCR Integration** - Rasmdagi matinni o'qish
7. **Image Compression** - Avtomatik optimizatsiya
8. **CDN Integration** - Tezroq yuklash uchun CDN

## 📝 Changelog

### Version 1.0.0 (2025-01-20)
- ✅ AI Image Agent yaratildi
- ✅ Template-specific storage tizimi
- ✅ Image quality validation
- ✅ Integrated service
- ✅ API endpoints
- ✅ Comprehensive tests
- ✅ Documentation

## 👥 Contributors

- AI-powered development with Claude
- Integration with existing PPT system

## 📄 License

MIT License

---

**Note**: Bu tizim OpenAI va Bing API talab qiladi. Production muhitda API limitlarini va cost ni e'tiborga oling.