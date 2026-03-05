/**
 * Content Generator
 *
 * Generates content for a single slide's elements.
 * Handles text, shapes, tables with spatial awareness and font size adjustment.
 */

import { AIClient } from '../ai/ai-client';
import { EnhancedLogger, LogLevel } from '../../lib/logger';
import {
  findNearbyElements,
  createLayoutVisualization,
  getPositionDescription,
  applyFontSize,
  validateContent,
  groupBySimilarSize,
} from '../utils/layout-helpers';
import { createContentSchema } from '../schemas/ai-response-schemas';
import { AISlideElement, GenerationConfig, DEFAULT_GENERATION_CONFIG } from '../types/generation';

interface ContentParams {
  slide: { id: string; elements: any[] };
  outline: { title?: string; title_eng?: string; keyPoints?: string[]; description?: string };
  language: string;
  mainTopic?: string;
  slidePosition?: { current: number; total: number; sectionName?: string };
}

export class ContentGenerator {
  private aiClient: AIClient;
  private logger: EnhancedLogger;
  private config: GenerationConfig;

  constructor(aiClient: AIClient, config?: Partial<GenerationConfig>, logger?: EnhancedLogger) {
    this.aiClient = aiClient;
    this.config = { ...DEFAULT_GENERATION_CONFIG, ...config };
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
  }

  async generate(params: ContentParams): Promise<any> {
    const { slide, outline, language, mainTopic, slidePosition } = params;

    // Extract text/shape/table elements with metadata
    const textElements = this.extractTextElements(slide);

    if (textElements.length === 0) {
      this.logger.warn(`No text elements found for slide ${slide.id}`);
      return slide;
    }

    // Group by similar sizes for diversity awareness
    const sizeGroups = groupBySimilarSize(textElements as AISlideElement[]);
    const diversityContext = this.buildDiversityContext(sizeGroups);
    const layoutVisualization = createLayoutVisualization(textElements as AISlideElement[]);

    // Build content schema
    const hasTable = textElements.some((el) => el.type === 'table');
    const contentSchema = createContentSchema(language, hasTable, textElements.length);

    const topicRef = mainTopic ? `"${mainTopic}"` : `"${outline.title || outline.title_eng}"`;

    const result = await this.aiClient.call<{ slideId: string; elements: any[] }>({
      operationName: `generateContent_${slide.id}`,
      temperature: 0.7,
      responseFormat: 'json_schema',
      responseSchema: contentSchema,
      messages: [
        {
          role: 'system',
          content: this.buildSystemPrompt(language, topicRef, diversityContext),
        },
        {
          role: 'user',
          content: this.buildUserPrompt(slide, outline, language, mainTopic, textElements, layoutVisualization, slidePosition),
        },
      ],
      fallback: () => this.buildFallbackContent(slide.id, textElements),
    });

    const generatedData = result.data;

    // Validate and apply font size adjustments
    if (generatedData.elements) {
      generatedData.elements = generatedData.elements.map((genEl: any) => {
        const originalEl = textElements.find((el) => el.index === genEl.elementIndex);

        if (originalEl && genEl.content) {
          const validation = validateContent(
            originalEl as AISlideElement,
            genEl.content,
            originalEl.fontSize,
            originalEl.maxCharacters,
            this.config.minFontSize
          );

          if (validation.fontSize) {
            genEl.adjustedFontSize = validation.fontSize;
          }

          if (validation.warnings.length > 0) {
            this.logger.debug(`Validation warnings for element ${genEl.elementIndex}`, {
              warnings: validation.warnings,
            });
          }
        }

        return genEl;
      });
    }

    // Merge generated content back to slide
    const updatedSlide = this.mergeContentToSlide(slide, generatedData);

    const filledCount = generatedData.elements?.length || 0;
    this.logger.info(`Content generated for slide ${slide.id}`, {
      filled: `${filledCount}/${textElements.length}`,
      tokenUsage: result.usage.totalTokens,
      fromCache: result.fromCache,
      fromFallback: result.fromFallback,
    });

    return updatedSlide;
  }

  private extractTextElements(slide: { elements: any[] }): any[] {
    return slide.elements
      .map((el: any, idx: number) => ({
        index: idx,
        type: el.type,
        width: el.width || 0,
        height: el.height || 0,
        left: el.left || 0,
        top: el.top || 0,
        currentContent: el.content || '',
        fontSize: el.fontSize || 14,
        maxCharacters: el.maxCharacters || this.estimateMaxChars(el),
        tableData: el.tableData || null,
      }))
      .filter(
        (el: any) => el.type === 'text' || el.type === 'shape' || el.type === 'table'
      );
  }

  private buildDiversityContext(sizeGroups: Map<number, AISlideElement[]>): string {
    let context = '';
    for (const [maxChars, group] of sizeGroups.entries()) {
      if (group.length > 1) {
        context += `\nCONTENT DIVERSITY: There are ${group.length} similar-sized elements (maxChars ~${maxChars}).`;
        context += `\n   Each MUST have UNIQUE, DIFFERENT content. Do NOT repeat similar text!`;
      }
    }
    return context;
  }

  private buildSystemPrompt(language: string, topicRef: string, diversityContext: string): string {
    return `You are a world-class presentation content writer with deep expertise in ${topicRef}. You write like a university professor — every sentence is precise, factual, and valuable.

YOUR MISSION: Generate professional, information-rich content for a presentation slide about ${topicRef}. Every word must earn its place — no filler, no fluff, no generic text.

WRITING STYLE:
- Write like an expert teaching an audience — authoritative but accessible
- Use domain-specific terminology naturally
- Include SPECIFIC facts: numbers, percentages, dates, names, examples
- Make every sentence independently informative
- ALL content in ${language} language

FORMATTING RULES BY ELEMENT TYPE:

TITLES (role: MAIN TITLE or SUBTITLE):
- 3-8 words maximum, bold and specific
- Must contain a keyword from ${topicRef}
- GOOD: "Sun'iy intellekt tarixi va evolyutsiyasi" | BAD: "Kirish" or "Umumiy ma'lumot"

BODY TEXT (role: BODY CONTENT or CONTENT BLOCK):
- Use bullet points with "• " prefix for lists
- Each bullet = one COMPLETE fact or insight (not fragments)
- Structure: "• [Key term]: [specific explanation with data]"
- Example: "• Deep Learning: 2012-yilda AlexNet modeli ImageNet musobaqasida xatolikni 26% dan 15% ga kamaytirdi"
- For paragraphs: Use clear topic sentences followed by supporting details
- Target 80-95% of maxCharacters — fill the space with substance

LABELS (role: LABEL/CALLOUT):
- 1-5 precise words, topic-relevant
- Act as section markers or highlights
- GOOD: "Asosiy ko'rsatkichlar" | BAD: "Ma'lumot"

TABLES:
- Fill with REAL, plausible data (not placeholder text)
- Headers should be descriptive column names
- Data rows should contain specific values

CHARACTER LIMITS:
- Small (maxChars < 50): 2-6 precise words
- Medium (maxChars 50-200): 1-3 informative sentences or 2-4 bullet points
- Large (maxChars > 200): 4-8 bullet points OR 2-3 detailed paragraphs
- Use 80-95% of available characters — don't leave space empty
- NEVER exceed maxCharacters

ABSOLUTE RULES:
1. Generate content for EVERY element — skip NOTHING
2. Each element has UNIQUE content — ZERO repetition
3. Every sentence must contain topic-specific information
4. No generic phrases: "muhim ahamiyatga ega", "turli sohalarda qo'llaniladi", "katta o'zgarishlar"
5. No placeholder text: "Lorem ipsum", "[content]", "Sample text"${diversityContext}`;
  }

  private buildUserPrompt(
    slide: { id: string },
    outline: { title?: string; title_eng?: string; keyPoints?: string[]; description?: string },
    language: string,
    mainTopic: string | undefined,
    textElements: any[],
    layoutVisualization: string,
    slidePosition?: { current: number; total: number; sectionName?: string }
  ): string {
    const topicRef = mainTopic
      ? `"${mainTopic}"`
      : `"${outline.title || outline.title_eng}"`;

    // Build position context
    const positionContext = slidePosition
      ? `\nSLIDE POSITION: ${slidePosition.current} of ${slidePosition.total} content slides${slidePosition.sectionName ? ` | Section: "${slidePosition.sectionName}"` : ''}\n`
      : '';

    // Build key points guidance if available
    const keyPointsSection = outline.keyPoints && outline.keyPoints.length > 0
      ? `\nKEY POINTS TO COVER IN THIS SLIDE (use these as your PRIMARY content source):\n${outline.keyPoints.map((kp, i) => `  ${i + 1}. ${kp}`).join('\n')}\n\nIMPORTANT: Transform these key points into well-written slide content. Each key point should appear in at least one element. For BODY elements, use bullet points "• " with the key points as the basis.\n`
      : '';

    const elementDetails = textElements
      .map((el: any, i: number) => {
        const nearby = findNearbyElements(el as AISlideElement, textElements as AISlideElement[]);
        const positionDesc = getPositionDescription(el as AISlideElement, textElements as AISlideElement[]);
        const nearbyInfo =
          nearby.length > 0
            ? `\n   NEARBY ELEMENTS: ${nearby.map((n) => `[${n.index}] (${getPositionDescription(n, textElements as AISlideElement[])})`).join(', ')}`
            : '';

        const contentRole = this.detectContentRole(el, textElements);

        return `${i + 1}. Element [${el.index}] - ${el.type.toUpperCase()}
   LOCATION: ${positionDesc}
   SIZE: ${el.width}px wide x ${el.height}px high
   POSITION: Top=${el.top}px, Left=${el.left}px
   FONT SIZE: ${el.fontSize}px
   MAX CHARACTERS: ${el.maxCharacters}
   CURRENT CONTENT: "${el.currentContent || 'EMPTY - FILL THIS'}"
   ${el.type === 'table' ? `TABLE STRUCTURE: ${JSON.stringify(el.tableData) || 'Empty'}\n   ` : ''}CONTENT ROLE: ${contentRole}${nearbyInfo}`;
      })
      .join('\n\n');

    return `SLIDE: ${slide.id}
PRESENTATION TOPIC: ${mainTopic ? `"${mainTopic}"` : ''}
THIS SLIDE'S FOCUS: "${outline.title || outline.title_eng}"${outline.description ? `\nSECTION CONTEXT: ${outline.description}` : ''}
LANGUAGE: ${language}${positionContext}
${keyPointsSection}
${layoutVisualization}

ELEMENTS TO FILL (${textElements.length} total):
${elementDetails}

INSTRUCTIONS:
1. Fill ALL ${textElements.length} elements — every element gets content
2. Follow each element's CONTENT ROLE precisely
3. Use the KEY POINTS above as your primary content source — transform them into well-written slide text
4. For BODY elements: use "• " bullet points with specific facts from key points
5. For TITLES: write a compelling, specific title (3-8 words) related to this slide's focus
6. Use elementIndex values EXACTLY as shown in [brackets]
7. Write in ${language} — do not mix languages
8. Fill 80-95% of each element's maxCharacters — don't leave elements half-empty
9. Every sentence must contain at least one specific fact, number, or technical term`;
  }

  private mergeContentToSlide(slide: { id: string; elements: any[] }, generatedData: any): any {
    return {
      ...slide,
      elements: slide.elements.map((el: any, idx: number) => {
        const generatedElement = generatedData.elements?.find(
          (ge: any) => ge.elementIndex === idx
        );

        if (generatedElement && (el.type === 'text' || el.type === 'shape' || el.type === 'table')) {
          const updatedElement = { ...el, content: generatedElement.content };

          // Apply font size reduction if needed
          if (generatedElement.adjustedFontSize) {
            if (el.type === 'text') {
              updatedElement.content = applyFontSize(generatedElement.content, generatedElement.adjustedFontSize);
            } else if (el.type === 'shape' && el.text?.content) {
              updatedElement.text = {
                ...el.text,
                content: applyFontSize(generatedElement.content, generatedElement.adjustedFontSize),
              };
            }
          }

          // Update table data if provided
          if (el.type === 'table' && generatedElement.tableData) {
            updatedElement.data = generatedElement.tableData?.data || generatedElement.tableData;
          }

          return updatedElement;
        }

        return el;
      }),
    };
  }

  /**
   * Smart content role detection based on relative position, size, and font
   */
  private detectContentRole(el: any, allElements: any[]): string {
    const avgWidth = allElements.reduce((s, e) => s + (e.width || 0), 0) / allElements.length;
    const avgHeight = allElements.reduce((s, e) => s + (e.height || 0), 0) / allElements.length;
    const maxFontSize = Math.max(...allElements.map((e: any) => e.fontSize || 14));
    const sortedByFont = [...allElements].sort((a, b) => (b.fontSize || 14) - (a.fontSize || 14));
    const area = (el.width || 0) * (el.height || 0);
    const avgArea = avgWidth * avgHeight;

    // Title: largest font size, near top, wide
    if (el.fontSize >= maxFontSize * 0.9 && el.top < 150 && el.width > avgWidth * 0.5) {
      return `MAIN TITLE — Write 3-8 words. Must contain a keyword from the topic. Be specific and impactful, NOT generic. Example: "Sun'iy intellektning rivojlanish bosqichlari"`;
    }

    // Subtitle: second largest font, near top
    if (el.fontSize >= maxFontSize * 0.7 && el.top < 200 && el.width > avgWidth * 0.4) {
      return `SUBTITLE — One concise descriptive sentence about this slide's specific sub-topic. Example: "Mashina o'rganishning asosiy algoritmlari va ularning ishlash printsiplari"`;
    }

    // Large body: big area, likely main content
    if (area > avgArea * 1.5 || el.height > 250) {
      return `BODY CONTENT — This is the MAIN content area. Write detailed bullet points using "• " prefix. Each bullet = one complete fact with specific data. Fill 80-95% of maxCharacters. Example format:
• [Term/Concept]: [Specific fact with numbers or dates]
• [Another aspect]: [Detailed explanation]`;
    }

    // Medium-large content block
    if (el.maxCharacters > 200 || (area > avgArea * 0.8 && el.height > 150)) {
      return `CONTENT BLOCK — Write 3-6 bullet points with "• " prefix. Each point must contain a specific fact, statistic, or technical detail. Fill the space — use 80-95% of maxCharacters`;
    }

    // Small label/callout
    if (area < avgArea * 0.25 || (el.width < 180 && el.height < 70)) {
      return `LABEL/CALLOUT — 2-5 precise words. Use as a category marker or highlight. Example: "Asosiy ko'rsatkichlar"`;
    }

    // Medium content
    if (el.maxCharacters > 100 || area > avgArea * 0.5) {
      return `CONTENT BLOCK — Write 2-4 informative sentences or bullet points about a specific aspect. Include at least one number, date, or technical term`;
    }

    // Small supporting text
    if (el.maxCharacters < 60) {
      return `SHORT TEXT — 1-2 precise sentences or a key phrase. Be specific to the topic`;
    }

    return `SUPPORTING TEXT — Write 1-3 informative sentences with specific facts about the topic. Avoid generic statements`;
  }

  /**
   * Estimate max characters based on element dimensions and font size
   */
  private estimateMaxChars(el: any): number {
    const width = el.width || 200;
    const height = el.height || 50;
    const fontSize = el.fontSize || 14;

    // Approximate chars per line based on width and font size
    const charsPerLine = Math.floor(width / (fontSize * 0.6));
    const lines = Math.floor(height / (fontSize * 1.4));
    const estimated = charsPerLine * Math.max(1, lines);

    // Clamp between 20 and 1000
    return Math.max(20, Math.min(1000, estimated));
  }

  private buildFallbackContent(slideId: string, textElements: any[]): any {
    return {
      slideId,
      elements: textElements.map((el) => ({
        elementIndex: el.index,
        content: el.currentContent || `[Content for element ${el.index}]`,
        tableData: el.type === 'table' ? { data: [['Data', 'Placeholder']] } : null,
      })),
    };
  }
}
