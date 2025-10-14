# 🎨 Pikachu - AI-Powered Presentation Generator

AI yordamida avtomatik PowerPoint taqdimotlar yaratuvchi REST API.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat&logo=openai&logoColor=white)](https://openai.com/)

## ✨ Asosiy Xususiyatlar

- 🤖 **AI-Powered** - OpenAI GPT yordamida kontent generatsiya
- 🎨 **Template System** - O'z templatelaringizni yuklash va ishlatish
- 🔒 **Secure** - Helmet, CORS, Rate Limiting, API Key authentication
- 📊 **Smart Layout** - AI-powered text placement va overlap detection
- 🖼️ **Image Search** - Bing yordamida avtomatik rasm qidirish va joylashtirish
- 🌐 **RESTful API** - To'liq REST API tashqi servislar uchun
- 📝 **Validation** - Comprehensive input validation
- 📈 **Statistics** - Presentation statistics va monitoring

## 🚀 O'rnatish

### Prerequisites

- Node.js 20.x yoki undan yuqori
- npm yoki yarn
- OpenAI API key

### 1. Repository ni clone qiling

```bash
git clone https://github.com/yourusername/pikachu.git
cd pikachu
```

### 2. Dependencies ni o'rnating

```bash
npm install
```

### 3. Environment variables ni sozlang

```bash
# .env.example faylidan .env yarating
cp .env.example .env
```

`.env` faylini o'zingizning ma'lumotlaringiz bilan to'ldiring:

```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000
NODE_ENV=development
API_KEY=your_secure_api_key_here
ALLOWED_ORIGINS=*
```

### 4. Serverni ishga tushiring

```bash
# Development mode
npm start

# yoki
npm run api
```

Server `http://localhost:3000` da ishga tushadi.

## 📚 API Documentation

To'liq API documentation uchun [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) faylini ko'ring.

### Quick Start

#### 1. Health Check

```bash
curl http://localhost:3000/health
```

#### 2. Generate Presentation

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

#### 3. List Presentations

```bash
curl http://localhost:3000/api/presentations/list
```

#### 4. Download Presentation

```bash
curl -O http://localhost:3000/api/presentations/download/your-presentation.pptx
```

## 🔧 Konfiguratsiya

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `OPENAI_API_KEY` | OpenAI API key | - | Yes |
| `PORT` | Server port | 3000 | No |
| `NODE_ENV` | Environment (development/production) | development | No |
| `API_KEY` | API authentication key | - | No |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | * | No |

### Rate Limiting

Rate limiting sozlamalari `src/services/api/middleware/rate-limiter.ts` da:

- **General API**: 100 requests / 15 minutes
- **Slide Generation**: 10 requests / 15 minutes
- **File Upload**: 20 requests / 1 hour

## 🏗️ Arxitektura

```
src/
├── core/                    # Core business logic
│   ├── generators/          # AI content generation
│   ├── processors/          # Data processing
│   └── exporters/           # PPTX export
├── services/                # External services
│   ├── api/                 # REST API
│   │   ├── controller/      # Route controllers
│   │   ├── middleware/      # Express middleware
│   │   ├── routes/          # API routes
│   │   └── utils/           # API utilities
│   ├── image/               # Image services
│   ├── layout/              # Layout optimization
│   └── validation/          # Validation services
└── lib/                     # Utilities
    ├── logger.ts
    ├── config-manager.ts
    └── ...
```

## 🔐 Xavfsizlik

### Production uchun tavsiyalar:

1. **API Key**: Albatta `API_KEY` ni o'rnating
2. **CORS**: Faqat ishonchli domenlarni ruxsat bering
3. **HTTPS**: Production da HTTPS dan foydalaning
4. **Environment**: `.env` faylini git ga commit qilmang
5. **Rate Limiting**: Kerak bo'lsa rate limit qiymatlarini moslashtiring

### Middleware Stack

- ✅ **Helmet** - Security headers
- ✅ **CORS** - Cross-origin resource sharing
- ✅ **Rate Limiting** - DDoS protection
- ✅ **Input Validation** - Request validation
- ✅ **Error Handling** - Centralized error handling
- ✅ **API Key Auth** - Optional authentication

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific tests
npm run test:validation
npm run test:ai-images
```

## 📦 API Endpoints

| Endpoint | Method | Description | Rate Limit |
|----------|--------|-------------|------------|
| `/health` | GET | Health check | None |
| `/api/slide/generate` | POST | Generate presentation | 10/15min |
| `/api/template/templates` | GET | List templates | 100/15min |
| `/api/template/import` | POST | Upload template | 20/hour |
| `/api/presentations/list` | GET | List presentations | 100/15min |
| `/api/presentations/download/:filename` | GET | Download file | 100/15min |
| `/api/presentations/:filename` | DELETE | Delete presentation | 100/15min |
| `/api/presentations/stats` | GET | Get statistics | 100/15min |

## 🌐 Tashqi Servislar bilan Integratsiya

### Node.js

```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'X-API-Key': 'your_api_key_here'
  }
});

const result = await client.post('/slide/generate', {
  template: 'modern-template.sxema.json',
  language: 'Uzbek',
  page: 10,
  topic: 'AI in Healthcare'
});
```

### Python

```python
import requests

response = requests.post(
    'http://localhost:3000/api/slide/generate',
    headers={'X-API-Key': 'your_api_key_here'},
    json={
        'template': 'modern-template.sxema.json',
        'language': 'Uzbek',
        'page': 10,
        'topic': 'AI in Healthcare'
    }
)
```

Ko'proq misollar uchun [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) ga qarang.

## 📝 Scripts

```json
{
  "start": "tsx src/services/api/api-client.ts",
  "api": "tsx src/services/api/api-client.ts",
  "test:validation": "tsx src/tests/test-validation-system.ts",
  "test:ai-images": "tsx src/tests/test-ai-image-system.ts"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- [OpenAI](https://openai.com/) - AI content generation
- [Express](https://expressjs.com/) - Web framework
- [PptxGenJS](https://gitbrent.github.io/PptxGenJS/) - PowerPoint generation
- [Sharp](https://sharp.pixelplumbing.com/) - Image processing

## 📞 Support

Muammolar yoki savollar bo'lsa:

- 📧 Email: support@example.com
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/pikachu/issues)
- 📖 Docs: [API Documentation](./API_DOCUMENTATION.md)

---

**Made with ❤️ using AI and TypeScript**
