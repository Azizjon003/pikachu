import AIImageAgent, { ImageSearchContext, AgentDecision } from './ai-image-agent';
import ImageStorageManager, { ImageMetadata } from './image-storage-manager';
import ImageQualityValidator, { ValidationResult } from './image-quality-validator';
import dotenv from 'dotenv';
import BingLinks from './image-search';

dotenv.config();

/**
 * Integrated AI Image Service
 *
 * Combines AI Agent, Storage Manager, and Quality Validator
 * into a single high-level service for presentation image management
 */

export interface SlideImageRequest {
  slideTitle: string;
  slideContent: string;
  slideIndex: number;
  elementType: 'background' | 'content' | 'icon' | 'illustration';
  templateName: string;
  presentationTitle: string;
  presentationTheme?: string;
  desiredStyle?: string;
  colorScheme?: string;
}

export interface ImageSelectionResult {
  success: boolean;
  imageUrl: string | null;
  localPath: string | null;
  metadata: ImageMetadata | null;
  confidence: number;
  aiReasoning: string;
  alternatives: Array<{
    url: string;
    score: number;
    reasoning: string;
  }>;
  validationResult?: ValidationResult;
  error?: string;
  processingTime: number;
}

export interface BatchImageRequest {
  templateName: string;
  presentationTitle: string;
  presentationTheme?: string;
  slides: Array<{
    slideIndex: number;
    slideTitle: string;
    slideContent: string;
    elementType: 'background' | 'content' | 'icon' | 'illustration';
    desiredStyle?: string;
    colorScheme?: string;
  }>;
}

export interface BatchImageResult {
  totalSlides: number;
  successfulCount: number;
  failedCount: number;
  results: ImageSelectionResult[];
  totalProcessingTime: number;
  averageConfidence: number;
}

export class IntegratedAIImageService {
  private agent: AIImageAgent;
  private storage: ImageStorageManager;
  private validator: ImageQualityValidator;
  private bingSearch: typeof BingLinks;
  private enableValidation: boolean = true;
  private enableQualityCheck: boolean = true;

  constructor(
    openaiApiKey?: string,
    bingApiKey?: string,
    storageBaseDir: string = 'images'
  ) {
    const openai = openaiApiKey || process.env.OPENAI_API_KEY;
    const bing = bingApiKey || process.env.BING_API_KEY;

    if (!openai) {
      throw new Error('OPENAI_API_KEY is required');
    }

    if (!bing) {
      throw new Error('BING_API_KEY is required');
    }

    this.agent = new AIImageAgent(openai, bing);
    this.storage = new ImageStorageManager(storageBaseDir);
    this.validator = new ImageQualityValidator(openai);
    this.bingSearch = BingLinks;

    console.log('🚀 Integrated AI Image Service initialized');
  }

  /**
   * Main method: Find and download optimal image for a slide
   */
  async findAndDownloadImage(request: SlideImageRequest): Promise<ImageSelectionResult> {
    const startTime = Date.now();
    console.log(`\n🎯 Processing image request for slide ${request.slideIndex + 1}: "${request.slideTitle}"`);

    try {
      // Step 1: Use AI Agent to find optimal image
      const context: ImageSearchContext = {
        slideTitle: request.slideTitle,
        slideContent: request.slideContent,
        slideIndex: request.slideIndex,
        totalSlides: 1, // Will be updated in batch mode
        presentationTitle: request.presentationTitle,
        presentationTheme: request.presentationTheme,
        targetLanguage: 'en',
        elementType: request.elementType,
        desiredStyle: request.desiredStyle,
        colorScheme: request.colorScheme
      };

      const decision = await this.agent.selectOptimalImage(context, request.templateName);

      if (!decision.selectedImage) {
        console.log('❌ No suitable image found by AI agent');
        return {
          success: false,
          imageUrl: null,
          localPath: null,
          metadata: null,
          confidence: 0,
          aiReasoning: decision.reasoning,
          alternatives: [],
          error: 'No suitable image found',
          processingTime: Date.now() - startTime
        };
      }

      console.log(`✅ AI Agent selected image: ${decision.selectedImage.url}`);
      console.log(`   Confidence: ${(decision.confidence * 100).toFixed(1)}%`);

      // Step 2: Validate image quality (if enabled)
      let validationResult: ValidationResult | undefined;

      if (this.enableValidation) {
        console.log('🔍 Validating image quality...');
        try {
          validationResult = await this.validator.validateImage(
            decision.selectedImage.url,
            {
              minWidth: 800,
              minHeight: 600,
              expectedContent: request.slideTitle,
              expectedStyle: request.desiredStyle || 'professional',
              purposeDescription: `${request.elementType} image for ${request.presentationTitle}`
            }
          );

          console.log(`   Quality Score: ${(validationResult.overallScore * 100).toFixed(1)}%`);
          console.log(`   Grade: ${validationResult.grade}`);

          if (!validationResult.isValid && this.enableQualityCheck) {
            console.log('⚠️  Image failed quality check, trying alternatives...');

            // Try alternatives
            for (const alt of decision.alternativeImages.slice(0, 2)) {
              const altValidation = await this.validator.validateImage(alt.url);
              if (altValidation.isValid) {
                decision.selectedImage = alt;
                validationResult = altValidation;
                console.log(`✅ Alternative image passed quality check`);
                break;
              }
            }

            if (!validationResult.isValid) {
              console.log('⚠️  No alternatives passed quality check, using best available');
            }
          }
        } catch (error) {
          console.warn('⚠️  Validation failed, proceeding without validation:', error);
        }
      }

      // Step 3: Download and store image
      console.log('📥 Downloading image...');
      const imageMetadata = await this.storage.downloadImage(
        decision.selectedImage.url,
        request.templateName,
        {
          slideIndex: request.slideIndex,
          elementType: request.elementType,
          searchQuery: decision.selectedImage.searchQuery,
          dimensions: {
            width: decision.selectedImage.width,
            height: decision.selectedImage.height
          },
          aiScore: decision.selectedImage.overallScore,
          aiReasoning: decision.selectedImage.aiReasoning,
          validationScore: validationResult?.overallScore,
          context: {
            slideTitle: request.slideTitle,
            slideContent: request.slideContent,
            presentationTitle: request.presentationTitle,
            elementType: request.elementType
          }
        }
      );

      console.log(`✅ Image saved: ${imageMetadata.localPath}`);

      // Format alternatives
      const alternatives = decision.alternativeImages.map(alt => ({
        url: alt.url,
        score: alt.overallScore,
        reasoning: alt.aiReasoning
      }));

      return {
        success: true,
        imageUrl: decision.selectedImage.url,
        localPath: imageMetadata.localPath,
        metadata: imageMetadata,
        confidence: decision.confidence,
        aiReasoning: decision.reasoning,
        alternatives,
        validationResult,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('❌ Error processing image request:', error);
      return {
        success: false,
        imageUrl: null,
        localPath: null,
        metadata: null,
        confidence: 0,
        aiReasoning: '',
        alternatives: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Batch process multiple slides
   */
  async processBatchImages(batchRequest: BatchImageRequest): Promise<BatchImageResult> {
    const startTime = Date.now();
    console.log(`\n🎬 Starting batch image processing for "${batchRequest.presentationTitle}"`);
    console.log(`   Template: ${batchRequest.templateName}`);
    console.log(`   Total Slides: ${batchRequest.slides.length}`);

    const results: ImageSelectionResult[] = [];
    let successfulCount = 0;
    let failedCount = 0;
    let totalConfidence = 0;

    for (let i = 0; i < batchRequest.slides.length; i++) {
      const slide = batchRequest.slides[i];

      console.log(`\n--- Processing Slide ${i + 1}/${batchRequest.slides.length} ---`);

      const result = await this.findAndDownloadImage({
        slideTitle: slide.slideTitle,
        slideContent: slide.slideContent,
        slideIndex: slide.slideIndex,
        elementType: slide.elementType,
        templateName: batchRequest.templateName,
        presentationTitle: batchRequest.presentationTitle,
        presentationTheme: batchRequest.presentationTheme,
        desiredStyle: slide.desiredStyle,
        colorScheme: slide.colorScheme
      });

      results.push(result);

      if (result.success) {
        successfulCount++;
        totalConfidence += result.confidence;
      } else {
        failedCount++;
      }

      // Add delay between requests to avoid rate limiting
      if (i < batchRequest.slides.length - 1) {
        console.log('⏳ Waiting 2s before next request...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const totalProcessingTime = Date.now() - startTime;
    const averageConfidence = successfulCount > 0 ? totalConfidence / successfulCount : 0;

    console.log('\n📊 Batch Processing Summary:');
    console.log(`   Total Slides: ${batchRequest.slides.length}`);
    console.log(`   ✅ Successful: ${successfulCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);
    console.log(`   Average Confidence: ${(averageConfidence * 100).toFixed(1)}%`);
    console.log(`   Total Time: ${(totalProcessingTime / 1000).toFixed(1)}s`);

    return {
      totalSlides: batchRequest.slides.length,
      successfulCount,
      failedCount,
      results,
      totalProcessingTime,
      averageConfidence
    };
  }

  /**
   * Find image using simple keyword search (fallback method)
   */
  async findImageByKeyword(
    keyword: string,
    templateName: string,
    slideIndex: number = 0
  ): Promise<ImageSelectionResult> {
    const startTime = Date.now();
    console.log(`🔍 Searching image by keyword: "${keyword}"`);

    try {
      const bingSearch = new this.bingSearch(keyword, 10, 'off', 10, '', [], true);
      const imageLinks = await bingSearch.getImageLinks();

      if (imageLinks.length === 0) {
        return {
          success: false,
          imageUrl: null,
          localPath: null,
          metadata: null,
          confidence: 0,
          aiReasoning: 'No images found for keyword',
          alternatives: [],
          error: 'No images found',
          processingTime: Date.now() - startTime
        };
      }

      const imageUrl = imageLinks[0];
      console.log(`✅ Found image: ${imageUrl}`);

      // Download and store
      const imageMetadata = await this.storage.downloadImage(
        imageUrl,
        templateName,
        {
          slideIndex,
          elementType: 'content',
          searchQuery: keyword,
          dimensions: { width: 0, height: 0 },
          context: {
            slideTitle: keyword,
            slideContent: '',
            presentationTitle: templateName,
            elementType: 'content'
          }
        }
      );

      return {
        success: true,
        imageUrl,
        localPath: imageMetadata.localPath,
        metadata: imageMetadata,
        confidence: 0.5,
        aiReasoning: 'Found via keyword search',
        alternatives: imageLinks.slice(1, 4).map(url => ({
          url,
          score: 0.5,
          reasoning: 'Alternative from keyword search'
        })),
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('❌ Error in keyword search:', error);
      return {
        success: false,
        imageUrl: null,
        localPath: null,
        metadata: null,
        confidence: 0,
        aiReasoning: '',
        alternatives: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get all images for a template
   */
  async getTemplateImages(templateName: string): Promise<ImageMetadata[]> {
    return await this.storage.getImagesForTemplate(templateName);
  }

  /**
   * Get template statistics
   */
  async getTemplateStats(templateName: string) {
    return await this.storage.getStatistics(templateName);
  }

  /**
   * Cleanup old images for a template
   */
  async cleanupTemplateImages(
    templateName: string,
    options: {
      olderThanDays?: number;
      keepLatest?: number;
      minQualityScore?: number;
    } = {}
  ) {
    console.log(`🧹 Cleaning up images for template: ${templateName}`);
    return await this.storage.cleanup(templateName, options);
  }

  /**
   * Delete all images for a template
   */
  async deleteTemplateImages(templateName: string): Promise<void> {
    console.log(`🗑️  Deleting all images for template: ${templateName}`);
    await this.storage.deleteTemplate(templateName);
    this.agent.clearTemplateHistory(templateName);
    console.log(`✅ Template images deleted: ${templateName}`);
  }

  /**
   * Export template metadata
   */
  async exportTemplateMetadata(templateName: string) {
    return await this.storage.exportMetadata(templateName);
  }

  /**
   * Validate existing image
   */
  async validateExistingImage(imageUrl: string, context?: any): Promise<ValidationResult> {
    return await this.validator.validateImage(imageUrl, context);
  }

  /**
   * Get service statistics
   */
  getServiceStats() {
    const templates = this.storage.getAllTemplates();
    return {
      totalTemplates: templates.length,
      templates: templates,
      storageBaseDir: this.storage['baseDir']
    };
  }

  /**
   * Enable/disable validation
   */
  setValidationEnabled(enabled: boolean): void {
    this.enableValidation = enabled;
    console.log(`Validation ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable/disable quality check (strict mode)
   */
  setQualityCheckEnabled(enabled: boolean): void {
    this.enableQualityCheck = enabled;
    console.log(`Quality check ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Print service information
   */
  printServiceInfo(): void {
    console.log('\n📋 Integrated AI Image Service Info:');
    console.log(`   Validation: ${this.enableValidation ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Quality Check: ${this.enableQualityCheck ? '✅ Enabled' : '❌ Disabled'}`);

    const stats = this.getServiceStats();
    console.log(`   Total Templates: ${stats.totalTemplates}`);
    if (stats.templates.length > 0) {
      console.log(`   Templates: ${stats.templates.join(', ')}`);
    }
  }
}

export default IntegratedAIImageService;