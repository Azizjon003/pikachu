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
  outline: { title?: string; title_eng?: string };
  language: string;
  mainTopic?: string;
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
    const { slide, outline, language, mainTopic } = params;

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
          content: this.buildUserPrompt(slide, outline, language, mainTopic, textElements, layoutVisualization),
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
        maxCharacters: el.maxCharacters || 100,
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
    return `You are a professional presentation content writer specialized in creating TOPIC-SPECIFIC content.

PRIMARY OBJECTIVE: Generate content SPECIFICALLY about ${topicRef} - NOT generic content

CRITICAL RULES:
1. You MUST generate content for EVERY element listed
2. Do NOT skip any elements
3. Content MUST be in ${language} language
4. Content MUST be SPECIFICALLY about ${topicRef} - NOT generic
5. STRICT CHARACTER LIMITS: Each element has a maxCharacters limit. Try to stay within it, but font size will be adjusted if needed.
6. CONTENT DIVERSITY: Each element MUST have UNIQUE content. NEVER repeat the same text!
7. Use element properties to determine content style:
   - Large width/height + top position = Main title (3-8 words, TOPIC-SPECIFIC)
   - Medium size + center = Body text (concise paragraphs or bullets)
   - Small size = Labels or callouts (1-3 words)
   - Table elements = Generate appropriate table data

CHARACTER LIMIT GUIDELINES:
- Small elements (maxChars < 50): Very short text (1-5 words)
- Medium elements (maxChars 50-200): Concise phrases or sentences
- Large elements (maxChars > 200): Paragraphs
- Add spaces between words - NEVER merge words together!

CONTENT VARIETY RULES:
- NEVER use the same or similar text for different elements
- Each element should cover a DIFFERENT SPECIFIC aspect of the topic
- Vary your language and phrasing across elements
- ALL content must use topic-specific terminology${diversityContext}`;
  }

  private buildUserPrompt(
    slide: { id: string },
    outline: { title?: string; title_eng?: string },
    language: string,
    mainTopic: string | undefined,
    textElements: any[],
    layoutVisualization: string
  ): string {
    const topicRef = mainTopic
      ? `"${mainTopic}"`
      : `"${outline.title || outline.title_eng}"`;

    const elementDetails = textElements
      .map((el: any, i: number) => {
        const nearby = findNearbyElements(el as AISlideElement, textElements as AISlideElement[]);
        const positionDesc = getPositionDescription(el as AISlideElement, textElements as AISlideElement[]);
        const nearbyInfo =
          nearby.length > 0
            ? `\n   NEARBY ELEMENTS: ${nearby.map((n) => `[${n.index}] (${getPositionDescription(n, textElements as AISlideElement[])})`).join(', ')}`
            : '';

        const contentRole =
          el.top < 100 && el.width > 500
            ? 'MAIN TITLE - Keep SHORT (3-8 words) and UNIQUE'
            : el.height > 300
            ? 'BODY CONTENT - Use detailed text, DISTINCT from others'
            : el.width < 200 && el.height < 100
            ? 'LABEL/CALLOUT - Very brief (1-3 words)'
            : 'GENERAL CONTENT';

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

    return `SLIDE ID: ${slide.id}
${mainTopic ? `MAIN TOPIC: "${mainTopic}" (ALL content must be SPECIFICALLY about this)` : ''}
OUTLINE TOPIC: ${outline.title || outline.title_eng}
LANGUAGE: ${language}
TOTAL ELEMENTS: ${textElements.length}

${layoutVisualization}

ELEMENTS:
${elementDetails}

MANDATORY:
1. Generate content for ALL ${textElements.length} elements — no more, no less
2. Each element MUST have UNIQUE, DIFFERENT content
3. Use the element index shown in [brackets] as elementIndex value
4. Match content to topic: ${topicRef}
5. Write ALL content in ${language} language
6. Content must NOT be empty — always provide meaningful text`;
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
