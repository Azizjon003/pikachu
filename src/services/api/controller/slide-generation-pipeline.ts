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
 * - Database persistence with per-step timing
 */

import fs from 'fs';
import path from 'path';
import prisma from '../../../lib/prisma';
import { AIClient } from '@/src/core/ai/ai-client';
import { OutlineGenerator } from '@/src/core/generation/outline-generator';
import { ContentGenerator } from '@/src/core/generation/content-generator';
import { SpecialSlideGenerator } from '@/src/core/generation/special-slide-generator';
import { LayoutPlacer } from '@/src/core/generation/layout-placer';
import { SlideReviewer } from '@/src/core/generation/slide-reviewer';
import { generateSlideFromAI } from '@/src/core/processors';
import { exportPPTX } from '@/src/core/exporters';
import ImageReplacerService from '@/src/services/image/image-replacer';
import TextPlacementValidator from '@/src/services/validation/text-placement-validator';
import { collisionAgent } from '@/src/services/layout/collision-prevention-agent';
import { LayoutDesigner } from '@/src/services/layout/layout-designer';
import { EnhancedLogger, LogLevel } from '@/src/lib/logger';
import {
  PipelineOptions,
  PipelineResult,
  FailedSlideInfo,
  GenerationConfig,
  DEFAULT_GENERATION_CONFIG,
} from '@/src/core/types/generation';

export type ProgressCallback = (progress: number, message: string) => void;

/** Helper: measure async function execution time */
async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, durationMs: Date.now() - start };
}

/** Helper: measure sync function execution time */
function timedSync<T>(fn: () => T): { result: T; durationMs: number } {
  const start = Date.now();
  const result = fn();
  return { result, durationMs: Date.now() - start };
}

interface StepRecord {
  stepName: string;
  stepOrder: number;
  durationMs: number;
  status: string;
  details?: Record<string, unknown>;
}

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
    const steps: StepRecord[] = [];
    const pipelineStart = Date.now();

    const progress = (pct: number, msg: string) => {
      onProgress?.(pct, msg);
      this.logger.info(msg, { progress: pct });
    };

    // ===== Step 1: Load template (0-5%) =====
    progress(2, 'Loading template');

    const { result: { aiSchema, fullSxema }, durationMs: loadMs } = await timed(async () => {
      // Load AI schema from DB
      const templateName = template.replace('.sxema.json', '');
      const dbTpl = await prisma.template.findFirst({
        where: { name: { contains: templateName } },
        select: { schema: true, name: true },
      });

      if (!dbTpl?.schema) {
        throw new Error(`Template schema not found in DB: ${templateName}`);
      }

      // Full sxema (raw PPTX JSON) still lives on filesystem — it's large and only needed for export
      const fullSxemaPath = path.join(process.cwd(), 'templates', `${dbTpl.name}.json`);
      if (!fs.existsSync(fullSxemaPath)) {
        throw new Error(`Template full schema not found: ${fullSxemaPath}`);
      }

      return {
        aiSchema: dbTpl.schema as any[],
        fullSxema: JSON.parse(fs.readFileSync(fullSxemaPath, 'utf-8')),
      };
    });

    steps.push({ stepName: 'template_load', stepOrder: 1, durationMs: loadMs, status: 'completed' });
    progress(5, 'Template loaded');

    // ===== Step 2: Generate outline (5-15%) =====
    progress(7, 'Generating outline');
    const { result: outline, durationMs: outlineMs } = await timed(() =>
      this.outlineGenerator.generate({ slides: aiSchema, language, pageCount: page, topic })
    );
    steps.push({ stepName: 'outline', stepOrder: 2, durationMs: outlineMs, status: 'completed',
      details: { outlineCount: outline.outline.length, slidesPlanned: outline.slides.length } });
    progress(15, 'Outline generated');

    // ===== Step 3: Place title slide (15-20%) =====
    progress(17, 'Placing title slide');
    const { result: firstSlide, durationMs: titleMs } = await timed(() =>
      this.layoutPlacer.placeTitlePage(aiSchema[0], topic, author)
    );
    steps.push({ stepName: 'title_placement', stepOrder: 3, durationMs: titleMs, status: 'completed' });
    progress(20, 'Title slide placed');

    // ===== Step 4: Place outline slide (20-25%) =====
    progress(22, 'Placing outline slide');
    const outlineTitles = outline.outline.map((item: any) => item.title);
    const { result: secondSlide, durationMs: outlinePlaceMs } = await timed(() =>
      this.layoutPlacer.placeOutline(aiSchema[1], outlineTitles, language)
    );
    steps.push({ stepName: 'outline_placement', stepOrder: 4, durationMs: outlinePlaceMs, status: 'completed' });
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

    const { result: contentResults, durationMs: contentMs } = await timed(() =>
      Promise.allSettled(
        slidesToFill.map((slide: any, i: number) => {
          const outlineSlide = outline.slides[i];
          const sectionInfo = outline.outline[outlineSlide.outlineIndex];
          return this.contentGenerator.generate({
            slide,
            outline: {
              ...outlineSlide,
              description: sectionInfo?.description,
            },
            language,
            mainTopic: topic,
            slidePosition: {
              current: i + 1,
              total: slidesToFill.length,
              sectionName: sectionInfo?.title,
            },
          });
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
        contentSlides.push(slidesToFill[index]);
      }

      const slidePct = 25 + Math.floor(((index + 1) / slidesToFill.length) * 30);
      progress(slidePct, `Content slide ${index + 1}/${slidesToFill.length} done`);
    });

    steps.push({ stepName: 'content', stepOrder: 5, durationMs: contentMs, status: 'completed',
      details: { totalSlides: slidesToFill.length, failed: failedSlides.length } });
    progress(55, `${contentSlides.length} content slides generated`);

    // ===== Step 6: Generate special slides in parallel (55-65%) =====
    progress(57, 'Generating special slides');

    const { result: [conclusionResult, referencesResult, thankYouResult], durationMs: specialMs } = await timed(() =>
      Promise.allSettled([
        this.specialSlideGenerator.generateConclusion({
          slide: aiSchema[aiSchema.length - 3], topic, language,
        }),
        this.specialSlideGenerator.generateReferences({
          slide: aiSchema[aiSchema.length - 2], topic, language, count: 5,
        }),
        this.specialSlideGenerator.generateThankYou({
          slide: aiSchema[aiSchema.length - 1], topic, language,
        }),
      ])
    );

    const conclusionSlide = conclusionResult.status === 'fulfilled'
      ? conclusionResult.value : aiSchema[aiSchema.length - 3];
    const referencesSlide = referencesResult.status === 'fulfilled'
      ? referencesResult.value : aiSchema[aiSchema.length - 2];
    const thankYouSlide = thankYouResult.status === 'fulfilled'
      ? thankYouResult.value : aiSchema[aiSchema.length - 1];

    steps.push({ stepName: 'special_slides', stepOrder: 6, durationMs: specialMs, status: 'completed' });
    progress(65, 'Special slides generated');

    // ===== Assemble all slides =====
    const allFilledSlides = [
      firstSlide, secondSlide, ...contentSlides,
      conclusionSlide, referencesSlide, thankYouSlide,
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
    const { result: replacementResults, durationMs: imageMs } = await timed(async () => {
      const imageReplacer = new ImageReplacerService(fullFilledSlidesPath, './images');
      return imageReplacer.replaceEditedImages();
    });

    this.logger.info('Image replacement summary', {
      total: replacementResults.total,
      successful: replacementResults.successful,
      failed: replacementResults.failed,
    });

    steps.push({ stepName: 'images', stepOrder: 7, durationMs: imageMs, status: 'completed',
      details: { total: replacementResults.total, successful: replacementResults.successful, failed: replacementResults.failed } });
    progress(80, `Images replaced: ${replacementResults.successful}/${replacementResults.total}`);

    // ===== Step 8: Validate text placement (80-85%) =====
    progress(82, 'Validating text placement');
    let allFilledSlidesJson = JSON.parse(fs.readFileSync(fullFilledSlidesPath, 'utf-8'));

    const { result: validationResult, durationMs: validationMs } = await timed(async () => {
      const validator = new TextPlacementValidator();
      return validator.validatePresentation(allFilledSlidesJson, topic, author, outlineTitles);
    });

    if (validationResult.fixedSlides > 0) {
      this.logger.info(`Applied fixes to ${validationResult.fixedSlides} slides`);
      allFilledSlidesJson = validationResult.validatedSlides;
      fs.writeFileSync(fullFilledSlidesPath, JSON.stringify(allFilledSlidesJson, null, 2));
    }

    steps.push({ stepName: 'validation', stepOrder: 8, durationMs: validationMs, status: 'completed',
      details: { issues: validationResult.issues.length, fixes: validationResult.fixes.length } });
    progress(85, 'Validation complete');

    // ===== Step 9: Collision prevention (85-90%) =====
    progress(87, 'Fixing collisions');
    let totalCollisionsFixed = 0;
    let totalSlidesFixed = 0;
    let totalSlidesWithErrors = 0;

    const { durationMs: collisionMs } = timedSync(() => {
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
          const pct = 85 + Math.floor((i / allFilledSlidesJson.length) * 5);
          progress(pct, `Collision fix: slide ${i + 1}/${allFilledSlidesJson.length}`);
        }
      }
    });

    if (totalSlidesFixed > 0) {
      fs.writeFileSync(fullFilledSlidesPath, JSON.stringify(allFilledSlidesJson, null, 2));
    }

    this.logger.info('Collision prevention complete', {
      slidesFixed: totalSlidesFixed,
      collisionsResolved: totalCollisionsFixed,
      validationErrors: totalSlidesWithErrors,
    });

    steps.push({ stepName: 'collision', stepOrder: 9, durationMs: collisionMs, status: 'completed',
      details: { slidesFixed: totalSlidesFixed, collisionsResolved: totalCollisionsFixed } });
    progress(90, 'Collisions fixed');

    // ===== Step 10: Quality Review (90-95%) =====
    progress(91, 'Reviewing slide quality');
    const { result: reviewResult, durationMs: reviewMs } = await timed(async () => {
      const reviewer = new SlideReviewer(this.aiClient, this.logger);
      return reviewer.reviewPresentation(allFilledSlidesJson, topic, language);
    });

    if (reviewResult.summary.imagesRemoved > 0 || reviewResult.summary.imagesReplaced > 0
        || reviewResult.summary.textIssuesFixed > 0) {
      allFilledSlidesJson = reviewResult.slides;
      fs.writeFileSync(fullFilledSlidesPath, JSON.stringify(allFilledSlidesJson, null, 2));
      this.logger.info('Quality review applied fixes', reviewResult.summary);
    }

    steps.push({ stepName: 'review', stepOrder: 10, durationMs: reviewMs, status: 'completed',
      details: { score: reviewResult.summary.overallScore, ...reviewResult.summary } });
    progress(95, `Quality review: score ${reviewResult.summary.overallScore}/100`);

    // ===== Step 11: Merge AI content into full schema (95-96%) =====
    progress(95, 'Merging content into template');

    const slideName = `${sessionId}-${sanitizedTopic}.pptx`;
    const slidePath = path.join(generatedDir, slideName);

    const { result: dataFullSxema, durationMs: mergeMs } = timedSync(() =>
      generateSlideFromAI(allFilledSlidesJson, fullSxema)
    );

    steps.push({ stepName: 'merge', stepOrder: 11, durationMs: mergeMs, status: 'completed' });

    // ===== Step 12: Layout Design (96-98%) =====
    progress(96, 'Optimizing layout design');

    const { result: designResult, durationMs: designMs } = timedSync(() => {
      const designer = new LayoutDesigner({
        slideWidth: dataFullSxema.viewportWidth,
        slideHeight: dataFullSxema.viewportHeight,
      });
      return designer.designSlides(dataFullSxema.slide);
    });

    dataFullSxema.slide = designResult.slides;
    this.logger.info('Layout design complete', designResult.summary);

    steps.push({ stepName: 'layout_design', stepOrder: 12, durationMs: designMs, status: 'completed',
      details: designResult.summary as any });
    progress(98, 'Layout optimized');

    // ===== Step 13: Export PPTX (98-100%) =====
    progress(98, 'Exporting PPTX');

    const { durationMs: exportMs } = timedSync(() => {
      exportPPTX(
        dataFullSxema.slide,
        false,
        false,
        dataFullSxema.theme,
        { width: dataFullSxema.viewportWidth, height: dataFullSxema.viewportHeight },
        slidePath
      );
    });

    steps.push({ stepName: 'export', stepOrder: 13, durationMs: exportMs, status: 'completed' });
    progress(100, 'PPTX exported successfully');

    // ===== Save to database =====
    const tokenUsage = this.aiClient.getTotalUsage();
    const fileSize = fs.existsSync(slidePath) ? fs.statSync(slidePath).size : null;
    const totalDuration = Date.now() - pipelineStart;

    const dbTemplate = await prisma.template.findFirst({
      where: { name: { contains: template.replace('.sxema.json', '') } },
      select: { id: true },
    });

    const presentation = await prisma.presentation.create({
      data: {
        filename: slideName,
        filePath: `generated/${slideName}`,
        topic,
        language,
        author: author || null,
        templateId: dbTemplate?.id || null,
        fileSize,
        slideCount: allFilledSlidesJson.length,
        pageCount: page,
        generationTime: totalDuration,
        totalTokens: tokenUsage.totalTokens || null,
        estimatedCost: tokenUsage.estimatedCost || null,
        qualityScore: reviewResult.summary.overallScore,
        validationIssues: validationResult.issues.length,
        validationFixes: validationResult.fixes.length,
        collisionsFixed: totalCollisionsFixed,
        imagesReplaced: replacementResults.successful,
        imagesFailed: replacementResults.failed,
        failedSlides: failedSlides.length,
        status: 'completed',
        metadata: {
          outline: outline.outline.map((o: any) => o.title),
        },
      },
    });

    // Save per-step timing
    await prisma.generationStep.createMany({
      data: steps.map((s) => ({
        presentationId: presentation.id,
        stepName: s.stepName,
        stepOrder: s.stepOrder,
        durationMs: s.durationMs,
        status: s.status,
        details: s.details ? (s.details as any) : null,
      })),
    });

    this.logger.info('Presentation saved to database', {
      slideName, totalDuration: `${(totalDuration / 1000).toFixed(1)}s`,
      steps: steps.map((s) => `${s.stepName}: ${s.durationMs}ms`),
    });

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
      qualityReview: {
        overallScore: reviewResult.summary.overallScore,
        imagesRemoved: reviewResult.summary.imagesRemoved,
        imagesReplaced: reviewResult.summary.imagesReplaced,
        textIssuesFixed: reviewResult.summary.textIssuesFixed,
      },
      layoutDesign: designResult.summary,
      failedSlides,
      tokenUsage,
    };
  }
}
