/**
 * Integrated Slide Generator
 * Orchestrates all components for complete, production-ready slide generation
 */

import OpenAI from 'openai';
import { ResilientSlideGenerator } from './resilient-generator';
import { QualityValidator, ValidationResult } from '../../lib/quality-validator';
import { ContentIntelligence, ElementAnalysis } from '../processors/content-analyzer';
import { PromptOptimizer, OptimizedPrompt, TokenUsage } from '../../lib/prompt-optimizer';
import { ProgressTracker, ProgressStage } from '../../lib/progress-tracker';
import { EnhancedLogger, LogLevel } from '../../lib/logger';
import { ConfigManager } from '../../lib/config-manager';

export interface GenerationResult {
  success: boolean;
  data: any;
  metadata: GenerationMetadata;
  errors?: string[];
}

export interface GenerationMetadata {
  totalDuration: number;
  stages: {
    analysis: number;
    generation: number;
    validation: number;
    finalization: number;
  };
  qualityScore: number;
  tokenUsage: TokenUsage;
  cacheHitRate: number;
  retryCount: number;
  validationResult: ValidationResult;
  contentAnalysis?: ElementAnalysis[];
}

export class IntegratedSlideGenerator {
  private client: OpenAI;
  private resilientGenerator: ResilientSlideGenerator;
  private qualityValidator: QualityValidator;
  private contentIntelligence: ContentIntelligence;
  private promptOptimizer: PromptOptimizer;
  private progressTracker: ProgressTracker;
  private logger: EnhancedLogger;
  private config: ConfigManager;

  constructor(apiKey: string, configPath?: string) {
    // Initialize OpenAI client
    this.client = new OpenAI({ apiKey });

    // Initialize configuration
    this.config = new ConfigManager(configPath);
    this.config.loadFromEnv();

    // Initialize logger
    this.logger = new EnhancedLogger(LogLevel.INFO);

    // Initialize components
    const modelConfig = this.config.get('model');
    const retryConfig = this.config.get('retry');
    const circuitConfig = this.config.get('circuitBreaker');
    const cacheConfig = this.config.get('cache');
    const qualityConfig = this.config.get('quality');
    const costsConfig = this.config.get('costs');

    this.resilientGenerator = new ResilientSlideGenerator(
      this.client,
      retryConfig,
      circuitConfig,
      cacheConfig,
      this.logger
    );

    this.qualityValidator = new QualityValidator(
      qualityConfig.minWordCount,
      qualityConfig.maxWordCount,
      qualityConfig.minScore
    );

    this.contentIntelligence = new ContentIntelligence();

    this.promptOptimizer = new PromptOptimizer(
      costsConfig.costPerInputToken,
      costsConfig.costPerOutputToken
    );

    this.progressTracker = new ProgressTracker(true);

    this.logger.info('IntegratedSlideGenerator initialized', {
      model: modelConfig.name,
      retryEnabled: retryConfig.maxAttempts > 1,
      circuitBreakerEnabled: circuitConfig.enabled,
      cacheEnabled: cacheConfig.enabled,
    });
  }

  /**
   * Generate outline with full pipeline
   */
  async generateOutline(
    slides: any[],
    language: string,
    pageCount: number,
    topic: string
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    this.progressTracker.reset();
    this.progressTracker.setStage(ProgressStage.INITIALIZING, 'Starting outline generation');

    try {
      // Stage 1: Analysis
      this.progressTracker.setStage(ProgressStage.ANALYZING, 'Analyzing slides structure');
      this.progressTracker.updateProgress(10, `Analyzing ${slides.length} slides`);

      const analysisStart = Date.now();
      const slideAnalyses = slides.map((slide) => this.contentIntelligence.analyzeSlide(slide));
      const analysisTime = Date.now() - analysisStart;

      this.progressTracker.updateProgress(30, 'Structure analysis complete');

      // Stage 2: Prompt optimization
      this.logger.info('Optimizing outline prompt');
      const optimizedPrompt = this.promptOptimizer.buildTitlePrompt(language, topic, slides.length);

      this.progressTracker.updateProgress(40, 'Prompt optimized');

      // Stage 3: Generation
      this.progressTracker.setStage(ProgressStage.GENERATING, 'Generating outline');
      const generationStart = Date.now();

      const jsonSchema = this.buildOutlineSchema(language, slides.length);

      const outlineData = await this.resilientGenerator.generateOutline(
        slides,
        language,
        pageCount,
        topic,
        jsonSchema
      );

      const generationTime = Date.now() - generationStart;
      this.progressTracker.updateProgress(70, 'Outline generated');

      // Track token usage (estimated)
      this.promptOptimizer.trackUsage(
        this.promptOptimizer.estimateTokens(optimizedPrompt.systemPrompt + optimizedPrompt.userPrompt),
        this.promptOptimizer.estimateTokens(JSON.stringify(outlineData))
      );

      // Stage 4: Validation
      this.progressTracker.setStage(ProgressStage.VALIDATING, 'Validating outline structure');
      const validationStart = Date.now();

      const validation = this.validateOutline(outlineData, pageCount);
      const validationTime = Date.now() - validationStart;

      this.progressTracker.updateProgress(90, `Validation score: ${validation.score}/100`);

      // Stage 5: Finalization
      this.progressTracker.setStage(ProgressStage.FINALIZING, 'Finalizing outline');

      const totalDuration = Date.now() - startTime;
      const metrics = this.resilientGenerator.getMetrics();
      const cacheStats = this.resilientGenerator.getCacheStats();

      this.progressTracker.updateProgress(100, 'Outline generation complete');
      this.progressTracker.complete('Outline successfully generated');

      this.logger.info('Outline generation completed', {
        duration: `${totalDuration}ms`,
        qualityScore: validation.score,
        outlines: outlineData.outline?.length || 0,
        slides: outlineData.slides?.length || 0,
      });

      return {
        success: true,
        data: outlineData,
        metadata: {
          totalDuration,
          stages: {
            analysis: analysisTime,
            generation: generationTime,
            validation: validationTime,
            finalization: Date.now() - startTime - analysisTime - generationTime - validationTime,
          },
          qualityScore: validation.score,
          tokenUsage: this.promptOptimizer.getTotalUsage(),
          cacheHitRate: cacheStats.hitRate,
          retryCount: metrics.attempts - metrics.successes,
          validationResult: validation,
        },
      };
    } catch (error: any) {
      this.progressTracker.fail(error, 'Outline generation failed');
      this.logger.error('Outline generation failed', error);

      return {
        success: false,
        data: null,
        metadata: this.buildErrorMetadata(startTime),
        errors: [error.message],
      };
    }
  }

  /**
   * Generate content for a slide with full pipeline
   */
  async generateSlideContent(
    slide: any,
    outline: any,
    language: string
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    this.progressTracker.reset();
    this.progressTracker.setStage(ProgressStage.INITIALIZING, `Starting content generation for slide ${slide.id}`);

    try {
      // Stage 1: Content Analysis
      this.progressTracker.setStage(ProgressStage.ANALYZING, 'Analyzing slide elements');
      const analysisStart = Date.now();

      const elementAnalyses = this.contentIntelligence.analyzeSlide(slide);
      const slideSummary = this.contentIntelligence.getSlideSummary(slide);
      const visualBalance = this.contentIntelligence.checkVisualBalance(slide);

      const analysisTime = Date.now() - analysisStart;

      this.logger.debug('Slide analysis complete', {
        elements: elementAnalyses.length,
        averageComplexity: slideSummary.averageComplexity.toFixed(1),
        visualBalance: visualBalance.score,
      });

      this.progressTracker.updateProgress(25, `Analyzed ${elementAnalyses.length} elements`);

      // Extract text/shape/table elements
      const elements = slide.elements
        .map((el: any, idx: number) => ({
          index: idx,
          type: el.type,
          width: el.width || 0,
          height: el.height || 0,
          left: el.left || 0,
          top: el.top || 0,
          currentContent: el.content || '',
          fontSize: el.fontSize || 14,
          maxCharacters: el.maxCharacters || 100,
          tableData: el.tableData || null,
        }))
        .filter((el: any) => el.type === 'text' || el.type === 'shape' || el.type === 'table');

      // Stage 2: Prompt Optimization
      const diversityContext = this.buildDiversityContext(elements);
      const optimizedPrompt = this.promptOptimizer.buildContentPrompt(
        language,
        outline.title || outline.title_eng,
        elements,
        diversityContext
      );

      this.progressTracker.updateProgress(35, 'Prompt optimized');

      // Stage 3: Generation
      this.progressTracker.setStage(ProgressStage.GENERATING, 'Generating content');
      const generationStart = Date.now();

      const contentSchema = this.buildContentSchema(language);

      const generatedData = await this.resilientGenerator.generateContent(
        slide,
        outline,
        language,
        elements,
        contentSchema
      );

      const generationTime = Date.now() - generationStart;

      // Track token usage
      this.promptOptimizer.trackUsage(
        this.promptOptimizer.estimateTokens(optimizedPrompt.systemPrompt + optimizedPrompt.userPrompt),
        this.promptOptimizer.estimateTokens(JSON.stringify(generatedData))
      );

      this.progressTracker.updateProgress(65, `Generated content for ${generatedData.elements?.length || 0} elements`);

      // Stage 4: Quality Validation
      this.progressTracker.setStage(ProgressStage.VALIDATING, 'Validating content quality');
      const validationStart = Date.now();

      const contentsToValidate = (generatedData.elements || []).map((el: any) => {
        const originalEl = elements.find((e: any) => e.index === el.elementIndex);
        return {
          content: el.content || '',
          maxCharacters: originalEl?.maxCharacters,
        };
      });

      const validation = this.qualityValidator.validateMultipleContents(contentsToValidate);
      const validationTime = Date.now() - validationStart;

      this.logger.info('Content validation complete', {
        score: validation.score,
        rating: this.qualityValidator.getQualityRating(validation.score),
        issues: validation.issues.length,
      });

      this.progressTracker.updateProgress(85, `Quality score: ${validation.score}/100`);

      // Stage 5: Finalization
      this.progressTracker.setStage(ProgressStage.FINALIZING, 'Applying content to slide');

      // Apply font size adjustments and merge content
      const updatedSlide = this.applyContentToSlide(slide, generatedData, elements);

      const totalDuration = Date.now() - startTime;
      const metrics = this.resilientGenerator.getMetrics();
      const cacheStats = this.resilientGenerator.getCacheStats();

      this.progressTracker.updateProgress(100, 'Content generation complete');
      this.progressTracker.complete(`Successfully generated content for slide ${slide.id}`);

      this.logger.info('Slide content generation completed', {
        slideId: slide.id,
        duration: `${totalDuration}ms`,
        qualityScore: validation.score,
        elementsGenerated: generatedData.elements?.length || 0,
      });

      return {
        success: true,
        data: updatedSlide,
        metadata: {
          totalDuration,
          stages: {
            analysis: analysisTime,
            generation: generationTime,
            validation: validationTime,
            finalization: Date.now() - startTime - analysisTime - generationTime - validationTime,
          },
          qualityScore: validation.score,
          tokenUsage: this.promptOptimizer.getTotalUsage(),
          cacheHitRate: cacheStats.hitRate,
          retryCount: metrics.attempts - metrics.successes,
          validationResult: validation,
          contentAnalysis: elementAnalyses,
        },
      };
    } catch (error: any) {
      this.progressTracker.fail(error, 'Content generation failed');
      this.logger.error('Content generation failed', error, { slideId: slide.id });

      return {
        success: false,
        data: null,
        metadata: this.buildErrorMetadata(startTime),
        errors: [error.message],
      };
    }
  }

  /**
   * Build diversity context for prompt
   */
  private buildDiversityContext(elements: any[]): string {
    const sizeGroups = new Map<number, any[]>();
    const threshold = 50;

    elements.forEach((el) => {
      let foundGroup = false;
      for (const [key, group] of sizeGroups.entries()) {
        if (Math.abs(key - el.maxCharacters) < threshold) {
          group.push(el);
          foundGroup = true;
          break;
        }
      }
      if (!foundGroup) {
        sizeGroups.set(el.maxCharacters, [el]);
      }
    });

    let diversityContext = '';
    for (const [maxChars, group] of sizeGroups.entries()) {
      if (group.length > 1) {
        diversityContext += `\nCRITICAL: ${group.length} elements have similar size (~${maxChars} chars). Each MUST have UNIQUE content!`;
      }
    }

    return diversityContext;
  }

  /**
   * Apply generated content to slide
   */
  private applyContentToSlide(slide: any, generatedData: any, elements: any[]): any {
    return {
      ...slide,
      elements: slide.elements.map((el: any, idx: number) => {
        const generatedElement = generatedData.elements?.find(
          (ge: any) => ge.elementIndex === idx
        );

        if (generatedElement && (el.type === 'text' || el.type === 'shape' || el.type === 'table')) {
          const updatedElement = {
            ...el,
            content: generatedElement.content,
          };

          // Apply font size adjustment if needed
          if (generatedElement.adjustedFontSize) {
            updatedElement.content = this.applyFontSize(
              generatedElement.content,
              generatedElement.adjustedFontSize
            );
          }

          // For table elements
          if (el.type === 'table' && generatedElement.tableData) {
            updatedElement.data =
              generatedElement.tableData?.data || generatedElement.tableData;
          }

          return updatedElement;
        }

        return el;
      }),
    };
  }

  /**
   * Apply font size to HTML content
   */
  private applyFontSize(htmlContent: string, newFontSize: number): string {
    return htmlContent.replace(
      /font-size:\s*\d+(?:\.\d+)?\s*px/gi,
      `font-size: ${newFontSize.toFixed(1)}px`
    );
  }

  /**
   * Validate outline structure
   */
  private validateOutline(outline: any, expectedSlideCount: number): ValidationResult {
    const issues: any[] = [];
    let score = 100;

    if (!outline.outline || outline.outline.length !== 3) {
      issues.push({
        type: 'consistency',
        severity: 'high',
        message: 'Outline should have exactly 3 sections',
      });
      score -= 30;
    }

    if (!outline.slides || outline.slides.length !== expectedSlideCount) {
      issues.push({
        type: 'consistency',
        severity: 'medium',
        message: `Expected ${expectedSlideCount} slides, got ${outline.slides?.length || 0}`,
      });
      score -= 20;
    }

    return {
      isValid: score >= 60,
      score: Math.max(0, score),
      issues,
      suggestions: issues.length > 0 ? ['Review outline structure'] : [],
      metrics: {
        wordCount: 0,
        characterCount: 0,
        sentenceCount: 0,
        averageWordLength: 0,
        averageSentenceLength: 0,
        readabilityScore: 0,
        grammarScore: score,
        coherenceScore: score,
        consistencyScore: score,
      },
    };
  }

  /**
   * Build outline JSON schema
   */
  private buildOutlineSchema(language: string, slideCount: number): any {
    return {
      type: 'object',
      properties: {
        outline: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: `Title in ${language}` },
              title_eng: { type: 'string', description: 'Title in English' },
            },
            required: ['title', 'title_eng'],
            additionalProperties: false,
          },
        },
        slides: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              slideIndex: { type: 'number' },
              title: { type: 'string' },
              title_eng: { type: 'string' },
              outlineIndex: { type: 'number' },
            },
            required: ['slideIndex', 'title', 'title_eng', 'outlineIndex'],
            additionalProperties: false,
          },
        },
      },
      required: ['outline', 'slides'],
      additionalProperties: false,
    };
  }

  /**
   * Build content JSON schema
   */
  private buildContentSchema(language: string): any {
    return {
      type: 'object',
      properties: {
        slideId: { type: 'string' },
        elements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              elementIndex: { type: 'number' },
              content: { type: 'string', description: `Content in ${language}` },
              tableData: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { type: 'array', items: { type: 'string' } },
                  },
                },
                required: ['data'],
                additionalProperties: false,
              },
            },
            required: ['elementIndex', 'content', 'tableData'],
            additionalProperties: false,
          },
        },
      },
      required: ['slideId', 'elements'],
      additionalProperties: false,
    };
  }

  /**
   * Build error metadata
   */
  private buildErrorMetadata(startTime: number): GenerationMetadata {
    return {
      totalDuration: Date.now() - startTime,
      stages: { analysis: 0, generation: 0, validation: 0, finalization: 0 },
      qualityScore: 0,
      tokenUsage: this.promptOptimizer.getTotalUsage(),
      cacheHitRate: this.resilientGenerator.getCacheStats().hitRate,
      retryCount: 0,
      validationResult: {
        isValid: false,
        score: 0,
        issues: [],
        suggestions: [],
        metrics: {
          wordCount: 0,
          characterCount: 0,
          sentenceCount: 0,
          averageWordLength: 0,
          averageSentenceLength: 0,
          readabilityScore: 0,
          grammarScore: 0,
          coherenceScore: 0,
          consistencyScore: 0,
        },
      },
    };
  }

  /**
   * Get comprehensive statistics
   */
  getStatistics(): {
    generator: any;
    optimizer: any;
    cache: any;
    progress: any;
    logger: any;
  } {
    return {
      generator: this.resilientGenerator.getMetrics(),
      optimizer: this.promptOptimizer.getTotalUsage(),
      cache: this.resilientGenerator.getCacheStats(),
      progress: this.progressTracker.getSummary(),
      logger: this.logger.getStats(),
    };
  }

  /**
   * Print summary report
   */
  printSummaryReport(): void {
    console.log('\n=== Integrated Generator Summary ===\n');

    const stats = this.getStatistics();

    console.log('Generator Metrics:');
    console.log(`  Total Attempts: ${stats.generator.attempts}`);
    console.log(`  Successes: ${stats.generator.successes}`);
    console.log(`  Failures: ${stats.generator.failures}`);
    console.log(`  Average Latency: ${(stats.generator.totalLatency / stats.generator.attempts || 0).toFixed(0)}ms`);

    console.log('\nToken Usage:');
    console.log(`  Input Tokens: ${stats.optimizer.inputTokens.toLocaleString()}`);
    console.log(`  Output Tokens: ${stats.optimizer.outputTokens.toLocaleString()}`);
    console.log(`  Total Cost: $${stats.optimizer.estimatedCost.toFixed(4)}`);

    console.log('\nCache Performance:');
    console.log(`  Hit Rate: ${(stats.cache.hitRate * 100).toFixed(1)}%`);
    console.log(`  Entries: ${stats.cache.entries}`);

    console.log('\nCircuit Breaker:');
    console.log(`  State: ${this.resilientGenerator.getCircuitState()}`);

    this.progressTracker.printSummary();
  }
}
