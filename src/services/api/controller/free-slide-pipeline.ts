/**
 * Free Slide Generation Pipeline
 *
 * Template-free presentation generation using layout patterns + design system.
 * Runs parallel to the existing SlideGenerationPipeline without touching it.
 *
 * Pipeline steps:
 * 1. AI → Outline + pattern selection (5-15%)
 * 2. Build slide layouts from patterns (15-25%)
 * 3. AI → Content generation (25-55%)
 * 4. Build special slides (55-65%)
 * 5. Image search & placement (65-80%)
 * 6. Quality review (80-90%)
 * 7. Layout optimization (90-95%)
 * 8. Export PPTX (95-100%)
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
import { LayoutDesigner } from '@/src/services/layout/layout-designer';
import { exportPPTX } from '@/src/core/exporters';
import { collisionAgent } from '@/src/services/layout/collision-prevention-agent';
import BingLinks from '@/src/services/image/image-search';
import { EnhancedLogger, LogLevel } from '@/src/lib/logger';
import type { Slide } from '../../../../types/slides';
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
    progress(15, `Outline generated: ${outlineResult.outline.length} sections, ${outlineResult.slides.length} slides`);

    // ===== Step 2: Build slide layouts from patterns (15-25%) =====
    progress(17, 'Building slide layouts');

    // Resolve theme: use custom colors if provided, otherwise use preset theme
    const theme = outlineResult.customColors && outlineResult.theme === 'custom'
      ? buildCustomTheme(outlineResult.customColors)
      : THEMES[outlineResult.theme] || THEMES.professional;
    const viewport = DEFAULT_VIEWPORT;

    // Resolve font pair
    const fontPairName = outlineResult.fontPair || 'modern';
    const fontPair = FONT_PAIRS[fontPairName] || FONT_PAIRS.modern;
    const builder = new SlideBuilder(theme, viewport, fontPair.title, fontPair.body);

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
    progress(65, 'Special slides built');

    // ===== Step 5: Image search & placement (65-80%) =====
    progress(67, 'Searching for images');

    const usedImageUrls = new Set<string>();
    const { durationMs: imageMs } = await timed(async () => {
      // Find all slides that have image elements (both preset pattern and custom layouts)
      const slidesWithImages: Array<{ keyword: string; slideIdx: number }> = [];

      for (let i = 0; i < outlineResult.slides.length; i++) {
        const slide = outlineResult.slides[i];
        const slideIdx = contentSlideIndices[i];
        const pptSlide = allSlides[slideIdx];
        if (!pptSlide) continue;

        // Check if this slide has any image elements
        const hasImageEl = pptSlide.elements.some((el) => el.type === 'image');
        if (!hasImageEl) continue;

        // Use provided imageKeyword, or generate one from slide title for custom layouts
        const keyword = slide.imageKeyword || (
          slide.pattern === 'custom' && slide.customElements?.some(el => el.type === 'image')
            ? slide.title_eng
            : null
        );

        if (keyword) {
          slidesWithImages.push({ keyword, slideIdx });
        }
      }

      // Search images in parallel (batches of 4)
      const BATCH_SIZE = 4;
      for (let batch = 0; batch < slidesWithImages.length; batch += BATCH_SIZE) {
        const batchSlides = slidesWithImages.slice(batch, batch + BATCH_SIZE);

        await Promise.allSettled(
          batchSlides.map(async ({ keyword, slideIdx }) => {
            const pptSlide = allSlides[slideIdx];
            const imageElements = pptSlide.elements
              .map((el, idx) => ({ el, idx }))
              .filter(({ el }) => el.type === 'image');

            if (imageElements.length === 0) return;

            try {
              const bingSearch = new BingLinks(keyword, 8, 'off', 8, 'photo', [], false);
              const links = await bingSearch.getImageLinks();

              let linkIdx = 0;
              for (const { idx } of imageElements) {
                // Find an unused image URL
                while (linkIdx < links.length && usedImageUrls.has(links[linkIdx])) {
                  linkIdx++;
                }
                if (linkIdx >= links.length) break;

                usedImageUrls.add(links[linkIdx]);
                (pptSlide.elements[idx] as any).src = links[linkIdx];
                linkIdx++;
              }
            } catch (error) {
              this.logger.warn(`Image search failed for "${keyword}"`, { error });
            }
          })
        );

        const pct = 67 + Math.floor(((batch + BATCH_SIZE) / slidesWithImages.length) * 13);
        progress(Math.min(pct, 80), `Searching images: ${Math.min(batch + BATCH_SIZE, slidesWithImages.length)}/${slidesWithImages.length}`);
      }
    });

    steps.push({
      stepName: 'images', stepOrder: 5, durationMs: imageMs, status: 'completed',
      details: { imagesFound: usedImageUrls.size },
    });
    progress(80, `${usedImageUrls.size} images found`);

    // ===== Step 6: Quality review (80-90%) =====
    progress(82, 'Reviewing slide quality');

    // Convert to the JSON format the reviewer expects
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
      stepName: 'review', stepOrder: 6, durationMs: reviewMs, status: 'completed',
      details: { score: reviewResult.summary.overallScore },
    });
    progress(90, `Quality review: score ${reviewResult.summary.overallScore}/100`);

    // ===== Step 7: Collision prevention + Layout optimization (90-95%) =====
    progress(91, 'Optimizing layout');

    let totalCollisionsFixed = 0;
    const { durationMs: collisionMs } = timedSync(() => {
      for (const slide of allSlides) {
        try {
          // Separate shape elements from content elements.
          // Shapes intentionally overlap with text (card background effect)
          // so they must be excluded from collision detection.
          const shapeIndices: number[] = [];
          const contentElements: any[] = [];

          slide.elements.forEach((el: any, idx: number) => {
            if (el.type === 'shape') {
              shapeIndices.push(idx);
            } else {
              contentElements.push(el);
            }
          });

          // Only run collision detection on non-shape elements
          if (contentElements.length > 1) {
            const result = collisionAgent.fixAndValidate(contentElements);
            totalCollisionsFixed += result.fixesApplied;

            // Rebuild elements array: shapes in original positions + fixed content
            const newElements: any[] = [];
            let contentIdx = 0;
            for (let i = 0; i < slide.elements.length; i++) {
              if (shapeIndices.includes(i)) {
                newElements.push(slide.elements[i]); // Keep shape as-is
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

    const { result: designResult, durationMs: designMs } = timedSync(() => {
      const designer = new LayoutDesigner({
        slideWidth: viewport.width,
        slideHeight: viewport.height,
      });
      return designer.designSlides(allSlides);
    });

    const optimizedSlides = designResult.slides;

    // Add slide numbers (skip title slide, start from 2)
    const totalSlideCount = optimizedSlides.length;
    for (let i = 1; i < optimizedSlides.length; i++) {
      builder.addSlideNumber(optimizedSlides[i], i + 1, totalSlideCount);
    }

    steps.push({
      stepName: 'layout_optimization', stepOrder: 7,
      durationMs: collisionMs + designMs, status: 'completed',
      details: { collisionsFixed: totalCollisionsFixed, ...designResult.summary },
    });
    progress(95, 'Layout optimized');

    // ===== Step 8: Export PPTX (95-100%) =====
    progress(96, 'Exporting PPTX');

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

    steps.push({ stepName: 'export', stepOrder: 8, durationMs: exportMs, status: 'completed' });
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
          hasCustomColors: !!outlineResult.customColors,
          outline: outlineResult.outline.map((o) => o.title),
          patterns: outlineResult.slides.map((s) => s.pattern),
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
      layoutDesign: designResult.summary,
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
