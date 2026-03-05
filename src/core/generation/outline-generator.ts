/**
 * Outline Generator
 *
 * Generates the presentation outline (3 main topics + slide assignments).
 * Uses AIClient for retry/circuit breaker support.
 */

import { AIClient } from '../ai/ai-client';
import { EnhancedLogger, LogLevel } from '../../lib/logger';
import { OutlineSchema, OutlineResponse } from '../processors/schema-processor';
import { createOutlineSchema } from '../schemas/ai-response-schemas';
import { AISlide, GenerationConfig, DEFAULT_GENERATION_CONFIG } from '../types/generation';

export interface OutlineParams {
  slides: AISlide[];
  language: string;
  pageCount: number;
  topic: string;
  outlineCount?: number;
}

export class OutlineGenerator {
  private aiClient: AIClient;
  private logger: EnhancedLogger;
  private config: GenerationConfig;

  constructor(aiClient: AIClient, config?: Partial<GenerationConfig>, logger?: EnhancedLogger) {
    this.aiClient = aiClient;
    this.config = { ...DEFAULT_GENERATION_CONFIG, ...config };
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
  }

  /**
   * Dynamic outline count based on page count.
   * Fewer pages → fewer sections, more pages → more sections for depth.
   */
  private calculateOutlineCount(pageCount: number, configCount: number): number {
    if (pageCount <= 6) return Math.min(configCount, 2);
    if (pageCount <= 10) return 3;
    if (pageCount <= 15) return 4;
    if (pageCount <= 20) return 5;
    return Math.min(6, Math.ceil(pageCount / 4));
  }

  async generate(params: OutlineParams): Promise<OutlineResponse> {
    const { language, pageCount, topic } = params;
    const outlineCount = this.calculateOutlineCount(pageCount, params.outlineCount ?? this.config.outlineCount);

    // Filter slides: remove first 2 and last 3 (title, outline, conclusion, references, thankyou)
    let slides = params.slides.filter(
      (_, index) =>
        index !== 0 &&
        index !== 1 &&
        index !== params.slides.length - 3 &&
        index !== params.slides.length - 2 &&
        index !== params.slides.length - 1
    );

    const availableSlidesCount = slides.length;

    this.logger.info('Generating outline', {
      topic,
      language,
      availableSlides: availableSlidesCount,
      requestedPages: pageCount,
      outlineCount,
    });

    const jsonSchema = createOutlineSchema(language, outlineCount, pageCount, availableSlidesCount);

    const result = await this.aiClient.call<OutlineResponse>({
      operationName: 'generateOutline',
      temperature: 0.7,
      responseFormat: 'json_schema',
      responseSchema: jsonSchema,
      messages: [
        {
          role: 'system',
          content: this.buildSystemPrompt(topic, language, availableSlidesCount, pageCount, outlineCount),
        },
        {
          role: 'user',
          content: this.buildUserPrompt(topic, language, slides, availableSlidesCount, pageCount, outlineCount),
        },
      ],
      fallback: () => this.buildFallbackOutline(topic, language, pageCount, availableSlidesCount, outlineCount),
    });

    // Validate with Zod
    const parsed = OutlineSchema.parse(result.data);

    // Validate slide indexes
    const invalidIndexes = parsed.slides.filter(
      (slide) => slide.slideIndex < 0 || slide.slideIndex >= availableSlidesCount
    );

    if (invalidIndexes.length > 0) {
      this.logger.error('Invalid slideIndex found', undefined, { invalidIndexes });
      throw new Error(`Invalid slideIndex detected. Valid range: 0-${availableSlidesCount - 1}`);
    }

    if (parsed.slides.length !== pageCount) {
      this.logger.warn(`Expected ${pageCount} slides, got ${parsed.slides.length}`);
    }

    this.logger.info('Outline generated successfully', {
      outlines: parsed.outline.length,
      slides: parsed.slides.length,
      slideIndexes: parsed.slides.map((s) => s.slideIndex),
      tokenUsage: result.usage.totalTokens,
      cost: `$${result.usage.estimatedCost.toFixed(4)}`,
      fromCache: result.fromCache,
    });

    return parsed;
  }

  private buildSystemPrompt(
    topic: string,
    language: string,
    availableSlides: number,
    pageCount: number,
    outlineCount: number
  ): string {
    return `You are a world-class presentation architect and subject-matter expert. Create a masterful, university-level presentation outline about "${topic}".

YOUR EXPERTISE: You have deep knowledge of "${topic}" and can provide specific facts, real data, historical context, and expert-level analysis. You write like a professor preparing a keynote lecture.

PLANNING STRATEGY — Think step by step:
1. What is "${topic}"? Define its scope, field, and significance
2. What are the 5-10 most important facts, milestones, and concepts?
3. What is the BEST logical flow? (chronological? cause→effect? problem→solution? simple→complex?)
4. How to make each slide UNIQUE and VALUABLE — no filler, no repetition
5. What specific data points, names, dates, statistics can you include?

OUTLINE RULES:
- Create EXACTLY ${outlineCount} main sections
- Each section needs:
  * "title" in ${language} — must be specific and meaningful (NOT generic like "Introduction" or "Overview")
  * "title_eng" in English — same specificity
  * "description" — 2-3 sentences explaining what this section covers, why it matters, and what the audience will learn (in ${language})
- Sections MUST follow a compelling narrative arc:
  * Start with WHAT (definition, context, importance)
  * Move to HOW/WHY (mechanisms, causes, processes, history)
  * End with IMPACT/APPLICATION (results, future, practical use)
- Each section title must use domain-specific terminology of "${topic}"
- Sections should have ROUGHLY equal numbers of slides

SLIDE RULES:
- Total available slide templates: ${availableSlides} (indexes 0 to ${availableSlides - 1})
- Generate EXACTLY ${pageCount} slides
- ${pageCount > availableSlides ? `REUSE slide indexes as needed (${pageCount} slides > ${availableSlides} templates). Vary the reused templates — don't reuse the same one consecutively` : `Use indexes from 0 to ${availableSlides - 1}`}
- Each slide needs:
  * "slideIndex": valid index (0 to ${availableSlides - 1})
  * "title" / "title_eng": a SPECIFIC, descriptive slide title that tells the audience exactly what they'll learn (NOT the same as the section title, NOT generic like "Details" or "Information")
  * "outlineIndex": which section it belongs to (0 to ${outlineCount - 1})
  * "keyPoints": array of 3-4 HIGHLY SPECIFIC talking points

KEY POINTS QUALITY — THIS IS CRITICAL:
- Every keyPoint MUST contain at least ONE of: a specific number/statistic, a proper name, a date/year, a technical term, or a concrete example
- Write keyPoints as COMPLETE informative sentences, not vague phrases
- Each keyPoint should be independently valuable — if someone only reads that one point, they learn something real

EXAMPLES OF GOOD keyPoints (for topic "Sun'iy intellekt"):
✅ "GPT-4 modeli 1.7 trillion parametrga ega bo'lib, 2023-yilda OpenAI tomonidan ishlab chiqilgan"
✅ "Deep learning asosida tibbiyotda saraton kasalligini 94% aniqlik bilan aniqlash mumkin"
✅ "AlphaFold 2 oqsil strukturasini bashorat qilishda 200 million oqsilni xaritalagan"
✅ "2024-yilga kelib sun'iy intellekt sohasi 500 milliard dollar bozorga ega"

EXAMPLES OF BAD keyPoints (NEVER write like this):
❌ "Sun'iy intellektning muhim xususiyatlari"
❌ "Bu sohadagi asosiy rivojlanishlar"
❌ "Turli qo'llanilish sohalari mavjud"
❌ "Kelajakda ko'p o'zgarishlar bo'ladi"

VALIDATION CHECKLIST:
- Every slide title is unique and specific to "${topic}"
- No two slides share similar keyPoints
- keyPoints are factual, detailed sentences (not vague phrases)
- Slides are evenly distributed across ${outlineCount} sections
- The presentation tells a complete, compelling story about "${topic}"`;
  }

  private buildUserPrompt(
    topic: string,
    language: string,
    slides: AISlide[],
    availableSlides: number,
    pageCount: number,
    outlineCount: number
  ): string {
    // Build a simplified template summary (avoid sending entire JSON)
    const templateSummary = slides.map((s, i) => {
      const textEls = s.elements?.filter((e: any) => e.type === 'text' || e.type === 'shape') || [];
      return `Template ${i}: ${textEls.length} text elements`;
    }).join(', ');

    return `TOPIC: "${topic}"
LANGUAGE: ${language}
AVAILABLE SLIDE TEMPLATES: ${availableSlides} (indexes 0 to ${availableSlides - 1})
REQUIRED SLIDES: ${pageCount}
REQUIRED SECTIONS: ${outlineCount}

TEMPLATE INFO: ${templateSummary}

YOUR TASK:
You are preparing a professional presentation about "${topic}" for an educated audience. This presentation should be informative, well-researched, and engaging.

STEP 1 — Create ${outlineCount} main sections:
- Each with "title" (in ${language}), "title_eng" (English), and "description" (in ${language})
- Sections must form a logical narrative: context → core content → analysis → application/conclusion
- Section titles must be SPECIFIC to "${topic}" (not generic words like "Introduction")

STEP 2 — Plan EXACTLY ${pageCount} slides:
- Each slide: "slideIndex" (0 to ${availableSlides - 1}), "title"/"title_eng", "outlineIndex" (0 to ${outlineCount - 1}), "keyPoints" (3-4 items)
- Distribute slides evenly across sections (~${Math.round(pageCount / outlineCount)} slides per section)
- Each slide title should describe its specific sub-topic
- keyPoints must be COMPLETE, FACTUAL sentences with specific data

STEP 3 — Self-review before responding:
✅ Every keyPoint contains a specific fact (number, name, date, or technical detail)
✅ No two slides cover the same sub-topic
✅ The ${pageCount} slides tell a complete story from beginning to end
✅ All titles and keyPoints are in ${language} (except title_eng)
✅ Slide indexes are valid (0 to ${availableSlides - 1})`;
  }

  private buildFallbackOutline(
    topic: string,
    _language: string,
    pageCount: number,
    availableSlides: number,
    outlineCount: number
  ): OutlineResponse {
    this.logger.warn('Using fallback outline');

    const outlineLabels = [
      'Introduction',
      'Main Content',
      'Analysis',
      'Discussion',
      'Conclusion',
    ];

    const outline = Array.from({ length: outlineCount }, (_, i) => ({
      title: `${topic} - ${outlineLabels[i % outlineLabels.length]}`,
      title_eng: `${topic} - ${outlineLabels[i % outlineLabels.length]}`,
      description: `${outlineLabels[i % outlineLabels.length]} section about ${topic}`,
    }));

    const slides = Array.from({ length: pageCount }, (_, i) => ({
      slideIndex: i % availableSlides,
      title: `${topic} - Slide ${i + 1}`,
      title_eng: `${topic} - Slide ${i + 1}`,
      outlineIndex: i % outlineCount,
      keyPoints: [`Key point about ${topic}`],
    }));

    return { outline, slides };
  }
}
