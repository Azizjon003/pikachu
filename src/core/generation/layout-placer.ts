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

    const prompt = `You are a PowerPoint slide layout analyzer. Identify which text placeholders should contain the TITLE and which should contain the AUTHOR NAME on a title slide.

Content to place:
- TITLE: "${topic}"
- AUTHOR: "${author}"

Available text elements:
${textElements.map((el, i) => `Element #${i} (elementIndex: ${el.index}):
  - Current content: "${el.content}"
  - Font size: ${el.fontSize}px
  - Position: top=${el.top}, left=${el.left}
  - Size: ${el.width}x${el.height}
  - Max characters: ${el.maxCharacters}`).join('\n\n')}

RULES:
1. TITLE: Largest font size, positioned in upper-center or center
2. AUTHOR: Smaller font size than title, positioned BELOW the title
3. These MUST be two DIFFERENT elements
4. Compare ALL elements by font size — the LARGEST is almost always the title

Return JSON:
{
  "title": { "elementIndex": <number>, "confidence": <0-1>, "reasoning": "<why>" },
  "author": { "elementIndex": <number>, "confidence": <0-1>, "reasoning": "<why>" }
}`;

    const result = await this.aiClient.call<TitlePlacement>({
      operationName: 'placeTitlePage',
      temperature: 0.3,
      responseFormat: 'json_object',
      messages: [
        { role: 'system', content: 'You are a PowerPoint slide analyzer. Return ONLY valid JSON.' },
        { role: 'user', content: prompt },
      ],
      fallback: () => this.fallbackTitlePlacement(textElements),
    });

    const placement = result.data;

    this.logger.info('Title placement detected', {
      titleElement: placement.title.elementIndex,
      titleConfidence: placement.title.confidence,
      authorElement: placement.author.elementIndex,
      authorConfidence: placement.author.confidence,
    });

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

  /**
   * Place outline items on second slide
   */
  async placeOutline(slide: Slide, outlineItems: string[]): Promise<Slide> {
    this.logger.info('Placing outline items on second slide', { itemCount: outlineItems.length });

    const textElements = slide.elements
      .filter((el) => el.type === 'shape' && el.content)
      .map((el) => ({
        index: el.elementIndex,
        content: el.content,
        fontSize: el.fontSize,
        top: el.top,
        left: el.left,
        maxCharacters: el.maxCharacters,
      }));

    const prompt = `You are a PowerPoint outline slide analyzer. Identify which element should be the HEADER and which ${outlineItems.length} elements should contain the OUTLINE ITEMS.

Outline items to place:
${outlineItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

Available text elements:
${textElements.map((el, i) => `Element #${i} (elementIndex: ${el.index}):
  - Current content: "${el.content}"
  - Font size: ${el.fontSize}px
  - Position: top=${el.top}, left=${el.left}
  - Max characters: ${el.maxCharacters}`).join('\n\n')}

RULES:
1. HEADER: Shortest text, LARGE font size (> 32px), TOP of slide. Should contain "Reja:" only.
2. OUTLINE ITEMS (${outlineItems.length} elements):
   - Medium font size (18-28px), positioned vertically below header
   - Order by 'top' position (smallest to largest = first to last item)
   - Must accommodate numbered text like "1. Item text"
3. All items must be DIFFERENT elements

Return JSON:
{
  "header": { "elementIndex": <number>, "confidence": <0-1>, "reasoning": "<why>" },
  "items": [
    {"elementIndex": <number>, "order": 1, "confidence": <0-1>, "reasoning": "<why>"},
    ...
  ]
}`;

    const result = await this.aiClient.call<OutlinePlacement>({
      operationName: 'placeOutline',
      temperature: 0.3,
      responseFormat: 'json_object',
      messages: [
        { role: 'system', content: 'You are a PowerPoint slide analyzer. Return ONLY valid JSON.' },
        { role: 'user', content: prompt },
      ],
      fallback: () => this.fallbackOutlinePlacement(textElements, outlineItems.length),
    });

    const placement = result.data;

    this.logger.info('Outline placement detected', {
      headerElement: placement.header.elementIndex,
      itemElements: placement.items.map((item) => item.elementIndex),
    });

    return {
      ...slide,
      elements: slide.elements.map((el) => {
        if (el.elementIndex === placement.header.elementIndex) {
          return { ...el, content: 'Reja:' };
        }
        const itemMatch = placement.items.find((item) => item.elementIndex === el.elementIndex);
        if (itemMatch) {
          const itemIndex = itemMatch.order - 1;
          return { ...el, content: `${itemIndex + 1}. ${outlineItems[itemIndex]}` };
        }
        return el;
      }),
    };
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
        reasoning: `Fallback: element ${i + 1} by position`,
      })),
    };
  }
}
