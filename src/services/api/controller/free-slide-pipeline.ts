/**
 * Free Slide Generation Pipeline
 *
 * Template-free presentation generation using layout patterns + design system.
 * Runs parallel to the existing SlideGenerationPipeline without touching it.
 *
 * Pipeline steps:
 * 1. AI → Outline + pattern selection (0-12%)
 * 2. Typography + Build slide layouts (12-20%)
 * 3. AI → Content generation (20-45%)
 * 4. Build special slides (45-52%)
 * 5. Content enhancement agent (52-58%)
 * 6. Smart image search & placement (58-72%)
 * 7. Color harmony check (72-76%)
 * 8. Quality review (76-82%)
 * 9. Collision prevention (82-88%)
 * 10. Transitions + Image placement (88-93%)
 * 11. Export PPTX (93-100%)
 */

import fs from 'fs';
import path from 'path';
import prisma from '../../../lib/prisma';
import { AIClient } from '@/src/core/ai/ai-client';
import { FreeOutlineGenerator } from '@/src/core/free-generation/free-outline-generator';
import { FreeContentGenerator } from '@/src/core/free-generation/free-content-generator';
import { SlideBuilder, type ElementContent } from '@/src/core/free-generation/slide-builder';
import { THEMES, DEFAULT_VIEWPORT, buildCustomTheme, FONT_PAIRS } from '@/src/core/free-generation/design-system';
import { getPattern } from '@/src/core/free-generation/slide-patterns';
import { SlideReviewer } from '@/src/core/generation/slide-reviewer';
import { exportPPTX } from '@/src/core/exporters';
import { collisionAgent } from '@/src/services/layout/collision-prevention-agent';
import BingLinks from '@/src/services/image/image-search';
import { EnhancedLogger, LogLevel } from '@/src/lib/logger';
import type { Slide } from '../../../../types/slides';
// Pipeline agents
import { SmartImageAgent } from '@/src/core/free-generation/agents/smart-image-agent';
import { ColorHarmonyAgent } from '@/src/core/free-generation/agents/color-harmony-agent';
import { ContentEnhancementAgent } from '@/src/core/free-generation/agents/content-enhancement-agent';
import { ImagePlacementAgent } from '@/src/core/free-generation/agents/image-placement-agent';
import { TransitionAgent } from '@/src/core/free-generation/agents/transition-agent';
import { TypographyAgent } from '@/src/core/free-generation/agents/typography-agent';
import {
  type FreeSlideOptions,
  type FreeOutlineResult,
  type PipelineResult,
  type FailedSlideInfo,
  type GenerationConfig,
  DEFAULT_GENERATION_CONFIG,
} from '@/src/core/types/generation';

export type ProgressCallback = (progress: number, message: string) => void;

/** Measure async function execution time */
async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, durationMs: Date.now() - start };
}

/** Measure sync function execution time */
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

// ============================================
// FreeSlideGenerationPipeline
// ============================================

export class FreeSlideGenerationPipeline {
  private aiClient: AIClient;
  private outlineGenerator: FreeOutlineGenerator;
  private contentGenerator: FreeContentGenerator;
  private logger: EnhancedLogger;

  constructor(config?: Partial<GenerationConfig>) {
    const mergedConfig = { ...DEFAULT_GENERATION_CONFIG, ...config };
    this.logger = new EnhancedLogger(LogLevel.INFO);
    this.aiClient = new AIClient(mergedConfig, this.logger);
    this.outlineGenerator = new FreeOutlineGenerator(this.aiClient, mergedConfig, this.logger);
    this.contentGenerator = new FreeContentGenerator(this.aiClient, mergedConfig, this.logger);
  }

  async execute(
    options: FreeSlideOptions,
    onProgress?: ProgressCallback
  ): Promise<PipelineResult> {
    const { language, page, topic, author } = options;
    const failedSlides: FailedSlideInfo[] = [];
    const steps: StepRecord[] = [];
    const pipelineStart = Date.now();

    const progress = (pct: number, msg: string) => {
      onProgress?.(pct, msg);
      this.logger.info(msg, { progress: pct });
    };

    // ===== Step 1: Generate outline + pattern selection (0-15%) =====
    progress(2, 'Generating outline and selecting layouts');

    const { result: outlineResult, durationMs: outlineMs } = await timed(() =>
      this.outlineGenerator.generate({
        language,
        pageCount: page,
        topic,
        theme: options.theme,
        fontPair: options.fontPair,
      })
    );

    steps.push({
      stepName: 'free_outline', stepOrder: 1, durationMs: outlineMs, status: 'completed',
      details: {
        theme: outlineResult.theme,
        outlineCount: outlineResult.outline.length,
        slideCount: outlineResult.slides.length,
      },
    });
    // Ensure at least one image pattern exists — swap a bullet-list if needed
    const hasImagePattern = outlineResult.slides.some(s =>
      s.pattern === 'image-right' || s.pattern === 'image-left' || s.pattern === 'image-full' ||
      s.pattern === 'split-image-stats'
    );
    if (!hasImagePattern && outlineResult.slides.length >= 3) {
      // Find a bullet-list slide to swap (prefer middle slides)
      const bulletIdx = outlineResult.slides.findIndex((s, i) =>
        (s.pattern === 'bullet-list' || s.pattern === 'two-column') && i > 0
      );
      if (bulletIdx >= 0) {
        outlineResult.slides[bulletIdx].pattern = 'image-right';
        outlineResult.slides[bulletIdx].imageKeyword = outlineResult.slides[bulletIdx].title_eng;
        this.logger.info(`Swapped slide ${bulletIdx} to image-right for visual variety`);
      }
    }

    progress(12, `Outline generated: ${outlineResult.outline.length} sections, ${outlineResult.slides.length} slides`);

    // ===== Step 2: Typography + Build slide layouts (12-20%) =====
    progress(14, 'Configuring typography and building layouts');

    // Resolve theme: use custom colors if provided, otherwise use preset theme
    const theme = outlineResult.customColors && outlineResult.theme === 'custom'
      ? buildCustomTheme(outlineResult.customColors)
      : THEMES[outlineResult.theme] || THEMES.professional;
    const viewport = DEFAULT_VIEWPORT;

    // Resolve font pair with multi-language typography agent
    const fontPairName = outlineResult.fontPair || 'modern';
    const fontPair = FONT_PAIRS[fontPairName] || FONT_PAIRS.modern;

    const typographyAgent = new TypographyAgent();
    const typography = typographyAgent.getTypography(language, fontPair);

    const builder = new SlideBuilder(theme, viewport, typography.titleFont, typography.bodyFont);
    this.logger.info('Typography configured', {
      language, fontPair: fontPairName,
      titleFont: typography.titleFont, bodyFont: typography.bodyFont,
      isRTL: typography.isRTL,
    });

    // Build fixed slides: title, outline, conclusion, references, thank-you
    const allSlides: Slide[] = [];

    // Title slide
    const titleSlide = builder.buildFromPattern('title-center', {
      elements: [
        { text: topic },
        { text: author ? `${author}` : '' },
        { text: '' },
      ],
    });
    allSlides.push(titleSlide);

    // Outline slide
    const outlineTitles = outlineResult.outline.map((o) => o.title);
    const outlineContent = outlineTitles.map((t, i) => `${i + 1}. ${t}`).join('\n');
    const outlineSlide = builder.buildFromPattern('bullet-list', {
      elements: [
        { text: language === 'English' ? 'Contents' : language === 'Russian' ? 'Содержание' : 'Mundarija' },
        { text: outlineContent },
      ],
    });
    allSlides.push(outlineSlide);

    // Content slides (empty for now — will be filled in Step 3)
    const contentSlideIndices: number[] = [];
    for (const slide of outlineResult.slides) {
      let builtSlide: Slide;
      if (slide.pattern === 'custom' && slide.customElements?.length) {
        const emptyContent = { elements: slide.customElements.map(() => ({})) };
        builtSlide = builder.buildFromCustomLayout(slide.customElements, emptyContent, slide.customBackground);
      } else {
        const pattern = getPattern(slide.pattern);
        const emptyContent = { elements: pattern.elements.map(() => ({})) };
        builtSlide = builder.buildSlide(pattern, emptyContent);
      }
      contentSlideIndices.push(allSlides.length);
      allSlides.push(builtSlide);
    }

    steps.push({ stepName: 'layout_build', stepOrder: 2, durationMs: 0, status: 'completed' });
    progress(25, `${contentSlideIndices.length} slide layouts built`);

    // ===== Step 3: Generate content for slides (25-55%) =====
    progress(27, `Generating content for ${outlineResult.slides.length} slides`);

    const { result: contentResults, durationMs: contentMs } = await timed(() =>
      Promise.allSettled(
        outlineResult.slides.map((slide, i) => {
          const sectionInfo = outlineResult.outline[slide.outlineIndex];
          return this.contentGenerator.generate({
            slide,
            language,
            mainTopic: topic,
            slidePosition: {
              current: i + 1,
              total: outlineResult.slides.length,
              sectionName: sectionInfo?.title,
            },
          });
        })
      )
    );

    // Apply content to slides
    contentResults.forEach((result, i) => {
      const slideIdx = contentSlideIndices[i];
      const outlineSlideInfo = outlineResult.slides[i];

      if (result.status === 'fulfilled') {
        // Rebuild the slide with actual content
        if (outlineSlideInfo.pattern === 'custom' && outlineSlideInfo.customElements?.length) {
          allSlides[slideIdx] = builder.buildFromCustomLayout(
            outlineSlideInfo.customElements,
            { elements: result.value.elements },
            outlineSlideInfo.customBackground
          );
        } else {
          const pattern = getPattern(outlineSlideInfo.pattern);
          allSlides[slideIdx] = builder.buildSlide(pattern, { elements: result.value.elements });
        }
      } else {
        this.logger.error(`Content generation failed for slide ${i}`, result.reason as Error);
        failedSlides.push({
          slideIndex: slideIdx,
          error: (result.reason as Error)?.message || 'Unknown error',
          usedFallback: true,
        });
      }

      const pct = 25 + Math.floor(((i + 1) / outlineResult.slides.length) * 30);
      progress(pct, `Content slide ${i + 1}/${outlineResult.slides.length} done`);
    });

    steps.push({
      stepName: 'content', stepOrder: 3, durationMs: contentMs, status: 'completed',
      details: { totalSlides: outlineResult.slides.length, failed: failedSlides.length },
    });
    progress(55, `${outlineResult.slides.length} content slides generated`);

    // ===== Step 4: Build special slides (55-65%) =====
    progress(57, 'Building special slides');

    // Conclusion — use section-break style header + bullet content
    const conclusionTitle = language === 'English' ? 'Conclusion' : language === 'Russian' ? 'Заключение' : 'Xulosa';
    const conclusionSlide = builder.buildFromPattern('bullet-list', {
      elements: [
        { text: conclusionTitle },
        { text: '' }, // Will be filled below
      ],
    });
    allSlides.push(conclusionSlide);

    // References — use bullet-list
    const referencesTitle = language === 'English' ? 'References' : language === 'Russian' ? 'Литература' : 'Adabiyotlar';
    const referencesSlide = builder.buildFromPattern('bullet-list', {
      elements: [
        { text: referencesTitle },
        { text: '' },
      ],
    });
    allSlides.push(referencesSlide);

    // Thank you — gradient background with centered text
    const thankYouText = language === 'English' ? 'Thank You!' : language === 'Russian' ? 'Спасибо!' : 'Rahmat!';
    const questionsText = language === 'English' ? 'Questions & Discussion' : language === 'Russian' ? 'Вопросы и обсуждение' : 'Savollar va muhokama';
    const thankYouSlide = builder.buildFromPattern('thank-you', {
      elements: [
        { text: thankYouText },
        { text: questionsText },
        { text: author || '' },
      ],
    });
    allSlides.push(thankYouSlide);

    // Generate content for conclusion and references via AI
    const { durationMs: specialMs } = await timed(async () => {
      const conclusionIdx = allSlides.length - 3;
      const referencesIdx = allSlides.length - 2;

      const [conclusionResult, referencesResult] = await Promise.allSettled([
        this.generateSpecialContent('conclusion', topic, language, outlineResult),
        this.generateSpecialContent('references', topic, language, outlineResult),
      ]);

      if (conclusionResult.status === 'fulfilled') {
        allSlides[conclusionIdx] = builder.buildFromPattern('bullet-list', {
          elements: [
            { text: conclusionTitle },
            { text: conclusionResult.value },
          ],
        });
      }

      if (referencesResult.status === 'fulfilled') {
        allSlides[referencesIdx] = builder.buildFromPattern('bullet-list', {
          elements: [
            { text: referencesTitle },
            { text: referencesResult.value },
          ],
        });
      }
    });

    steps.push({ stepName: 'special_slides', stepOrder: 4, durationMs: specialMs, status: 'completed' });
    progress(52, 'Special slides built');

    // ===== Step 5: Content Enhancement Agent (52-58%) =====
    progress(53, 'Enhancing content quality');

    const { result: enhancementResult, durationMs: enhanceMs } = await timed(async () => {
      const enhancer = new ContentEnhancementAgent(this.aiClient, this.logger);
      return enhancer.enhance(allSlides, topic, language);
    });

    steps.push({
      stepName: 'content_enhancement', stepOrder: 5, durationMs: enhanceMs, status: 'completed',
      details: { issuesFound: enhancementResult.issuesFound, issuesFixed: enhancementResult.issuesFixed },
    });
    progress(58, `Content enhanced: ${enhancementResult.issuesFixed} fixes applied`);

    // ===== Step 6: Smart Image Search & Placement (58-72%) =====
    progress(59, 'Smart image search');

    const smartImageAgent = new SmartImageAgent(this.aiClient, this.logger);
    const usedImageUrls = new Set<string>();

    const { durationMs: imageMs } = await timed(async () => {
      const slidesWithImages: Array<{ keyword: string; slideTitle: string; slideIdx: number; contentIdx: number }> = [];

      for (let i = 0; i < outlineResult.slides.length; i++) {
        const slide = outlineResult.slides[i];
        const slideIdx = contentSlideIndices[i];
        const pptSlide = allSlides[slideIdx];
        if (!pptSlide) continue;

        const hasImageEl = pptSlide.elements.some((el) => el.type === 'image');
        if (!hasImageEl) continue;

        const keyword = slide.imageKeyword || (
          slide.pattern === 'custom' && slide.customElements?.some(el => el.type === 'image')
            ? slide.title_eng
            : null
        );

        if (keyword) {
          slidesWithImages.push({ keyword, slideTitle: slide.title_eng, slideIdx, contentIdx: i });
        }
      }

      // Use Smart Image Agent for each slide with images
      for (let si = 0; si < slidesWithImages.length; si++) {
        const { keyword, slideTitle, slideIdx, contentIdx } = slidesWithImages[si];
        const pptSlide = allSlides[slideIdx];
        const imageElements = pptSlide.elements
          .map((el, idx) => ({ el, idx }))
          .filter(({ el }) => el.type === 'image');

        for (const { idx } of imageElements) {
          const result = await smartImageAgent.findBestImage({
            keyword,
            slideTitle,
            slideIndex: contentIdx,
          });

          if (result && result.isValid) {
            (pptSlide.elements[idx] as any).src = result.url;
            usedImageUrls.add(result.url);
          }
        }

        const pct = 59 + Math.floor(((si + 1) / slidesWithImages.length) * 13);
        progress(Math.min(pct, 72), `Smart image ${si + 1}/${slidesWithImages.length}`);
      }
    });

    steps.push({
      stepName: 'smart_images', stepOrder: 6, durationMs: imageMs, status: 'completed',
      details: { imagesFound: usedImageUrls.size },
    });
    progress(72, `${usedImageUrls.size} images found`);

    // ===== Step 7: Color Harmony Check (72-76%) =====
    progress(73, 'Checking color harmony');

    const { result: harmonyResult, durationMs: harmonyMs } = timedSync(() => {
      const harmonyAgent = new ColorHarmonyAgent(theme);
      return harmonyAgent.harmonize(allSlides);
    });

    steps.push({
      stepName: 'color_harmony', stepOrder: 7, durationMs: harmonyMs, status: 'completed',
      details: {
        contrastIssues: harmonyResult.issuesFound,
        contrastFixed: harmonyResult.issuesFixed,
        chartColorsFixed: harmonyResult.chartColorsFixed,
      },
    });
    progress(76, `Color harmony: ${harmonyResult.issuesFixed} contrast fixes`);

    // ===== Step 8: Quality review (76-82%) =====
    progress(77, 'Reviewing slide quality');

    const slidesJson = allSlides.map((slide, idx) => ({
      id: slide.id,
      elements: slide.elements.map((el, elIdx) => ({
        ...el,
        elementIndex: elIdx,
      })),
    }));

    const { result: reviewResult, durationMs: reviewMs } = await timed(async () => {
      const reviewer = new SlideReviewer(this.aiClient, this.logger);
      return reviewer.reviewPresentation(slidesJson, topic, language);
    });

    steps.push({
      stepName: 'review', stepOrder: 8, durationMs: reviewMs, status: 'completed',
      details: { score: reviewResult.summary.overallScore },
    });
    progress(82, `Quality review: score ${reviewResult.summary.overallScore}/100`);

    // ===== Step 9: Collision prevention (82-88%) =====
    progress(83, 'Collision prevention');

    let totalCollisionsFixed = 0;
    const { durationMs: collisionMs } = timedSync(() => {
      for (const slide of allSlides) {
        try {
          // Identify elements that should be EXCLUDED from collision detection:
          // 1. Shapes, charts, lines — non-content decorative elements
          // 2. Text elements that overlap with a shape (card content) — stat-numbers/labels inside card backgrounds
          //    These are intentionally placed on top of shapes and should NOT be moved.
          const skipIndices = new Set<number>();

          // First pass: find all shapes and their bounding boxes
          const shapeBounds: Array<{ left: number; top: number; right: number; bottom: number }> = [];
          slide.elements.forEach((el: any, idx: number) => {
            if (el.type === 'shape' || el.type === 'chart' || el.type === 'line') {
              skipIndices.add(idx);
              if (el.type === 'shape') {
                shapeBounds.push({
                  left: el.left, top: el.top,
                  right: el.left + el.width, bottom: el.top + el.height,
                });
              }
            }
          });

          // Second pass: skip text elements that are inside a shape (card layout)
          slide.elements.forEach((el: any, idx: number) => {
            if (skipIndices.has(idx) || el.type !== 'text') return;
            const elCenter = { x: el.left + el.width / 2, y: el.top + el.height / 2 };
            for (const sb of shapeBounds) {
              if (elCenter.x >= sb.left && elCenter.x <= sb.right &&
                  elCenter.y >= sb.top && elCenter.y <= sb.bottom) {
                skipIndices.add(idx); // This text is inside a card shape — don't move it
                break;
              }
            }
          });

          const contentElements: any[] = [];
          slide.elements.forEach((el: any, idx: number) => {
            if (!skipIndices.has(idx)) {
              contentElements.push(el);
            }
          });

          // Only run collision detection on free-standing content elements
          if (contentElements.length > 1) {
            const result = collisionAgent.fixAndValidate(contentElements);
            totalCollisionsFixed += result.fixesApplied;

            // Rebuild elements array: skipped in original positions + fixed content
            const newElements: any[] = [];
            let contentIdx = 0;
            for (let i = 0; i < slide.elements.length; i++) {
              if (skipIndices.has(i)) {
                newElements.push(slide.elements[i]); // Keep as-is
              } else {
                newElements.push(result.fixedElements[contentIdx]);
                contentIdx++;
              }
            }
            slide.elements = newElements as any[];
          }
        } catch (error) {
          this.logger.error('Collision fix error', error as Error);
        }
      }
    });

    steps.push({
      stepName: 'collision_prevention', stepOrder: 9,
      durationMs: collisionMs, status: 'completed',
      details: { collisionsFixed: totalCollisionsFixed },
    });
    progress(88, `Collision prevention: ${totalCollisionsFixed} fixes`);

    // ===== Step 10: Transitions + Image Placement + RTL (88-93%) =====
    progress(89, 'Applying transitions and image placement');

    const optimizedSlides = allSlides;

    // Transition Agent
    const transitionAgent = new TransitionAgent();
    const patterns = outlineResult.slides.map(s => s.pattern);
    transitionAgent.assignTransitions(optimizedSlides, patterns);

    // Image Placement Agent (handles placeholders for missing images + overlays)
    const imagePlacementAgent = new ImagePlacementAgent(theme);
    const placementResult = imagePlacementAgent.process(optimizedSlides);

    // RTL support (if needed)
    let rtlAdjustments = 0;
    if (typography.isRTL) {
      rtlAdjustments = typographyAgent.applyRTL(optimizedSlides, true);
    }

    // Apply typography fonts to all text elements
    const fontUpdates = typographyAgent.applyFonts(
      optimizedSlides,
      typography.titleFont,
      typography.bodyFont
    );

    // Add slide numbers (skip title slide, start from 2)
    const totalSlideCount = optimizedSlides.length;
    for (let i = 1; i < optimizedSlides.length; i++) {
      builder.addSlideNumber(optimizedSlides[i], i + 1, totalSlideCount);
    }

    steps.push({
      stepName: 'finalization', stepOrder: 10, durationMs: 0, status: 'completed',
      details: {
        transitions: optimizedSlides.length,
        placeholders: placementResult.placeholdersGenerated,
        overlays: placementResult.overlaysAdded,
        rtlAdjustments,
        fontUpdates,
      },
    });
    progress(93, 'Transitions and placement applied');

    // ===== Step 11: Export PPTX (93-100%) =====
    progress(94, 'Exporting PPTX');

    const sessionId = Date.now();
    const sanitizedTopic = topic
      .replace(/[^a-zA-Z0-9\u0400-\u04FF\u0600-\u06FF]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30);

    const generatedDir = path.join(process.cwd(), 'generated');
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }

    const slideName = `${sessionId}-${sanitizedTopic}.pptx`;
    const slidePath = path.join(generatedDir, slideName);

    // Save JSON
    const jsonFileName = `${sessionId}-${sanitizedTopic}.free-slides.json`;
    const jsonFilePath = path.join(generatedDir, jsonFileName);
    fs.writeFileSync(jsonFilePath, JSON.stringify(optimizedSlides, null, 2));

    const slideTheme = builder.getSlideTheme();

    const { durationMs: exportMs } = timedSync(() => {
      exportPPTX(
        optimizedSlides,
        false,
        false,
        slideTheme,
        viewport,
        slidePath
      );
    });

    steps.push({ stepName: 'export', stepOrder: 11, durationMs: exportMs, status: 'completed' });
    progress(100, 'PPTX exported successfully');

    // ===== Save to database =====
    const tokenUsage = this.aiClient.getTotalUsage();
    const fileSize = fs.existsSync(slidePath) ? fs.statSync(slidePath).size : null;
    const totalDuration = Date.now() - pipelineStart;

    const presentation = await prisma.presentation.create({
      data: {
        filename: slideName,
        filePath: `generated/${slideName}`,
        topic,
        language,
        author: author || null,
        templateId: null, // Template-free!
        fileSize,
        slideCount: optimizedSlides.length,
        pageCount: page,
        generationTime: totalDuration,
        totalTokens: tokenUsage.totalTokens || null,
        estimatedCost: tokenUsage.estimatedCost || null,
        qualityScore: reviewResult.summary.overallScore,
        validationIssues: 0,
        validationFixes: 0,
        collisionsFixed: totalCollisionsFixed,
        imagesReplaced: usedImageUrls.size,
        imagesFailed: 0,
        failedSlides: failedSlides.length,
        status: 'completed',
        metadata: {
          mode: 'template-free',
          theme: outlineResult.theme,
          fontPair: fontPairName,
          fonts: { title: typography.titleFont, body: typography.bodyFont },
          isRTL: typography.isRTL,
          hasCustomColors: !!outlineResult.customColors,
          outline: outlineResult.outline.map((o) => o.title),
          patterns: outlineResult.slides.map((s) => s.pattern),
          agents: {
            contentEnhancement: { found: enhancementResult.issuesFound, fixed: enhancementResult.issuesFixed },
            colorHarmony: { contrastFixed: harmonyResult.issuesFixed, chartFixed: harmonyResult.chartColorsFixed },
            imagePlacement: { placeholders: placementResult.placeholdersGenerated, overlays: placementResult.overlaysAdded },
            typography: { fontUpdates, rtlAdjustments },
          },
        },
      },
    });

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

    this.logger.info('Free presentation saved', {
      slideName, theme: outlineResult.theme,
      totalDuration: `${(totalDuration / 1000).toFixed(1)}s`,
    });

    return {
      success: true,
      slidePath,
      slideName,
      sessionId,
      jsonFilePath,
      jsonFileName,
      validation: { totalSlides: optimizedSlides.length, validSlides: optimizedSlides.length, fixedSlides: 0, issuesFound: 0, fixesApplied: 0 },
      collisionPrevention: { slidesFixed: 0, collisionsResolved: totalCollisionsFixed, validationErrors: 0 },
      qualityReview: {
        overallScore: reviewResult.summary.overallScore,
        imagesRemoved: reviewResult.summary.imagesRemoved,
        imagesReplaced: reviewResult.summary.imagesReplaced,
        textIssuesFixed: reviewResult.summary.textIssuesFixed,
      },
      layoutDesign: {
        slidesProcessed: optimizedSlides.length,
        fontAdjustments: fontUpdates,
        positionAdjustments: 0,
        spacingFixes: 0,
        hierarchyFixes: 0,
      },
      agents: {
        contentEnhancement: enhancementResult,
        colorHarmony: harmonyResult,
        imagePlacement: placementResult,
        transitions: { applied: optimizedSlides.length },
        typography: { titleFont: typography.titleFont, bodyFont: typography.bodyFont, isRTL: typography.isRTL, rtlAdjustments },
      },
      failedSlides,
      tokenUsage,
    };
  }

  // ============================================
  // Special content generation
  // ============================================

  private async generateSpecialContent(
    type: 'conclusion' | 'references',
    topic: string,
    language: string,
    outline: FreeOutlineResult
  ): Promise<string> {
    const outlineSummary = outline.outline.map((o) => o.title).join(', ');

    if (type === 'conclusion') {
      const result = await this.aiClient.call<{ content: string }>({
        operationName: 'freeConclusion',
        temperature: 0.6,
        responseFormat: 'json_object',
        messages: [
          {
            role: 'system',
            content: `You are writing the conclusion slide for an expert-level presentation. Return JSON: { "content": "..." }.

FORMAT: Use bullet points with "• " prefix. Write 5-6 powerful takeaways.

QUALITY RULES:
- Each takeaway must include a SPECIFIC fact, number, or real-world implication
- Start each bullet with an action verb or strong statement
- Include forward-looking insights — what will happen next in this field
- Reference specific data points mentioned in the presentation
- End with a call-to-action or thought-provoking insight
- Language: ${language}

GOOD example:
"• AI diagnostikasi 2025-yilga kelib 97% aniqlikka yetadi — shifokorlar yukini 40% kamaytiradi
• Global AI tibbiyot bozori $187B ga yetadi (2030) — hozirgi $45B dan 4x o'sish
• Asosiy to'siq: ma'lumotlar maxfiyligi va regulyativ muhit — 67% davlatlar hali qonun qabul qilmagan
• Tavsiya: tashkilotlar hozirdan AI integratsiya strategiyasini ishlab chiqishi zarur"

BAD example:
"• AI muhim
• Kelajak porloq
• Ko'p imkoniyatlar bor"`,
          },
          {
            role: 'user',
            content: `Topic: "${topic}"\nSections covered: ${outlineSummary}\n\nWrite a data-rich, actionable conclusion with specific numbers and insights.`,
          },
        ],
        fallback: () => ({ content: `• ${topic} — ${outlineSummary}` }),
      });
      return result.data.content;
    }

    // References
    const result = await this.aiClient.call<{ content: string }>({
      operationName: 'freeReferences',
      temperature: 0.5,
      responseFormat: 'json_object',
      messages: [
        {
          role: 'system',
          content: `Generate 6-8 realistic academic and industry references for a presentation. Return JSON: { "content": "..." }.

FORMAT: Each reference on a new line, numbered. Use proper academic citation format.

REQUIREMENTS:
- Mix of sources: 2-3 journal articles, 1-2 books, 1-2 industry reports, 1 conference paper
- Use REAL journal names: Nature, Science, IEEE, ACM, The Lancet, McKinsey Quarterly, Harvard Business Review
- Use REALISTIC author names (2-3 authors per source)
- Years: 2020-2025
- Include DOI or URL format where appropriate
- Include page numbers for journal articles
- For industry reports, reference real organizations (McKinsey, Gartner, WHO, World Bank)
- Language: ${language} for titles, English for journal/publisher names

GOOD: "1. Zhang, L., Kumar, A., & Smith, J. (2024). Deep Learning Applications in Medical Imaging: A Comprehensive Review. Nature Medicine, 30(4), 412-428."
BAD: "1. Author. (2024). Title. Journal."`,
        },
        {
          role: 'user',
          content: `Topic: "${topic}"\nSections covered: ${outlineSummary}\n\nGenerate realistic, properly formatted academic references.`,
        },
      ],
      fallback: () => ({ content: `1. ${topic} - Reference Guide, 2024` }),
    });
    return result.data.content;
  }
}
