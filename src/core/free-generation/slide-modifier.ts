/**
 * Slide Modifier
 *
 * AI-powered modification of existing presentations via natural language prompts.
 * Supports:
 * 1. Content changes — "add more statistics to slide 3"
 * 2. Style changes — "make the color scheme darker", "use blue theme"
 * 3. Structural changes — "add a new slide about X after slide 4"
 * 4. Element changes — "make titles bigger", "change font to Arial"
 * 5. Deletion — "remove slide 5", "remove the image from slide 2"
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AIClient } from '@/src/core/ai/ai-client';
import { SlideBuilder } from '@/src/core/free-generation/slide-builder';
import { getPattern } from '@/src/core/free-generation/slide-patterns';
import { THEMES, DEFAULT_VIEWPORT, FONT_PAIRS } from '@/src/core/free-generation/design-system';
import { exportPPTX } from '@/src/core/exporters';
import { EnhancedLogger, LogLevel } from '@/src/lib/logger';
import type { Slide } from '../../../types/slides';
import type { SlideModifyOptions, SlideModifyResult, PatternName } from '@/src/core/types/generation';

interface ModifyAction {
  action: 'update_text' | 'update_style' | 'add_slide' | 'delete_slide' | 'reorder' | 'update_element';
  slideIndex?: number;
  elementIndex?: number;
  newContent?: string;
  styleChanges?: Record<string, string>;
  newSlide?: {
    pattern: string;
    title: string;
    content: string;
    afterSlideIndex: number;
  };
  description: string;
}

export class SlideModifier {
  private aiClient: AIClient;
  private logger: EnhancedLogger;

  constructor(aiClient?: AIClient, logger?: EnhancedLogger) {
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
    this.aiClient = aiClient ?? new AIClient(undefined, this.logger);
  }

  /**
   * Modify an existing presentation based on a natural language prompt
   */
  async modify(options: SlideModifyOptions): Promise<SlideModifyResult> {
    const { jsonFilePath, prompt, language, topic } = options;

    // 1. Load existing slides
    const fullPath = path.isAbsolute(jsonFilePath)
      ? jsonFilePath
      : path.join(process.cwd(), jsonFilePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Presentation file not found: ${jsonFilePath}`);
    }

    const slides: Slide[] = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    this.logger.info('Loaded presentation for modification', {
      slideCount: slides.length,
      prompt: prompt.substring(0, 100),
    });

    // 2. Build slide summary for AI context
    const slideSummary = this.buildSlideSummary(slides);

    // 3. Ask AI what changes to make
    const actions = await this.planModifications(slideSummary, prompt, language, topic, slides.length);

    if (actions.length === 0) {
      throw new Error('AI could not determine any changes from the given prompt');
    }

    this.logger.info('Modification plan', {
      actionCount: actions.length,
      actions: actions.map(a => a.description),
    });

    // 4. Apply changes
    const changesSummary: string[] = [];
    let modifiedSlides = [...slides];

    // Sort actions: deletions last (reverse index order), additions second-to-last, others first
    const sortedActions = [...actions].sort((a, b) => {
      const order: Record<string, number> = {
        update_text: 0, update_style: 0, update_element: 0, reorder: 1, add_slide: 2, delete_slide: 3,
      };
      return (order[a.action] || 0) - (order[b.action] || 0);
    });

    for (const action of sortedActions) {
      try {
        const result = this.applyAction(modifiedSlides, action, language);
        if (result.changed) {
          modifiedSlides = result.slides;
          changesSummary.push(action.description);
        }
      } catch (error) {
        this.logger.warn(`Failed to apply action: ${action.description}`, { error });
      }
    }

    // 5. Export modified presentation
    const generatedDir = path.join(process.cwd(), 'generated');
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }

    const sessionId = Date.now();
    const sanitizedTopic = topic
      .replace(/[^a-zA-Z0-9\u0400-\u04FF\u0600-\u06FF]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30);

    const slideName = `${sessionId}-${sanitizedTopic}-modified.pptx`;
    const slidePath = path.join(generatedDir, slideName);

    const jsonFileName = `${sessionId}-${sanitizedTopic}-modified.free-slides.json`;
    const newJsonFilePath = path.join(generatedDir, jsonFileName);
    fs.writeFileSync(newJsonFilePath, JSON.stringify(modifiedSlides, null, 2));

    // Build theme from first slide's background or use default
    const theme = THEMES.professional;
    const viewport = DEFAULT_VIEWPORT;
    const builder = new SlideBuilder(theme, viewport);
    const slideTheme = builder.getSlideTheme();

    exportPPTX(modifiedSlides, false, false, slideTheme, viewport, slidePath);

    this.logger.info('Modified presentation exported', {
      slideName,
      changesApplied: changesSummary.length,
    });

    return {
      success: true,
      slidePath,
      slideName,
      jsonFilePath: `generated/${jsonFileName}`,
      jsonFileName,
      changesApplied: changesSummary.length,
      changesSummary,
    };
  }

  /**
   * Build a concise summary of each slide for AI context
   */
  private buildSlideSummary(slides: Slide[]): string {
    return slides.map((slide, i) => {
      const texts = slide.elements
        .filter((el): el is any => el.type === 'text' && 'content' in el)
        .map((el) => {
          const plain = el.content.replace(/<[^>]+>/g, '').trim().substring(0, 80);
          const fontSize = el.content.match(/font-size:\s*(\d+)/)?.[1] || '16';
          return `[${fontSize}px] "${plain}"`;
        });

      const hasImage = slide.elements.some(el => el.type === 'image');
      const hasChart = slide.elements.some(el => el.type === 'chart');
      const hasTable = slide.elements.some(el => el.type === 'table');
      const elementTypes = [
        hasImage ? 'image' : '',
        hasChart ? 'chart' : '',
        hasTable ? 'table' : '',
      ].filter(Boolean).join(', ');

      return `Slide ${i + 1} (${slide.elements.length} elements${elementTypes ? ', has: ' + elementTypes : ''}):\n  ${texts.join('\n  ')}`;
    }).join('\n\n');
  }

  /**
   * Use AI to plan what modifications to make
   */
  private async planModifications(
    slideSummary: string,
    prompt: string,
    language: string,
    topic: string,
    slideCount: number
  ): Promise<ModifyAction[]> {
    const result = await this.aiClient.call<{ actions: ModifyAction[] }>({
      operationName: 'slideModify',
      temperature: 0.4,
      responseFormat: 'json_object',
      messages: [
        {
          role: 'system',
          content: `You modify existing presentations based on user instructions. Analyze the current slides and determine what changes to make.

AVAILABLE ACTIONS:
1. "update_text" — Change text content of a specific element
   { action: "update_text", slideIndex: N, elementIndex: N, newContent: "new text", description: "..." }

2. "update_style" — Change visual style (colors, font size, alignment)
   { action: "update_style", slideIndex: N, elementIndex: N, styleChanges: { "font-size": "24", "color": "#333333", "font-weight": "bold" }, description: "..." }
   For slide-wide style: use slideIndex without elementIndex to change ALL text elements in that slide.

3. "add_slide" — Insert a new slide
   { action: "add_slide", newSlide: { pattern: "bullet-list", title: "...", content: "bullet1\nbullet2\nbullet3", afterSlideIndex: N }, description: "..." }
   Available patterns: bullet-list, two-column, stats-grid, three-cards, image-right, quote, comparison, timeline

4. "delete_slide" — Remove a slide
   { action: "delete_slide", slideIndex: N, description: "..." }

5. "update_element" — Change element properties (position, size)
   { action: "update_element", slideIndex: N, elementIndex: N, styleChanges: { "left": "100", "top": "200", "width": "800" }, description: "..." }

RULES:
- slideIndex is 0-based (Slide 1 = index 0)
- elementIndex is 0-based within the slide
- For text updates, write in ${language}
- Be precise — only change what the user asks for
- For style changes across ALL slides, emit one action per slide
- Maximum 20 actions per modification
- Return JSON: { "actions": [...] }
- If the prompt is unclear, make reasonable interpretations`,
        },
        {
          role: 'user',
          content: `TOPIC: "${topic}"
TOTAL SLIDES: ${slideCount}

CURRENT PRESENTATION:
${slideSummary}

USER REQUEST: "${prompt}"

Plan the modifications.`,
        },
      ],
      fallback: () => ({ actions: [] }),
    });

    return result.data.actions.filter(a => a.action && a.description);
  }

  /**
   * Apply a single modification action to the slides
   */
  private applyAction(
    slides: Slide[],
    action: ModifyAction,
    language: string
  ): { slides: Slide[]; changed: boolean } {
    switch (action.action) {
      case 'update_text':
        return this.applyTextUpdate(slides, action);
      case 'update_style':
        return this.applyStyleUpdate(slides, action);
      case 'add_slide':
        return this.applyAddSlide(slides, action, language);
      case 'delete_slide':
        return this.applyDeleteSlide(slides, action);
      case 'update_element':
        return this.applyElementUpdate(slides, action);
      default:
        return { slides, changed: false };
    }
  }

  private applyTextUpdate(slides: Slide[], action: ModifyAction): { slides: Slide[]; changed: boolean } {
    const { slideIndex, elementIndex, newContent } = action;
    if (slideIndex === undefined || elementIndex === undefined || !newContent) {
      return { slides, changed: false };
    }
    if (slideIndex < 0 || slideIndex >= slides.length) return { slides, changed: false };

    const slide = slides[slideIndex];
    const el = slide.elements[elementIndex];
    if (!el || el.type !== 'text') return { slides, changed: false };

    // Preserve existing styling, replace text content
    const textEl = el as any;
    const oldContent = textEl.content as string;

    // Extract style from first <p> tag
    const styleMatch = oldContent.match(/<p[^>]*style="([^"]*)"[^>]*>/);
    const style = styleMatch ? styleMatch[1] : '';

    // Build new HTML content
    const lines = newContent.split('\n').filter(Boolean);
    textEl.content = lines
      .map(line => `<p style="${style}">${line}</p>`)
      .join('');

    return { slides, changed: true };
  }

  private applyStyleUpdate(slides: Slide[], action: ModifyAction): { slides: Slide[]; changed: boolean } {
    const { slideIndex, elementIndex, styleChanges } = action;
    if (slideIndex === undefined || !styleChanges) return { slides, changed: false };
    if (slideIndex < 0 || slideIndex >= slides.length) return { slides, changed: false };

    const slide = slides[slideIndex];
    let changed = false;

    const elementsToUpdate = elementIndex !== undefined
      ? [slide.elements[elementIndex]].filter(Boolean)
      : slide.elements.filter(el => el.type === 'text');

    for (const el of elementsToUpdate) {
      if (el.type !== 'text') continue;
      const textEl = el as any;

      for (const [prop, value] of Object.entries(styleChanges)) {
        if (prop === 'font-size') {
          textEl.content = textEl.content.replace(
            /font-size:\s*\d+/g,
            `font-size: ${value}`
          );
          changed = true;
        } else if (prop === 'color') {
          textEl.content = textEl.content.replace(
            /(?<=[;\s"])color:\s*#[0-9a-fA-F]+/g,
            `color: ${value}`
          );
          changed = true;
        } else if (prop === 'font-weight') {
          if (textEl.content.includes('font-weight:')) {
            textEl.content = textEl.content.replace(
              /font-weight:\s*\w+/g,
              `font-weight: ${value}`
            );
          } else {
            textEl.content = textEl.content.replace(
              /font-size:/g,
              `font-weight: ${value}; font-size:`
            );
          }
          changed = true;
        } else if (prop === 'text-align') {
          textEl.content = textEl.content.replace(
            /text-align:\s*\w+/g,
            `text-align: ${value}`
          );
          changed = true;
        } else if (prop === 'font-family') {
          textEl.content = textEl.content.replace(
            /font-family:\s*'[^']+'/g,
            `font-family: '${value}'`
          );
          if (textEl.defaultFontName) {
            textEl.defaultFontName = value;
          }
          changed = true;
        }
      }
    }

    // Handle background color changes
    if (styleChanges['background-color'] && slide.background) {
      slide.background = {
        type: 'solid',
        color: styleChanges['background-color'],
      };
      changed = true;
    }

    return { slides, changed };
  }

  private applyAddSlide(slides: Slide[], action: ModifyAction, language: string): { slides: Slide[]; changed: boolean } {
    if (!action.newSlide) return { slides, changed: false };

    const { pattern, title, content, afterSlideIndex } = action.newSlide;
    const insertAt = Math.min(Math.max(0, afterSlideIndex + 1), slides.length);

    const theme = THEMES.professional;
    const viewport = DEFAULT_VIEWPORT;
    const builder = new SlideBuilder(theme, viewport);

    const patternDef = getPattern(pattern as PatternName);
    const newSlide = builder.buildFromPattern(pattern as PatternName, {
      elements: [
        { text: title },
        { text: content },
      ],
    });

    slides.splice(insertAt, 0, newSlide);
    return { slides, changed: true };
  }

  private applyDeleteSlide(slides: Slide[], action: ModifyAction): { slides: Slide[]; changed: boolean } {
    const { slideIndex } = action;
    if (slideIndex === undefined || slideIndex < 0 || slideIndex >= slides.length) {
      return { slides, changed: false };
    }

    // Don't delete first (title) or last (thank-you) slides
    if (slideIndex === 0 || slideIndex === slides.length - 1) {
      return { slides, changed: false };
    }

    slides.splice(slideIndex, 1);
    return { slides, changed: true };
  }

  private applyElementUpdate(slides: Slide[], action: ModifyAction): { slides: Slide[]; changed: boolean } {
    const { slideIndex, elementIndex, styleChanges } = action;
    if (slideIndex === undefined || elementIndex === undefined || !styleChanges) {
      return { slides, changed: false };
    }
    if (slideIndex < 0 || slideIndex >= slides.length) return { slides, changed: false };

    const el = slides[slideIndex].elements[elementIndex] as any;
    if (!el) return { slides, changed: false };

    let changed = false;
    for (const [prop, value] of Object.entries(styleChanges)) {
      const numValue = parseFloat(value);
      if (['left', 'top', 'width', 'height'].includes(prop) && !isNaN(numValue)) {
        el[prop] = numValue;
        changed = true;
      }
      if (prop === 'opacity' && !isNaN(numValue)) {
        el.opacity = numValue;
        changed = true;
      }
    }

    return { slides, changed };
  }
}
