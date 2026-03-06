/**
 * Free Outline Generator
 *
 * Generates presentation outline AND selects layout patterns for each slide.
 * Unlike the template-based OutlineGenerator, this doesn't need existing slides.
 */

import { AIClient } from '../ai/ai-client';
import { EnhancedLogger, LogLevel } from '../../lib/logger';
import {
  type FreeOutlineResult,
  type FreeOutlineSlide,
  type OutlineItem,
  type PatternName,
  type ThemeName,
  type FontPairName,
  type CustomColorPalette,
  type CustomLayoutElement,
  type GenerationConfig,
  DEFAULT_GENERATION_CONFIG,
} from '../types/generation';
import { getPatternsForPrompt } from './slide-patterns';
import { getFontPairsForPrompt } from './design-system';
import { validateCustomLayout } from './grid-validator';

// ============================================
// Types
// ============================================

export interface FreeOutlineParams {
  language: string;
  pageCount: number;
  topic: string;
  theme?: ThemeName;
  fontPair?: FontPairName;
}

// ============================================
// FreeOutlineGenerator
// ============================================

export class FreeOutlineGenerator {
  private aiClient: AIClient;
  private logger: EnhancedLogger;

  constructor(aiClient: AIClient, _config?: Partial<GenerationConfig>, logger?: EnhancedLogger) {
    this.aiClient = aiClient;
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
  }

  async generate(params: FreeOutlineParams): Promise<FreeOutlineResult> {
    const { language, pageCount, topic, theme, fontPair } = params;
    const outlineCount = this.calculateOutlineCount(pageCount);

    // Content slide count (excluding: title, outline, conclusion, references, thank-you = 5 fixed)
    const contentSlideCount = Math.max(1, pageCount - 5);

    const patternList = getPatternsForPrompt();

    const schema = this.buildSchema(outlineCount, contentSlideCount, language);

    const result = await this.aiClient.call<{
      theme: ThemeName;
      fontPair: FontPairName;
      customColors: CustomColorPalette | null;
      outline: Array<{ title: string; title_eng: string; description: string }>;
      slides: Array<{
        slideIndex: number;
        title: string;
        title_eng: string;
        outlineIndex: number;
        keyPoints: string[];
        pattern: PatternName;
        imageKeyword: string | null;
        customElements: CustomLayoutElement[] | null;
        customBackground: string | null;
      }>;
    }>({
      operationName: 'freeOutline',
      temperature: 0.8,
      responseFormat: 'json_schema',
      responseSchema: schema,
      messages: [
        {
          role: 'system',
          content: this.buildSystemPrompt(language, outlineCount, contentSlideCount, patternList),
        },
        {
          role: 'user',
          content: this.buildUserPrompt(topic, language, outlineCount, contentSlideCount, theme, fontPair),
        },
      ],
      fallback: () => this.buildFallback(topic, outlineCount, contentSlideCount, theme),
    });

    const data = result.data;

    const outline: OutlineItem[] = data.outline.map((o) => ({
      title: o.title,
      title_eng: o.title_eng,
    }));

    const slides: FreeOutlineSlide[] = data.slides.map((s) => {
      let customElements = s.pattern === 'custom' && s.customElements ? s.customElements : undefined;

      // Strip null values from custom element properties (OpenAI schema requires all fields, AI sends null for unused ones)
      if (customElements) {
        customElements = customElements.map(el => {
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(el)) {
            if (value !== null && value !== undefined) {
              cleaned[key] = value;
            }
          }
          return cleaned as unknown as CustomLayoutElement;
        });
      }

      // Validate and fix custom layouts
      if (customElements && customElements.length > 0) {
        const validation = validateCustomLayout(customElements);
        customElements = validation.fixed;

        if (validation.warnings.length > 0) {
          this.logger.warn(`Custom layout validation for slide ${s.slideIndex}`, {
            warnings: validation.warnings,
            errors: validation.errors,
          });
        }

        // If custom layout is completely broken (no elements after fix), fall back to bullet-list
        if (customElements.length === 0) {
          this.logger.warn(`Custom layout for slide ${s.slideIndex} was invalid, falling back to bullet-list`);
          return {
            slideIndex: s.slideIndex,
            title: s.title,
            title_eng: s.title_eng,
            outlineIndex: s.outlineIndex,
            keyPoints: s.keyPoints,
            pattern: 'bullet-list' as PatternName,
            imageKeyword: s.imageKeyword || undefined,
          };
        }
      }

      // Ensure custom pattern has customElements, otherwise fall back
      if (s.pattern === 'custom' && (!customElements || customElements.length === 0)) {
        this.logger.warn(`Slide ${s.slideIndex} has pattern "custom" but no customElements, falling back to bullet-list`);
        return {
          slideIndex: s.slideIndex,
          title: s.title,
          title_eng: s.title_eng,
          outlineIndex: s.outlineIndex,
          keyPoints: s.keyPoints,
          pattern: 'bullet-list' as PatternName,
          imageKeyword: s.imageKeyword || undefined,
        };
      }

      return {
        slideIndex: s.slideIndex,
        title: s.title,
        title_eng: s.title_eng,
        outlineIndex: s.outlineIndex,
        keyPoints: s.keyPoints,
        pattern: s.pattern,
        imageKeyword: s.imageKeyword || undefined,
        customElements,
        customBackground: s.pattern === 'custom' && s.customBackground ? s.customBackground as any : undefined,
      };
    });

    const customCount = slides.filter(s => s.pattern === 'custom').length;
    this.logger.info('Free outline generated', {
      theme: data.theme,
      fontPair: data.fontPair,
      hasCustomColors: !!data.customColors,
      outlineCount: outline.length,
      slideCount: slides.length,
      customLayouts: customCount,
      patterns: slides.map((s) => s.pattern),
      tokenUsage: result.usage.totalTokens,
    });

    return {
      outline,
      slides,
      theme: data.theme || theme || 'professional',
      customColors: data.customColors || undefined,
      fontPair: data.fontPair || fontPair,
    };
  }

  // ============================================
  // Prompts
  // ============================================

  private buildSystemPrompt(
    language: string,
    outlineCount: number,
    slideCount: number,
    patternList: string
  ): string {
    const fontPairList = getFontPairsForPrompt();

    return `You are a world-class presentation architect and visual designer. You design the STRUCTURE, VISUAL LAYOUT, COLOR SCHEME, and TYPOGRAPHY of presentations.

YOUR TASK: Create a presentation outline with ${outlineCount} sections and ${slideCount} content slides. For each slide, choose the best layout pattern. Also choose the color theme, font pair, and optionally generate a custom color palette.

AVAILABLE LAYOUT PATTERNS:
${patternList}

PATTERN SELECTION RULES:
1. First slide should use a pattern that introduces the topic well (bullet-list, image-right)
2. Use VARIETY — don't repeat the same pattern more than twice in a row
3. Match pattern to content type:
   - Data/stats → "stats-grid" or "table-slide"
   - Comparison → "comparison" or "two-column"
   - Process/history → "timeline" or "process-flow"
   - Visual topic → "image-right" or "image-left"
   - Key points → "bullet-list" or "three-cards"
   - Important quote → "quote"
   - Hierarchy/levels → "pyramid"
   - Features overview → "icon-grid"
4. Use "section-break" between major sections (max 1-2 times)
5. For image patterns (image-right, image-left, image-full), provide an imageKeyword for Bing search

CUSTOM LAYOUT ("custom" pattern):
When NO preset pattern fits your creative vision, use pattern="custom" and design your OWN layout!
You must provide customElements array and customBackground.

Grid system: 12 columns (col: 1-12), 8 rows (row: 1-8).
Each element needs: type, role, col: [start, end], row: [start, end].

Available element types:
- text: text content (needs role, fontSize, fontWeight, align, color, maxCharacters)
- image: image placeholder (needs role="image", col, row)
- shape: decorative shape (needs role="accent", background, shapeVariant, optional shadow/opacity)
- table: data table (needs role="body", col, row, fontSize, color)

Available roles: title, subtitle, body, label, image, accent, stat-number, stat-label
Available colors: primary, text, muted, white, accent
Available backgrounds: primary, accent, light, white, none, gradient, gradient-accent, glass
Available shapeVariants: rect, circle, rounded-lg, line-h, line-v, blob
Available shadows: sm, md, lg
Available customBackground: white, light, dark, gradient, primary

CUSTOM LAYOUT DESIGN PRINCIPLES:
- Use shapes as decorative backgrounds BEHIND text (lower z-index = earlier in array)
- Create visual hierarchy: large title at top, content below
- Add accent shapes (lines, blobs, circles) for visual interest
- Use gradient backgrounds on shapes for modern look
- Cards = rounded-lg shape with shadow + text on top
- Leave breathing room — don't fill every grid cell
- Maximum 12 elements per custom layout
- Always include at least one title element

EXAMPLE custom layout (asymmetric modern card layout):
customElements: [
  { type: "shape", role: "accent", col: [1, 5], row: [1, 8], background: "gradient", shapeVariant: "rounded-lg", borderRadius: 20, opacity: 0.08 },
  { type: "text", role: "title", col: [1, 7], row: [1, 2], fontSize: 40, fontWeight: "bold", align: "left", color: "primary", maxCharacters: 60 },
  { type: "shape", role: "accent", col: [1, 3], row: [3, 3], background: "gradient", shapeVariant: "line-h" },
  { type: "text", role: "body", col: [1, 5], row: [4, 7], fontSize: 16, align: "left", color: "text", maxCharacters: 350 },
  { type: "image", role: "image", col: [7, 12], row: [2, 7] },
  { type: "shape", role: "accent", col: [11, 12], row: [7, 8], background: "accent", shapeVariant: "circle", opacity: 0.15 }
]

BE CREATIVE with custom layouts! Mix shapes, images, and text in unique arrangements. Use 2-4 custom layouts per presentation for variety.

THEME SELECTION:
Choose a preset theme OR set theme to "custom" and provide customColors:
- "professional" — business, finance, corporate
- "modern" — technology, AI, digital
- "warm" — education, culture, food
- "cool" — science, healthcare, environment
- "bold" — marketing, sports, entertainment
- "minimal" — design, architecture, philosophy
- "custom" — generate a unique color palette that perfectly matches the topic

When using "custom", provide customColors with:
- primary: main brand color (used for headings, key elements)
- accent: complementary color (used for highlights, stats)
- background: slide background (usually white or very light)
- surface: card/section backgrounds (slightly tinted)
- text: main text color (dark, high contrast)
- muted: secondary text (lighter gray)
- gradientStart + gradientEnd: gradient pair (used for title/closing slides)

COLOR DESIGN RULES for custom themes:
- Ensure WCAG AA contrast ratio between text and background
- Primary and accent should be visually distinct
- Background must be light enough for readability
- Gradient colors should flow naturally (related hues)
- Match colors to the emotional tone of the topic (e.g., healthcare → calming blues/greens, energy → vibrant oranges/reds)

FONT PAIR SELECTION:
${fontPairList}
Choose the font pair that best matches the topic's personality and professionalism level.

OUTLINE RULES:
- Each section title must be SPECIFIC and INTRIGUING — not generic labels
  GOOD: "AI tibbiyotda: $45 milliardlik inqilob" | BAD: "Sun'iy intellekt"
- Each slide MUST have 4-5 KEY POINTS (never less than 4)
- EVERY key point must contain AT LEAST ONE specific fact:
  - Real numbers, percentages, or statistics (e.g., "97.3% aniqlik", "$184 milliard bozor")
  - Real dates or time periods (e.g., "2023-yilda", "so'nggi 5 yilda")
  - Real names — companies, people, institutions, products (e.g., "Google DeepMind", "GPT-4", "WHO")
  - Real examples or case studies (e.g., "Tesla autopilot tizimi 10 million avtomobilga o'rnatilgan")
- Key points should be INFORMATION-DENSE — each one should contain enough detail to become a full bullet point
  GOOD: "GPT-4 tibbiy testlarda shifokorlardan 15% yuqori natija ko'rsatdi (Nature Medicine, 2024)"
  BAD: "AI tibbiyotda qo'llaniladi"
- Write all titles and key points in ${language}
- title_eng is always in English`;
  }

  private buildUserPrompt(
    topic: string,
    language: string,
    outlineCount: number,
    slideCount: number,
    theme?: ThemeName,
    fontPair?: FontPairName
  ): string {
    return `PRESENTATION TOPIC: "${topic}"
LANGUAGE: ${language}
SECTIONS: ${outlineCount}
CONTENT SLIDES: ${slideCount}
${theme ? `PREFERRED THEME: "${theme}"` : 'CHOOSE THE BEST THEME for this topic (consider using "custom" for a unique look)'}
${fontPair ? `PREFERRED FONT PAIR: "${fontPair}"` : 'CHOOSE THE BEST FONT PAIR for this topic'}

Create the outline now. Remember:
1. ${outlineCount} outline sections with titles in ${language}
2. ${slideCount} content slides, each assigned to a section
3. Each slide has a pattern, title, 4-5 key points (MINIMUM 4), and optional imageKeyword
4. Use diverse patterns — not the same one repeatedly
5. EVERY key point must include real data: numbers, names, dates, statistics, examples. No vague generalities
6. Choose a color theme AND font pair that match the topic
7. If theme is "custom", provide customColors with a beautiful, topic-matched palette
${slideCount >= 5 ? '8. Use pattern="custom" for 2-3 slides where you want a UNIQUE creative layout — provide customElements array and customBackground' : '8. Do NOT use pattern="custom" — use only preset patterns for small presentations'}
9. For non-custom patterns, set customElements=null and customBackground=null`;
  }

  // ============================================
  // Schema
  // ============================================

  private buildSchema(
    outlineCount: number,
    slideCount: number,
    language: string
  ): Record<string, unknown> {
    const patternEnum = [
      'title-center', 'title-subtitle', 'bullet-list', 'two-column',
      'image-right', 'image-left', 'image-full', 'three-cards',
      'stats-grid', 'comparison', 'timeline', 'table-slide',
      'quote', 'section-break', 'thank-you',
      'process-flow', 'pyramid', 'icon-grid',
    ];

    const themeEnum = ['professional', 'modern', 'warm', 'cool', 'bold', 'minimal', 'custom'];
    const fontPairEnum = ['classic', 'modern', 'elegant', 'playful', 'technical', 'minimal'];

    const colorProp = { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' };

    return {
      type: 'object',
      properties: {
        theme: { type: 'string', enum: themeEnum, description: 'Color theme for the presentation' },
        fontPair: { type: 'string', enum: fontPairEnum, description: 'Font pair for the presentation' },
        customColors: {
          anyOf: [
            {
              type: 'object',
              properties: {
                primary: colorProp,
                accent: colorProp,
                background: colorProp,
                surface: colorProp,
                text: colorProp,
                muted: colorProp,
                gradientStart: colorProp,
                gradientEnd: colorProp,
              },
              required: ['primary', 'accent', 'background', 'surface', 'text', 'muted', 'gradientStart', 'gradientEnd'],
              additionalProperties: false,
            },
            { type: 'null' },
          ],
          description: 'Custom color palette (required when theme is "custom", null otherwise)',
        },
        outline: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: `Section title in ${language}` },
              title_eng: { type: 'string', description: 'Section title in English' },
              description: { type: 'string', description: `Brief description in ${language}` },
            },
            required: ['title', 'title_eng', 'description'],
            additionalProperties: false,
          },
          minItems: outlineCount,
          maxItems: outlineCount,
        },
        slides: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              slideIndex: { type: 'integer', minimum: 0, maximum: slideCount - 1 },
              title: { type: 'string', description: `Slide title in ${language}` },
              title_eng: { type: 'string', description: 'Slide title in English' },
              outlineIndex: { type: 'integer', minimum: 0, maximum: outlineCount - 1 },
              keyPoints: {
                type: 'array',
                items: { type: 'string' },
                minItems: 4,
                maxItems: 5,
              },
              pattern: { type: 'string', enum: [...patternEnum, 'custom'] },
              imageKeyword: {
                anyOf: [{ type: 'string' }, { type: 'null' }],
                description: 'English search keyword for image (only for image patterns)',
              },
              customElements: {
                anyOf: [
                  {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: { type: 'string', enum: ['text', 'image', 'shape', 'table'] },
                        role: { type: 'string', enum: ['title', 'subtitle', 'body', 'label', 'image', 'accent', 'stat-number', 'stat-label'] },
                        col: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 12 }, minItems: 2, maxItems: 2 },
                        row: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 8 }, minItems: 2, maxItems: 2 },
                        fontSize: { anyOf: [{ type: 'integer', minimum: 10, maximum: 72 }, { type: 'null' }] },
                        fontWeight: { anyOf: [{ type: 'string', enum: ['normal', 'bold'] }, { type: 'null' }] },
                        align: { anyOf: [{ type: 'string', enum: ['left', 'center', 'right'] }, { type: 'null' }] },
                        color: { anyOf: [{ type: 'string', enum: ['primary', 'text', 'muted', 'white', 'accent'] }, { type: 'null' }] },
                        background: { anyOf: [{ type: 'string', enum: ['primary', 'accent', 'light', 'white', 'none', 'gradient', 'gradient-accent', 'glass'] }, { type: 'null' }] },
                        borderRadius: { anyOf: [{ type: 'integer', minimum: 0, maximum: 40 }, { type: 'null' }] },
                        shapeVariant: { anyOf: [{ type: 'string', enum: ['rect', 'circle', 'rounded-lg', 'line-h', 'line-v', 'blob'] }, { type: 'null' }] },
                        shadow: { anyOf: [{ type: 'string', enum: ['sm', 'md', 'lg'] }, { type: 'null' }] },
                        opacity: { anyOf: [{ type: 'number', minimum: 0, maximum: 1 }, { type: 'null' }] },
                        maxCharacters: { anyOf: [{ type: 'integer', minimum: 5, maximum: 500 }, { type: 'null' }] },
                      },
                      required: ['type', 'role', 'col', 'row', 'fontSize', 'fontWeight', 'align', 'color', 'background', 'borderRadius', 'shapeVariant', 'shadow', 'opacity', 'maxCharacters'],
                      additionalProperties: false,
                    },
                    minItems: 2,
                    maxItems: 12,
                  },
                  { type: 'null' },
                ],
                description: 'Custom layout elements (required when pattern is "custom", null otherwise)',
              },
              customBackground: {
                anyOf: [
                  { type: 'string', enum: ['white', 'light', 'dark', 'gradient', 'primary'] },
                  { type: 'null' },
                ],
                description: 'Background for custom layout slides (null for preset patterns)',
              },
            },
            required: ['slideIndex', 'title', 'title_eng', 'outlineIndex', 'keyPoints', 'pattern', 'imageKeyword', 'customElements', 'customBackground'],
            additionalProperties: false,
          },
          minItems: slideCount,
          maxItems: slideCount,
        },
      },
      required: ['theme', 'fontPair', 'customColors', 'outline', 'slides'],
      additionalProperties: false,
    };
  }

  // ============================================
  // Helpers
  // ============================================

  private calculateOutlineCount(pageCount: number): number {
    if (pageCount <= 8) return 2;
    if (pageCount <= 12) return 3;
    if (pageCount <= 18) return 4;
    if (pageCount <= 25) return 5;
    return 6;
  }

  private buildFallback(
    topic: string,
    outlineCount: number,
    slideCount: number,
    theme?: ThemeName
  ): any {
    const patterns: PatternName[] = [
      'bullet-list', 'image-right', 'two-column', 'stats-grid',
      'three-cards', 'timeline', 'comparison', 'quote',
      'process-flow', 'pyramid', 'icon-grid',
    ];

    const sectionLabels = ['Introduction', 'Core Concepts', 'Applications', 'Challenges', 'Future Outlook', 'Summary'];
    const outline = Array.from({ length: outlineCount }, (_, i) => ({
      title: `${topic} — ${sectionLabels[i] || `Part ${i + 1}`}`,
      title_eng: `${topic} — ${sectionLabels[i] || `Part ${i + 1}`}`,
      description: `${sectionLabels[i] || `Part ${i + 1}`} of ${topic}`,
    }));

    const slides = Array.from({ length: slideCount }, (_, i) => ({
      slideIndex: i,
      title: `${topic} - Slide ${i + 1}`,
      title_eng: `${topic} - Slide ${i + 1}`,
      outlineIndex: Math.min(i % outlineCount, outlineCount - 1),
      keyPoints: [
        `Key point 1 about ${topic}`,
        `Key point 2 about ${topic}`,
        `Key point 3 about ${topic}`,
        `Key point 4 about ${topic}`,
      ],
      pattern: patterns[i % patterns.length],
      imageKeyword: patterns[i % patterns.length].startsWith('image-') ? topic : null,
      customElements: null,
      customBackground: null,
    }));

    return { theme: theme || 'professional', fontPair: 'modern', customColors: null, outline, slides };
  }
}
