# Content Generation Guide

## Functions

### 1. `generateOutline(slides, language, page, topic)`

Generates an outline and selects slides from the available slides.

**Parameters:**

- `slides` - Array of slide schemas from `.sxema.json`
- `language` - Language code (e.g., "uz", "Russian", "English")
- `page` - Number of slides to select
- `topic` - Main topic of the presentation

**Returns:**

```typescript
{
  outline: [
    { title: "Topic 1", title_eng: "Topic 1 in English" },
    { title: "Topic 2", title_eng: "Topic 2 in English" },
    { title: "Topic 3", title_eng: "Topic 3 in English" }
  ],
  slides: [
    {
      slideIndex: 5,        // Index from original slides array
      title: "Slide Title",
      title_eng: "Slide Title in English",
      outlineIndex: 0       // Which outline topic (0-2)
    }
  ]
}
```

### 2. `generateContent(slide, outline, language)`

Fills a slide with AI-generated content based on the outline topic.

**Parameters:**

- `slide` - Single slide object from `.sxema.json`
- `outline` - Single outline object with `{title, title_eng}`
- `language` - Language for content generation

**Returns:**
Updated slide with filled `content` fields in text/shape elements.

## Usage Examples

### Basic Usage

```typescript
import { generateOutline, generateContent } from "./llma-structured";

// 1. Load slides
const aiSchema = JSON.parse(fs.readFileSync("Amir.sxema.json", "utf-8"));

// 2. Generate outline
const outline = await generateOutline(
  aiSchema,
  "Russian",
  5,
  "Tumors of Nervous System"
);

// 3. Fill first slide with content
const firstSlide = outline.slides[0];
const outlineForSlide = outline.outline[firstSlide.outlineIndex];
const slideToFill = aiSchema[firstSlide.slideIndex];

const filledSlide = await generateContent(
  slideToFill,
  outlineForSlide,
  "Russian"
);
```

### Fill All Slides

```typescript
const allFilledSlides = [];

for (const selectedSlide of outline.slides) {
  const slideOutline = outline.outline[selectedSlide.outlineIndex];
  const originalSlide = aiSchema[selectedSlide.slideIndex];

  const filled = await generateContent(originalSlide, slideOutline, "Russian");

  allFilledSlides.push(filled);

  // Rate limiting
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
```

## Test Files

- `testLlm.ts` - Simple example with 1 slide
- `testContentGeneration.ts` - Complete demo with all slides

## Run

```bash
# Simple test
ts-node testLlm.ts

# Full demo
ts-node testContentGeneration.ts
```

## Output Files

- `Amir.outline.json` - Generated outline
- `Amir.filled-slide.json` - Single filled slide
- `demo.all-filled-slides.json` - All filled slides
