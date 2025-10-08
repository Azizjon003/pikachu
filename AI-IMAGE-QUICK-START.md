# AI Image System - Quick Start Guide

## 🚀 Tezkor Boshlash

### 1. Environment Setup

`.env` fayliga quyidagilarni qo'shing:

```env
OPENAI_API_KEY=your_openai_api_key_here
BING_API_KEY=your_bing_api_key_here
```

### 2. Test Qilish

```bash
# Server ni ishga tushirish
npm start

# Yoki test qilish
tsx src/tests/test-ai-image-system.ts
```

### 3. API Orqali Ishlatish

#### Bitta rasm yaratish:

```bash
curl -X POST http://localhost:3000/api/images/generate \
  -H "Content-Type: application/json" \
  -d '{
    "slideTitle": "Biznes O'\''sishi",
    "slideContent": "Biznessimiz 23% o'\''sdi",
    "slideIndex": 0,
    "elementType": "background",
    "templateName": "biznes-hisobot",
    "presentationTitle": "Yillik Hisobot 2024",
    "presentationTheme": "Korporativ",
    "desiredStyle": "zamonaviy, professional",
    "colorScheme": "ko'\''k, oq"
  }'
```

#### Ko'p rasmlar yaratish:

```bash
curl -X POST http://localhost:3000/api/images/generate-batch \
  -H "Content-Type: application/json" \
  -d '{
    "templateName": "tech-taqdimot",
    "presentationTitle": "Texnologiya Tendensiyalari 2025",
    "presentationTheme": "Zamonaviy",
    "slides": [
      {
        "slideIndex": 0,
        "slideTitle": "Sun'\''iy Intellekt",
        "slideContent": "AI sanoatni o'\''zgartirmoqda",
        "elementType": "background",
        "desiredStyle": "futuristik",
        "colorScheme": "ko'\''k, binafsha"
      },
      {
        "slideIndex": 1,
        "slideTitle": "Cloud Computing",
        "slideContent": "Moslashuvchan infratuzilma",
        "elementType": "background",
        "desiredStyle": "zamonaviy",
        "colorScheme": "oq, ko'\''k"
      }
    ]
  }'
```

### 4. Code Orqali Ishlatish

```typescript
import IntegratedAIImageService from './src/services/image/integrated-ai-image-service';

// Service yaratish
const service = new IntegratedAIImageService();

// Bitta rasm yaratish
const result = await service.findAndDownloadImage({
  slideTitle: 'Bozor Tahlili',
  slideContent: 'Q4 daromadimiz 23% oshdi',
  slideIndex: 0,
  elementType: 'background',
  templateName: 'yillik-hisobot',
  presentationTitle: 'Yillik Hisobot 2024',
  presentationTheme: 'Korporativ',
  desiredStyle: 'zamonaviy, professional',
  colorScheme: 'ko\'k, oq'
});

console.log('Rasm URL:', result.imageUrl);
console.log('Local Path:', result.localPath);
console.log('Ishonch:', result.confidence);
```

### 5. Template Rasmlarini Ko'rish

```bash
curl http://localhost:3000/api/images/template/biznes-hisobot
```

### 6. Template Statistikasi

```bash
curl http://localhost:3000/api/images/stats/biznes-hisobot
```

### 7. Eski Rasmlarni Tozalash

```bash
curl -X POST http://localhost:3000/api/images/cleanup/biznes-hisobot \
  -H "Content-Type: application/json" \
  -d '{
    "olderThanDays": 30,
    "keepLatest": 10
  }'
```

## 📁 Rasm Saqlash Strukturasi

Rasmlar quyidagi strukturada saqlanadi:

```
images/
└── biznes-hisobot/
    └── images/
        ├── biznes-hisobot_abc123.jpg
        ├── biznes-hisobot_def456.png
        └── .metadata/
            ├── biznes-hisobot_abc123.json
            └── biznes-hisobot_def456.json
```

## 🎯 Asosiy Xususiyatlar

### ✅ AI Agent
- GPT-4o orqali aqlli rasm tanlash
- 5 xil qidiruv strategiyasi
- Avtomatik sifat baholash
- Duplikatlarni oldini olish

### ✅ Storage Manager
- Template-specific saqlash
- Metadata boshqarish
- Avtomatik tozalash
- Statistika

### ✅ Quality Validator
- Technical tahlil (Sharp)
- AI vision (GPT-4 Vision)
- Issue detection
- Recommendations

### ✅ Integrated Service
- High-level API
- Batch processing
- Error handling
- Logging

## 🔑 API Endpoints

| Method | Endpoint | Tavsif |
|--------|----------|--------|
| POST | `/api/images/generate` | Bitta rasm yaratish |
| POST | `/api/images/generate-batch` | Ko'p rasmlar yaratish |
| POST | `/api/images/search` | Kalit so'z qidirish |
| GET | `/api/images/template/:name` | Template rasmlari |
| GET | `/api/images/stats/:name` | Template statistikasi |
| POST | `/api/images/cleanup/:name` | Tozalash |
| DELETE | `/api/images/template/:name` | Template o'chirish |
| POST | `/api/images/validate` | Rasm tekshirish |
| GET | `/api/images/service/stats` | Service statistikasi |

## ⚙️ Configuration

### Validation O'chirish

```typescript
const service = new IntegratedAIImageService();
service.setValidationEnabled(false);
```

### Quality Check O'chirish

```typescript
service.setQualityCheckEnabled(false);
```

## 🐛 Troubleshooting

### API Key Error
```
Error: OPENAI_API_KEY is required
```
**Yechim**: `.env` fayliga `OPENAI_API_KEY` qo'shing

### No Images Found
```
Error: No suitable images found
```
**Yechim**:
- Qidiruv so'zlarini kengroq qiling
- Quality threshold pasayting
- `desiredStyle` va `colorScheme` parametrlarini o'zgartiring

### Rate Limit
```
Error: Rate limit exceeded
```
**Yechim**: Request orasida 2-3 soniya kutish qo'shing

## 📊 Success Indicators

✅ **Confidence > 80%**: Juda yaxshi
✅ **Confidence 60-80%**: Yaxshi
⚠️ **Confidence < 60%**: Qidiruv parametrlarini yaxshilang

## 💡 Best Practices

1. **Slide Title va Content** - To'liq va aniq yozing
2. **Element Type** - To'g'ri tanlang (background, content, icon, illustration)
3. **Desired Style** - Bir nechta stilni vergul bilan kiriting
4. **Template Naming** - Ma'noli nomlar bering
5. **Batch Processing** - Ko'p rasmlar uchun batch API ishlatting

## 📞 Support

Muammolar bo'lsa:
1. `AI-IMAGE-SYSTEM-DOCUMENTATION.md` ni o'qing
2. Test faylni ishga tushiring: `tsx src/tests/test-ai-image-system.ts`
3. Log'larni tekshiring

---

**Yaratilgan sana**: 2025-01-20
**Versiya**: 1.0.0