/**
 * Image Editor
 *
 * Replaces specific images in a slide with AI-searched alternatives.
 * Works like an agent: analyzes slide context, finds optimal images,
 * replaces and returns updated slide.
 */

import axios from 'axios';
import { AIClient } from '../ai/ai-client';
import { EnhancedLogger, LogLevel } from '../../lib/logger';
import BingLinks from '../../services/image/image-search';

export interface ImageEditParams {
  slide: { id: string; elements: any[] };
  elementIndexes: number[];
  language: string;
  topic?: string;
  keywords?: Record<number, string>;
}

export interface ImageReplacement {
  elementIndex: number;
  oldSrc: string;
  newSrc: string;
  searchKeyword: string;
  success: boolean;
  error?: string;
}

export interface ImageEditResult {
  slide: any;
  replacements: ImageReplacement[];
}

export class ImageEditor {
  private aiClient: AIClient;
  private logger: EnhancedLogger;
  private usedUrls: Set<string> = new Set();

  constructor(aiClient: AIClient, logger?: EnhancedLogger) {
    this.aiClient = aiClient;
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
  }

  async replaceImages(params: ImageEditParams): Promise<ImageEditResult> {
    const { slide, elementIndexes, language, topic, keywords } = params;

    // Find image elements matching requested indexes
    // _idx = elementIndex property (for matching), _arrIdx = real array position (for updating)
    const imageElements = slide.elements
      .map((el: any, idx: number) => ({
        ...el,
        _idx: el.elementIndex !== undefined ? el.elementIndex : idx,
        _arrIdx: idx,
      }))
      .filter((el: any) => el.type === 'image' && elementIndexes.includes(el._idx));

    if (imageElements.length === 0) {
      this.logger.warn('No image elements found matching the given indexes');
      return { slide, replacements: [] };
    }

    // Extract text context from the slide for keyword generation
    const slideContext = this.extractSlideContext(slide);

    this.logger.info(`Replacing ${imageElements.length} images on slide ${slide.id}`, {
      elementIndexes,
      hasCustomKeywords: !!keywords,
    });

    // Process each image
    const replacements: ImageReplacement[] = [];

    for (const imgEl of imageElements) {
      const elementIndex = imgEl._idx;
      const oldSrc = imgEl.src || '';

      try {
        // 1. Determine search keyword
        let searchKeyword: string;

        if (keywords && keywords[elementIndex]) {
          // Custom keyword provided by user
          searchKeyword = keywords[elementIndex];
          this.logger.info(`Using custom keyword for element ${elementIndex}: "${searchKeyword}"`);
        } else {
          // Generate keyword from slide context using AI
          searchKeyword = await this.generateKeyword(slideContext, topic, language, elementIndex);
        }

        // 2. Search for images on Bing
        const newSrc = await this.searchImage(searchKeyword);

        if (newSrc) {
          // 3. Update the element in the slide (use real array index)
          const arrIdx = imgEl._arrIdx;
          slide.elements[arrIdx] = {
            ...slide.elements[arrIdx],
            src: newSrc,
          };

          replacements.push({
            elementIndex,
            oldSrc,
            newSrc,
            searchKeyword,
            success: true,
          });

          this.logger.info(`Image replaced: element ${elementIndex}`, {
            keyword: searchKeyword,
            newSrc: newSrc.substring(0, 80),
          });
        } else {
          replacements.push({
            elementIndex,
            oldSrc,
            newSrc: oldSrc,
            searchKeyword,
            success: false,
            error: 'No valid image found after search',
          });

          this.logger.warn(`Failed to find replacement for element ${elementIndex}`);
        }
      } catch (error: any) {
        replacements.push({
          elementIndex,
          oldSrc,
          newSrc: oldSrc,
          searchKeyword: '',
          success: false,
          error: error.message,
        });

        this.logger.error(`Image replacement failed for element ${elementIndex}`, error);
      }
    }

    const successCount = replacements.filter((r) => r.success).length;
    this.logger.info(`Image editing complete: ${successCount}/${replacements.length} successful`);

    return { slide, replacements };
  }

  /**
   * Extract text context from nearby elements in the slide
   */
  private extractSlideContext(slide: { elements: any[] }): string {
    return slide.elements
      .filter((el: any) => (el.type === 'text' || el.type === 'shape') && el.content)
      .map((el: any) => el.content)
      .join(' ')
      .substring(0, 500);
  }

  /**
   * Use AI to generate an optimal English search keyword from slide context
   */
  private async generateKeyword(
    slideContext: string,
    topic: string | undefined,
    language: string,
    elementIndex: number
  ): Promise<string> {
    if (!slideContext && !topic) {
      return 'professional presentation image';
    }

    try {
      const result = await this.aiClient.call<{ keyword: string }>({
        operationName: `generateImageKeyword_${elementIndex}`,
        temperature: 0.3,
        responseFormat: 'json_object',
        messages: [
          {
            role: 'system',
            content: `You generate image search keywords. Given slide context, return a 2-5 word English search query for finding the most relevant, professional image.

Return JSON: { "keyword": "your search query" }

Rules:
- Always respond in English regardless of input language
- Be specific to the topic, not generic
- Focus on visual concepts that photograph well
- Avoid abstract or text-heavy queries`,
          },
          {
            role: 'user',
            content: `Slide context (${language}): "${slideContext.substring(0, 300)}"
${topic ? `Topic: "${topic}"` : ''}
Generate the best image search keyword for this slide.`,
          },
        ],
        fallback: () => ({
          keyword: topic
            ? `${topic} professional`
            : slideContext.split(/\s+/).slice(0, 3).join(' '),
        }),
      });

      const keyword = result.data.keyword || topic || 'professional presentation';
      this.logger.info(`AI generated keyword: "${keyword}"`, { elementIndex });
      return keyword;
    } catch (error) {
      this.logger.warn('Keyword generation failed, using fallback', { error });
      return topic || slideContext.split(/\s+/).slice(0, 3).join(' ') || 'professional image';
    }
  }

  /**
   * Search Bing for images and return the first valid URL
   */
  private async searchImage(keyword: string): Promise<string | null> {
    try {
      const bingSearch = new BingLinks(keyword, 10, 'off', 10, 'photo', [], false);
      const imageLinks = await bingSearch.getImageLinks();

      if (imageLinks.length === 0) {
        this.logger.warn(`No images found for: "${keyword}"`);
        return null;
      }

      this.logger.info(`Found ${imageLinks.length} candidate images for: "${keyword}"`);

      // Try each image until we find a valid, unique one
      for (const imageUrl of imageLinks) {
        if (this.usedUrls.has(imageUrl)) continue;

        const isValid = await this.testImageUrl(imageUrl);
        if (isValid) {
          this.usedUrls.add(imageUrl);
          return imageUrl;
        }
      }

      this.logger.warn('All candidate images failed validation');
      return null;
    } catch (error) {
      this.logger.error('Image search failed', error as Error);
      return null;
    }
  }

  /**
   * Test if an image URL is valid and accessible
   */
  private async testImageUrl(url: string): Promise<boolean> {
    try {
      if (!url.startsWith('https://')) return false;

      const response = await axios.head(url, {
        timeout: 5000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        validateStatus: (status) => status < 500,
      });

      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) return false;

      const contentLength = parseInt(response.headers['content-length'] || '0');
      if (contentLength < 1024 || contentLength > 10 * 1024 * 1024) return false;

      return true;
    } catch {
      return false;
    }
  }
}
