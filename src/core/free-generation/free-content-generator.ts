/**
 * Free Content Generator
 *
 * Generates content for template-free slides based on pattern elements.
 * Each pattern element has a role and maxCharacters — AI fills the content.
 */

import { AIClient } from '../ai/ai-client';
import { EnhancedLogger, LogLevel } from '../../lib/logger';
import type { FreeOutlineSlide, GenerationConfig, DEFAULT_GENERATION_CONFIG, CustomLayoutElement } from '../types/generation';
import { getPattern, type PatternElement } from './slide-patterns';
import type { ElementContent, ChartContentData } from './slide-builder';

// ============================================
// Types
// ============================================

interface FreeContentParams {
  slide: FreeOutlineSlide;
  language: string;
  mainTopic: string;
  slidePosition: { current: number; total: number; sectionName?: string };
}

interface FreeContentResult {
  elements: ElementContent[];
}

// ============================================
// FreeContentGenerator
// ============================================

export class FreeContentGenerator {
  private aiClient: AIClient;
  private logger: EnhancedLogger;

  constructor(aiClient: AIClient, _config?: Partial<GenerationConfig>, logger?: EnhancedLogger) {
    this.aiClient = aiClient;
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
  }

  async generate(params: FreeContentParams): Promise<FreeContentResult> {
    const { slide, language, mainTopic, slidePosition } = params;

    // Get pattern elements — either from preset pattern or custom layout
    const patternElements = this.getPatternElements(slide);

    // Separate content elements (need AI content) from non-content (image, shape, line)
    const textElements = patternElements
      .map((el, idx) => ({ el, idx }))
      .filter(({ el }) => el.type === 'text' || el.type === 'table' || el.type === 'chart');

    if (textElements.length === 0) {
      return { elements: patternElements.map(() => ({})) };
    }

    const schema = this.buildSchema(textElements.map(t => t.el));

    const result = await this.aiClient.call<{
      elements: Array<{
        index: number;
        content: string;
        tableData?: string[][] | null;
        chartData?: { labels: string[]; legends: string[]; series: number[][] } | null;
      }>;
    }>({
      operationName: `freeContent_${slide.slideIndex}`,
      temperature: 0.7,
      responseFormat: 'json_schema',
      responseSchema: schema,
      messages: [
        { role: 'system', content: this.buildSystemPrompt(language, mainTopic) },
        { role: 'user', content: this.buildUserPrompt(slide, language, mainTopic, patternElements, slidePosition) },
      ],
      fallback: () => this.buildFallback(textElements.map(t => t.el), slide),
    });

    // Map AI response back to full element list
    const elements: ElementContent[] = patternElements.map(() => ({}));

    for (const genEl of result.data.elements) {
      const mapping = textElements.find(t => t.idx === genEl.index);
      if (mapping) {
        const elType = patternElements[mapping.idx].type;
        if (elType === 'table' && genEl.tableData) {
          elements[mapping.idx] = { tableData: genEl.tableData };
        } else if (elType === 'chart' && genEl.chartData) {
          elements[mapping.idx] = { chartData: genEl.chartData };
        } else {
          elements[mapping.idx] = { text: genEl.content };
        }
      }
    }

    this.logger.info(`Free content generated for slide ${slide.slideIndex}`, {
      pattern: slide.pattern,
      elements: result.data.elements.length,
      tokenUsage: result.usage.totalTokens,
    });

    return { elements };
  }

  /**
   * Get pattern elements from preset pattern or custom layout.
   * Custom layouts are converted to PatternElement[] format.
   */
  private getPatternElements(slide: FreeOutlineSlide): PatternElement[] {
    if (slide.pattern === 'custom' && slide.customElements?.length) {
      return slide.customElements.map((el): PatternElement => ({
        type: el.type as PatternElement['type'],
        role: el.role,
        col: el.col,
        row: el.row,
        fontSize: el.fontSize || (el.type === 'shape' || el.type === 'line' || el.type === 'chart' ? 0 : 16),
        fontWeight: el.fontWeight,
        align: el.align,
        color: el.color,
        maxCharacters: el.maxCharacters,
        background: el.background,
        borderRadius: el.borderRadius,
        shadow: el.shadow,
        opacity: el.opacity,
        shapeVariant: el.shapeVariant,
        chartType: el.chartType,
        lineStyle: el.lineStyle,
        linePoints: el.linePoints,
      }));
    }
    return getPattern(slide.pattern).elements;
  }

  // ============================================
  // Prompts
  // ============================================

  private buildSystemPrompt(language: string, topic: string): string {
    return `You are a world-class presentation content writer and subject-matter expert on "${topic}".

YOUR MISSION: Generate RICH, AUTHORITATIVE, DEEPLY INFORMATIVE content that transforms slides from boring bullet points into compelling visual stories. Every element must deliver real value.

CONTENT QUALITY STANDARDS:
- Write as a leading expert who has spent 20+ years in this field
- Every sentence must teach the audience something they didn't know
- Include SPECIFIC, VERIFIABLE facts: exact numbers, percentages, dates, proper names, real examples
- Use concrete comparisons and analogies to make complex ideas accessible
- Add context — don't just state facts, explain WHY they matter
- Reference real companies, researchers, events, studies, and technologies
- ALL content in ${language} language

FORMATTING BY ROLE:
- TITLE: 4-10 words. Must be intriguing and specific.
  EXCELLENT: "AI tibbiyotda — 3.4 million hayot saqlab qolindi" | GOOD: "Sun'iy intellektning tibbiyotdagi inqilobi"
  BAD: "Sun'iy intellekt" | TERRIBLE: "Kirish"
- SUBTITLE: One powerful descriptive sentence with a specific hook or data point.
  GOOD: "2024-yilda global AI bozori $184 milliardga yetdi — 5 yilda 6 barobar o'sish"
  BAD: "AI tez rivojlanmoqda"
- BODY: Rich bullet points with "• " prefix. Each bullet is a COMPLETE thought with:
  - A specific fact, number, or example
  - Context explaining significance
  - Real-world impact or application
  GOOD: "• GPT-4 tibbiy testlarda 90% aniqlik ko'rsatdi — tajribali shifokorlardan 15% yuqori (Nature Medicine, 2024)"
  BAD: "• AI tibbiyotda qo'llaniladi"
- LABEL: 2-6 precise, descriptive words.
  GOOD: "Yillik o'sish sur'ati" | BAD: "O'sish"
- STAT-NUMBER: Exact, impressive number with unit. Format for visual impact.
  GOOD: "97.3%", "$184B", "3.2M+", "10x", "45 kun"
  BAD: "ko'p", "yuqori", "katta"
- STAT-LABEL: Clear, specific description of what the stat measures.
  GOOD: "Diagnostika aniqligi (Stanford, 2024)" | BAD: "Aniqlik"

ADVANCED CONTENT TECHNIQUES:
1. STORYTELLING: For body text, weave a narrative — start with a problem, show the solution, end with impact
2. DATA-RICH: Every slide should contain at least 2-3 specific numbers or data points
3. REAL EXAMPLES: Mention real companies (Google, Tesla, Samsung), real people (researchers, founders), real events
4. CAUSE-EFFECT: Don't just list facts — connect them: "X led to Y, which resulted in Z"
5. CONTRAST: Use before/after, old vs new, competitor comparisons to create impact
6. CREDIBILITY: Reference studies, reports, institutions (WHO, McKinsey, Nature, IEEE)

ABSOLUTE RULES:
1. Generate content for EVERY element — skip NOTHING
2. Each element has UNIQUE content — ZERO repetition between elements
3. Fill 85-95% of maxCharacters — use the space fully to deliver maximum value
4. NEVER exceed maxCharacters
5. NO generic phrases ("as we know", "it is important to note", "in conclusion")
6. NO placeholder text — every word must be real, specific, valuable content
7. Tables must have real, specific data — not "Data 1", "Data 2"
8. NEVER wrap content in quotes — no "..." or «...» around text. Write plain text directly:
   WRONG: "15%"  →  CORRECT: 15%
   WRONG: "Energiya sektori"  →  CORRECT: Energiya sektori
   WRONG: "Yashil energiyaga sarflangan mablag'"  →  CORRECT: Yashil energiyaga sarflangan mablag'
9. For CARD-based layouts (three-cards, stats-grid, icon-grid): ALL cards must have BALANCED content length. If one card has 50 words, others must also have ~50 words. Never leave one card with a wall of text and others nearly empty
10. Every card in a multi-card layout MUST have both a clear heading/number AND supporting description text`;
  }

  private buildUserPrompt(
    slide: FreeOutlineSlide,
    language: string,
    mainTopic: string,
    patternElements: PatternElement[],
    slidePosition: { current: number; total: number; sectionName?: string }
  ): string {
    const elementDetails = patternElements
      .map((el, i) => {
        if (el.type !== 'text' && el.type !== 'table' && el.type !== 'chart') return null;

        if (el.type === 'chart') {
          return `Element [${i}] — CHART
  CHART TYPE: ${el.chartType || 'bar'}
  Return chartData with: labels (3-8 category names), legends (1-4 series names), series (number arrays matching labels count).
  Use REAL data with realistic numbers. Example for a bar chart about revenue:
    labels: ["2019", "2020", "2021", "2022", "2023"]
    legends: ["Revenue ($B)"]
    series: [[12.5, 18.2, 24.7, 31.3, 42.1]]
  For pie/ring charts, use a SINGLE series. Numbers represent proportions/percentages.
  Set content to "" for chart elements.`;
        }

        const maxChars = el.maxCharacters || this.estimateMaxChars(el);
        return `Element [${i}] — ${el.type.toUpperCase()}
  ROLE: ${el.role.toUpperCase()}
  MAX CHARACTERS: ${maxChars}
  ${el.type === 'table' ? 'Return tableData as 2D array (first row = headers)' : ''}`;
      })
      .filter(Boolean)
      .join('\n\n');

    const patternHint = this.getPatternSpecificHint(slide.pattern);

    return `PRESENTATION: "${mainTopic}"
SLIDE FOCUS: "${slide.title}" (${slide.title_eng})
LANGUAGE: ${language}
PATTERN: ${slide.pattern}
POSITION: Slide ${slidePosition.current} of ${slidePosition.total}${slidePosition.sectionName ? ` | Section: "${slidePosition.sectionName}"` : ''}

KEY POINTS — these are your primary content source. EXPAND each point with real data, examples, and context:
${slide.keyPoints.map((kp, i) => `  ${i + 1}. ${kp}`).join('\n')}

ELEMENTS TO FILL:
${elementDetails}
${patternHint}
CONTENT INSTRUCTIONS:
- TITLE elements: Create a compelling, specific title that makes the audience curious. Include a number or keyword. Do NOT wrap in quotes.
- BODY elements: Transform each key point into a rich bullet (• ) with specific facts, real examples, and data. Each bullet should be a complete, informative thought — not a fragment.
- STAT-NUMBER elements: Use ONLY the number/value — e.g., "97.3%", "$3.2B", "45 kun". NO quotes. NO extra text. Just the impressive number.
- STAT-LABEL elements: Short explanation of what the stat measures — e.g., "Diagnostika aniqligi (2024)". Do NOT wrap in quotes.
- TABLE elements: Fill with real, specific data — real names, real numbers, real comparisons. First row = headers.
- LABEL elements: Concise but descriptive — include context. Do NOT wrap in quotes.
- IMPORTANT: Never wrap any content in quotation marks ("..." or «...»). Write plain text directly.

Return JSON with elements array, each having index (matching [N] above) and content string.
For table elements, also include tableData as 2D string array.`;
  }

  // ============================================
  // Schema
  // ============================================

  private buildSchema(textElements: PatternElement[]): Record<string, unknown> {
    const hasTable = textElements.some(el => el.type === 'table');
    const hasChart = textElements.some(el => el.type === 'chart');

    const elementProps: Record<string, unknown> = {
      index: { type: 'integer', description: 'Element index from the pattern' },
      content: { type: 'string', description: 'Generated text content (empty string for chart elements)' },
    };

    const required = ['index', 'content'];

    if (hasTable) {
      elementProps.tableData = {
        anyOf: [
          {
            type: 'array',
            items: { type: 'array', items: { type: 'string' } },
            minItems: 2,
          },
          { type: 'null' },
        ],
      };
      required.push('tableData');
    }

    if (hasChart) {
      elementProps.chartData = {
        anyOf: [
          {
            type: 'object',
            properties: {
              labels: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 8 },
              legends: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
              series: {
                type: 'array',
                items: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 8 },
                minItems: 1, maxItems: 4,
              },
            },
            required: ['labels', 'legends', 'series'],
            additionalProperties: false,
          },
          { type: 'null' },
        ],
        description: 'Chart data with labels (categories), legends (series names), and series (number arrays). Each series must have same length as labels.',
      };
      required.push('chartData');
    }

    return {
      type: 'object',
      properties: {
        elements: {
          type: 'array',
          items: {
            type: 'object',
            properties: elementProps,
            required,
            additionalProperties: false,
          },
          minItems: textElements.length,
          maxItems: textElements.length,
        },
      },
      required: ['elements'],
      additionalProperties: false,
    };
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Get pattern-specific content instructions to ensure AI generates
   * balanced, properly formatted content for each pattern type.
   */
  private getPatternSpecificHint(pattern: string): string {
    const hints: Record<string, string> = {
      'three-cards': `
PATTERN-SPECIFIC RULES (three-cards):
- This slide has 3 EQUAL cards side by side. Each card has a LABEL (heading) and BODY text.
- ALL 3 cards MUST have approximately EQUAL content length (within 20% of each other).
- Each card LABEL: 2-4 words, bold heading. Example: "Raqamli transformatsiya"
- Each card BODY: 2-3 concise sentences (~80-120 chars each). Cover ONE distinct subtopic per card.
- Distribute key points EVENLY: ~1-2 key points per card, not all in one card.
- WRONG: Card 1 = 200 chars, Card 2 = 50 chars, Card 3 = 180 chars
- RIGHT: Card 1 = 130 chars, Card 2 = 140 chars, Card 3 = 125 chars`,

      'stats-grid': `
PATTERN-SPECIFIC RULES (stats-grid):
- This slide has 3 STAT CARDS, each with a BIG NUMBER and a short label below.
- STAT-NUMBER: Write ONLY the number with unit — "15%", "$3.2B", "2.4M+", "10x", "45 kun".
  Keep under 8 characters. NO quotes. NO extra words.
- STAT-LABEL: One clear line explaining what the number means — "Yillik eksport o'sishi (2023-2025)"
  Keep under 50 characters. NO quotes.
- Each stat should cover a DIFFERENT metric — do not repeat similar stats.
- Make numbers impressive and specific — "15.7%" not "15%", "$3.2B" not "$3B"`,

      'icon-grid': `
PATTERN-SPECIFIC RULES (icon-grid):
- This slide has 4 feature boxes in a 2x2 grid. Each box has a LABEL and BODY.
- ALL 4 boxes MUST have approximately EQUAL content length.
- LABEL: 2-4 words describing the feature.
- BODY: 1-2 short sentences (~60-80 chars). Be specific, not generic.`,

      'comparison': `
PATTERN-SPECIFIC RULES (comparison):
- This slide compares TWO sides. Each side must be equally detailed.
- Use parallel structure — if left side has 4 bullets, right side also needs 4 bullets.
- Be specific and factual in both columns — no vague pros/cons.`,

      'chart-combo': `
PATTERN-SPECIFIC RULES (chart-combo):
- This slide has 3 stat cards on top and a bar chart below.
- STAT-NUMBER: Short number only — "15%", "$1.2B". NO quotes.
- STAT-LABEL: Brief description. NO quotes.
- Chart data must have realistic, consistent numbers that tell a clear trend story.`,

      'infographic-row': `
PATTERN-SPECIFIC RULES (infographic-row):
- This slide has 4 numbered fact blocks in a row.
- Each block has a STAT-NUMBER and LABEL/BODY.
- ALL 4 blocks must be approximately equal in length.
- Numbers should be sequential or show progression.`,

      'split-image-stats': `
PATTERN-SPECIFIC RULES (split-image-stats):
- Left side is an image. Right side has stat cards.
- STAT-NUMBER: Short, impressive number. NO quotes.
- STAT-LABEL: Brief context for the number. NO quotes.`,

      'data-dashboard': `
PATTERN-SPECIFIC RULES (data-dashboard):
- This slide combines stat numbers with a chart.
- Keep stat numbers short and impactful.
- Chart data should complement (not duplicate) the stat numbers.`,
    };

    return hints[pattern] || '';
  }

  private estimateMaxChars(el: PatternElement): number {
    const roleDefaults: Record<string, number> = {
      title: 80,
      subtitle: 150,
      body: 500,
      label: 40,
      'stat-number': 15,
      'stat-label': 60,
    };
    return el.maxCharacters || roleDefaults[el.role] || 200;
  }

  private buildFallback(
    textElements: PatternElement[],
    slide: FreeOutlineSlide
  ): any {
    return {
      elements: textElements.map((el, i) => {
        const base: Record<string, unknown> = { index: i, content: '', tableData: null, chartData: null };
        if (el.role === 'title') { base.content = slide.title; return base; }
        if (el.role === 'subtitle') { base.content = slide.title_eng; return base; }
        if (el.type === 'table') {
          base.tableData = [['Column 1', 'Column 2'], ['Data 1', 'Data 2']];
          return base;
        }
        if (el.type === 'chart') {
          base.chartData = {
            labels: ['Category A', 'Category B', 'Category C', 'Category D'],
            legends: ['Series 1'],
            series: [[25, 40, 30, 45]],
          };
          return base;
        }
        base.content = slide.keyPoints.map(kp => `• ${kp}`).join('\n');
        return base;
      }),
    };
  }
}
