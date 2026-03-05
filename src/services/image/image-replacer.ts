import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import BingLinks from './image-search';
import { getOpenAIService, OpenAIService } from '../openai';
import dotenv from 'dotenv';
dotenv.config();

interface ImageElement {
  type: 'image';
  src: string;
  hasImage: boolean;
  isEdited?: boolean;
  elementIndex: number;
}

interface ShapeElement {
  type: 'shape';
  content: string;
  elementIndex: number;
  [key: string]: any;
}

interface TableElement {
  type: 'table';
  data: string[][];
  elementIndex: number;
}

type SlideElement = ImageElement | ShapeElement | TableElement;

interface Slide {
  id: string;
  index: number;
  slide: number;
  elements: SlideElement[];
  note: string;
}

type Schema = Slide[];

interface ReplacementStats {
  total: number;
  successful: number;
  failed: number;
  duplicatesAvoided: number;
  errors: string[];
  failureReasons: {
    noImages: number;
    validationFailed: number;
    downloadFailed: number;
    allAttemptsFailed: number;
  };
}

/**
 * ImageReplacerService - Replaces images marked as edited in presentation schema
 */
class ImageReplacerService {
  private schemaPath: string;
  private imageBaseDir: string;
  private verbose: boolean;
  private openaiService: OpenAIService;
  private usedImageUrls: Set<string> = new Set();

  constructor(
    schemaPath: string = './Amir.sxema.json',
    imageBaseDir: string = './images',
    verbose: boolean = true
  ) {
    this.schemaPath = path.resolve(schemaPath);
    this.imageBaseDir = path.resolve(imageBaseDir);
    this.verbose = verbose;

    // Initialize OpenAI service
    this.openaiService = getOpenAIService();
  }

  /**
   * Logs messages if verbose mode is enabled
   */
  private log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info'): void {
    if (!this.verbose) return;

    const prefix = {
      info: '[INFO]',
      success: '[SUCCESS]',
      error: '[ERROR]',
      warn: '[WARN]'
    };

    console.log(`${prefix[type]} ${message}`);
  }

  /**
   * Reads and parses the schema JSON file
   */
  private async readSchema(): Promise<Schema> {
    try {
      const schemaContent = await fs.promises.readFile(this.schemaPath, 'utf-8');
      return JSON.parse(schemaContent) as Schema;
    } catch (error) {
      this.log(`Failed to read schema: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Writes the updated schema back to file
   */
  private async writeSchema(schema: Schema): Promise<void> {
    try {
      const schemaContent = JSON.stringify(schema, null, 2);
      await fs.promises.writeFile(this.schemaPath, schemaContent, 'utf-8');
      this.log('Schema updated successfully', 'success');
    } catch (error) {
      this.log(`Failed to write schema: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Ensures the images directory exists
   */
  private async ensureImageDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.imageBaseDir, { recursive: true });
    } catch (error) {
      this.log(`Failed to create image directory: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Extracts text content from shape elements on a slide
   */
  private extractSlideContext(slide: Slide): string {
    const textContent: string[] = [];

    for (const element of slide.elements) {
      if (element.type === 'shape') {
        const shapeElement = element as ShapeElement;
        if (shapeElement.content && shapeElement.content.trim()) {
          textContent.push(shapeElement.content.trim());
        }
      } else if (element.type === 'table') {
        const tableElement = element as TableElement;
        // Extract text from table cells
        for (const row of tableElement.data) {
          for (const cell of row) {
            if (cell && cell.trim()) {
              textContent.push(cell.trim());
            }
          }
        }
      }
    }

    return textContent.join(' ');
  }

  /**
   * Extract context from nearby elements around the target image
   */
  private extractElementContext(slide: Slide, targetElementIndex: number): string {
    const elements = slide.elements;
    const targetIdx = elements.findIndex(el => el.elementIndex === targetElementIndex);

    if (targetIdx === -1) {
      this.log(`Element index ${targetElementIndex} not found in slide`, 'warn');
      return '';
    }

    // Get nearby elements (±3 positions)
    const startIdx = Math.max(0, targetIdx - 3);
    const endIdx = Math.min(elements.length, targetIdx + 4);
    const nearbyElements = elements.slice(startIdx, endIdx);

    // Extract text from shape elements
    const contextTexts: string[] = [];
    for (const el of nearbyElements) {
      if (el.type === 'shape') {
        const shapeEl = el as ShapeElement;
        if (shapeEl.content && shapeEl.content.trim()) {
          contextTexts.push(shapeEl.content.trim());
        }
      }
    }

    const context = contextTexts.join(' ');

    if (context) {
      this.log(`  Extracted context from ${contextTexts.length} nearby text elements`, 'info');
    } else {
      this.log('  No text context found near image element', 'warn');
    }

    return context;
  }

  /**
   * Translate text to English and extract key searchable terms using OpenAI
   */
  private async translateToEnglish(text: string): Promise<string> {
    if (!text || text.trim().length === 0) {
      return '';
    }

    try {
      this.log(`  Translating: "${text.substring(0, 80)}..."`, 'info');

      const response = await this.openaiService.createChatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a translator and keyword extractor. Translate the given text to English and extract 3-5 key searchable terms that would be good for finding relevant images. Return only the keywords separated by spaces, focusing on visual concepts that can be photographed.'
          },
          {
            role: 'user',
            content: `Translate and extract visual keywords: ${text}`
          }
        ],
        temperature: 0.3,
        max_tokens: 50
      });

      const englishKeywords = response.content?.trim() || '';

      if (englishKeywords) {
        this.log(`  ✓ English keywords: "${englishKeywords}"`, 'success');
        return englishKeywords;
      }

      this.log('  Translation returned empty, using original text', 'warn');
      return text;
    } catch (error) {
      this.log(`  Translation failed: ${error}`, 'warn');
      return text;
    }
  }

  /**
   * Generates a search keyword based on slide content
   */
  private generateSearchKeyword(slideContext: string, slideNumber: number): string {
    // Clean up the text
    let text = slideContext.toLowerCase();

    // Remove placeholder text
    text = text.replace(/lorem ipsum.*?(?=\.|$)/gi, '');
    text = text.replace(/\[.*?\]/g, ''); // Remove [brackets]

    // Extract meaningful words (>3 chars, not numbers, not common stop words)
    const stopWords = new Set([
      'this', 'that', 'with', 'from', 'have', 'been', 'will', 'would', 'could',
      'should', 'about', 'which', 'their', 'there', 'these', 'those', 'then',
      'than', 'them', 'they', 'what', 'when', 'where', 'were', 'also', 'very',
      'more', 'most', 'some', 'such', 'only', 'other', 'into', 'over',
    ]);

    const words = text
      .split(/\s+/)
      .map(w => w.replace(/[^a-z0-9'-]/g, ''))
      .filter(word => word.length > 3 && !word.match(/^\d+$/) && !stopWords.has(word));

    // Take the most meaningful words (longer words tend to be more specific)
    const sorted = words.sort((a, b) => b.length - a.length);
    const unique = [...new Set(sorted)].slice(0, 4);

    if (unique.length > 0) {
      const keyword = unique.join(' ');
      this.log(`Generated keyword from content: "${keyword}"`, 'info');
      return keyword;
    }

    // Ultimate fallback — generic professional image
    const fallback = `professional presentation slide`;
    this.log(`Using fallback keyword: "${fallback}"`, 'warn');
    return fallback;
  }

  /**
   * Test if an image URL is valid and downloadable
   */
  private async testImageUrl(url: string): Promise<boolean> {
    try {
      // Only accept HTTPS URLs
      if (!url.startsWith('https://')) {
        this.log(`    Invalid protocol (only HTTPS allowed): ${url}`, 'warn');
        return false;
      }

      const response = await axios.head(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        validateStatus: (status) => status < 500 // Accept any status < 500
      });

      // Check if it's an image
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        this.log(`    Not an image: ${contentType}`, 'warn');
        return false;
      }

      // Check file size (must be > 1KB and < 10MB)
      const contentLength = parseInt(response.headers['content-length'] || '0');
      if (contentLength < 1024 || contentLength > 10 * 1024 * 1024) {
        this.log(`    Invalid size: ${contentLength} bytes`, 'warn');
        return false;
      }

      return true;
    } catch (error) {
      this.log(`    Validation failed: ${error}`, 'warn');
      return false;
    }
  }

  /**
   * Downloads an image from a URL
   */
  private async downloadImage(url: string, outputPath: string): Promise<boolean> {
    try {
      this.log(`Downloading image from: ${url}`);

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 seconds timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      await fs.promises.writeFile(outputPath, response.data);
      this.log(`Image saved to: ${outputPath}`, 'success');
      return true;
    } catch (error) {
      this.log(`Failed to download image: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Searches for an image using Bing and returns a valid, unique, downloadable URL
   */
  private async searchImageUrl(keyword: string, maxAttempts: number = 10): Promise<string | null> {
    try {
      this.log(`Searching for images with keyword: "${keyword}"`);

      const bingSearch = new BingLinks(
        keyword,
        maxAttempts, // Get multiple results for fallback
        'off',
        10,
        '',
        [],
        this.verbose
      );

      const imageLinks = await bingSearch.getImageLinks();

      if (imageLinks.length === 0) {
        this.log('No images found for this search', 'warn');
        return null;
      }

      this.log(`Found ${imageLinks.length} candidate images`);

      // Try each image until we find a valid, unique, downloadable one
      for (let i = 0; i < imageLinks.length; i++) {
        const imageUrl = imageLinks[i];

        // Skip if already used
        if (this.usedImageUrls.has(imageUrl)) {
          this.log(`  Skipping duplicate image ${i + 1}: ${imageUrl}`, 'warn');
          continue;
        }

        // Test if image is downloadable
        const isValid = await this.testImageUrl(imageUrl);

        if (isValid) {
          this.usedImageUrls.add(imageUrl);
          this.log(`  ✓ Selected unique image ${i + 1}: ${imageUrl}`, 'success');
          return imageUrl;
        } else {
          this.log(`  ✗ Image ${i + 1} failed validation: ${imageUrl}`, 'warn');
        }
      }

      this.log('All candidate images failed validation', 'error');
      return null;
    } catch (error) {
      this.log(`Image search failed: ${error}`, 'error');
      return null;
    }
  }

  /**
   * Gets file extension from URL or defaults to .png
   */
  private getImageExtension(url: string): string {
    const match = url.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);
    return match ? `.${match[1].toLowerCase()}` : '.png';
  }

  /**
   * Replaces a single image element with Bing image URL (Enhanced with translation, validation, and fallbacks)
   */
  private async replaceImage(
    slide: Slide,
    imageElement: ImageElement,
    slideContext: string
  ): Promise<boolean> {
    try {
      this.log(`\n  --- Processing Image Element ${imageElement.elementIndex} ---`, 'info');

      // 1. Get element-specific context from nearby text
      const elementContext = this.extractElementContext(slide, imageElement.elementIndex);

      // 2. Use element context if available, otherwise use slide context
      const searchText = elementContext || slideContext;

      if (!searchText) {
        this.log('  No context available for image search', 'warn');
        return false;
      }

      this.log(`  Original text: "${searchText.substring(0, 100)}${searchText.length > 100 ? '...' : ''}"`, 'info');

      // 3. Translate to English for better search results
      const englishKeywords = await this.translateToEnglish(searchText);

      // 4. Try with translated keywords first
      let imageUrl: string | null = null;

      if (englishKeywords && englishKeywords.length > 0) {
        imageUrl = await this.searchImageUrl(englishKeywords);
      }

      // Fallback 1: Try with fallback keyword
      if (!imageUrl && searchText) {
        this.log('  First search failed, trying fallback keyword...', 'warn');
        const fallbackKeyword = this.generateSearchKeyword(searchText, slide.slide);
        imageUrl = await this.searchImageUrl(fallbackKeyword);
      }

      // Fallback 2: Try with generic professional keyword
      if (!imageUrl) {
        this.log('  Trying generic keyword...', 'warn');
        imageUrl = await this.searchImageUrl('professional presentation background');
      }

      if (imageUrl) {
        // Update the image src with the Bing URL
        imageElement.src = imageUrl;
        // Remove isEdited flag
        delete imageElement.isEdited;
        this.log(`  ✅ Image replaced successfully: ${imageUrl}`, 'success');
        return true;
      }

      this.log('  ❌ All search attempts failed', 'error');
      return false;
    } catch (error) {
      this.log(`  ❌ Failed to replace image: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Finds all images marked as edited in the schema
   */
  private findEditedImages(schema: Schema): Array<{ slide: Slide; image: ImageElement }> {
    const editedImages: Array<{ slide: Slide; image: ImageElement }> = [];

    for (const slide of schema) {
      for (const element of slide.elements) {
        if (element.type === 'image') {
          const imageElement = element as ImageElement;
          if (imageElement.isEdited === true) {
            editedImages.push({ slide, image: imageElement });
          }
        }
      }
    }

    return editedImages;
  }

  /**
   * Main function to replace all edited images
   */
  async replaceEditedImages(): Promise<ReplacementStats> {
    const stats: ReplacementStats = {
      total: 0,
      successful: 0,
      failed: 0,
      duplicatesAvoided: 0,
      errors: [],
      failureReasons: {
        noImages: 0,
        validationFailed: 0,
        downloadFailed: 0,
        allAttemptsFailed: 0
      }
    };

    try {
      this.log('=== Starting Image Replacement Process ===', 'info');

      // Reset used image URLs tracker
      this.usedImageUrls.clear();
      this.log('Reset image URL tracker', 'info');

      // Read schema
      this.log('Reading schema file...', 'info');
      const schema = await this.readSchema();

      // Find all edited images
      const editedImages = this.findEditedImages(schema);
      stats.total = editedImages.length;

      this.log(`Found ${stats.total} image(s) marked as edited`, 'info');

      if (stats.total === 0) {
        this.log('No images to replace', 'info');
        return stats;
      }

      // Process all edited images in parallel with concurrency control
      this.log(`\n🚀 Processing ${editedImages.length} images in parallel with concurrency control...`, 'info');

      const maxConcurrency = 5; // Process max 5 images at a time
      const results: boolean[] = [];

      // Process in chunks for controlled concurrency
      for (let i = 0; i < editedImages.length; i += maxConcurrency) {
        const chunk = editedImages.slice(i, i + maxConcurrency);

        this.log(`\n--- Processing chunk ${Math.floor(i / maxConcurrency) + 1}/${Math.ceil(editedImages.length / maxConcurrency)} (${chunk.length} images) ---`, 'info');

        const chunkPromises = chunk.map(async ({ slide, image }, chunkIndex) => {
          const globalIndex = i + chunkIndex;
          this.log(`\n  [${globalIndex + 1}/${stats.total}] Processing slide ${slide.slide}, element ${image.elementIndex}`, 'info');

          // Extract slide context
          const slideContext = this.extractSlideContext(slide);
          this.log(`  [${globalIndex + 1}/${stats.total}] Slide context: ${slideContext.substring(0, 80)}...`, 'info');

          // Track duplicates before replacement
          const urlsBefore = this.usedImageUrls.size;

          try {
            // Replace the image (now with validation and fallbacks)
            const success = await this.replaceImage(slide, image, slideContext);

            // Check if we avoided duplicates
            const urlsAfter = this.usedImageUrls.size;
            if (urlsAfter > urlsBefore) {
              stats.duplicatesAvoided += (urlsBefore - (urlsAfter - 1));
            }

            if (success) {
              this.log(`  [${globalIndex + 1}/${stats.total}] ✅ Successfully replaced`, 'success');
              return true;
            } else {
              stats.failureReasons.allAttemptsFailed++;
              const errorMsg = `Failed to replace image on slide ${slide.slide}, element ${image.elementIndex}`;
              stats.errors.push(errorMsg);
              this.log(`  [${globalIndex + 1}/${stats.total}] ❌ ${errorMsg}`, 'error');
              return false;
            }
          } catch (error) {
            stats.failureReasons.allAttemptsFailed++;
            const errorMsg = `Exception while replacing image on slide ${slide.slide}, element ${image.elementIndex}: ${error}`;
            stats.errors.push(errorMsg);
            this.log(`  [${globalIndex + 1}/${stats.total}] ❌ ${errorMsg}`, 'error');
            return false;
          }
        });

        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);

        // Count successes/failures in this chunk
        chunkResults.forEach(success => {
          if (success) {
            stats.successful++;
          } else {
            stats.failed++;
          }
        });

        // Add delay between chunks to avoid rate limiting
        if (i + maxConcurrency < editedImages.length) {
          this.log(`\n  ⏳ Waiting 2s before next chunk...`, 'info');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Write updated schema
      if (stats.successful > 0) {
        this.log('\nSaving updated schema...', 'info');
        await this.writeSchema(schema);
      }

      // Print detailed summary
      this.log('\n=== Replacement Summary ===', 'info');
      this.log(`Total images processed: ${stats.total}`, 'info');
      this.log(`✅ Successful: ${stats.successful}`, 'success');
      this.log(`❌ Failed: ${stats.failed}`, stats.failed > 0 ? 'warn' : 'info');
      this.log(`🔄 Duplicate URLs avoided: ${stats.duplicatesAvoided}`, 'info');
      this.log(`🖼️  Unique images used: ${this.usedImageUrls.size}`, 'info');

      if (stats.failed > 0) {
        this.log('\nFailure Breakdown:', 'warn');
        this.log(`  - All search attempts failed: ${stats.failureReasons.allAttemptsFailed}`, 'warn');
      }

      if (stats.errors.length > 0) {
        this.log('\nDetailed Errors:', 'error');
        stats.errors.forEach(err => this.log(`  - ${err}`, 'error'));
      }

      return stats;
    } catch (error) {
      const errorMsg = `Fatal error during replacement: ${error}`;
      this.log(errorMsg, 'error');
      stats.errors.push(errorMsg);
      throw error;
    }
  }

  /**
   * Replace a single image by slide number and element index
   */
  async replaceImageByIndex(
    slideNumber: number,
    elementIndex: number,
    customKeyword?: string
  ): Promise<boolean> {
    try {
      await this.ensureImageDirectory();
      const schema = await this.readSchema();

      // Find the slide
      const slide = schema.find(s => s.slide === slideNumber);
      if (!slide) {
        this.log(`Slide ${slideNumber} not found`, 'error');
        return false;
      }

      // Find the image element
      const imageElement = slide.elements.find(
        el => el.type === 'image' && el.elementIndex === elementIndex
      ) as ImageElement | undefined;

      if (!imageElement) {
        this.log(`Image element ${elementIndex} not found on slide ${slideNumber}`, 'error');
        return false;
      }

      // Get context or use custom keyword
      const slideContext = customKeyword || this.extractSlideContext(slide);

      // Replace the image
      const success = await this.replaceImage(slide, imageElement, slideContext);

      if (success) {
        await this.writeSchema(schema);
        return true;
      }

      return false;
    } catch (error) {
      this.log(`Error replacing image: ${error}`, 'error');
      return false;
    }
  }
}

export default ImageReplacerService;
