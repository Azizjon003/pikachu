/**
 * Slide Editor
 *
 * Modifies existing slide content based on user instructions.
 * Reuses ContentGenerator patterns: extract → prompt → schema → AI → merge.
 */

import { AIClient } from '../ai/ai-client';
import { EnhancedLogger, LogLevel } from '../../lib/logger';
import {
  createLayoutVisualization,
  getPositionDescription,
  applyFontSize,
  validateContent,
} from '../utils/layout-helpers';
import { createContentSchema } from '../schemas/ai-response-schemas';
import { AISlideElement, GenerationConfig, DEFAULT_GENERATION_CONFIG } from '../types/generation';

export interface SlideEditParams {
  slide: { id: string; elements: any[] };
  instructions: string;
  language: string;
  topic?: string;
  elementIndexes?: number[];
}

interface ExtractedElement {
  index: number;
  type: string;
  width: number;
  height: number;
  left: number;
  top: number;
  currentContent: string;
  fontSize: number;
  maxCharacters: number;
  tableData: any;
  editable: boolean;
}

export class SlideEditor {
  private aiClient: AIClient;
  private logger: EnhancedLogger;
  private config: GenerationConfig;

  constructor(aiClient: AIClient, config?: Partial<GenerationConfig>, logger?: EnhancedLogger) {
    this.aiClient = aiClient;
    this.config = { ...DEFAULT_GENERATION_CONFIG, ...config };
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
  }

  async edit(params: SlideEditParams): Promise<any> {
    const { slide, instructions, language, topic, elementIndexes } = params;

    const allTextElements = this.extractTextElements(slide);

    if (allTextElements.length === 0) {
      this.logger.warn(`No text elements found for slide ${slide.id}`);
      return slide;
    }

    // Mark which elements are editable
    const elements = allTextElements.map((el) => ({
      ...el,
      editable: elementIndexes ? elementIndexes.includes(el.index) : true,
    }));

    const editableElements = elements.filter((el) => el.editable);

    if (editableElements.length === 0) {
      this.logger.warn('No editable elements match the given indexes');
      return slide;
    }

    const hasTable = editableElements.some((el) => el.type === 'table');
    const schema = createContentSchema(language, hasTable, editableElements.length);
    const layoutVisualization = createLayoutVisualization(allTextElements as unknown as AISlideElement[]);

    const result = await this.aiClient.call<{ slideId: string; elements: any[] }>({
      operationName: `editSlide_${slide.id}`,
      temperature: 0.7,
      responseFormat: 'json_schema',
      responseSchema: schema,
      messages: [
        {
          role: 'system',
          content: this.buildSystemPrompt(instructions, language, topic),
        },
        {
          role: 'user',
          content: this.buildUserPrompt(slide.id, elements, editableElements, layoutVisualization, language),
        },
      ],
      fallback: () => this.buildFallback(slide.id, editableElements),
    });

    const generatedData = result.data;

    // Validate and apply font size adjustments
    if (generatedData.elements) {
      generatedData.elements = generatedData.elements.map((genEl: any) => {
        const originalEl = editableElements.find((el) => el.index === genEl.elementIndex);

        if (originalEl && genEl.content) {
          const validation = validateContent(
            originalEl as unknown as AISlideElement,
            genEl.content,
            originalEl.fontSize,
            originalEl.maxCharacters,
            this.config.minFontSize
          );

          if (validation.fontSize) {
            genEl.adjustedFontSize = validation.fontSize;
          }
        }

        return genEl;
      });
    }

    const updatedSlide = this.mergeEditsToSlide(slide, generatedData);

    this.logger.info(`Slide edited: ${slide.id}`, {
      instructions: instructions.substring(0, 100),
      editedElements: editableElements.length,
      totalElements: allTextElements.length,
      tokenUsage: result.usage.totalTokens,
      fromCache: result.fromCache,
    });

    return updatedSlide;
  }

  private extractTextElements(slide: { elements: any[] }): ExtractedElement[] {
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
        editable: true,
      }))
      .filter(
        (el) => el.type === 'text' || el.type === 'shape' || el.type === 'table'
      );
  }

  private buildSystemPrompt(instructions: string, language: string, topic?: string): string {
    return `You are a professional slide content editor. Your task is to MODIFY existing slide content based on specific instructions.

EDIT INSTRUCTIONS: "${instructions}"

RULES:
1. Apply the edit instructions ONLY to the elements marked as EDITABLE.
2. Keep the same language (${language}) unless the instruction says otherwise.
3. Stay within each element's maxCharacters limit (slight overflow OK — font will auto-adjust).
4. Maintain the element's role (title stays title, body stays body).
5. Each element must still have UNIQUE content — no duplicates.
6. Do NOT add unrelated information — only modify as instructed.
7. Preserve the overall slide structure and meaning.
${topic ? `8. Topic context: "${topic}" — all content should stay relevant to this topic.` : ''}

IMPORTANT: You must return content for ALL editable elements, even if some don't need changes. For elements that don't need modification based on the instructions, return their current content unchanged.`;
  }

  private buildUserPrompt(
    slideId: string,
    allElements: ExtractedElement[],
    editableElements: ExtractedElement[],
    layoutVisualization: string,
    language: string
  ): string {
    const elementDetails = allElements
      .map((el, i) => {
        const positionDesc = getPositionDescription(el as unknown as AISlideElement, allElements as unknown as AISlideElement[]);
        const editableTag = el.editable ? '  >>> EDITABLE — apply instructions to this element' : '  (read-only — shown for context only)';
        const contentRole =
          el.top < 100 && el.width > 500
            ? 'TITLE'
            : el.height > 300
            ? 'BODY'
            : el.width < 200 && el.height < 100
            ? 'LABEL'
            : 'CONTENT';

        return `${i + 1}. Element [${el.index}] — ${el.type.toUpperCase()} — ${contentRole}
   CURRENT CONTENT: "${el.currentContent || '(empty)'}"
   Location: ${positionDesc} | Size: ${el.width}px × ${el.height}px
   Font: ${el.fontSize}px | Max chars: ${el.maxCharacters}
${editableTag}`;
      })
      .join('\n\n');

    return `SLIDE ID: ${slideId}
LANGUAGE: ${language}
TOTAL ELEMENTS: ${allElements.length}
EDITABLE ELEMENTS: ${editableElements.length} (only these should appear in your response)

${layoutVisualization}

ALL ELEMENTS (for context):
${elementDetails}

RESPOND with content for the ${editableElements.length} EDITABLE elements only.
Use their elementIndex values exactly as shown in [brackets].`;
  }

  private mergeEditsToSlide(slide: { id: string; elements: any[] }, generatedData: any): any {
    return {
      ...slide,
      elements: slide.elements.map((el: any, idx: number) => {
        const editedElement = generatedData.elements?.find(
          (ge: any) => ge.elementIndex === idx
        );

        if (editedElement && (el.type === 'text' || el.type === 'shape' || el.type === 'table')) {
          const updatedElement = { ...el, content: editedElement.content };

          if (editedElement.adjustedFontSize) {
            if (el.type === 'text') {
              updatedElement.content = applyFontSize(editedElement.content, editedElement.adjustedFontSize);
            } else if (el.type === 'shape' && el.text?.content) {
              updatedElement.text = {
                ...el.text,
                content: applyFontSize(editedElement.content, editedElement.adjustedFontSize),
              };
            }
          }

          if (el.type === 'table' && editedElement.tableData) {
            updatedElement.data = editedElement.tableData?.data || editedElement.tableData;
          }

          return updatedElement;
        }

        return el;
      }),
    };
  }

  private buildFallback(slideId: string, editableElements: ExtractedElement[]): any {
    return {
      slideId,
      elements: editableElements.map((el) => ({
        elementIndex: el.index,
        content: el.currentContent || `[Content ${el.index}]`,
      })),
    };
  }
}
