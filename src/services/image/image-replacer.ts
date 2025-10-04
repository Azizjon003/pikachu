import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import BingLinks from './image-search';

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

/**
 * ImageReplacerService - Replaces images marked as edited in presentation schema
 */
class ImageReplacerService {
  private schemaPath: string;
  private imageBaseDir: string;
  private verbose: boolean;

  constructor(
    schemaPath: string = './Amir.sxema.json',
    imageBaseDir: string = './images',
    verbose: boolean = true
  ) {
    this.schemaPath = path.resolve(schemaPath);
    this.imageBaseDir = path.resolve(imageBaseDir);
    this.verbose = verbose;
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
   * Generates a search keyword based on slide content
   */
  private generateSearchKeyword(slideContext: string, slideNumber: number): string {
    // Clean up the text
    let text = slideContext.toLowerCase();

    // Remove Lorem ipsum placeholder text
    text = text.replace(/lorem ipsum.*?(?=\.|$)/gi, '');

    // Extract meaningful medical/scientific terms
    const medicalTerms = [
      'tumor', 'nervous system', 'brain', 'cancer', 'glioma', 'meningioma',
      'schwannoma', 'medulloblastoma', 'pituitary', 'mri', 'ct scan',
      'diagnostic', 'treatment', 'surgery', 'radiation', 'chemotherapy',
      'neurosurgery', 'oncology', 'pathology', 'biopsy', 'malignant',
      'benign', 'cerebellum', 'spinal cord', 'peripheral nerves'
    ];

    const foundTerms: string[] = [];
    for (const term of medicalTerms) {
      if (text.includes(term)) {
        foundTerms.push(term);
      }
    }

    // If we found medical terms, use them
    if (foundTerms.length > 0) {
      // Take top 3 most specific terms
      const keyword = foundTerms.slice(0, 3).join(' ') + ' medical';
      this.log(`Generated keyword from content: "${keyword}"`, 'info');
      return keyword;
    }

    // Fallback: extract first meaningful words
    const words = text
      .split(/\s+/)
      .filter(word => word.length > 3 && !word.match(/^\d+$/))
      .slice(0, 4);

    if (words.length > 0) {
      const keyword = words.join(' ');
      this.log(`Generated fallback keyword: "${keyword}"`, 'info');
      return keyword;
    }

    // Ultimate fallback
    const fallback = `medical presentation slide ${slideNumber}`;
    this.log(`Using ultimate fallback keyword: "${fallback}"`, 'warn');
    return fallback;
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
   * Searches for an image using Bing and returns the first valid URL
   */
  private async searchImageUrl(keyword: string): Promise<string | null> {
    try {
      this.log(`Searching for images with keyword: "${keyword}"`);

      const bingSearch = new BingLinks(
        keyword,
        5, // Get 5 results to have fallbacks
        'off', // adult filter
        10, // timeout in seconds
        '', // no filter
        [], // no blocked sites
        this.verbose
      );

      const imageLinks = await bingSearch.getImageLinks();

      if (imageLinks.length === 0) {
        this.log('No images found for this search', 'warn');
        return null;
      }

      this.log(`Found ${imageLinks.length} images`);

      // Return the first valid URL
      const firstUrl = imageLinks[0];
      this.log(`Selected image URL: ${firstUrl}`, 'success');
      return firstUrl;

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
   * Replaces a single image element with Bing image URL
   */
  private async replaceImage(
    slide: Slide,
    imageElement: ImageElement,
    slideContext: string
  ): Promise<boolean> {
    try {
      // Generate search keyword
      const keyword = this.generateSearchKeyword(slideContext, slide.slide);

      // Search for image URL
      const imageUrl = await this.searchImageUrl(keyword);

      if (imageUrl) {
        // Update the image src with the Bing URL
        imageElement.src = imageUrl;
        // Remove isEdited flag
        delete imageElement.isEdited;
        this.log(`Image URL updated: ${imageUrl}`, 'success');
        return true;
      }

      return false;
    } catch (error) {
      this.log(`Failed to replace image: ${error}`, 'error');
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
  async replaceEditedImages(): Promise<{
    total: number;
    successful: number;
    failed: number;
    errors: string[];
  }> {
    const stats = {
      total: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      this.log('=== Starting Image Replacement Process ===', 'info');

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

      // Process each edited image
      for (let i = 0; i < editedImages.length; i++) {
        const { slide, image } = editedImages[i];

        this.log(`\n--- Processing image ${i + 1}/${stats.total} ---`, 'info');
        this.log(`Slide: ${slide.slide}, Element: ${image.elementIndex}`, 'info');

        // Extract slide context
        const slideContext = this.extractSlideContext(slide);
        this.log(`Slide context: ${slideContext.substring(0, 100)}...`, 'info');

        // Replace the image
        const success = await this.replaceImage(slide, image, slideContext);

        if (success) {
          stats.successful++;
          this.log(`Successfully replaced image ${i + 1}/${stats.total}`, 'success');
        } else {
          stats.failed++;
          const errorMsg = `Failed to replace image on slide ${slide.slide}`;
          stats.errors.push(errorMsg);
          this.log(errorMsg, 'error');
        }
      }

      // Write updated schema
      if (stats.successful > 0) {
        this.log('\nSaving updated schema...', 'info');
        await this.writeSchema(schema);
      }

      // Print summary
      this.log('\n=== Replacement Summary ===', 'info');
      this.log(`Total images: ${stats.total}`, 'info');
      this.log(`Successful: ${stats.successful}`, 'success');
      this.log(`Failed: ${stats.failed}`, stats.failed > 0 ? 'warn' : 'info');

      if (stats.errors.length > 0) {
        this.log('\nErrors:', 'error');
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
