/**
 * Smart Image Agent for Template-Free Slides
 *
 * Enhances image selection with:
 * 1. AI-optimized search keywords (transforms generic keywords into visual queries)
 * 2. Image URL validation (checks if URL is accessible before using)
 * 3. Fallback strategies (multiple search attempts with refined queries)
 */

import BingLinks from '@/src/services/image/image-search';
import { AIClient } from '@/src/core/ai/ai-client';
import { EnhancedLogger, LogLevel } from '@/src/lib/logger';
import axios from 'axios';

export interface ImageSearchRequest {
  keyword: string;
  slideTitle: string;
  slideIndex: number;
  preferredStyle?: 'photo' | 'illustration' | 'infographic';
}

export interface ImageSearchResult {
  url: string;
  isValid: boolean;
}

export class SmartImageAgent {
  private aiClient: AIClient;
  private logger: EnhancedLogger;
  private usedUrls = new Set<string>();

  constructor(aiClient: AIClient, logger?: EnhancedLogger) {
    this.aiClient = aiClient;
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
  }

  /**
   * Optimize keyword for Bing image search using AI
   */
  async optimizeKeyword(request: ImageSearchRequest): Promise<string[]> {
    try {
      const result = await this.aiClient.call<{ keywords: string[] }>({
        operationName: 'imageKeywordOptimize',
        temperature: 0.7,
        responseFormat: 'json_object',
        messages: [
          {
            role: 'system',
            content: `You optimize image search keywords for professional presentations.
Given a topic keyword, generate 3 Bing image search queries that will find HIGH-QUALITY, PROFESSIONAL photos.

RULES:
- Add visual descriptors: "aerial view", "close-up", "professional photo", "modern", "high resolution"
- Be specific: "solar panel farm aerial" > "solar energy"
- Prefer concrete visuals: "doctor using tablet in hospital" > "healthcare technology"
- Avoid generic/abstract terms
- All queries in English
- Return JSON: { "keywords": ["query1", "query2", "query3"] }`,
          },
          {
            role: 'user',
            content: `Original keyword: "${request.keyword}"\nSlide title: "${request.slideTitle}"\nStyle: ${request.preferredStyle || 'photo'}`,
          },
        ],
        fallback: () => ({
          keywords: [
            `${request.keyword} professional photo high quality`,
            `${request.keyword} modern`,
            request.keyword,
          ],
        }),
      });

      return result.data.keywords;
    } catch {
      return [request.keyword];
    }
  }

  /**
   * Search for images with optimized keywords and validation
   */
  async findBestImage(request: ImageSearchRequest): Promise<ImageSearchResult | null> {
    // Get optimized keywords
    const keywords = await this.optimizeKeyword(request);

    for (const keyword of keywords) {
      try {
        const bingSearch = new BingLinks(keyword, 10, 'off', 10, 'photo', [], false);
        const links = await bingSearch.getImageLinks();

        for (const link of links) {
          if (this.usedUrls.has(link)) continue;

          const safeUrl = link.replace(/^http:\/\//i, 'https://');

          // Quick validation — check if URL is accessible
          const isValid = await this.validateImageUrl(safeUrl);
          if (isValid) {
            this.usedUrls.add(link);
            this.logger.info(`Smart image found for slide ${request.slideIndex}`, {
              keyword,
              url: safeUrl.substring(0, 60),
            });
            return { url: safeUrl, isValid: true };
          }
        }
      } catch (error) {
        this.logger.warn(`Image search failed for "${keyword}"`, { error });
      }
    }

    this.logger.warn(`No valid image found for slide ${request.slideIndex}`, {
      keywords,
    });
    return null;
  }

  /**
   * Validate that an image URL is accessible (HEAD request with timeout)
   */
  private async validateImageUrl(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, {
        timeout: 5000,
        maxRedirects: 3,
        validateStatus: (status) => status < 400,
      });
      const contentType = response.headers['content-type'] || '';
      return contentType.startsWith('image/');
    } catch {
      return false;
    }
  }

  /** Mark a URL as used (for deduplication across slides) */
  markUsed(url: string): void {
    this.usedUrls.add(url);
  }
}
