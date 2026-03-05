/**
 * Slide Generation Pipeline
 *
 * Unified orchestrator for the entire presentation generation process.
 * Both async (task-based) and sync endpoints use this single pipeline.
 *
 * Key improvements over the old controller:
 * - Promise.allSettled for partial failure recovery
 * - No unnecessary sleep() calls
 * - Fine-grained progress tracking
 * - Retry/circuit breaker on all AI calls via AIClient
 * - Single code path (no duplication between async/sync)
 * - Collision prevention always runs (not skipped in sync mode)
 */

import fs from 'fs';
import path from 'path';
import { AIClient } from '@/src/core/ai/ai-client';
import { OutlineGenerator } from '@/src/core/generation/outline-generator';
import { ContentGenerator } from '@/src/core/generation/content-generator';
import { SpecialSlideGenerator } from '@/src/core/generation/special-slide-generator';
import { LayoutPlacer } from '@/src/core/generation/layout-placer';
import { generateSlideFromAI } from '@/src/core/processors';
import { exportPPTX } from '@/src/core/exporters';
import ImageReplacerService from '@/src/services/image/image-replacer';
import TextPlacementValidator from '@/src/services/validation/text-placement-validator';
import { collisionAgent } from '@/src/services/layout/collision-prevention-agent';
import { EnhancedLogger, LogLevel } from '@/src/lib/logger';
import {
  PipelineOptions,
  PipelineResult,
  FailedSlideInfo,
  TokenUsage,
  GenerationConfig,
  DEFAULT_GENERATION_CONFIG,
} from '@/src/core/types/generation';

export type ProgressCallback = (progress: number, message: string) => void;

export class SlideGenerationPipeline {
  private aiClient: AIClient;
  private outlineGenerator: OutlineGenerator;
  private contentGenerator: ContentGenerator;
  private specialSlideGenerator: SpecialSlideGenerator;
  private layoutPlacer: LayoutPlacer;
  private logger: EnhancedLogger;

  constructor(config?: Partial<GenerationConfig>) {
    const mergedConfig = { ...DEFAULT_GENERATION_CONFIG, ...config };
    this.logger = new EnhancedLogger(LogLevel.INFO);
    this.aiClient = new AIClient(mergedConfig, this.logger);
    this.outlineGenerator = new OutlineGenerator(this.aiClient, mergedConfig, this.logger);
    this.contentGenerator = new ContentGenerator(this.aiClient, mergedConfig, this.logger);
    this.specialSlideGenerator = new SpecialSlideGenerator(this.aiClient, this.logger);
    this.layoutPlacer = new LayoutPlacer(this.aiClient, this.logger);
  }

  async execute(
    options: PipelineOptions,
    onProgress?: ProgressCallback
  ): Promise<PipelineResult> {
    const { template, language, page, topic, author } = options;
    const failedSlides: FailedSlideInfo[] = [];

    const progress = (pct: number, msg: string) => {
      onProgress?.(pct, msg);
      this.logger.info(msg, { progress: pct });
    };

    // ===== Step 1: Load template (0-5%) =====
    progress(2, 'Loading template');

    const templatePath = path.join(process.cwd(), 'templates', template);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${template}`);
    }

    const aiSchema = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
    const fullSxema = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'templates', template.replace('.sxema.json', '.json')),
        'utf-8'
      )
    );
    progress(5, 'Template loaded');

    // ===== Step 2: Generate outline (5-15%) =====
    progress(7, 'Generating outline');
    const outline = await this.outlineGenerator.generate({
      slides: aiSchema,
      language,
      pageCount: page,
      topic,
    });
    progress(15, 'Outline generated');

    // ===== Step 3: Place title slide (15-20%) =====
    progress(17, 'Placing title slide');
    const firstSlide = await this.layoutPlacer.placeTitlePage(aiSchema[0], topic, author);
    progress(20, 'Title slide placed');

    // ===== Step 4: Place outline slide (20-25%) =====
    progress(22, 'Placing outline slide');
    const outlineTitles = outline.outline.map((item: any) => item.title);
    const secondSlide = await this.layoutPlacer.placeOutline(aiSchema[1], outlineTitles);
    progress(25, 'Outline slide placed');

    // ===== Step 5: Generate content slides with Promise.allSettled (25-55%) =====
    const filteredSchema = aiSchema.filter(
      (_: any, index: number) =>
        index !== 0 &&
        index !== 1 &&
        index !== aiSchema.length - 3 &&
        index !== aiSchema.length - 2 &&
        index !== aiSchema.length - 1
    );

    const slidesToFill = outline.slides.map(
      (outlineSlide: any) => filteredSchema[outlineSlide.slideIndex]
    );

    progress(27, `Generating ${slidesToFill.length} content slides in parallel`);

    const contentResults = await Promise.allSettled(
      slidesToFill.map((slide: any, i: number) =>
        this.contentGenerator.generate({
          slide,
          outline: outline.slides[i],
          language,
          mainTopic: topic,
        })
      )
    );

    // Process results — use fallback for failed slides
    const contentSlides: any[] = [];
    contentResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        contentSlides.push(result.value);
      } else {
        this.logger.error(`Content generation failed for slide ${index + 3}`, result.reason as Error);
        failedSlides.push({
          slideIndex: index + 2,
          error: (result.reason as Error)?.message || 'Unknown error',
          usedFallback: true,
        });
        // Use original slide as fallback
        contentSlides.push(slidesToFill[index]);
      }

      // Fine-grained progress
      const slidePct = 25 + Math.floor(((index + 1) / slidesToFill.length) * 30);
      progress(slidePct, `Content slide ${index + 1}/${slidesToFill.length} done`);
    });

    progress(55, `${contentSlides.length} content slides generated`);

    // ===== Step 6: Generate special slides in parallel (55-65%) =====
    progress(57, 'Generating special slides');

    const [conclusionResult, referencesResult, thankYouResult] = await Promise.allSettled([
      this.specialSlideGenerator.generateConclusion({
        slide: aiSchema[aiSchema.length - 3],
        topic,
        language,
      }),
      this.specialSlideGenerator.generateReferences({
        slide: aiSchema[aiSchema.length - 2],
        topic,
        language,
        count: 5,
      }),
      this.specialSlideGenerator.generateThankYou({
        slide: aiSchema[aiSchema.length - 1],
        topic,
        language,
      }),
    ]);

    const conclusionSlide = conclusionResult.status === 'fulfilled'
      ? conclusionResult.value
      : aiSchema[aiSchema.length - 3];
    const referencesSlide = referencesResult.status === 'fulfilled'
      ? referencesResult.value
      : aiSchema[aiSchema.length - 2];
    const thankYouSlide = thankYouResult.status === 'fulfilled'
      ? thankYouResult.value
      : aiSchema[aiSchema.length - 1];

    progress(65, 'Special slides generated');

    // ===== Assemble all slides =====
    const allFilledSlides = [
      firstSlide,
      secondSlide,
      ...contentSlides,
      conclusionSlide,
      referencesSlide,
      thankYouSlide,
    ];

    // ===== Step 7: Save and replace images (65-80%) =====
    const sessionId = Date.now();
    const sanitizedTopic = topic
      .replace(/[^a-zA-Z0-9\u0400-\u04FF\u0600-\u06FF]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30);

    const uniqueFilename = `${sessionId}-${sanitizedTopic}.full-filled-slides.json`;
    const generatedDir = path.join(process.cwd(), 'generated');
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }

    const fullFilledSlidesPath = path.join(generatedDir, uniqueFilename);
    fs.writeFileSync(fullFilledSlidesPath, JSON.stringify(allFilledSlides, null, 2));

    progress(68, 'Replacing images');
    const imageReplacer = new ImageReplacerService(fullFilledSlidesPath, './images');
    const replacementResults = await imageReplacer.replaceEditedImages();

    this.logger.info('Image replacement summary', {
      total: replacementResults.total,
      successful: replacementResults.successful,
      failed: replacementResults.failed,
    });

    progress(80, `Images replaced: ${replacementResults.successful}/${replacementResults.total}`);

    // ===== Step 8: Validate text placement (80-85%) =====
    progress(82, 'Validating text placement');
    let allFilledSlidesJson = JSON.parse(fs.readFileSync(fullFilledSlidesPath, 'utf-8'));

    const validator = new TextPlacementValidator();
    const validationResult = await validator.validatePresentation(
      allFilledSlidesJson,
      topic,
      author,
      outlineTitles
    );

    if (validationResult.fixedSlides > 0) {
      this.logger.info(`Applied fixes to ${validationResult.fixedSlides} slides`);
      allFilledSlidesJson = validationResult.validatedSlides;
      fs.writeFileSync(fullFilledSlidesPath, JSON.stringify(allFilledSlidesJson, null, 2));
    }

    progress(85, 'Validation complete');

    // ===== Step 9: Collision prevention (85-95%) =====
    progress(87, 'Fixing collisions');
    let totalCollisionsFixed = 0;
    let totalSlidesFixed = 0;
    let totalSlidesWithErrors = 0;

    for (let i = 0; i < allFilledSlidesJson.length; i++) {
      const slide = allFilledSlidesJson[i];
      try {
        const result = collisionAgent.fixAndValidate(slide.elements);
        slide.elements = result.fixedElements;

        if (result.fixesApplied > 0) {
          totalCollisionsFixed += result.fixesApplied;
          totalSlidesFixed++;
        }
        if (!result.isValid) {
          totalSlidesWithErrors++;
        }
      } catch (error) {
        this.logger.error(`Error fixing slide ${i + 1}`, error as Error);
      }

      if (i % 3 === 0) {
        const pct = 85 + Math.floor((i / allFilledSlidesJson.length) * 10);
        progress(pct, `Collision fix: slide ${i + 1}/${allFilledSlidesJson.length}`);
      }
    }

    if (totalSlidesFixed > 0) {
      fs.writeFileSync(fullFilledSlidesPath, JSON.stringify(allFilledSlidesJson, null, 2));
    }

    this.logger.info('Collision prevention complete', {
      slidesFixed: totalSlidesFixed,
      collisionsResolved: totalCollisionsFixed,
      validationErrors: totalSlidesWithErrors,
    });

    progress(95, 'Collisions fixed');

    // ===== Step 10: Export PPTX (95-100%) =====
    progress(97, 'Exporting PPTX');

    const dataFullSxema = generateSlideFromAI(allFilledSlidesJson, fullSxema);
    const slideName = `${sessionId}-${sanitizedTopic}.pptx`;
    const slidePath = path.join(generatedDir, slideName);

    exportPPTX(
      dataFullSxema.slide,
      false,
      false,
      dataFullSxema.theme,
      { width: dataFullSxema.viewportWidth, height: dataFullSxema.viewportHeight },
      slidePath
    );

    progress(100, 'PPTX exported successfully');

    return {
      success: true,
      slidePath,
      slideName,
      sessionId,
      jsonFilePath: fullFilledSlidesPath,
      jsonFileName: uniqueFilename,
      validation: {
        totalSlides: validationResult.totalSlides,
        validSlides: validationResult.validSlides,
        fixedSlides: validationResult.fixedSlides,
        issuesFound: validationResult.issues.length,
        fixesApplied: validationResult.fixes.length,
      },
      collisionPrevention: {
        slidesFixed: totalSlidesFixed,
        collisionsResolved: totalCollisionsFixed,
        validationErrors: totalSlidesWithErrors,
      },
      failedSlides,
      tokenUsage: this.aiClient.getTotalUsage(),
    };
  }
}
