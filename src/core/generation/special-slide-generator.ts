/**
 * Special Slide Generator
 *
 * Generates conclusion, references, and thank-you slides.
 * Unifies logic from structured-generator.ts and ai-slide-placer.ts.
 */

import { AIClient } from '../ai/ai-client';
import { EnhancedLogger, LogLevel } from '../../lib/logger';
import { createLayoutVisualization, getPositionDescription } from '../utils/layout-helpers';
import { AISlideElement } from '../types/generation';
import { specialSlideContentSchema } from '../schemas/ai-response-schemas';

interface SpecialSlideParams {
  slide: { id: string; elements: any[] };
  topic: string;
  language: string;
}

interface ReferencesParams extends SpecialSlideParams {
  count?: number;
}

export class SpecialSlideGenerator {
  private aiClient: AIClient;
  private logger: EnhancedLogger;

  constructor(aiClient: AIClient, logger?: EnhancedLogger) {
    this.aiClient = aiClient;
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
  }

  async generateConclusion(params: SpecialSlideParams): Promise<any> {
    const { slide, topic, language } = params;
    const textElements = this.extractTextElements(slide);
    const layoutVisualization = createLayoutVisualization(textElements as AISlideElement[]);
    const elementGuide = this.buildElementGuide(textElements, 'conclusion');

    const result = await this.aiClient.call<{ slideId: string; elements: any[] }>({
      operationName: 'generateConclusion',
      temperature: 0.7,
      responseFormat: 'json_schema',
      responseSchema: specialSlideContentSchema,
      messages: [
        {
          role: 'system',
          content: `Generate a conclusion slide for the topic: "${topic}".
The content must be a concise summary of approximately 100 to 150 words, written entirely in ${language}.

Requirements:
- Title: Use the topic name as the main title in ${language}
- Content: Provide a brief yet informative overview focusing on key takeaways
- Structure content into clear, complete declarative sentences
- Try to stay within maxCharacters limits (slight overflow OK - font adjusts)
- Each element MUST have UNIQUE content - NO DUPLICATES!
- Write ALL content in ${language} language

SLIDE ID: ${slide.id}
TOPIC: ${topic}
LANGUAGE: ${language}
TOTAL ELEMENTS: ${textElements.length}

${layoutVisualization}

${elementGuide}

Generate content for ALL ${textElements.length} elements. Each must be UNIQUE.`,
        },
      ],
      fallback: () => this.buildFallback(slide.id, textElements, 'Xulosa'),
    });

    this.logger.info('Conclusion slide generated', {
      slideId: slide.id,
      tokenUsage: result.usage.totalTokens,
    });

    return this.applyPlacements(slide, result.data);
  }

  async generateReferences(params: ReferencesParams): Promise<any> {
    const { slide, topic, language, count = 5 } = params;
    const textElements = this.extractTextElements(slide);
    const layoutVisualization = createLayoutVisualization(textElements as AISlideElement[]);
    const elementGuide = this.buildElementGuide(textElements, 'references');

    const result = await this.aiClient.call<{ slideId: string; elements: any[] }>({
      operationName: 'generateReferences',
      temperature: 0.7,
      responseFormat: 'json_schema',
      responseSchema: specialSlideContentSchema,
      messages: [
        {
          role: 'system',
          content: `Generate ${count} academic literature references for the topic: "${topic}".
All content must be written in ${language}.

Requirements:
- Main Title: Translate "References" into ${language} for the title element
- Generate ${count} realistic academic references about "${topic}"
- Include: author(s), title, date, publisher/journal
- Mix of books, articles, and papers
- Alphabetical order by author's last name
- Format as numbered list (1., 2., 3., etc.)
- Place all references in the body content element
- Each element MUST have UNIQUE content
- Stay within maxCharacters limits (slight overflow OK)

Reference format examples:
- Book: "Author A.A. Title. Publisher, Year."
- Article: "Author A.A. Article title // Journal. Year. Vol. Pages."
- Web: "Author A.A. Title. URL (access date)"

SLIDE ID: ${slide.id}
TOPIC: ${topic}
LANGUAGE: ${language}
TOTAL ELEMENTS: ${textElements.length}

${layoutVisualization}

${elementGuide}

Generate content for ALL ${textElements.length} elements. Each must be UNIQUE.`,
        },
      ],
      fallback: () => this.buildFallback(slide.id, textElements, 'Foydalanilgan adabiyotlar'),
    });

    this.logger.info('References slide generated', {
      slideId: slide.id,
      referenceCount: count,
      tokenUsage: result.usage.totalTokens,
    });

    return this.applyPlacements(slide, result.data);
  }

  async generateThankYou(params: SpecialSlideParams): Promise<any> {
    const { slide, topic, language } = params;
    const textElements = this.extractTextElements(slide);
    const layoutVisualization = createLayoutVisualization(textElements as AISlideElement[]);
    const elementGuide = this.buildElementGuide(textElements, 'thankyou');

    const result = await this.aiClient.call<{ slideId: string; elements: any[] }>({
      operationName: 'generateThankYou',
      temperature: 0.5,
      responseFormat: 'json_schema',
      responseSchema: specialSlideContentSchema,
      messages: [
        {
          role: 'system',
          content: `Generate a thank you slide for: "${topic}".
Written entirely in ${language}.

CRITICAL: The main/largest element must contain "Thank you for your attention" translated into ${language}.
For example, if Uzbek: "E'tiboringiz uchun rahmat!"

Requirements:
- Main element: Thank you phrase in ${language}
- Other elements: supportive text (contact info, Q&A invitation, etc.)
- Each element MUST have UNIQUE content
- Stay within maxCharacters limits
- Write ALL content in ${language}

SLIDE ID: ${slide.id}
TOPIC: ${topic}
LANGUAGE: ${language}
TOTAL ELEMENTS: ${textElements.length}

${layoutVisualization}

${elementGuide}

Generate content for ALL ${textElements.length} elements. Each must be UNIQUE.`,
        },
      ],
      fallback: () => this.buildFallback(slide.id, textElements, "E'tiboringiz uchun rahmat!"),
    });

    this.logger.info('Thank you slide generated', {
      slideId: slide.id,
      tokenUsage: result.usage.totalTokens,
    });

    return this.applyPlacements(slide, result.data);
  }

  // ===== Private Helpers =====

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

  private buildElementGuide(textElements: any[], slideType: string): string {
    return `ELEMENT LAYOUT & POSITIONING GUIDE:
${textElements
  .map((el: any, i: number) => {
    const positionDesc = getPositionDescription(el as AISlideElement, textElements as AISlideElement[]);
    const contentRole =
      el.top < 100 && el.width > 500
        ? slideType === 'references'
          ? "MAIN TITLE (Translate 'References')"
          : slideType === 'thankyou'
          ? "MAIN TITLE (Use 'Thank You' phrase)"
          : 'MAIN TITLE'
        : el.height > 300
        ? slideType === 'references'
          ? 'BODY CONTENT (Place all references here)'
          : 'BODY CONTENT'
        : el.width < 200 && el.height < 100
        ? 'LABEL'
        : 'GENERAL';

    return `${i + 1}. Element [${el.index}] - ${el.type.toUpperCase()}
   LOCATION: ${positionDesc}
   SIZE: ${el.width}px x ${el.height}px
   POSITION: Top=${el.top}px, Left=${el.left}px
   FONT SIZE: ${el.fontSize}px
   MAX CHARACTERS: ${el.maxCharacters}
   CONTENT ROLE: ${contentRole}`;
  })
  .join('\n\n')}`;
  }

  private applyPlacements(slide: { id: string; elements: any[] }, generatedData: any): any {
    return {
      ...slide,
      elements: slide.elements.map((el: any, idx: number) => {
        const generatedElement = generatedData.elements?.find(
          (ge: any) => ge.elementIndex === idx
        );

        if (
          generatedElement &&
          (el.type === 'text' || el.type === 'shape' || el.type === 'table')
        ) {
          return { ...el, content: generatedElement.content };
        }

        return el;
      }),
    };
  }

  private buildFallback(slideId: string, textElements: any[], defaultTitle: string): any {
    return {
      slideId,
      elements: textElements.map((el, i) => ({
        elementIndex: el.index,
        content: i === 0 ? defaultTitle : `[Content ${i}]`,
      })),
    };
  }
}
