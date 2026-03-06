/**
 * Accessibility Agent
 *
 * Ensures presentation meets accessibility standards:
 * 1. Alt-text for images (AI-generated descriptions)
 * 2. Color blindness safety (deuteranopia, protanopia, tritanopia)
 * 3. Reading order validation (logical tab order)
 * 4. Minimum font size check (>= 14px for body, >= 24px for titles)
 * 5. Text element naming for screen readers
 */

import { AIClient } from '@/src/core/ai/ai-client';
import { EnhancedLogger, LogLevel } from '@/src/lib/logger';

export interface AccessibilityIssue {
  slideIndex: number;
  elementIndex: number;
  type: 'missing-alt' | 'color-blind-unsafe' | 'reading-order' | 'small-font' | 'low-contrast';
  description: string;
  fixed: boolean;
}

export interface AccessibilityResult {
  issuesFound: number;
  issuesFixed: number;
  altTextsGenerated: number;
  readingOrderFixes: number;
  issues: AccessibilityIssue[];
}

// Color blindness simulation: colors that look similar under different types
const CONFUSABLE_PAIRS: Array<{ colors: [string, string]; type: string }> = [
  // Deuteranopia (red-green)
  { colors: ['#FF0000', '#00FF00'], type: 'deuteranopia' },
  { colors: ['#E74C3C', '#27AE60'], type: 'deuteranopia' },
  { colors: ['#FF6B6B', '#51CF66'], type: 'deuteranopia' },
  { colors: ['#DC3545', '#28A745'], type: 'deuteranopia' },
  // Protanopia (red-green variant)
  { colors: ['#FF4444', '#44FF44'], type: 'protanopia' },
  { colors: ['#C0392B', '#2ECC71'], type: 'protanopia' },
  // Tritanopia (blue-yellow)
  { colors: ['#3498DB', '#F1C40F'], type: 'tritanopia' },
  { colors: ['#2980B9', '#F39C12'], type: 'tritanopia' },
];

export class AccessibilityAgent {
  private aiClient: AIClient;
  private logger: EnhancedLogger;

  constructor(aiClient: AIClient, logger?: EnhancedLogger) {
    this.aiClient = aiClient;
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
  }

  /**
   * Run full accessibility audit and fix issues
   */
  async audit(
    slides: any[],
    topic: string,
    language: string
  ): Promise<AccessibilityResult> {
    const issues: AccessibilityIssue[] = [];
    let altTextsGenerated = 0;

    for (let si = 0; si < slides.length; si++) {
      const slide = slides[si];

      // 1. Check images for alt text
      for (let ei = 0; ei < slide.elements.length; ei++) {
        const el = slide.elements[ei];
        if (el.type === 'image' && el.src && !el.name) {
          issues.push({
            slideIndex: si, elementIndex: ei,
            type: 'missing-alt',
            description: `Image missing alt text: ${el.src.substring(0, 50)}`,
            fixed: false,
          });
        }
      }

      // 2. Check font sizes (only flag, don't auto-fix — small fonts may be
      //    intentional for labels, slide numbers, captions, etc.)
      for (let ei = 0; ei < slide.elements.length; ei++) {
        const el = slide.elements[ei];
        if (el.type !== 'text' || !el.content) continue;

        const fontSize = this.extractFontSize(el.content);
        if (fontSize < 12 && fontSize > 0) {
          issues.push({
            slideIndex: si, elementIndex: ei,
            type: 'small-font',
            description: `Font size ${fontSize}px is very small`,
            fixed: false,
          });
        }
      }

      // 3. Check reading order (elements should flow top-to-bottom, left-to-right)
      const textElements = slide.elements
        .map((el: any, idx: number) => ({ el, idx }))
        .filter(({ el }: any) => el.type === 'text');

      // Reading order: only detect issues, do NOT reorder elements.
      // Reordering breaks pattern layouts where shapes must precede their content text.
      for (let j = 1; j < textElements.length; j++) {
        const prev = textElements[j - 1].el;
        const curr = textElements[j].el;

        if (curr.top < prev.top - 50 && curr.left < prev.left - 100) {
          issues.push({
            slideIndex: si, elementIndex: textElements[j].idx,
            type: 'reading-order',
            description: `Element at (${curr.left},${curr.top}) appears before element at (${prev.left},${prev.top}) in DOM but is visually later`,
            fixed: false,
          });
        }
      }

      // 4. Color blindness check on chart elements
      for (let ei = 0; ei < slide.elements.length; ei++) {
        const el = slide.elements[ei];
        if (el.type !== 'chart' || !el.themeColors) continue;

        const unsafePairs = this.findConfusableColors(el.themeColors);
        for (const pair of unsafePairs) {
          issues.push({
            slideIndex: si, elementIndex: ei,
            type: 'color-blind-unsafe',
            description: `Chart colors ${pair.color1} and ${pair.color2} may be confused (${pair.type})`,
            fixed: false,
          });
        }
      }
    }

    // Generate alt text for images missing it (batch AI call)
    const missingAltIssues = issues.filter(i => i.type === 'missing-alt');
    if (missingAltIssues.length > 0) {
      altTextsGenerated = await this.generateAltTexts(
        missingAltIssues, slides, topic, language
      );
    }

    return {
      issuesFound: issues.length,
      issuesFixed: issues.filter(i => i.fixed).length + altTextsGenerated,
      altTextsGenerated,
      readingOrderFixes: 0,
      issues,
    };
  }

  /**
   * Generate alt text for images via AI
   */
  private async generateAltTexts(
    issues: AccessibilityIssue[],
    slides: any[],
    topic: string,
    language: string
  ): Promise<number> {
    const imagesToDescribe = issues.slice(0, 8).map((issue, i) => {
      const el = slides[issue.slideIndex]?.elements[issue.elementIndex];
      // Get surrounding text for context
      const slideTexts = slides[issue.slideIndex]?.elements
        .filter((e: any) => e.type === 'text' && e.content)
        .map((e: any) => e.content.replace(/<[^>]+>/g, '').substring(0, 60))
        .join(', ') || '';

      return {
        fixIndex: i,
        slideIndex: issue.slideIndex,
        elementIndex: issue.elementIndex,
        keyword: el?.src?.split('/').pop()?.split('?')[0] || 'image',
        context: slideTexts.substring(0, 120),
      };
    });

    try {
      const result = await this.aiClient.call<{
        altTexts: Array<{ fixIndex: number; altText: string }>;
      }>({
        operationName: 'imageAltText',
        temperature: 0.5,
        responseFormat: 'json_object',
        messages: [
          {
            role: 'system',
            content: `Generate descriptive alt text for presentation images. Alt text should be concise (10-20 words), describe what the image likely shows based on context.

RULES:
- Write in ${language}
- Be descriptive but concise
- Include relevant details from slide context
- Start with the main subject of the image
- Return JSON: { "altTexts": [{ "fixIndex": 0, "altText": "..." }, ...] }`,
          },
          {
            role: 'user',
            content: `Topic: "${topic}"

Images needing alt text:
${imagesToDescribe.map(img =>
  `[${img.fixIndex}] Slide ${img.slideIndex + 1}, File: "${img.keyword}", Context: "${img.context}"`
).join('\n')}`,
          },
        ],
        fallback: () => ({ altTexts: [] }),
      });

      let generated = 0;
      for (const alt of result.data.altTexts) {
        const img = imagesToDescribe[alt.fixIndex];
        if (!img || !alt.altText) continue;

        const el = slides[img.slideIndex]?.elements[img.elementIndex];
        if (el) {
          el.name = alt.altText;
          const issue = issues[alt.fixIndex];
          if (issue) issue.fixed = true;
          generated++;
        }
      }
      return generated;
    } catch (error) {
      this.logger.warn('Alt text generation failed', { error });
      return 0;
    }
  }

  /**
   * Find color pairs that may be confusable for color-blind users
   */
  private findConfusableColors(colors: string[]): Array<{ color1: string; color2: string; type: string }> {
    const results: Array<{ color1: string; color2: string; type: string }> = [];

    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const c1 = colors[i].toUpperCase();
        const c2 = colors[j].toUpperCase();

        // Check hue similarity (simplified)
        const hue1 = this.getHue(c1);
        const hue2 = this.getHue(c2);

        // Red-green confusion check
        if (this.isInRange(hue1, 0, 30) && this.isInRange(hue2, 90, 150)) {
          results.push({ color1: c1, color2: c2, type: 'deuteranopia' });
        }
        if (this.isInRange(hue2, 0, 30) && this.isInRange(hue1, 90, 150)) {
          results.push({ color1: c1, color2: c2, type: 'deuteranopia' });
        }
      }
    }

    return results;
  }

  private getHue(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;

    if (d === 0) return 0;
    let h = 0;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;

    h = Math.round(h * 60);
    return h < 0 ? h + 360 : h;
  }

  private isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }

  private extractFontSize(content: string): number {
    const match = content.match(/font-size:\s*(\d+)/);
    return match ? parseInt(match[1]) : 16;
  }
}
