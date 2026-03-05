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

  async generate(params: OutlineParams): Promise<OutlineResponse> {
    const { language, pageCount, topic } = params;
    const outlineCount = params.outlineCount ?? this.config.outlineCount;

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
    return `You are an expert academic and professional presentation planner. Your job is to create a DEEP, WELL-STRUCTURED outline for a presentation about "${topic}".

PRIMARY OBJECTIVE: Plan a presentation that teaches the audience about "${topic}" with real facts, specific details, and logical flow.

THINKING PROCESS — Before generating output, mentally:
1. Identify what "${topic}" actually is (field, subject, scope)
2. List the most important aspects, facts, and sub-topics
3. Organize them into ${outlineCount} logical sections that build on each other
4. For each slide, plan 2-4 specific points that should be covered
5. Ensure no repetition — each slide covers unique information

OUTLINE RULES:
- Create EXACTLY ${outlineCount} main sections
- Each section needs:
  * "title" in ${language} — specific to "${topic}"
  * "title_eng" in English — specific to "${topic}"
  * "description" — 1-2 sentence summary of what this section covers (in ${language})
- Sections must follow a logical teaching order (e.g., definition → details → analysis → application)
- Each section title must contain terminology specific to "${topic}"

SLIDE RULES:
- Total available slide templates: ${availableSlides} (indexes 0 to ${availableSlides - 1})
- Generate EXACTLY ${pageCount} slides
- ${pageCount > availableSlides ? `REUSE slide indexes as needed (${pageCount} slides > ${availableSlides} templates)` : `Use indexes from 0 to ${availableSlides - 1}`}
- Each slide needs:
  * "slideIndex": valid index (0 to ${availableSlides - 1})
  * "title" / "title_eng": specific slide title (NOT the same as the section title)
  * "outlineIndex": which section it belongs to (0 to ${outlineCount - 1})
  * "keyPoints": array of 2-4 SPECIFIC facts/points this slide should present

KEY POINTS QUALITY:
- Each keyPoint must be a SPECIFIC fact, statistic, definition, or detail about "${topic}"
- NOT generic statements like "important aspects" or "key features"
- Include numbers, dates, names, technical terms where relevant
- Example good keyPoint: "DNA ning ikki zanjirli spirali 1953-yilda Watson va Crick tomonidan kashf etilgan"
- Example bad keyPoint: "DNA ning muhim xususiyatlari"

VALIDATION:
- Every title contains "${topic}"-specific terminology
- No two slides have the same keyPoints
- keyPoints are factual and specific, not vague`;
  }

  private buildUserPrompt(
    topic: string,
    language: string,
    slides: AISlide[],
    availableSlides: number,
    pageCount: number,
    outlineCount: number
  ): string {
    return `TOPIC: "${topic}"
LANGUAGE: ${language}
AVAILABLE SLIDE TEMPLATES: ${availableSlides} (indexes 0 to ${availableSlides - 1})
REQUIRED SLIDES: ${pageCount}

AVAILABLE SLIDE TEMPLATES:
${JSON.stringify(slides)}

INSTRUCTIONS:
1. Study the topic "${topic}" deeply — understand its scope, sub-topics, and key facts
2. Create ${outlineCount} main sections that logically divide "${topic}":
   - Each section with title (${language} + English) and a brief description
   - Sections should build on each other (introduction → details → analysis/conclusion)
3. Plan EXACTLY ${pageCount} slides, each with:
   - A specific title (NOT the same as section title)
   - 2-4 keyPoints — SPECIFIC facts, details, or talking points for that slide
   - Assigned to the correct section (outlineIndex)
4. Use ONLY slide indexes from 0 to ${availableSlides - 1}

QUALITY CHECK before responding:
- Each slide's keyPoints contain REAL, SPECIFIC information (not generic)
- No two slides repeat the same information
- The presentation tells a complete, coherent story about "${topic}"
- All text is in ${language} (except title_eng which is English)`;
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
