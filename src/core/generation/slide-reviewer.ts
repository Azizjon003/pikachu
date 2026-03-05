/**
 * Slide Reviewer
 *
 * Reviews slide quality after all generation steps are complete.
 * Checks image validity, text quality, and fixes issues automatically.
 * Runs as the final quality gate before PPTX export.
 */

import axios from 'axios';
import { AIClient } from '../ai/ai-client';
import { EnhancedLogger, LogLevel } from '../../lib/logger';
import BingLinks from '../../services/image/image-search';

// ============================================
// Types
// ============================================

export interface ReviewIssue {
  type: 'bad_image' | 'text_overflow' | 'empty_content' | 'duplicate_content' | 'generic_content' | 'placeholder_content';
  elementIndex: number;
  description: string;
  severity: 'critical' | 'major' | 'minor';
}

export interface ReviewFix {
  type: 'image_removed' | 'image_replaced' | 'text_trimmed' | 'content_regenerated';
  elementIndex: number;
  description: string;
}

export interface SlideReview {
  slideIndex: number;
  score: number;
  issues: ReviewIssue[];
  fixes: ReviewFix[];
}

export interface ReviewSummary {
  totalSlides: number;
  imagesRemoved: number;
  imagesReplaced: number;
  textIssuesFixed: number;
  overallScore: number;
}

export interface SlideReviewResult {
  slides: any[];
  reviews: SlideReview[];
  summary: ReviewSummary;
}

// ============================================
// SlideReviewer
// ============================================

export class SlideReviewer {
  private aiClient: AIClient;
  private logger: EnhancedLogger;
  private usedUrls: Set<string> = new Set();

  constructor(aiClient: AIClient, logger?: EnhancedLogger) {
    this.aiClient = aiClient;
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
  }

  /**
   * Review all slides in a presentation
   */
  async reviewPresentation(
    slides: any[],
    topic: string,
    language: string
  ): Promise<SlideReviewResult> {
    this.logger.info('Starting quality review', { totalSlides: slides.length, topic });

    const reviews: SlideReview[] = [];
    let totalImagesRemoved = 0;
    let totalImagesReplaced = 0;
    let totalTextFixes = 0;

    // Collect all text content for duplicate detection
    const allTextContents = this.collectAllTextContents(slides);

    for (let i = 0; i < slides.length; i++) {
      const review = await this.reviewSlide(slides[i], i, topic, language, allTextContents);
      reviews.push(review);

      // Apply fixes to the slide
      totalImagesRemoved += review.fixes.filter(f => f.type === 'image_removed').length;
      totalImagesReplaced += review.fixes.filter(f => f.type === 'image_replaced').length;
      totalTextFixes += review.fixes.filter(f => f.type === 'text_trimmed').length;
    }

    const overallScore = reviews.length > 0
      ? Math.round(reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length)
      : 100;

    const summary: ReviewSummary = {
      totalSlides: slides.length,
      imagesRemoved: totalImagesRemoved,
      imagesReplaced: totalImagesReplaced,
      textIssuesFixed: totalTextFixes,
      overallScore,
    };

    this.logger.info('Quality review complete', summary);

    return { slides, reviews, summary };
  }

  /**
   * Review a single slide
   */
  private async reviewSlide(
    slide: any,
    slideIndex: number,
    topic: string,
    language: string,
    allTextContents: Map<string, number[]>
  ): Promise<SlideReview> {
    const issues: ReviewIssue[] = [];
    const fixes: ReviewFix[] = [];

    // 1. Check images
    const imageResults = await this.checkImages(slide, topic, language);
    issues.push(...imageResults.issues);
    fixes.push(...imageResults.fixes);

    // 2. Check text content
    const textResults = this.checkText(slide, slideIndex, allTextContents);
    issues.push(...textResults.issues);
    fixes.push(...textResults.fixes);

    // 3. Calculate score
    let score = 100;
    for (const issue of issues) {
      if (issue.severity === 'critical') score -= 30;
      else if (issue.severity === 'major') score -= 15;
      else score -= 5;
    }
    score = Math.max(0, score);

    if (issues.length > 0) {
      this.logger.info(`Slide ${slideIndex + 1} review: score=${score}, issues=${issues.length}, fixes=${fixes.length}`);
    }

    return { slideIndex, score, issues, fixes };
  }

  // ============================================
  // Image checking
  // ============================================

  /**
   * Check all images in a slide for validity
   */
  private async checkImages(
    slide: any,
    topic: string,
    language: string
  ): Promise<{ issues: ReviewIssue[]; fixes: ReviewFix[] }> {
    const issues: ReviewIssue[] = [];
    const fixes: ReviewFix[] = [];

    const imageElements = slide.elements
      .map((el: any, idx: number) => ({ el, idx: el.elementIndex !== undefined ? el.elementIndex : idx, arrIdx: idx }))
      .filter((item: any) => item.el.type === 'image');

    for (const { el, idx, arrIdx } of imageElements) {
      const src = el.src || '';

      // Skip local/template images — they are trusted
      if (!src || src.startsWith('./') || src.startsWith('/images/') || src.startsWith('/templates/')) {
        continue;
      }

      // Skip non-URL sources
      if (!src.startsWith('http://') && !src.startsWith('https://')) {
        continue;
      }

      // Test the external image URL
      const isValid = await this.testImageUrl(src);

      if (!isValid) {
        issues.push({
          type: 'bad_image',
          elementIndex: idx,
          description: `Image URL is invalid or inaccessible: ${src.substring(0, 80)}`,
          severity: 'major',
        });

        // Try to replace with a new image
        const slideContext = this.extractSlideContext(slide);
        const replaced = await this.replaceImage(slideContext, topic, language, idx);

        if (replaced) {
          slide.elements[arrIdx] = { ...slide.elements[arrIdx], src: replaced };
          fixes.push({
            type: 'image_replaced',
            elementIndex: idx,
            description: `Replaced dead image with new one`,
          });
        } else {
          // Remove the broken image src
          slide.elements[arrIdx] = { ...slide.elements[arrIdx], src: '' };
          fixes.push({
            type: 'image_removed',
            elementIndex: idx,
            description: `Removed invalid image (no replacement found)`,
          });
        }
      }
    }

    return { issues, fixes };
  }

  /**
   * Test if an image URL is valid and accessible
   */
  private async testImageUrl(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, {
        timeout: 3000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        validateStatus: (status) => status < 500,
      });

      if (response.status >= 400) return false;

      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) return false;

      const contentLength = parseInt(response.headers['content-length'] || '0');
      if (contentLength > 0 && contentLength < 500) return false;

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Try to find a replacement image using Bing search
   */
  private async replaceImage(
    slideContext: string,
    topic: string,
    language: string,
    elementIndex: number
  ): Promise<string | null> {
    try {
      // Generate keyword
      const keyword = await this.generateKeyword(slideContext, topic, language, elementIndex);

      // Search Bing
      const bingSearch = new BingLinks(keyword, 8, 'off', 8, 'photo', [], false);
      const links = await bingSearch.getImageLinks();

      // Find first valid, unique URL
      for (const url of links) {
        if (this.usedUrls.has(url)) continue;

        const isValid = await this.testImageUrl(url);
        if (isValid) {
          this.usedUrls.add(url);
          this.logger.info(`Replacement image found for element ${elementIndex}: "${keyword}"`);
          return url;
        }
      }

      return null;
    } catch (error) {
      this.logger.warn(`Failed to find replacement image for element ${elementIndex}`, { error });
      return null;
    }
  }

  /**
   * Generate a search keyword from slide context using AI
   */
  private async generateKeyword(
    slideContext: string,
    topic: string,
    language: string,
    elementIndex: number
  ): Promise<string> {
    if (!slideContext && !topic) {
      return 'professional presentation image';
    }

    try {
      const result = await this.aiClient.call<{ keyword: string }>({
        operationName: `reviewImageKeyword_${elementIndex}`,
        temperature: 0.3,
        responseFormat: 'json_object',
        messages: [
          {
            role: 'system',
            content: `Generate a 2-5 word English image search query for a presentation slide. Return JSON: { "keyword": "your query" }. Be specific, avoid generic terms.`,
          },
          {
            role: 'user',
            content: `Topic: "${topic}"\nSlide context (${language}): "${slideContext.substring(0, 300)}"`,
          },
        ],
        fallback: () => ({
          keyword: topic ? `${topic} professional` : 'professional presentation',
        }),
      });

      return result.data.keyword || topic || 'professional presentation';
    } catch {
      return topic || 'professional presentation image';
    }
  }

  // ============================================
  // Text checking
  // ============================================

  /**
   * Check text elements for quality issues
   */
  private checkText(
    slide: any,
    slideIndex: number,
    allTextContents: Map<string, number[]>
  ): { issues: ReviewIssue[]; fixes: ReviewFix[] } {
    const issues: ReviewIssue[] = [];
    const fixes: ReviewFix[] = [];

    for (let i = 0; i < slide.elements.length; i++) {
      const el = slide.elements[i];
      const idx = el.elementIndex !== undefined ? el.elementIndex : i;

      if (el.type !== 'text' && el.type !== 'shape') continue;

      const content = el.content || '';
      const maxChars = el.maxCharacters || 200;

      // Empty content check
      if (!content.trim() && el.type === 'text') {
        issues.push({
          type: 'empty_content',
          elementIndex: idx,
          description: 'Text element has no content',
          severity: 'minor',
        });
      }

      // Overflow check
      if (content.length > maxChars * 1.5) {
        issues.push({
          type: 'text_overflow',
          elementIndex: idx,
          description: `Content (${content.length} chars) exceeds limit (${maxChars}) by >50%`,
          severity: 'major',
        });

        // Auto-trim to maxChars
        const trimmed = content.substring(0, maxChars);
        const lastSpace = trimmed.lastIndexOf(' ');
        slide.elements[i] = {
          ...el,
          content: lastSpace > maxChars * 0.7 ? trimmed.substring(0, lastSpace) + '...' : trimmed + '...',
        };

        fixes.push({
          type: 'text_trimmed',
          elementIndex: idx,
          description: `Trimmed from ${content.length} to ~${maxChars} chars`,
        });
      }

      // Placeholder/generic content check
      if (content.trim().length > 5) {
        const lowerContent = content.trim().toLowerCase();
        const placeholderPatterns = [
          /^lorem ipsum/i,
          /^\[.*\]$/,
          /^content\s*(here|for|placeholder)/i,
          /^sample\s*text/i,
          /^text\s*here/i,
          /^insert\s/i,
          /^placeholder/i,
          /^your\s*(text|content|title)/i,
          /^click\s*to\s*(add|edit)/i,
          /^element\s*\d/i,
          /^\{.*\}$/,
          /^untitled/i,
          /^todo/i,
          /^n\/a$/i,
          /^none$/i,
          /^test$/i,
        ];

        const isPlaceholder = placeholderPatterns.some(p => p.test(lowerContent));
        if (isPlaceholder) {
          issues.push({
            type: 'placeholder_content',
            elementIndex: idx,
            description: `Element contains placeholder text: "${content.substring(0, 50)}"`,
            severity: 'critical',
          });
        }

        // Generic content check — content that's too vague to be useful
        if (content.trim().length > 20 && content.trim().length < 100) {
          const genericPatterns = [
            /^(introduction|kirish|введение|overview|umumiy)$/i,
            /^(conclusion|xulosa|заключение|summary)$/i,
            /^(main content|asosiy ma'lumot|основной контент)$/i,
            /^(important information|muhim ma'lumot)$/i,
          ];
          const isGeneric = genericPatterns.some(p => p.test(content.trim()));
          if (isGeneric) {
            issues.push({
              type: 'generic_content',
              elementIndex: idx,
              description: `Element has overly generic content: "${content.substring(0, 50)}"`,
              severity: 'minor',
            });
          }
        }
      }

      // Duplicate check — same content on different slides
      if (content.trim().length > 20) {
        const normalizedContent = content.trim().toLowerCase();
        const slidesWithSameContent = allTextContents.get(normalizedContent);
        if (slidesWithSameContent && slidesWithSameContent.length > 1 && slidesWithSameContent[0] !== slideIndex) {
          // Only flag on the second+ occurrence
          const firstOccurrence = slidesWithSameContent[0];
          if (slideIndex > firstOccurrence) {
            issues.push({
              type: 'duplicate_content',
              elementIndex: idx,
              description: `Same text appears on slide ${firstOccurrence + 1} and slide ${slideIndex + 1}`,
              severity: 'minor',
            });
          }
        }
      }
    }

    return { issues, fixes };
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Extract text context from a slide for keyword generation
   */
  private extractSlideContext(slide: { elements: any[] }): string {
    return slide.elements
      .filter((el: any) => (el.type === 'text' || el.type === 'shape') && el.content)
      .map((el: any) => el.content)
      .join(' ')
      .substring(0, 500);
  }

  /**
   * Collect all text content across slides for duplicate detection
   */
  private collectAllTextContents(slides: any[]): Map<string, number[]> {
    const map = new Map<string, number[]>();

    for (let si = 0; si < slides.length; si++) {
      for (const el of slides[si].elements) {
        if ((el.type === 'text' || el.type === 'shape') && el.content) {
          const key = el.content.trim().toLowerCase();
          if (key.length > 20) {
            const existing = map.get(key) || [];
            existing.push(si);
            map.set(key, existing);
          }
        }
      }
    }

    return map;
  }
}
