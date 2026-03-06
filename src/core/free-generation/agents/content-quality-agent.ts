/**
 * Content Quality Agent
 *
 * Validates slide content for quality and completeness:
 * 1. Empty text detection — flags elements with no meaningful content
 * 2. Duplicate title detection — no two slides should have the same title
 * 3. Content length validation — body text not too short or too long
 * 4. Bullet point formatting — consistent bullet style
 * 5. Placeholder detection — "Lorem ipsum", "TBD", "TODO" etc.
 * 6. Language consistency — detect mixed-language content
 */

import { AIClient } from '@/src/core/ai/ai-client';
import { EnhancedLogger, LogLevel } from '@/src/lib/logger';

export interface ContentIssue {
  slideIndex: number;
  elementIndex: number;
  type: 'empty' | 'duplicate-title' | 'too-short' | 'too-long' | 'placeholder' | 'bad-bullets' | 'regenerated' | 'quoted-text' | 'unbalanced-cards';
  description: string;
  fixed: boolean;
}

export interface ContentQualityResult {
  issuesFound: number;
  issuesFixed: number;
  emptyElements: number;
  duplicateTitles: number;
  quotesStripped: number;
  regenerated: number;
  issues: ContentIssue[];
}

const PLACEHOLDER_PATTERNS = [
  /lorem ipsum/i,
  /^placeholder$/i,
  /^tbd$/i,
  /^todo$/i,
  /^n\/a$/i,
  /^test$/i,
  /^example text$/i,
  /^insert text$/i,
  /^sample$/i,
  /^undefined$/i,
  /^null$/i,
  /^\[.*\]$/, // [placeholder]
];

export class ContentQualityAgent {
  private aiClient: AIClient;
  private logger: EnhancedLogger;

  constructor(aiClient: AIClient, logger?: EnhancedLogger) {
    this.aiClient = aiClient;
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
  }

  /**
   * Audit content quality and fix issues where possible
   */
  async audit(
    slides: any[],
    topic: string,
    language: string
  ): Promise<ContentQualityResult> {
    const issues: ContentIssue[] = [];
    let emptyElements = 0;
    let duplicateTitles = 0;
    let quotesStripped = 0;
    let regenerated = 0;

    const seenTitles = new Map<string, number>(); // title → slideIndex

    for (let si = 0; si < slides.length; si++) {
      const slide = slides[si];

      for (let ei = 0; ei < slide.elements.length; ei++) {
        const el = slide.elements[ei];
        if (el.type !== 'text' || !el.content) continue;

        // 0. Strip wrapping quotes from content (auto-fix)
        const quoteFixed = this.stripQuotesFromHTML(el.content);
        if (quoteFixed !== el.content) {
          issues.push({
            slideIndex: si, elementIndex: ei,
            type: 'quoted-text',
            description: `Stripped wrapping quotes from text content`,
            fixed: true,
          });
          el.content = quoteFixed;
          quotesStripped++;
        }

        const plainText = el.content.replace(/<[^>]+>/g, '').trim();
        const fontSize = this.extractFontSize(el.content);
        const isTitle = fontSize >= 28;
        const isBody = fontSize >= 13 && fontSize <= 20;

        // 1. Empty text detection
        if (plainText.length === 0 || plainText === '\u25CF') {
          emptyElements++;
          issues.push({
            slideIndex: si, elementIndex: ei,
            type: 'empty',
            description: `Empty text element (${isTitle ? 'title' : 'body'})`,
            fixed: false,
          });
          continue;
        }

        // 2. Placeholder detection
        if (PLACEHOLDER_PATTERNS.some(p => p.test(plainText))) {
          issues.push({
            slideIndex: si, elementIndex: ei,
            type: 'placeholder',
            description: `Placeholder text detected: "${plainText.substring(0, 30)}"`,
            fixed: false,
          });
        }

        // 3. Duplicate title detection
        if (isTitle && plainText.length > 3) {
          const normalized = plainText.toLowerCase().trim();
          if (seenTitles.has(normalized)) {
            duplicateTitles++;
            issues.push({
              slideIndex: si, elementIndex: ei,
              type: 'duplicate-title',
              description: `Title "${plainText.substring(0, 40)}" duplicates slide ${seenTitles.get(normalized)! + 1}`,
              fixed: false,
            });
          } else {
            seenTitles.set(normalized, si);
          }
        }

        // 4. Content length validation (body text)
        if (isBody) {
          if (plainText.length < 20) {
            issues.push({
              slideIndex: si, elementIndex: ei,
              type: 'too-short',
              description: `Body text too short (${plainText.length} chars): "${plainText.substring(0, 30)}"`,
              fixed: false,
            });
          } else if (plainText.length > 800) {
            issues.push({
              slideIndex: si, elementIndex: ei,
              type: 'too-long',
              description: `Body text too long (${plainText.length} chars), may overflow element`,
              fixed: false,
            });
          }
        }

        // 5. Bullet point consistency
        if (isBody && plainText.includes('\n')) {
          const lines = plainText.split('\n').filter(Boolean);
          const bulletLines = lines.filter((l: string) => l.startsWith('•') || l.startsWith('-') || l.startsWith('●'));
          const plainLines = lines.filter((l: string) => !l.startsWith('•') && !l.startsWith('-') && !l.startsWith('●') && !l.match(/^\d+\./));

          // Mixed bullet and non-bullet lines
          if (bulletLines.length > 0 && plainLines.length > 1) {
            issues.push({
              slideIndex: si, elementIndex: ei,
              type: 'bad-bullets',
              description: `Mixed bullet (${bulletLines.length}) and plain (${plainLines.length}) lines`,
              fixed: false,
            });
          }
        }
      }
    }

    // 6. Card content balance check — detect slides where card bodies have wildly different lengths
    for (let si = 0; si < slides.length; si++) {
      const slide = slides[si];
      const bodyElements = slide.elements
        .map((el: any, idx: number) => ({ el, idx }))
        .filter(({ el }: any) => {
          if (el.type !== 'text' || !el.content) return false;
          const fs = this.extractFontSize(el.content);
          return fs >= 13 && fs <= 20; // body-sized text
        });

      if (bodyElements.length >= 2) {
        const lengths = bodyElements.map(({ el }: any) =>
          (el.content as string).replace(/<[^>]+>/g, '').trim().length
        );
        const maxLen = Math.max(...lengths);
        const minLen = Math.min(...lengths);

        // If longest card body is >3x the shortest, flag imbalance
        if (maxLen > 0 && minLen > 0 && maxLen > minLen * 3) {
          issues.push({
            slideIndex: si, elementIndex: -1,
            type: 'unbalanced-cards',
            description: `Card content imbalance: shortest ${minLen} chars vs longest ${maxLen} chars (${(maxLen / minLen).toFixed(1)}x ratio)`,
            fixed: false,
          });
        }
      }
    }

    // 7. AI regeneration for empty/placeholder body elements (batch)
    const emptyBodies = issues.filter(
      i => (i.type === 'empty' || i.type === 'placeholder') && i.slideIndex > 0
    ).slice(0, 5); // Max 5

    if (emptyBodies.length > 0) {
      regenerated = await this.regenerateContent(emptyBodies, slides, topic, language);
    }

    return {
      issuesFound: issues.length,
      issuesFixed: issues.filter(i => i.fixed).length + regenerated,
      emptyElements,
      duplicateTitles,
      quotesStripped,
      regenerated,
      issues,
    };
  }

  /**
   * AI-regenerate content for empty/placeholder elements
   */
  private async regenerateContent(
    emptyIssues: ContentIssue[],
    slides: any[],
    topic: string,
    language: string
  ): Promise<number> {
    const toRegenerate = emptyIssues.map((issue, i) => {
      const slide = slides[issue.slideIndex];
      const titleEl = slide.elements.find((el: any) =>
        el.type === 'text' && this.extractFontSize(el.content || '') >= 28
      );
      const titleText = titleEl
        ? titleEl.content.replace(/<[^>]+>/g, '').trim()
        : `Slide ${issue.slideIndex + 1}`;

      return { fixIndex: i, slideIndex: issue.slideIndex, elementIndex: issue.elementIndex, slideTitle: titleText };
    });

    try {
      const result = await this.aiClient.call<{
        fixes: Array<{ fixIndex: number; content: string }>;
      }>({
        operationName: 'contentRegenerate',
        temperature: 0.7,
        responseFormat: 'json_object',
        messages: [
          {
            role: 'system',
            content: `You are filling in missing body text for presentation slides.
Write 3-5 concise bullet points per slide. Use "• " prefix for each point.
Language: ${language}
Return JSON: { "fixes": [{ "fixIndex": 0, "content": "• Point 1\\n• Point 2\\n..." }, ...] }`,
          },
          {
            role: 'user',
            content: `Topic: "${topic}"\n\nSlides needing content:\n${
              toRegenerate.map(r => `[${r.fixIndex}] "${r.slideTitle}"`).join('\n')
            }`,
          },
        ],
        fallback: () => ({ fixes: [] }),
      });

      let fixed = 0;
      for (const fix of result.data.fixes) {
        const info = toRegenerate[fix.fixIndex];
        if (!info || !fix.content) continue;

        const el = slides[info.slideIndex]?.elements[info.elementIndex];
        if (!el) continue;

        // Wrap content in HTML with existing font style
        const fontSize = this.extractFontSize(el.content || '') || 16;
        const colorMatch = (el.content || '').match(/color:\s*(#[0-9a-fA-F]{6})/);
        const color = colorMatch ? colorMatch[1] : '#333333';

        el.content = fix.content.split('\n').filter(Boolean).map((line: string) => {
          const isBullet = line.startsWith('•') || line.startsWith('-');
          const text = line.replace(/^[•\-]\s*/, '');
          if (isBullet) {
            return `<p style="font-size: ${fontSize}px; color: ${color}; line-height: 1.6;"><span style="font-weight: bold;">\u25CF </span>${text}</p>`;
          }
          return `<p style="font-size: ${fontSize}px; color: ${color}; line-height: 1.5;">${line}</p>`;
        }).join('');

        fixed++;
      }

      return fixed;
    } catch (error) {
      this.logger.warn('Content regeneration failed', { error });
      return 0;
    }
  }

  /**
   * Strip wrapping quotes from HTML content.
   * Handles both plain text in tags and nested HTML structures.
   * "text" → text, «text» → text
   */
  private stripQuotesFromHTML(html: string): string {
    // Match text content inside HTML tags that is wrapped in quotes
    // Pattern: >"quoted text"< or >«quoted text»<
    let result = html;

    // Strip quotes from text nodes inside HTML tags
    result = result.replace(/>(\s*)"([^"<]+)"(\s*)</g, '>$1$2$3<');
    result = result.replace(/>(\s*)«([^»<]+)»(\s*)</g, '>$1$2$3<');

    // Also handle quotes around content after bullet spans
    // e.g., <span>● </span>"text" → <span>● </span>text
    result = result.replace(/(<\/span>)"([^"<]+)"(<\/p>)/g, '$1$2$3');

    return result;
  }

  private extractFontSize(content: string): number {
    const match = content.match(/font-size:\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
}
