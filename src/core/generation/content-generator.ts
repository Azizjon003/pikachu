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
  outline: { title?: string; title_eng?: string; keyPoints?: string[] };
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
    return `You are an expert presentation content writer. Your task is to generate HIGH-QUALITY, FACTUALLY ACCURATE content for a presentation about ${topicRef}.

PRIMARY OBJECTIVE: Every piece of text MUST be specifically about ${topicRef}. Include real facts, specific details, and domain-relevant terminology. NEVER write generic placeholder text.

CRITICAL RULES:
1. Generate content for EVERY element listed — do NOT skip any
2. ALL content MUST be in ${language} language
3. Content MUST be SPECIFICALLY about ${topicRef} with real facts and details
4. Each element has a CONTENT ROLE (title, body, label etc.) — follow it precisely
5. Respect maxCharacters limits. Prioritize quality over quantity
6. CONTENT DIVERSITY: Each element covers a DIFFERENT aspect of the topic. NEVER repeat!

CONTENT QUALITY STANDARDS:
- TITLES: Short, impactful, topic-specific (not generic like "Introduction" or "Overview")
- BODY TEXT: Include specific facts, statistics, dates, names, or technical details relevant to ${topicRef}
- BULLET POINTS: Each point should convey a distinct, meaningful fact
- LABELS: Short but descriptive and topic-relevant
- TABLES: Fill with real, accurate data related to the topic

CHARACTER LIMITS:
- Small (maxChars < 50): 1-5 precise words
- Medium (maxChars 50-200): Concise informative sentences
- Large (maxChars > 200): Detailed paragraphs with specific facts
- Always use proper word spacing

FORBIDDEN:
- Generic filler text ("Lorem ipsum", "Sample text", "Content here")
- Overly broad statements that could apply to any topic
- Repeating the same idea in different words across elements
- Empty or meaningless content${diversityContext}`;
  }

  private buildUserPrompt(
    slide: { id: string },
    outline: { title?: string; title_eng?: string; keyPoints?: string[] },
    language: string,
    mainTopic: string | undefined,
    textElements: any[],
    layoutVisualization: string
  ): string {
    const topicRef = mainTopic
      ? `"${mainTopic}"`
      : `"${outline.title || outline.title_eng}"`;

    // Build key points guidance if available
    const keyPointsSection = outline.keyPoints && outline.keyPoints.length > 0
      ? `\nKEY POINTS TO COVER IN THIS SLIDE:\n${outline.keyPoints.map((kp, i) => `  ${i + 1}. ${kp}`).join('\n')}\nDistribute these points across the elements below. Each element should address one or more of these points.\n`
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

    return `SLIDE ID: ${slide.id}
${mainTopic ? `MAIN TOPIC: "${mainTopic}"` : ''}
SLIDE TOPIC: ${outline.title || outline.title_eng}
LANGUAGE: ${language}
TOTAL ELEMENTS: ${textElements.length}
${keyPointsSection}
${layoutVisualization}

ELEMENTS:
${elementDetails}

REQUIREMENTS:
1. Generate content for ALL ${textElements.length} elements — no more, no less
2. Each element MUST have UNIQUE content covering a DIFFERENT aspect
3. Use the element index shown in [brackets] as elementIndex value
4. ALL content must be about: ${topicRef}
5. Write in ${language} language
6. Use the KEY POINTS above as your content guide — include specific facts from them
7. Content must be factually accurate and informative`;
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
    const area = (el.width || 0) * (el.height || 0);
    const avgArea = avgWidth * avgHeight;

    // Title: largest font size, near top, wide
    if (el.fontSize >= maxFontSize * 0.9 && el.top < 150 && el.width > avgWidth * 0.6) {
      return 'MAIN TITLE - Keep SHORT (3-8 words), bold and topic-specific';
    }

    // Subtitle: second largest font, near top
    if (el.fontSize >= maxFontSize * 0.7 && el.top < 200 && el.width > avgWidth * 0.5) {
      return 'SUBTITLE - One concise sentence describing the slide topic';
    }

    // Large body: big area, likely main content
    if (area > avgArea * 1.5 || el.height > 250) {
      return 'BODY CONTENT - Use detailed, informative text with specific facts. Use bullet points if appropriate';
    }

    // Small label/callout
    if (area < avgArea * 0.3 || (el.width < 200 && el.height < 80)) {
      return 'LABEL/CALLOUT - Very brief (1-5 words), descriptive';
    }

    // Medium content
    if (el.maxCharacters > 150 || area > avgArea * 0.8) {
      return 'CONTENT BLOCK - Informative paragraph or bullet points about a specific aspect of the topic';
    }

    return 'SUPPORTING TEXT - Brief, relevant text about the topic';
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
