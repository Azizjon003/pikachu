# OpenAI Service

Markazlashtirilgan OpenAI service - barcha OpenAI API chaqiriqlarini bir joydan boshqarish uchun.

## Xususiyatlari

- ✅ **Singleton Pattern** - Bir martalik konfiguratsiуa
- ✅ **OpenAI va Azure OpenAI** qo'llab-quvvatlash
- ✅ **Avtomatik retry logic** - Exponential backoff bilan
- ✅ **Request/Response logging** - Debug uchun
- ✅ **Usage tracking** - Token va xarajatlarni kuzatish
- ✅ **Error handling** - To'liq xatolik boshqaruvi

## Ishlatish

### 1. Asosiy ishlatish

```typescript
import { getOpenAIService } from '@/services/openai';

const openaiService = getOpenAIService();

// Chat completion
const result = await openaiService.createChatCompletion({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ]
});

console.log(result.content);
```

### 2. JSON response

```typescript
import { getOpenAIService } from '@/services/openai';

const openaiService = getOpenAIService();

interface MyResponse {
  title: string;
  description: string;
}

const result = await openaiService.createJsonCompletion<MyResponse>({
  messages: [
    { role: 'user', content: 'Generate a title and description for a blog post' }
  ]
});

console.log(result.title, result.description);
```

### 3. Configuratsiya

Environment variables orqali:

```env
# OpenAI (oddiy)
OPENAI_API_KEY=sk-...

# Yoki Azure OpenAI (tavsiya etiladi)
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_API_VERSION=2024-05-01-preview
AZURE_OPENAI_DEPLOYMENT=gpt-4o
```

### 4. Maxsus konfiguratsiya

```typescript
import { OpenAIService } from '@/services/openai';

const customService = OpenAIService.getInstance({
  provider: 'openai',
  apiKey: 'your-key',
  defaultModel: 'gpt-4o',
  maxRetries: 5,
  timeout: 120000,
  enableLogging: true
});
```

## API

### `createChatCompletion(options)`

Chat completion yaratadi.

**Options:**
- `model?: string` - Model nomi
- `messages: Array<{role, content}>` - Xabarlar
- `temperature?: number` - Randomness (0-2)
- `maxTokens?: number` - Maksimal tokenlar
- `responseFormat?: {type}` - Response formati

**Returns:** `ChatCompletionResult`

### `createJsonCompletion<T>(options)`

JSON formatda javob qaytaradi.

**Options:** `createChatCompletion` bilan bir xil (responseFormat bundan tashqari)

**Returns:** `T` (sizning type'ingiz)

### `getClient()`

Raw OpenAI client'ini olish (advanced ishlatish uchun).

### `getUsageStats()`

Foydalanish statistikasini ko'rish:

```typescript
const stats = openaiService.getUsageStats();
console.log('Total requests:', stats.totalRequests);
console.log('Total tokens:', stats.totalTokens);
console.log('Total errors:', stats.totalErrors);
```

## Migration Guide

Eski kod:

```typescript
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [...]
});

const result = JSON.parse(response.choices[0].message.content);
```

Yangi kod:

```typescript
import { getOpenAIService } from '@/services/openai';

const openaiService = getOpenAIService();

const result = await openaiService.createJsonCompletion({
  model: 'gpt-4o',
  messages: [...]
});
```

## Afzalliklari

1. **Markazlashgan boshqaruv** - Bir joydan barcha OpenAI chaqiriqlarini boshqarish
2. **Oson provider almashtirish** - OpenAI ↔️ Azure OpenAI
3. **Logging va monitoring** - Barcha request/response'larni kuzatish
4. **Retry logic** - Avtomatik xatolikni qayta urinish
5. **Type safety** - TypeScript bilan to'liq qo'llab-quvvatlash

## Examples

Loyihadagi barcha AI servicelar ushbu markazlashtirilgan service'dan foydalanadi:

- `src/services/ai-schema/ai-schema-transformer.ts`
- `src/services/ai-schema/creative-layout-analyzer.ts`
- `src/services/layout/ai-layout-optimizer.ts`
- `src/services/image/ai-image-agent.ts`
- `src/core/generators/llm-client.ts`

Va boshqalar...
