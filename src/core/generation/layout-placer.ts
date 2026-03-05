/**
 * Layout Placer
 *
 * Intelligently places content on title and outline slides
 * by using AI to identify which element should hold which content.
 *
 * Unique logic from ai-slide-placer.ts — not duplicated elsewhere.
 */

import { AIClient } from '../ai/ai-client';
import { EnhancedLogger, LogLevel } from '../../lib/logger';
import {
  titlePlacementSchema,
  createOutlinePlacementSchema,
} from '../schemas/ai-response-schemas';

interface SlideElement {
  type: string;
  width: number;
  height: number;
  left: number;
  top: number;
  content: string;
  fontSize: number;
  maxCharacters: number;
  elementIndex: number;
  [key: string]: any;
}

interface Slide {
  elements: SlideElement[];
  [key: string]: any;
}

interface TitlePlacement {
  title: { elementIndex: number; confidence: number; reasoning: string };
  author: { elementIndex: number; confidence: number; reasoning: string };
}

interface OutlinePlacement {
  header: { elementIndex: number; confidence: number; reasoning: string };
  items: Array<{ elementIndex: number; order: number; confidence: number; reasoning: string }>;
}

export class LayoutPlacer {
  private aiClient: AIClient;
  private logger: EnhancedLogger;

  constructor(aiClient: AIClient, logger?: EnhancedLogger) {
    this.aiClient = aiClient;
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
  }

  /**
   * Place title and author on first slide
   */
  async placeTitlePage(slide: Slide, topic: string, author: string): Promise<Slide> {
    this.logger.info('Placing title and author on first slide', { topic, author });

    const textElements = slide.elements
      .filter((el) => el.type === 'shape' && el.content)
      .map((el) => ({
        index: el.elementIndex,
        content: el.content,
        fontSize: el.fontSize,
        top: el.top,
        left: el.left,
        width: el.width,
        height: el.height,
        maxCharacters: el.maxCharacters,
      }));

    this.logger.debug(`Found ${textElements.length} text elements`);

    const prompt = `Analyze a PowerPoint title slide layout and determine which text placeholder should contain the TITLE and which should contain the AUTHOR NAME.

Content to place:
- TITLE: "${topic}"
- AUTHOR: "${author}"

Available text elements:
${textElements.map((el, i) => `Element #${i} (elementIndex: ${el.index}):
  - Current content: "${el.content}"
  - Font size: ${el.fontSize}px
  - Position: top=${el.top}px, left=${el.left}px
  - Size: ${el.width}px × ${el.height}px
  - Max characters: ${el.maxCharacters}`).join('\n\n')}

ANALYSIS RULES:
1. TITLE element: Has the LARGEST font size. Usually positioned in the upper-center or center of the slide.
2. AUTHOR element: Has SMALLER font size than title. Usually positioned BELOW the title element (higher top value).
3. Title and author MUST be two DIFFERENT elements — never assign both to the same element.
4. Compare ALL elements by font size — the element with the largest fontSize is almost always the title.
5. Set confidence based on how clear the distinction is (1.0 = very clear, 0.5 = ambiguous).`;

    const result = await this.aiClient.call<TitlePlacement>({
      operationName: 'placeTitlePage',
      temperature: 0.2,
      responseFormat: 'json_schema',
      responseSchema: titlePlacementSchema,
      messages: [
        { role: 'system', content: 'You are an expert PowerPoint slide layout analyzer. Analyze element properties to determine correct placement.' },
        { role: 'user', content: prompt },
      ],
      fallback: () => this.fallbackTitlePlacement(textElements),
    });

    const placement = result.data;

    // Validate: title and author must be different elements
    if (placement.title.elementIndex === placement.author.elementIndex) {
      this.logger.warn('AI returned same element for title and author, using fallback');
      const fallback = this.fallbackTitlePlacement(textElements);
      return this.applyTitlePlacement(slide, fallback, topic, author);
    }

    // Warn on low confidence
    if (placement.title.confidence < 0.5 || placement.author.confidence < 0.5) {
      this.logger.warn('Low confidence placement detected', {
        titleConfidence: placement.title.confidence,
        authorConfidence: placement.author.confidence,
      });
    }

    this.logger.info('Title placement detected', {
      titleElement: placement.title.elementIndex,
      titleConfidence: placement.title.confidence,
      authorElement: placement.author.elementIndex,
      authorConfidence: placement.author.confidence,
    });

    return this.applyTitlePlacement(slide, placement, topic, author);
  }

  /**
   * Place outline items on second slide
   */
  async placeOutline(slide: Slide, outlineItems: string[], language: string): Promise<Slide> {
    this.logger.info('Placing outline items on second slide', { itemCount: outlineItems.length, language });

    const textElements = slide.elements
      .filter((el) => el.type === 'shape' && el.content)
      .map((el) => ({
        index: el.elementIndex,
        content: el.content,
        fontSize: el.fontSize,
        top: el.top,
        left: el.left,
        width: el.width,
        height: el.height,
        maxCharacters: el.maxCharacters,
      }));

    const outlinePlacementSchema = createOutlinePlacementSchema(outlineItems.length);

    const prompt = `Analyze a PowerPoint outline/agenda slide layout. Identify which element is the HEADER (title) and which ${outlineItems.length} elements should contain the OUTLINE ITEMS.

Outline items to place:
${outlineItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

Available text elements:
${textElements.map((el, i) => `Element #${i} (elementIndex: ${el.index}):
  - Current content: "${el.content}"
  - Font size: ${el.fontSize}px
  - Position: top=${el.top}px, left=${el.left}px
  - Size: ${el.width}px × ${el.height}px
  - Max characters: ${el.maxCharacters}`).join('\n\n')}

ANALYSIS RULES:
1. HEADER: The element with the LARGEST font size (usually > 32px), positioned at the TOP of the slide. This element will contain a short title like "Outline" or "Plan" in ${language}.
2. OUTLINE ITEMS: The remaining ${outlineItems.length} elements with medium font size (usually 18-28px), positioned VERTICALLY below the header.
   - Assign "order" based on vertical position: element with smallest "top" value = order 1, next = order 2, etc.
   - Each item must accommodate numbered text like "1. Item text"
3. ALL items must be DIFFERENT elements — never assign the same elementIndex twice.
4. Set confidence based on how clear the layout structure is.`;

    const result = await this.aiClient.call<OutlinePlacement>({
      operationName: 'placeOutline',
      temperature: 0.2,
      responseFormat: 'json_schema',
      responseSchema: outlinePlacementSchema,
      messages: [
        { role: 'system', content: 'You are an expert PowerPoint slide layout analyzer. Analyze element properties to determine correct placement.' },
        { role: 'user', content: prompt },
      ],
      fallback: () => this.fallbackOutlinePlacement(textElements, outlineItems.length),
    });

    const placement = result.data;

    // Validate: no duplicate elementIndex
    const allIndexes = [placement.header.elementIndex, ...placement.items.map((item) => item.elementIndex)];
    const uniqueIndexes = new Set(allIndexes);
    if (uniqueIndexes.size !== allIndexes.length) {
      this.logger.warn('Duplicate elementIndex in outline placement, using fallback');
      const fallback = this.fallbackOutlinePlacement(textElements, outlineItems.length);
      return this.applyOutlinePlacement(slide, fallback, outlineItems, language);
    }

    this.logger.info('Outline placement detected', {
      headerElement: placement.header.elementIndex,
      itemElements: placement.items.map((item) => item.elementIndex),
    });

    return this.applyOutlinePlacement(slide, placement, outlineItems, language);
  }

  // ===== Apply Placements =====

  private applyTitlePlacement(slide: Slide, placement: TitlePlacement, topic: string, author: string): Slide {
    return {
      ...slide,
      elements: slide.elements.map((el) => {
        if (el.elementIndex === placement.title.elementIndex) {
          return { ...el, content: topic };
        }
        if (el.elementIndex === placement.author.elementIndex) {
          return { ...el, content: author };
        }
        return el;
      }),
    };
  }

  private applyOutlinePlacement(slide: Slide, placement: OutlinePlacement, outlineItems: string[], language: string): Slide {
    // Translate header text based on language
    const headerText = this.getOutlineHeaderText(language);

    return {
      ...slide,
      elements: slide.elements.map((el) => {
        if (el.elementIndex === placement.header.elementIndex) {
          return { ...el, content: headerText };
        }
        const itemMatch = placement.items.find((item) => item.elementIndex === el.elementIndex);
        if (itemMatch) {
          const itemIndex = itemMatch.order - 1;
          if (itemIndex >= 0 && itemIndex < outlineItems.length) {
            return { ...el, content: `${itemIndex + 1}. ${outlineItems[itemIndex]}` };
          }
        }
        return el;
      }),
    };
  }

  /**
   * Get translated "Outline" header text by language
   */
  private getOutlineHeaderText(language: string): string {
    const lang = language.toLowerCase();
    const translations: Record<string, string> = {
      uzbek: 'Reja:',
      uz: 'Reja:',
      russian: 'План:',
      ru: 'План:',
      english: 'Outline:',
      en: 'Outline:',
      kazakh: 'Жоспар:',
      kk: 'Жоспар:',
      turkish: 'Plan:',
      tr: 'Plan:',
      korean: '개요:',
      ko: '개요:',
      chinese: '大纲:',
      zh: '大纲:',
      japanese: '概要:',
      ja: '概要:',
      german: 'Gliederung:',
      de: 'Gliederung:',
      french: 'Plan:',
      fr: 'Plan:',
      spanish: 'Esquema:',
      es: 'Esquema:',
      arabic: 'المخطط:',
      ar: 'المخطط:',
    };
    return translations[lang] || 'Outline:';
  }

  // ===== Fallbacks =====

  private fallbackTitlePlacement(textElements: any[]): TitlePlacement {
    this.logger.warn('Using fallback title placement');
    const sorted = [...textElements].sort((a, b) => b.fontSize - a.fontSize);
    return {
      title: { elementIndex: sorted[0]?.index ?? 0, confidence: 0.5, reasoning: 'Fallback: largest font' },
      author: { elementIndex: sorted[1]?.index ?? 1, confidence: 0.5, reasoning: 'Fallback: second largest font' },
    };
  }

  private fallbackOutlinePlacement(textElements: any[], itemCount: number): OutlinePlacement {
    this.logger.warn('Using fallback outline placement');
    const sorted = [...textElements].sort((a, b) => a.top - b.top);
    return {
      header: { elementIndex: sorted[0]?.index ?? 0, confidence: 0.5, reasoning: 'Fallback: topmost element' },
      items: sorted.slice(1, 1 + itemCount).map((el, i) => ({
        elementIndex: el.index,
        order: i + 1,
        confidence: 0.5,
        reasoning: `Fallback: element ${i + 1} by vertical position`,
      })),
    };
  }
}
