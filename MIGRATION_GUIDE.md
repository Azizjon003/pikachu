# OpenAI Service Migration Guide

## Eski Kod (Before)

```typescript
import { AzureOpenAI } from "openai";
import { config } from "dotenv";

config();

const endpoint =
  process.env["AZURE_OPENAI_ENDPOINT"] ||
  "https://magicslide-api.openai.azure.com/";
const apiKey = process.env["AZURE_OPENAI_API_KEY"] || "";
const apiVersion = "2024-05-01-preview";
const deployment = "gpt-4o";

const openai = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });

// Har safar yangi client yaratish kerak bo'lardi
```

## Yangi Kod (After)

```typescript
import { getOpenAIService } from "./services/openai";

// Markazlashtirilgan service - avtomatik Azure OpenAI'ni taniydi!
const openaiService = getOpenAIService();

// Hammasi tayyor, ishlatish mumkin! 🚀
```

---

## Misol 1: Chat Completion

### Eski:

```typescript
const openai = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });

const response = await openai.chat.completions.create({
  model: deployment,
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello!" }
  ]
});

const content = response.choices[0].message.content;
console.log(content);
```

### Yangi:

```typescript
import { getOpenAIService } from "./services/openai";

const openaiService = getOpenAIService();

const result = await openaiService.createChatCompletion({
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello!" }
  ]
});

console.log(result.content);
// Bonus: result.usage.totalTokens - token hisobi avtomatik!
```

---

## Misol 2: JSON Response

### Eski:

```typescript
const openai = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });

const response = await openai.chat.completions.create({
  model: deployment,
  messages: [
    { role: "user", content: "Generate a JSON with title and description" }
  ],
  response_format: { type: "json_object" }
});

const content = response.choices[0].message.content || "{}";
const parsed = JSON.parse(content);

console.log(parsed.title);
```

### Yangi:

```typescript
import { getOpenAIService } from "./services/openai";

const openaiService = getOpenAIService();

interface MyResponse {
  title: string;
  description: string;
}

const result = await openaiService.createJsonCompletion<MyResponse>({
  messages: [
    { role: "user", content: "Generate a JSON with title and description" }
  ]
});

console.log(result.title);
// JSON parsing avtomatik! Type-safe! ✅
```

---

## Misol 3: Temperature va boshqa parametrlar

### Eski:

```typescript
const response = await openai.chat.completions.create({
  model: deployment,
  messages: [...],
  temperature: 0.8,
  max_tokens: 2000,
  top_p: 0.9
});
```

### Yangi:

```typescript
const result = await openaiService.createChatCompletion({
  messages: [...],
  temperature: 0.8,
  maxTokens: 2000,  // camelCase!
  topP: 0.9          // camelCase!
});
```

---

## Misol 4: Turli modellar

### Eski:

```typescript
// gpt-4o uchun
const openai1 = new AzureOpenAI({
  endpoint,
  apiKey,
  apiVersion,
  deployment: "gpt-4o"
});

// gpt-4o uchun
const openai2 = new AzureOpenAI({
  endpoint,
  apiKey,
  apiVersion,
  deployment: "gpt-4o"
});
```

### Yangi:

```typescript
import { getOpenAIService } from "./services/openai";

const openaiService = getOpenAIService();

// gpt-4o uchun
const result1 = await openaiService.createChatCompletion({
  model: "gpt-4o",  // Shunchaki model nomini o'zgartiring!
  messages: [...]
});

// gpt-4o uchun
const result2 = await openaiService.createChatCompletion({
  model: "gpt-4o",  // Osongina!
  messages: [...]
});
```

---

## Environment Variables

### `.env` fayli:

```env
# Azure OpenAI (Recommended)
AZURE_OPENAI_ENDPOINT=https://magicslide-api.openai.azure.com/
AZURE_OPENAI_API_KEY=your_key_here
AZURE_OPENAI_API_VERSION=2024-05-01-preview
AZURE_OPENAI_DEPLOYMENT=gpt-4o

# Yoki oddiy OpenAI (Alternative)
# OPENAI_API_KEY=sk-your_key_here
```

**Eslatma:** Agar ikkalasi ham sozlangan bo'lsa, Azure OpenAI avtomatik tanlanadi.

---

## Afzalliklari

### ❌ Eski yondashuv:

- Har safar yangi client yaratish kerak
- Har joyda endpoint, apiKey, apiVersion qayta yozish
- Error handling o'zingiz qilishingiz kerak
- Token tracking yo'q
- Retry logic yo'q
- Logging qo'lda qilish kerak

### ✅ Yangi markazlashtirilgan service:

- **Bir marta sozlang, har yerda ishlating** 🎯
- **Avtomatik provider detection** (OpenAI vs Azure)
- **Built-in error handling** ✅
- **Avtomatik retry logic** 🔁
- **Token tracking** 📊
- **Request/response logging** 📝
- **Type-safe API** 🛡️
- **Oson test qilish** 🧪

---

## Advanced: Raw Client'ga kirish

Agar sizga raw OpenAI client kerak bo'lsa (maxsus ishlar uchun):

```typescript
import { getOpenAIService } from "./services/openai";

const openaiService = getOpenAIService();
const rawClient = openaiService.getClient();

// Endi raw client bilan ishlashingiz mumkin
const response = await rawClient.chat.completions.create({
  // ...
});
```

---

## Usage Statistics

Token va request'larni kuzatish:

```typescript
import { getOpenAIService } from "./services/openai";

const openaiService = getOpenAIService();

// Bir necha request qiling...
await openaiService.createChatCompletion({...});
await openaiService.createChatCompletion({...});

// Statistikani ko'ring
const stats = openaiService.getUsageStats();
console.log('Total requests:', stats.totalRequests);  // 2
console.log('Total tokens:', stats.totalTokens);      // 1234
console.log('Total errors:', stats.totalErrors);      // 0

// Statistikani reset qilish
openaiService.resetUsageStats();
```

---

## Testing

Test yozish uchun singleton'ni reset qilish:

```typescript
import { OpenAIService } from "./services/openai";

beforeEach(() => {
  OpenAIService.resetInstance();
});

test('should create completion', async () => {
  const service = OpenAIService.getInstance({
    provider: 'openai',
    apiKey: 'test-key',
    enableLogging: false
  });

  // Test qiling...
});
```

---

## Ko'p ishlatiladigan patternlar

### Pattern 1: Service qayta ishlatish

```typescript
// services/my-ai-service.ts
import { getOpenAIService } from "./openai";

export class MyAIService {
  private openai = getOpenAIService();

  async generateText(prompt: string) {
    return this.openai.createChatCompletion({
      messages: [{ role: "user", content: prompt }]
    });
  }
}
```

### Pattern 2: Wrapper function

```typescript
// utils/ai-helpers.ts
import { getOpenAIService } from "../services/openai";

export async function askAI(question: string): Promise<string> {
  const openai = getOpenAIService();

  const result = await openai.createChatCompletion({
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: question }
    ]
  });

  return result.content;
}

// Ishlatish:
const answer = await askAI("What is 2+2?");
```

---

## Xulosa

Markazlashtirilgan OpenAI service ishlatish:

1. ✅ **Kodni soddalashtiraydi** - Kamroq boilerplate
2. ✅ **Xavfsizroq** - Markaziy error handling
3. ✅ **Tezroq development** - Bir joyda sozlash
4. ✅ **Oson maintain qilish** - Bir joyda o'zgartirish
5. ✅ **Production-ready** - Logging, monitoring, retry logic

**Barcha eski kodingizni yangilang va ishdan bahramand bo'ling! 🚀**
