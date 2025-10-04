# 🚀 Slayd Generatsiya Tizimi - Yangilanishlar Qo'llanmasi

## 📋 Mundarija
1. [Amalga oshirilgan yaxshilanishlar](#amalga-oshirilgan-yaxshilanishlar)
2. [Fayl tuzilmasi](#fayl-tuzilmasi)
3. [Asosiy funksiyalar](#asosiy-funksiyalar)
4. [Ishlatish bo'yicha qo'llanma](#ishlatish-boyicha-qollanma)
5. [Konfiguratsiya](#konfiguratsiya)
6. [Xatolarni tuzatish](#xatolarni-tuzatish)

---

## ✅ Amalga oshirilgan yaxshilanishlar

### 1. **Font o'lchami avtomatik moslashuvi** 🎨
**Muammo:** Matn juda uzun bo'lganda, slaydning chegarasidan chiqib ketardi.

**Yechim:** Endi matn qisqartirilmaydi, faqat font o'lchami avtomatik kamaytiriladi.

**Qanday ishlaydi:**
```typescript
// Agar matn 100 belgidan uzun bo'lsa:
// Asl font: 24px
// Matn uzunligi: 150 belgi
// Yangi font = 24 * (100 / 150) = 16px
```

**Afzalliklari:**
- ✅ Hech qanday ma'lumot yo'qolmaydi
- ✅ Matn butunlay ko'rinadi
- ✅ O'qish uchun minimal 8px saqlanadi
- ✅ Avtomatik hisoblash

**Kod joylashuvi:**
- `llma-structured.ts:33-42` - `applyFontSize()` funksiyasi
- `llma-structured.ts:44-111` - `validateContent()` funksiyasi

---

### 2. **Takrorlanmaydigan kontent generatsiyasi** 🔄
**Muammo:** Bir xil o'lchamdagi elementlarga bir xil yoki juda qisqa matn berilardi.

**Yechim:** Har bir element uchun UNIKAL matn generatsiya qilinadi.

**Qanday ishlaydi:**
```typescript
// Tizim o'xshash elementlarni aniqlaydi
const similarElements = elements.filter(el =>
  Math.abs(el.maxCharacters - currentEl.maxCharacters) < 50
);

// LLM'ga xabar beradi
prompt += "⚠️ ${similarElements.length} ta o'xshash element bor.";
prompt += "Har biriga TURLI matn yarating!";
```

**Afzalliklari:**
- ✅ Har bir element unikal matnli
- ✅ Turli xil mavzular
- ✅ Takrorlanish yo'q
- ✅ To'liq va mazmunli matnlar

**Kod joylashuvi:**
- `llma-structured.ts:113-138` - `groupBySimilarSize()` funksiyasi
- `llma-structured.ts:368-429` - Diversity konteksti

---

### 3. **Yaxshilangan belgilar limiti** 📏
**Muammo:** Matnlar uchun juda kam joy berilardi, to'liq jumlalar sig'masdi.

**Yechim:** MaxCharacters hisoblash 20% oshirildi.

**Qanday ishlaydi:**
```typescript
// Avvalgi hisoblash:
maxCharacters = (width / (fontSize * 0.6)) * (height / (fontSize * 1.2))
// Yangi hisoblash:
maxCharacters = Math.floor(baseMaxChars * 1.2) // +20% qo'shimcha
```

**Afzalliklari:**
- ✅ To'liq jumlalar uchun joy
- ✅ Tabiiy matn oqimi
- ✅ Kamroq qisqarish
- ✅ Yaxshiroq formatlanish

**Kod joylashuvi:**
- `sxema.ts:48-76` - `calculateMaxCharacters()` funksiyasi

---

### 4. **Moslashuvchan validatsiya** ⚖️
**Muammo:** Barcha elementlar uchun bir xil qat'iy qoidalar qo'llanardi.

**Yechim:** Element o'lchamiga qarab turli talablar.

**Talablar:**
| Element o'lchami | Minimal foydalanish |
|-----------------|---------------------|
| Katta (>200 belgi) | 40% |
| O'rtacha (50-200) | 30% |
| Kichik (<50) | 20% |

**Afzalliklari:**
- ✅ Kichik elementlar uchun yumshoqroq
- ✅ Katta elementlar to'liqroq to'ldiriladi
- ✅ Mantiqiy taqsimot
- ✅ Minimal xatolar

**Kod joylashuvi:**
- `llma-structured.ts:81-103` - Flexible validation logic

---

### 5. **Yaxshilangan LLM promptlar** 🤖
**Muammo:** LLM'ga noaniq ko'rsatmalar berilardi.

**Yechim:** Batafsil ko'rsatmalar, misollar va qat'iy qoidalar qo'shildi.

**Qo'shilgan elementlar:**
```typescript
// 1. Har bir element uchun aniq ma'lumot
prompt += `
Element ID: #${el.index}
Font o'lchami: ${el.fontSize}px
MAKSIMAL belgilar: ${el.maxCharacters}
MUHIM: Bu limitdan OSHMASIN!
`;

// 2. Yaxshi vs yomon misollar
prompt += `
✅ YAXSHI: "Nerv tizimi kasalliklari - asosiy omillar"
❌ YOMON: "Nerv tizimi kasalliklari nerv tizimi kasalliklari..."
`;

// 3. Diversity ko'rsatmalari
prompt += `
⚠️ CONTENT DIVERSITY: Har bir element UNIKAL bo'lishi kerak
TAKRORLAMASLIK kerak!
`;
```

**Afzalliklari:**
- ✅ Aniq ko'rsatmalar
- ✅ Misollar bilan
- ✅ Qat'iy limitlar
- ✅ Sifat nazorati

**Kod joylashuvi:**
- `llma-structured.ts:375-520` - Enhanced prompt generation

---

### 6. **Yozuvlar tozalandi** 🧹
**Muammo:** Schema faylida xato misollar bor edi.

**Tuzatilgan xatolar:**
```diff
- "CAUSES OFIMPACTION"
+ "CAUSES OF IMPACTION"

- "IMPACTEDTOOTH"
+ "IMPACTED TOOTH"

- "Lorem ipsum dolor...300+ belgi..."
+ "To'g'ri uzunlikdagi misol matn"
```

**Kod joylashuvi:**
- `amir.sxema.json` - Butun fayl tozalandi

---

## 📁 Fayl tuzilmasi

### Asosiy fayllar:

```
pikachu/
├── llma-structured.ts         # Asosiy generatsiya logikasi
├── sxema.ts                   # Schema generatsiya
├── testLlm.ts                 # Test va ishga tushirish
├── amir.json                  # To'liq slayd ma'lumotlari
├── amir.sxema.json           # LLM uchun soddalashtirilgan schema
└── YANGILANISHLAR.md         # Bu qo'llanma
```

### Fayl vazifalari:

#### 1. **llma-structured.ts** (1100+ qator)
Vazifasi: Slayd kontentini generatsiya qilish

Asosiy funksiyalar:
- `applyFontSize()` - Font o'lchamini HTML'ga qo'llash
- `validateContent()` - Kontent sifatini tekshirish
- `groupBySimilarSize()` - O'xshash elementlarni guruhlash
- `findNearbyElements()` - Yaqin elementlarni topish
- `generateContent()` - Asosiy kontent generatsiyasi
- `generateConculation()` - Xulosa slaydini generatsiya qilish
- `generateReferences()` - Manbalar slaydini generatsiya qilish
- `generateThankYouSlide()` - Rahmat slaydini generatsiya qilish

#### 2. **sxema.ts** (150+ qator)
Vazifasi: LLM uchun schema tayyorlash

Asosiy funksiyalar:
- `extractFontSize()` - HTML'dan font o'lchamini ajratib olish
- `calculateMaxCharacters()` - Maksimal belgilar sonini hisoblash
- `generateAISchema()` - AI uchun schema yaratish

#### 3. **testLlm.ts** (200+ qator)
Vazifasi: Sistemani ishga tushirish va test qilish

Asosiy funksiyalar:
- `generateAmir()` - Butun taqdimotni generatsiya qilish
- Logging va xatolarni qayta ishlash

---

## 🎯 Asosiy funksiyalar

### 1. Font o'lchami moslashuvi

**Funksiya:** `applyFontSize(htmlContent: string, newFontSize: number)`

**Maqsadi:** HTML matnidagi font o'lchamini o'zgartirish

**Misol:**
```typescript
const html = '<span style="font-size: 24.0px;">Matn</span>';
const updated = applyFontSize(html, 16.5);
// Natija: '<span style="font-size: 16.5px;">Matn</span>'
```

**Qachon ishlatiladi:**
- Matn maksimal limitdan oshganda
- Avtomatik ravishda validateContent() tomonidan chaqiriladi

---

### 2. Kontent validatsiyasi

**Funksiya:** `validateContent(element, content, fontSize, maxCharacters)`

**Maqsadi:** Generatsiya qilingan matnni tekshirish va tuzatish

**Qaytaradi:**
```typescript
{
  isValid: boolean,           // Validatsiya o'tdimi
  content: string,            // Matn
  fontSize?: number,          // Moslashtirilgan font (agar kerak bo'lsa)
  warnings: string[]          // Ogohlantirishlar
}
```

**Tekshiriladigan narsalar:**
1. ✅ Bo'sh joylar mavjudmi (so'zlar orasida)
2. ✅ Belgilar limiti oshmaganmi
3. ✅ Matn juda qisqa emasmi
4. ✅ Font o'lchami minimal qiymatdan pastmi

**Misol:**
```typescript
const result = validateContent(
  element,
  "Juda uzun matn...",
  24,
  100
);

if (result.fontSize) {
  console.log(`Font ${24}px dan ${result.fontSize}px ga kamaytirildi`);
}
```

---

### 3. O'xshash elementlarni guruhlash

**Funksiya:** `groupBySimilarSize(elements)`

**Maqsadi:** Bir xil o'lchamdagi elementlarni topish

**Qaytaradi:** `Map<number, Element[]>`

**Misol:**
```typescript
const groups = groupBySimilarSize(elements);
// Natija:
// Map {
//   100 => [element1, element2, element3],  // 100 belgilik elementlar
//   250 => [element4, element5],            // 250 belgilik elementlar
// }
```

**Qachon ishlatiladi:**
- LLM'ga diversity konteksti berish uchun
- Har bir guruh uchun turli matn talab qilish uchun

---

### 4. Yaqin elementlarni topish

**Funksiya:** `findNearbyElements(current, allElements, threshold=50)`

**Maqsadi:** Elementning 50px atrofidagi boshqa elementlarni topish

**Qaytaradi:** `Element[]`

**Misol:**
```typescript
const nearby = findNearbyElements(currentEl, allElements, 50);
// Natija: [element2, element5] - 50px ichidagi elementlar
```

**Qachon ishlatiladi:**
- Elementlar bir-birining ustiga chiqmaslik uchun
- LLM'ga spatial awareness berish uchun

---

### 5. Schema generatsiyasi

**Funksiya:** `generateAISchema(amir.json)`

**Maqsadi:** To'liq JSON'dan soddalashtirilgan schema yaratish

**O'zgarishlar:**
```typescript
// amir.json (to'liq)
{
  "type": "shape",
  "width": 326.06,
  "height": 47.29,
  "text": {
    "content": "<p style=\"font-size: 24.0px;\">Matn</p>"
  }
}

// amir.sxema.json (soddalashtirilgan)
{
  "type": "shape",
  "width": 326.06,
  "height": 47.29,
  "content": "Matn",
  "fontSize": 24,           // ← YANGI
  "maxCharacters": 70,      // ← YANGI
  "elementIndex": 19
}
```

---

## 📘 Ishlatish bo'yicha qo'llanma

### Oddiy ishlatish

```bash
# 1. Schema generatsiya qilish
npx tsx sxema.ts

# 2. Slaydlarni generatsiya qilish
npx tsx testLlm.ts

# 3. Natijani ko'rish
# amir-generated.json fayli yaratiladi
```

---

### Qadamma-qadam jarayon

#### 1-qadam: Schema tayyorlash

```bash
npx tsx sxema.ts
```

**Nima bo'ladi:**
- `amir.json` o'qiladi
- Har bir element uchun:
  - Font o'lchami ajratib olinadi
  - MaxCharacters hisoblanadi
- `amir.sxema.json` yaratiladi

**Chiqish:**
```
✅ Schema generatsiya qilindi
📊 Jami 45 ta element
📝 Font o'lchamlari: 24px, 18px, 16px...
📏 Belgilar limiti: 70, 150, 200...
```

---

#### 2-qadam: Kontent generatsiya qilish

```bash
npx tsx testLlm.ts
```

**Nima bo'ladi:**
1. Schema yuklanadi
2. Har bir slayd uchun:
   - Element analiz qilinadi
   - LLM'ga so'rov yuboriladi
   - Javob validatsiya qilinadi
   - Font o'lchami moslashtiriladi (agar kerak bo'lsa)
   - Natija saqlanadi

**Chiqish:**
```
🚀 Slayd generatsiyasi boshlandi...
📊 Jami 10 ta slayd

Slayd 1/10 [████████████████████] 100%
  ✅ 5 ta element generatsiya qilindi
  ⚠️  Element 3: Font 24px → 18.5px kamaytirildi

Slayd 2/10 [████████████████████] 100%
  ✅ 7 ta element generatsiya qilindi

...

✅ Barcha slaydlar tayyor!
💾 Natija: amir-generated.json
```

---

### Xatolarni bartaraf etish

#### Xato: "Font size too small"
```
❌ Element 5: Font 8px dan past bo'lib qoladi (6.2px)
```

**Sabab:** Matn juda-juda uzun

**Yechim:**
1. Matnni qisqartiring
2. Element o'lchamini oshiring
3. Dastlabki font o'lchamini oshiring

---

#### Xato: "Content too short"
```
⚠️  Element 3: Matn juda qisqa (15 belgi, kerak 60+)
```

**Sabab:** LLM juda qisqa matn yaratdi

**Yechim:**
- Avtomatik: Tizim qayta generatsiya qiladi
- Qo'lda: Promptni yaxshilang

---

#### Xato: "Duplicate content detected"
```
⚠️  Element 7 va Element 8: O'xshash matnlar
```

**Sabab:** LLM diversity qoidasini buzmagan

**Yechim:**
- Avtomatik: Tizim qayta urinadi
- Diversity konteksti allaqachon yaxshilangan

---

### Natijani tekshirish

#### Generatsiya qilingan faylni ko'rish

```bash
# JSON faylni o'qish
npx tsx -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('amir-generated.json', 'utf-8'));
console.log('Slaydlar soni:', data.slide.length);
data.slide.forEach((slide, i) => {
  console.log(\`Slayd \${i+1}: \${slide.elements.length} ta element\`);
});
"
```

#### Sifatni tekshirish

```typescript
// Element ma'lumotlarini ko'rish
const slide1 = data.slide[0];
slide1.elements.forEach(el => {
  console.log('Element:', el.type);
  console.log('Matn uzunligi:', el.content?.length || 0);
  console.log('Font o'lchami:', el.fontSize || 'N/A');
  console.log('---');
});
```

---

## ⚙️ Konfiguratsiya

### Font o'lchami sozlamalari

**Joyi:** `llma-structured.ts:75`

```typescript
// Minimal font o'lchami (o'qish uchun)
const MIN_FONT_SIZE = 8; // px

// Font kamayishini hisoblash
newFontSize = originalFontSize * (maxCharacters / actualLength);
newFontSize = Math.max(newFontSize, MIN_FONT_SIZE);
```

**O'zgartirish:**
```typescript
// Agar 8px juda kichik bo'lsa:
const MIN_FONT_SIZE = 10; // O'zgartirildi: 8 → 10

// Agar kamroq kamayishni xohlasangiz:
newFontSize = originalFontSize * Math.sqrt(maxCharacters / actualLength);
```

---

### Validatsiya sozlamalari

**Joyi:** `llma-structured.ts:81-103`

```typescript
// Minimal matn uzunligi talablari
if (maxCharacters > 200) {
  minUsage = 0.40; // 40% - katta elementlar
} else if (maxCharacters > 50) {
  minUsage = 0.30; // 30% - o'rtacha elementlar
} else {
  minUsage = 0.20; // 20% - kichik elementlar
}
```

**O'zgartirish:**
```typescript
// Agar qat'iyroq qoidalar kerak bo'lsa:
if (maxCharacters > 200) {
  minUsage = 0.60; // O'zgartirildi: 40% → 60%
}

// Agar yumshoqroq qoidalar kerak bo'lsa:
if (maxCharacters < 50) {
  minUsage = 0.10; // O'zgartirildi: 20% → 10%
}
```

---

### MaxCharacters sozlamalari

**Joyi:** `sxema.ts:69-72`

```typescript
// 1.2x ko'paytirish (20% qo'shimcha)
return Math.max(10, Math.floor(baseMaxChars * 1.2));
```

**O'zgartirish:**
```typescript
// Ko'proq joy kerak bo'lsa:
return Math.max(10, Math.floor(baseMaxChars * 1.5)); // 50% qo'shimcha

// Kamroq joy kerak bo'lsa:
return Math.max(10, Math.floor(baseMaxChars * 1.0)); // Qo'shimcha yo'q
```

---

### LLM Prompt sozlamalari

**Joyi:** `llma-structured.ts:375-520`

```typescript
// Temperature (kreativlik)
temperature: 0.7 // 0.0 (deterministik) - 1.0 (kreativ)

// Token limiti
max_tokens: 4096

// Model
model: "claude-sonnet-4"
```

**O'zgartirish:**
```typescript
// Ko'proq kreativlik uchun:
temperature: 0.9

// Aniqroq natijalar uchun:
temperature: 0.3

// Katta slaydlar uchun:
max_tokens: 8192
```

---

## 🐛 Xatolarni tuzatish

### Diagnostika

#### 1. Log fayllarini yoqish

```typescript
// llma-structured.ts da qo'shing
const DEBUG = true;

function log(...args: any[]) {
  if (DEBUG) {
    console.log('[DEBUG]', new Date().toISOString(), ...args);
  }
}

// Ishlatish
log('Element validatsiya qilinmoqda:', element.id);
log('Font o'lchami:', originalFont, '→', newFont);
```

#### 2. Validation natijalarini ko'rish

```typescript
// testLlm.ts da qo'shing
const validationResults = [];

elements.forEach(el => {
  const result = validateContent(...);
  validationResults.push({
    element: el.id,
    ...result
  });
});

console.table(validationResults);
```

**Chiqish:**
```
┌─────────┬───────────┬──────────┬─────────────┐
│ (index) │ element   │ isValid  │ fontSize    │
├─────────┼───────────┼──────────┼─────────────┤
│    0    │ 'el-1'    │   true   │   24        │
│    1    │ 'el-2'    │   true   │   18.5      │
│    2    │ 'el-3'    │   false  │   6.2       │
└─────────┴───────────┴──────────┴─────────────┘
```

---

### Tez-tez uchraydigan xatolar

#### Xato 1: "Cannot read property 'fontSize' of undefined"

**Sabab:** Schema faylida fontSize maydoni yo'q

**Yechim:**
```bash
# Schema'ni qayta generatsiya qiling
npx tsx sxema.ts

# Tekshiring
npx tsx -e "
const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('amir.sxema.json', 'utf-8'));
console.log('Birinchi element:', schema.slide[0].elements[0]);
// fontSize va maxCharacters borligini tekshiring
"
```

---

#### Xato 2: "Font size reduced below minimum"

**Sabab:** Matn element uchun juda uzun

**Yechim 1:** Element o'lchamini oshiring
```typescript
// amir.json da
{
  "width": 326,   // → 500 ga oshiring
  "height": 47    // → 70 ga oshiring
}
```

**Yechim 2:** Minimal font o'lchamini kamaying
```typescript
// llma-structured.ts:75
const MIN_FONT_SIZE = 6; // 8 o'rniga 6
```

**Yechim 3:** LLM'ga qisqaroq matn yaratishni buyuring
```typescript
// Promptga qo'shing
prompt += `
MAXSUS TALAT: Bu element uchun JUDA QISQA matn yozing.
Maksimal ${maxCharacters} belgi, lekin ${maxCharacters * 0.7} belgidan kam bo'lsa yaxshi.
`;
```

---

#### Xato 3: "Duplicate content in similar elements"

**Sabab:** LLM diversity ko'rsatmasiga amal qilmagan

**Yechim:** Diversity kontekstini kuchaytiring
```typescript
// llma-structured.ts prompt qismida
prompt += `
🚨 JUDA MUHIM: Har bir element uchun MUTLAQO TURLI matn!

Misollar:
Element 1: "Asosiy xususiyatlar va afzalliklar"
Element 2: "Texnologiya va innovatsiyalar" // ← TURLI mavzu
Element 3: "Kelajak rejalari va strategiya" // ← YANA TURLI

❌ QILMANG:
Element 1: "Asosiy xususiyatlar"
Element 2: "Asosiy xususiyatlar va afzalliklar" // ← O'xshash!
Element 3: "Xususiyatlar" // ← O'xshash!
`;
```

---

#### Xato 4: "Content too short for element"

**Sabab:** LLM juda qisqa matn yaratdi

**Yechim:** Promptda minimal uzunlikni ta'kidlang
```typescript
prompt += `
UZUNLIK TALABI:
- Agar maxCharacters > 200: Kamida 80-120 belgilik matn yozing
- Agar maxCharacters > 100: Kamida 50-70 belgilik matn yozing
- Agar maxCharacters > 50: Kamida 25-35 belgilik matn yozing

Qisqa iboralar o'rniga TO'LIQ JUMLALAR yozing!
`;
```

---

### Performance muammolari

#### Muammo: "Generatsiya juda sekin"

**Diagnostika:**
```typescript
// Vaqtni o'lchash
const startTime = Date.now();

// ... generatsiya kodi ...

const duration = Date.now() - startTime;
console.log(`Vaqt: ${duration}ms`);
```

**Yechim 1:** Parallel generatsiya
```typescript
// Ketma-ket o'rniga:
for (const slide of slides) {
  await generateSlide(slide); // Sekin
}

// Parallel:
const promises = slides.map(slide => generateSlide(slide));
const results = await Promise.all(promises); // Tez
```

**Yechim 2:** Keshlovchi qo'shing
```typescript
const cache = new Map();

async function generateWithCache(prompt: string, schema: any) {
  const key = JSON.stringify({ prompt, schema });

  if (cache.has(key)) {
    console.log('✅ Keshdan olindi');
    return cache.get(key);
  }

  const result = await generateSlide(prompt, schema);
  cache.set(key, result);
  return result;
}
```

---

### Memory muammolari

#### Muammo: "Out of memory"

**Sabab:** Juda ko'p slaydlar bir vaqtda xotirada

**Yechim:** Batch processing
```typescript
// Hammasi bir vaqtda o'rniga:
const allSlides = await generateAllSlides(100); // ❌ Memory overflow

// Partiyalarda:
const BATCH_SIZE = 10;
const results = [];

for (let i = 0; i < slides.length; i += BATCH_SIZE) {
  const batch = slides.slice(i, i + BATCH_SIZE);
  const batchResults = await Promise.all(
    batch.map(slide => generateSlide(slide))
  );
  results.push(...batchResults);

  // Keshni tozalash
  if (global.gc) global.gc();
}
```

---

## 📊 Statistika va monitoring

### Generatsiya statistikasi

```typescript
interface GenerationStats {
  totalSlides: number;
  totalElements: number;
  fontAdjustments: number;
  averageFontReduction: number;
  validationWarnings: number;
  generationTime: number;
}

function calculateStats(results: any[]): GenerationStats {
  let fontAdjustments = 0;
  let totalReduction = 0;
  let warnings = 0;

  results.forEach(result => {
    if (result.fontSize !== result.originalFontSize) {
      fontAdjustments++;
      totalReduction += result.originalFontSize - result.fontSize;
    }
    warnings += result.warnings.length;
  });

  return {
    totalSlides: results.length,
    totalElements: results.reduce((sum, r) => sum + r.elements.length, 0),
    fontAdjustments,
    averageFontReduction: totalReduction / fontAdjustments || 0,
    validationWarnings: warnings,
    generationTime: Date.now() - startTime
  };
}

// Ishlatish
const stats = calculateStats(generatedSlides);
console.log(`
📊 GENERATSIYA STATISTIKASI
━━━━━━━━━━━━━━━━━━━━━━━━━
📄 Slaydlar: ${stats.totalSlides}
📦 Elementlar: ${stats.totalElements}
🔧 Font moslashtirish: ${stats.fontAdjustments}
📉 O'rtacha kamayish: ${stats.averageFontReduction.toFixed(1)}px
⚠️  Ogohlantirishlar: ${stats.validationWarnings}
⏱️  Vaqt: ${(stats.generationTime / 1000).toFixed(2)}s
━━━━━━━━━━━━━━━━━━━━━━━━━
`);
```

---

## 🎓 Best Practices

### 1. Schema tayyorlash

✅ **To'g'ri:**
```typescript
// Har safar yangi taqdimot uchun schema'ni qayta generatsiya qiling
npx tsx sxema.ts
```

❌ **Noto'g'ri:**
```typescript
// Eski schema'ni qayta ishlatish
// (fontSize va maxCharacters eski bo'lib qolishi mumkin)
```

---

### 2. Validatsiya natijalarini tekshirish

✅ **To'g'ri:**
```typescript
const result = validateContent(...);

if (result.warnings.length > 0) {
  console.warn('Ogohlantirishlar:', result.warnings);
  // Kerak bo'lsa tuzatish qiling
}

if (result.fontSize) {
  console.log('Font moslashtirildi:', result.fontSize);
  // Agar juda kichik bo'lsa, qayta generatsiya qiling
}
```

❌ **Noto'g'ri:**
```typescript
validateContent(...); // Natijani tekshirmaslik
```

---

### 3. Error handling

✅ **To'g'ri:**
```typescript
try {
  const result = await generateSlide(prompt, schema);

  if (!result || !result.elements) {
    throw new Error('Invalid result structure');
  }

  return result;
} catch (error) {
  console.error('Xato:', error.message);

  // Fallback
  return generateDefaultSlide();
}
```

❌ **Noto'g'ri:**
```typescript
const result = await generateSlide(...); // Xatoni ushlamas
return result; // result undefined bo'lishi mumkin
```

---

### 4. Performance optimization

✅ **To'g'ri:**
```typescript
// Promise.all bilan parallel
const slides = await Promise.all([
  generateSlide(slide1),
  generateSlide(slide2),
  generateSlide(slide3)
]);
```

❌ **Noto'g'ri:**
```typescript
// Ketma-ket (sekinroq)
const slide1 = await generateSlide(slide1);
const slide2 = await generateSlide(slide2);
const slide3 = await generateSlide(slide3);
```

---

### 5. Diversity ta'minlash

✅ **To'g'ri:**
```typescript
// Har bir element uchun alohida kontekst
elements.forEach((el, index) => {
  prompt = `
    Element #${index} (UNIKAL bo'lishi kerak)
    Oldingi elementlar: ${previousElements.join(', ')}
    Bu element TURLI mavzuda bo'lishi kerak!
  `;

  previousElements.push(generateContent(el, prompt));
});
```

❌ **Noto'g'ri:**
```typescript
// Barcha elementlar uchun bir xil prompt
const prompt = "Matn yozing";
elements.forEach(el => {
  generateContent(el, prompt); // Hammasi bir xil bo'ladi
});
```

---

## 📞 Yordam va qo'llab-quvvatlash

### Muammolar yuzaga kelsa:

1. **Loglarni tekshiring**
   ```bash
   npx tsx testLlm.ts > output.log 2>&1
   cat output.log
   ```

2. **Schema'ni tekshiring**
   ```bash
   npx tsx -e "
   const schema = require('./amir.sxema.json');
   console.log('Font o'lchamlari:',
     schema.slide[0].elements.map(e => e.fontSize)
   );
   "
   ```

3. **Validatsiya natijalarini saqlang**
   ```typescript
   const fs = require('fs');
   fs.writeFileSync(
     'validation-results.json',
     JSON.stringify(validationResults, null, 2)
   );
   ```

---

## 🎉 Xulosa

### Asosiy yutuqlar:

1. ✅ **Font avtomatik moslashuvi** - Matn yo'qolmaydi
2. ✅ **Unikal kontent** - Takrorlanish yo'q
3. ✅ **Yaxshilangan limitlar** - +20% ko'proq joy
4. ✅ **Moslashuvchan validatsiya** - O'lchamga qarab
5. ✅ **Tozalangan schema** - Xatosiz misollar
6. ✅ **Yaxshilangan promptlar** - Aniq ko'rsatmalar

### Oldinga qarash:

Keyingi versiyalarda qo'shilishi mumkin:
- 🚀 Cache tizimi (tezroq generatsiya)
- 🔄 Retry mexanizmi (ishonchlilik)
- 📊 Quality scoring (sifat bahosi)
- 🎨 Layout optimizer (avtomatik joylashuv)
- 📈 Progress tracking (jarayon ko'rinishi)
- ⚙️ Config system (sozlamalar boshqaruvi)

---

**Savol yoki muammolar uchun:**
- GitHub Issues: [Loyiha repo'si](https://github.com/...)
- Email: support@example.com
- Telegram: @support

**Yangilanish sanasi:** 2025-10-03
**Versiya:** 2.0.0

---

*Bu qo'llanma slayd generatsiya tizimining barcha yangilanishlarini o'z ichiga oladi. Savollaringiz bo'lsa, iltimos bog'laning!* 🚀
