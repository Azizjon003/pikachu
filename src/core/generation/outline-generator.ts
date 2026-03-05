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
    return `You are a professional presentation assistant specialized in creating highly focused, topic-specific content.

PRIMARY OBJECTIVE: Create outlines SPECIFICALLY about "${topic}" - NOT generic content

CRITICAL TOPIC SPECIFICITY REQUIREMENTS:
- Every outline MUST be directly about "${topic}" - use specific terminology
- Avoid generic statements - be SPECIFIC to this exact topic
- Use keywords and terms that are unique to "${topic}"
- Do NOT deviate to related but different topics

STRICT RULES:

1. OUTLINE GENERATION:
   - Create EXACTLY ${outlineCount} main topic outlines
   - Each outline must have:
     * "title": Outline title in ${language} SPECIFICALLY about "${topic}"
     * "title_eng": Outline title in English SPECIFICALLY about "${topic}"
   - Outlines must cover SPECIFIC aspects of "${topic}" (not general related topics)
   - Outlines must follow a logical sequence
   - USE TERMINOLOGY SPECIFIC TO "${topic}"

2. SLIDES SELECTION:
   - CRITICAL: Total available slides = ${availableSlides}
   - You MUST generate EXACTLY ${pageCount} slides (NO LESS, NO MORE)
   - You can ONLY use indexes from 0 to ${availableSlides - 1}
   - If ${pageCount} > ${availableSlides}, you MUST REUSE slides until the total reaches ${pageCount}
   - For each slide:
     * "slideIndex": MUST be a valid index from the available range
     * "title": Slide title in ${language} - MUST be SPECIFIC to "${topic}"
     * "title_eng": Slide title in English - MUST be SPECIFIC to "${topic}"
     * "outlineIndex": Which outline it belongs to (0 to ${outlineCount - 1})

3. IMPORTANT GUIDELINES:
   - DO NOT create fake slideIndex numbers
   - ONLY use slideIndex from the provided list [0-${availableSlides - 1}]
   - Outline titles must be SPECIFICALLY about "${topic}" (not general concepts)
   - Each outline must represent a specific logical section of "${topic}"
   - Group slides under the appropriate outline
   - Every title must contain topic-specific keywords`;
  }

  private buildUserPrompt(
    topic: string,
    language: string,
    slides: AISlide[],
    availableSlides: number,
    pageCount: number,
    outlineCount: number
  ): string {
    return `MAIN TOPIC: "${topic}"
LANGUAGE: ${language}
TOTAL AVAILABLE SLIDES: ${availableSlides}
SLIDES TO SELECT: ${pageCount}
VALID SLIDE INDEXES: 0 to ${availableSlides - 1}

AVAILABLE SLIDES (with their ACTUAL index numbers):
${JSON.stringify(slides)}

YOUR TASK:
1. Analyze the main topic "${topic}" - understand its SPECIFIC scope
2. Create ${outlineCount} logical outline topics that cover SPECIFIC aspects of "${topic}"
   - MUST use terminology SPECIFIC to "${topic}"
   - MUST focus on unique aspects of "${topic}"
   - AVOID generic/broad related topics
   - Write each outline title in both ${language} and English
   - Make sure outlines logically divide "${topic}" into ${outlineCount} SPECIFIC parts
3. Select EXACTLY ${pageCount} slides from the ${availableSlides} slides listed above
4. IMPORTANT: Use ONLY the actual index numbers shown in brackets [0] to [${availableSlides - 1}]
5. Assign each slide to the appropriate outline (outlineIndex: 0 to ${outlineCount - 1})
6. Write slide titles in both ${language} and English
   - Each slide title MUST be SPECIFIC to "${topic}"
   - Use topic-specific keywords in every title

VALIDATION CHECKLIST (verify before responding):
- All outline titles contain "${topic}"-specific terminology
- No generic/broad topics that could apply to other subjects
- All slide titles are directly related to "${topic}"
- Used specific keywords unique to "${topic}"`;
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
    }));

    const slides = Array.from({ length: pageCount }, (_, i) => ({
      slideIndex: i % availableSlides,
      title: `${topic} - Slide ${i + 1}`,
      title_eng: `${topic} - Slide ${i + 1}`,
      outlineIndex: i % outlineCount,
    }));

    return { outline, slides };
  }
}
