/**
 * Content Enhancement Agent
 *
 * Post-processing agent that improves content quality:
 * 1. Detects generic/placeholder text and regenerates it
 * 2. Removes duplicate content across slides
 * 3. Fixes empty or too-short text elements
 * 4. Validates stat-numbers have proper units
 */

import { AIClient } from '@/src/core/ai/ai-client';
import { EnhancedLogger, LogLevel } from '@/src/lib/logger';

export interface EnhancementIssue {
  slideIndex: number;
  elementIndex: number;
  type: 'generic' | 'placeholder' | 'duplicate' | 'empty' | 'too-short' | 'no-unit';
  originalText: string;
  fixedText?: string;
}

export interface EnhancementResult {
  issuesFound: number;
  issuesFixed: number;
  issues: EnhancementIssue[];
}

// Patterns that indicate low-quality content
const GENERIC_PATTERNS = [
  /^(introduction|overview|summary|conclusion|kirish|xulosa)$/i,
  /^slide \d+$/i,
  /^section \d+$/i,
  /key point \d+/i,
  /lorem ipsum/i,
  /placeholder/i,
  /^data \d+$/i,
  /^item \d+$/i,
  /^example$/i,
  /^test$/i,
  /^todo$/i,
  /^tbd$/i,
  /^n\/a$/i,
  /^column \d+$/i,
  /^header \d+$/i,
  /^category [a-d]$/i,
  /^series \d+$/i,
];

// Minimum content length by role
const MIN_LENGTH: Record<string, number> = {
  title: 5,
  subtitle: 10,
  body: 30,
  label: 3,
  'stat-number': 1,
  'stat-label': 5,
};

export class ContentEnhancementAgent {
  private aiClient: AIClient;
  private logger: EnhancedLogger;

  constructor(aiClient: AIClient, logger?: EnhancedLogger) {
    this.aiClient = aiClient;
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
  }

  /**
   * Scan all slides for content quality issues and fix them
   */
  async enhance(
    slides: any[],
    topic: string,
    language: string
  ): Promise<EnhancementResult> {
    const issues: EnhancementIssue[] = [];

    // Phase 1: Detect issues
    const allTexts = new Map<string, { slideIndex: number; elementIndex: number }>();

    for (let si = 0; si < slides.length; si++) {
      const slide = slides[si];
      for (let ei = 0; ei < slide.elements.length; ei++) {
        const el = slide.elements[ei];
        if (el.type !== 'text' || !el.content) continue;

        const plainText = this.stripHTML(el.content).trim();
        if (!plainText) continue;

        // Check for generic/placeholder content
        if (this.isGenericContent(plainText)) {
          issues.push({
            slideIndex: si,
            elementIndex: ei,
            type: 'generic',
            originalText: plainText.substring(0, 80),
          });
          continue;
        }

        // Check for too-short content (skip slide numbers, labels)
        const role = this.detectRole(el);
        const minLen = MIN_LENGTH[role] || 3;
        if (plainText.length < minLen && role !== 'stat-number' && role !== 'label') {
          issues.push({
            slideIndex: si,
            elementIndex: ei,
            type: 'too-short',
            originalText: plainText,
          });
          continue;
        }

        // Check for stat-numbers without units
        if (role === 'stat-number' && !/[\d%$€£¥+xX×]/.test(plainText)) {
          issues.push({
            slideIndex: si,
            elementIndex: ei,
            type: 'no-unit',
            originalText: plainText,
          });
        }

        // Check for duplicates (same text in different slides)
        const normalizedText = plainText.toLowerCase().replace(/\s+/g, ' ');
        if (normalizedText.length > 20) {
          const existing = allTexts.get(normalizedText);
          if (existing && existing.slideIndex !== si) {
            issues.push({
              slideIndex: si,
              elementIndex: ei,
              type: 'duplicate',
              originalText: plainText.substring(0, 80),
            });
          } else {
            allTexts.set(normalizedText, { slideIndex: si, elementIndex: ei });
          }
        }
      }
    }

    if (issues.length === 0) {
      return { issuesFound: 0, issuesFixed: 0, issues: [] };
    }

    this.logger.info(`Content enhancement: ${issues.length} issues found`, {
      types: issues.reduce((acc, i) => {
        acc[i.type] = (acc[i.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    });

    // Phase 2: Fix issues (batch regeneration via AI)
    const fixableIssues = issues.filter(
      i => i.type === 'generic' || i.type === 'duplicate' || i.type === 'too-short'
    );

    if (fixableIssues.length > 0) {
      await this.regenerateContent(fixableIssues, slides, topic, language);
    }

    return {
      issuesFound: issues.length,
      issuesFixed: fixableIssues.filter(i => i.fixedText).length,
      issues,
    };
  }

  /**
   * Regenerate content for problematic elements via AI
   */
  private async regenerateContent(
    issues: EnhancementIssue[],
    slides: any[],
    topic: string,
    language: string
  ): Promise<void> {
    // Build context for regeneration
    const elementsToFix = issues.map((issue, i) => {
      const el = slides[issue.slideIndex]?.elements[issue.elementIndex];
      const role = el ? this.detectRole(el) : 'body';
      return {
        fixIndex: i,
        slideIndex: issue.slideIndex,
        elementIndex: issue.elementIndex,
        role,
        issue: issue.type,
        currentText: issue.originalText,
      };
    }).slice(0, 10); // Max 10 fixes per batch

    try {
      const result = await this.aiClient.call<{
        fixes: Array<{ fixIndex: number; newContent: string }>;
      }>({
        operationName: 'contentEnhancement',
        temperature: 0.7,
        responseFormat: 'json_object',
        messages: [
          {
            role: 'system',
            content: `You fix low-quality presentation content. Given problematic text elements, write improved replacements.

RULES:
- Write in ${language}
- Make content specific, data-rich, and professional
- For "generic" issues: replace with specific, topic-relevant content
- For "duplicate" issues: rewrite with different perspective/angle/data
- For "too-short" issues: expand with real facts, numbers, examples
- Match the role: title (5-10 words), body (detailed bullets), stat-number (number+unit), label (2-5 words)
- Return JSON: { "fixes": [{ "fixIndex": 0, "newContent": "..." }, ...] }`,
          },
          {
            role: 'user',
            content: `Topic: "${topic}"\n\nElements to fix:\n${elementsToFix.map(e =>
              `[${e.fixIndex}] Role=${e.role}, Issue=${e.issue}, Current="${e.currentText}"`
            ).join('\n')}`,
          },
        ],
        fallback: () => ({ fixes: [] }),
      });

      // Apply fixes
      for (const fix of result.data.fixes) {
        const issue = issues[fix.fixIndex];
        if (!issue || !fix.newContent) continue;

        const el = slides[issue.slideIndex]?.elements[issue.elementIndex];
        if (!el) continue;

        // Replace text in HTML content
        const oldPlain = issue.originalText;
        if (el.content.includes(oldPlain)) {
          el.content = el.content.replace(oldPlain, fix.newContent);
          issue.fixedText = fix.newContent;
        }
      }
    } catch (error) {
      this.logger.warn('Content enhancement AI call failed', { error });
    }
  }

  /**
   * Detect element role from styling
   */
  private detectRole(el: any): string {
    const content = el.content || '';
    const fontSize = this.extractFontSize(content);

    if (fontSize >= 32) return 'title';
    if (fontSize >= 24) return 'subtitle';
    if (fontSize >= 36) return 'stat-number';
    if (fontSize <= 14 && el.width < 200) return 'label';
    return 'body';
  }

  /**
   * Check if text is generic/placeholder content
   */
  private isGenericContent(text: string): boolean {
    return GENERIC_PATTERNS.some(pattern => pattern.test(text));
  }

  /**
   * Strip HTML tags
   */
  private stripHTML(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
  }

  /**
   * Extract font size from HTML
   */
  private extractFontSize(content: string): number {
    const match = content.match(/font-size:\s*(\d+)/);
    return match ? parseInt(match[1]) : 16;
  }
}
