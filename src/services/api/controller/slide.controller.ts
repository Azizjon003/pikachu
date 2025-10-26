import ImageReplacerService from "@/src/services/image/image-replacer";
import {
  generateConculation,
  generateContent,
  generateOutline,
  generateReferences,
  generateThankYouSlide,
} from "@/src/core/generators/structured-generator";
import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { generateSlideFromAI } from "@/src/core/processors";
import { sleep } from "../utils/utils";
import { exportPPTX } from "@/src/core/exporters";
import {
  findTitleElement,
  findAuthorElement,
  findOutlineHeaderElement,
  findOutlineItemElements,
} from "../utils/slide-detector";
import { placeOutlineWithAI } from "../utils/ai-outline-placer";
import TextPlacementValidator from "@/src/services/validation/text-placement-validator";
import { AISlidePlacer } from "../utils/ai-slide-placer";
import AITextLayoutOptimizer from "@/src/services/layout/ai-layout-optimizer";
import {
  createTask,
  getTask,
  updateTask,
} from "@/src/services/api/services/task.service";

// ===== NEW OPTIMIZED SERVICES =====
import { AdaptiveBatchProcessor } from "@/src/services/optimization/adaptive-batch-processor";
import { ParallelImageProcessor } from "@/src/services/optimization/parallel-image-processor";
import { SmartTextLayoutEngine } from "@/src/services/optimization/smart-text-layout-engine";
import { PerformanceMonitor } from "@/src/services/optimization/performance-monitor";
import { contentCache } from "@/src/services/optimization/smart-cache";

interface GenerationParams {
  template: string;
  language: string;
  page: number;
  topic: string;
  author: string;
}

const processSlideGeneration = async (
  taskId: string,
  params: GenerationParams
) => {
  // Initialize performance monitoring
  const perfMonitor = new PerformanceMonitor();
  perfMonitor.start(params.page);

  try {
    const { template, language, page, topic, author } = params;
    updateTask(taskId, { status: "processing", progress: 5 });

    perfMonitor.startStage('Template Loading');

    // Generate unique session ID and sanitized topic for file naming
    const sessionId = Date.now();
    const sanitizedTopic = topic
      .replace(/[^a-zA-Z0-9\u0400-\u04FF\u0600-\u06FF]/g, "-") // Latin, Cyrillic, Arabic scripts
      .replace(/-+/g, "-") // Replace multiple dashes with single dash
      .replace(/^-|-$/g, "") // Remove leading/trailing dashes
      .substring(0, 30);

    const templateData = fs.readFileSync(
      path.join(process.cwd(), "templates", template),
      "utf-8"
    );

    const aiSchema = JSON.parse(templateData);
    const fullSxema = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "templates",
          template.replace(".sxema.json", ".json")
        ),
        "utf-8"
      )
    );
    perfMonitor.endStage('Template Loading');
    updateTask(taskId, { progress: 10 });

    perfMonitor.startStage('Outline Generation');
    const outline = await generateOutline(aiSchema, language, page, topic);
    perfMonitor.endStage('Outline Generation');
    updateTask(taskId, { progress: 20 });
    // Initialize AI Slide Placer
    const aiPlacer = new AISlidePlacer();

    // Use AI to intelligently place title and author on first slide
    console.log("\n📄 Processing First Slide (Title Page)...");
    const firstSlide = await aiPlacer.placeTitlePage(
      aiSchema[0],
      topic,
      author
    );

    // Use AI to intelligently place outline on second slide
    console.log("\n📄 Processing Second Slide (Outline Page)...");
    const outlineTitlesForSecondSlide = outline.outline.map(
      (item: any) => item.title
    );
    const secondSlide = await aiPlacer.placeOutline(
      aiSchema[1],
      outlineTitlesForSecondSlide
    );
    updateTask(taskId, { progress: 25 });
    // Filter remaining slides (skip first 2 and last 3)
    const filteredSchema = aiSchema.filter(
      (slide: any) =>
        slide.index !== 0 &&
        slide.index !== 1 &&
        slide.index !== aiSchema.length - 3 &&
        slide.index !== aiSchema.length - 2 &&
        slide.index !== aiSchema.length - 1
    );

    const slidesToFill = outline.slides.map(
      (outlineSlide: any) => filteredSchema[outlineSlide.slideIndex]
    );

    let allFilledSlides = [];
    allFilledSlides.push(firstSlide);
    allFilledSlides.push(secondSlide);
    console.log(outline, "slidesToFill");

    // Parallel content generation for all content slides
    console.log(
      `🚀 Generating ${slidesToFill.length} content slides in parallel...`
    );
    const contentPromises = slidesToFill.map((slide, i) => {
      console.log(`📄 Starting content generation for slide ${i + 3}...`);
      return generateContent(slide, outline.slides[i], "Uzbek", topic);
    });

    const contentSlides = await Promise.all(contentPromises);
    allFilledSlides.push(...contentSlides);
    console.log(
      `✅ All ${contentSlides.length} content slides generated in parallel!`
    );
    updateTask(taskId, { progress: 40 });
    // Generate additional slides with AI placer in parallel for maximum efficiency
    console.log(
      "🚀 Generating additional slides (conclusion, references, thank you) with AI placer in parallel..."
    );

    const [conclusionSlide, referencesSlide, thankYouSlide] = await Promise.all(
      [
        aiPlacer.placeConclusion(
          aiSchema[aiSchema.length - 3],
          topic,
          language
        ),
        aiPlacer.placeReferences(
          aiSchema[aiSchema.length - 2],
          topic,
          5,
          language
        ),
        aiPlacer.placeThankYou(aiSchema[aiSchema.length - 1], language),
      ]
    );

    console.log(
      "✅ All additional slides generated with AI placer in parallel!"
    );
    updateTask(taskId, { progress: 50 });
    // Add additional slides to the end
    allFilledSlides.push(conclusionSlide);
    allFilledSlides.push(referencesSlide);
    allFilledSlides.push(thankYouSlide);
    // Use unique filename based on sessionId and topic
    const uniqueFilename = `${sessionId}-${sanitizedTopic}.full-filled-slides.json`;
    const fullFilledSlides = path.join(
      process.cwd(),
      "generated",
      uniqueFilename
    );

    // Ensure generated directory exists before writing
    if (!fs.existsSync(path.join(process.cwd(), "generated"))) {
      fs.mkdirSync(path.join(process.cwd(), "generated"), { recursive: true });
    }

    fs.writeFileSync(
      fullFilledSlides,
      JSON.stringify(allFilledSlides, null, 2)
    );
    console.log("✅ All filled slides saved\n");

    await sleep(1000);
    updateTask(taskId, { progress: 55 });
    // 9. Replace edited images with Bing search results
    console.log("🖼️  Replacing edited images...");
    const imageReplacer = new ImageReplacerService(
      fullFilledSlides,
      "./images"
    );

    const replacementResults = await imageReplacer.replaceEditedImages();

    console.log(`\n📊 Image Replacement Summary:`);
    console.log(`   - Total images processed: ${replacementResults.total}`);
    console.log(`   - Successfully replaced: ${replacementResults.successful}`);
    console.log(`   - Failed: ${replacementResults.failed}`);
    console.log(
      `   - Duplicate URLs avoided: ${replacementResults.duplicatesAvoided}`
    );
    console.log(`   - Unique images used: ${replacementResults.successful}`);

    if (replacementResults.failed > 0) {
      console.log(`\n⚠️  Failure Breakdown:`);
      console.log(
        `   - All search attempts failed: ${replacementResults.failureReasons.allAttemptsFailed}`
      );
    }

    if (replacementResults.errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      replacementResults.errors.forEach((error: any, index: any) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    updateTask(taskId, { progress: 65 });
    const allFilledSlidesFromData = fs.readFileSync(fullFilledSlides, "utf-8");
    let allFilledSlidesFromDataJson = JSON.parse(allFilledSlidesFromData);

    // ===== POST-GENERATION VALIDATION STEP =====
    console.log("\n🔍 Starting post-generation validation...");
    const validator = new TextPlacementValidator();

    // Extract outline titles for validation
    const outlineTitles = outline.outline.map((item: any) => item.title);

    const validationResult = await validator.validatePresentation(
      allFilledSlidesFromDataJson,
      topic,
      author,
      outlineTitles
    );

    // Print validation report
    validator.printValidationReport(validationResult);
    updateTask(taskId, { progress: 75 });
    // Use validated (and potentially fixed) slides
    if (validationResult.fixedSlides > 0) {
      console.log(
        `\n✅ Applied fixes to ${validationResult.fixedSlides} slides`
      );
      allFilledSlidesFromDataJson = validationResult.validatedSlides;

      // Save validated slides
      fs.writeFileSync(
        fullFilledSlides,
        JSON.stringify(allFilledSlidesFromDataJson, null, 2)
      );
      console.log("✅ Validated slides saved\n");
    }
    // ===== END VALIDATION STEP =====

    // ===== OVERLAP DETECTION & OPTIMIZATION STEP (ADAPTIVE PARALLEL) =====
    console.log(
      "\n🔍 Starting SMART layout optimization with adaptive batching..."
    );
    updateTask(taskId, { progress: 85 });
    // Get viewport dimensions from schema
    const viewportWidth = fullSxema.viewportWidth || 1920;
    const viewportHeight = fullSxema.viewportHeight || 1080;

    // Use FAST Smart Layout Engine instead of slow AI-based optimizer
    const smartLayoutEngine = new SmartTextLayoutEngine(
      viewportWidth,
      viewportHeight
    );

    // Fallback AI optimizer for complex cases only
    const aiLayoutOptimizer = new AITextLayoutOptimizer(
      viewportWidth,
      viewportHeight
    );

    // Create adaptive batch processor (dynamic batch size: 2-10)
    const batchProcessor = new AdaptiveBatchProcessor({
      minBatchSize: 2,
      maxBatchSize: 10,
      targetProcessingTime: 20000, // 20 seconds per batch
      adaptiveScaling: true
    });
    let totalOverlapsFix = 0;
    let totalSlidesFix = 0;
    let totalFastOptimizations = 0;
    let totalAIOptimizations = 0;

    // Use adaptive batch processor with smart+fast layout optimization
    const optimizationResults = await batchProcessor.processBatches(
      allFilledSlidesFromDataJson,
      async (slide: any, slideIndex: number) => {
        try {
          console.log(`   📄 Optimizing slide ${slideIndex + 1}...`);

          // First, try FAST smart layout engine (no AI, 100x faster)
          const smartResult = smartLayoutEngine.optimizeLayout(slide.elements);

          // Check if smart engine solved all issues
          const validation = smartLayoutEngine.validateLayout(smartResult.optimizedElements);

          if (!validation.hasIssues || smartResult.improvements > 0) {
            // Smart engine succeeded! Use its results
            totalFastOptimizations++;
            console.log(
              `   ✅ FAST optimization: ${smartResult.improvements} fixes in ${smartResult.processingTime.toFixed(0)}ms`
            );

            return {
              slideIndex,
              success: true,
              elements: smartResult.optimizedElements,
              improvements: smartResult.improvements,
              method: 'smart',
              processingTime: smartResult.processingTime
            };
          } else {
            // Complex case - use AI optimizer as fallback
            console.log(`   🤖 Complex layout detected, using AI optimizer...`);
            const aiResult = await aiLayoutOptimizer.optimizeLayout(slide.elements);
            totalAIOptimizations++;

            return {
              slideIndex,
              success: aiResult.success,
              elements: aiResult.optimizedElements,
              improvements: aiResult.appliedFixes.length,
              method: 'ai',
              improvementScore: aiResult.improvementScore
            };
          }
        } catch (error) {
          console.error(`   ❌ Error optimizing slide ${slideIndex + 1}:`, error);
          return {
            slideIndex,
            success: false,
            elements: slide.elements,
            improvements: 0,
            error
          };
        }
      },
      {
        onBatchStart: (batchIndex, batchSize, totalBatches) => {
          console.log(
            `\n🔄 Batch ${batchIndex + 1}/${totalBatches}: Processing ${batchSize} slides...`
          );
        },
        onBatchComplete: (batchIndex, result) => {
          const avgTime = result.processingTime / result.results.length;
          console.log(
            `✓ Batch ${batchIndex + 1} complete: ${result.results.length} slides in ${result.processingTime.toFixed(0)}ms (avg: ${avgTime.toFixed(0)}ms/slide)\n`
          );
        },
        onProgress: (completed, total) => {
          const progressPercent = 85 + Math.floor((completed / total) * 10);
          updateTask(taskId, { progress: progressPercent });
        }
      }
    );

    // Apply optimization results to slides
    for (const result of optimizationResults) {
      if (result.success && result.improvements > 0) {
        allFilledSlidesFromDataJson[result.slideIndex].elements = result.elements;
        totalOverlapsFix += result.improvements;
        totalSlidesFix++;
      }
    }

    console.log(
      "\n╔═══════════════════════════════════════════════════════════╗"
    );
    console.log("║          Layout Optimization Summary                     ║");
    console.log(
      "╚═══════════════════════════════════════════════════════════╝"
    );
    console.log(
      `\n   Total Slides Analyzed: ${allFilledSlidesFromDataJson.length}`
    );
    console.log(`   Slides Optimized: ${totalSlidesFix}`);
    console.log(`   Total Fixes Applied: ${totalOverlapsFix}`);
    console.log(`   FAST Optimizations: ${totalFastOptimizations} (${((totalFastOptimizations / allFilledSlidesFromDataJson.length) * 100).toFixed(1)}%)`);
    console.log(`   AI Optimizations: ${totalAIOptimizations} (${((totalAIOptimizations / allFilledSlidesFromDataJson.length) * 100).toFixed(1)}%)`);
    console.log(
      `   Processing Mode: ADAPTIVE PARALLEL (2-10 slides per batch)`
    );
    console.log("");
    updateTask(taskId, { progress: 95 });
    // Save optimized slides
    if (totalSlidesFix > 0) {
      fs.writeFileSync(
        fullFilledSlides,
        JSON.stringify(allFilledSlidesFromDataJson, null, 2)
      );
      console.log("✅ Optimized slides saved\n");
    }
    // ===== END OVERLAP DETECTION & OPTIMIZATION STEP =====

    const dataFullSxema = generateSlideFromAI(
      allFilledSlidesFromDataJson,
      fullSxema
    );
    // Use same sessionId for PPTX file to match JSON file
    const slideName = `${sessionId}-${sanitizedTopic}.pptx`;
    if (!fs.existsSync(path.join(process.cwd(), "generated"))) {
      fs.mkdirSync(path.join(process.cwd(), "generated"), { recursive: true });
    }
    await sleep(1000);
    const slidePath = path.join(process.cwd(), "generated", slideName);
    exportPPTX(
      dataFullSxema.slide,
      false,
      false,
      dataFullSxema.theme,
      {
        width: dataFullSxema.viewportWidth,
        height: dataFullSxema.viewportHeight,
      },
      slidePath
    );

    await sleep(500);
    updateTask(taskId, { progress: 100 });
    const result = {
      success: true,
      slidePath,
      message: "Slide generated successfully",
      slideName,
      sessionId,
      jsonFilePath: fullFilledSlides,
      jsonFileName: uniqueFilename,
      validation: {
        totalSlides: validationResult.totalSlides,
        validSlides: validationResult.validSlides,
        fixedSlides: validationResult.fixedSlides,
        issuesFound: validationResult.issues.length,
        fixesApplied: validationResult.fixes.length,
      },
      overlapOptimization: {
        slidesOptimized: totalSlidesFix,
        totalSlides: allFilledSlidesFromDataJson.length,
        fixesApplied: totalOverlapsFix,
      },
    };

    updateTask(taskId, {
      status: "completed",
      progress: 100,
      result,
    });
  } catch (error: any) {
    console.log(error);
    updateTask(taskId, {
      status: "failed",
      error: error.message,
    });
  }
};

export const startSlideGeneration = async (req: Request, res: Response) => {
  const params: GenerationParams = req.body;
  const taskId = crypto.randomBytes(16).toString("hex");

  createTask(taskId);

  // Don't await this, let it run in the background
  processSlideGeneration(taskId, params);

  res.status(202).json({
    success: true,
    message: "Slide generation started",
    taskId,
  });
};

export const getSlideGenerationStatus = async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const task = getTask(taskId);

  if (!task) {
    return res.status(404).json({ success: false, message: "Task not found" });
  }

  res.json({
    success: true,
    task,
  });
};

export const generateSlide = async (req: Request, res: Response) => {
  try {
    const { template, language, page, topic, author } = req.body;

    // Generate unique session ID and sanitized topic for file naming
    const sessionId = Date.now();
    const sanitizedTopic = topic
      .replace(/[^a-zA-Z0-9\u0400-\u04FF\u0600-\u06FF]/g, "-") // Latin, Cyrillic, Arabic scripts
      .replace(/-+/g, "-") // Replace multiple dashes with single dash
      .replace(/^-|-$/g, "") // Remove leading/trailing dashes
      .substring(0, 30);

    const templateData = fs.readFileSync(
      path.join(process.cwd(), "templates", template),
      "utf-8"
    );

    const aiSchema = JSON.parse(templateData);
    const fullSxema = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "templates",
          template.replace(".sxema.json", ".json")
        ),
        "utf-8"
      )
    );
    const outline = await generateOutline(aiSchema, language, page, topic);

    // Initialize AI Slide Placer
    const aiPlacer = new AISlidePlacer();

    // Use AI to intelligently place title and author on first slide
    console.log("\n📄 Processing First Slide (Title Page)...");
    const firstSlide = await aiPlacer.placeTitlePage(
      aiSchema[0],
      topic,
      author
    );

    // Use AI to intelligently place outline on second slide
    console.log("\n📄 Processing Second Slide (Outline Page)...");
    const outlineTitlesForSecondSlide = outline.outline.map(
      (item: any) => item.title
    );
    const secondSlide = await aiPlacer.placeOutline(
      aiSchema[1],
      outlineTitlesForSecondSlide
    );

    // Filter remaining slides (skip first 2 and last 3)
    const filteredSchema = aiSchema.filter(
      (slide: any) =>
        slide.index !== 0 &&
        slide.index !== 1 &&
        slide.index !== aiSchema.length - 3 &&
        slide.index !== aiSchema.length - 2 &&
        slide.index !== aiSchema.length - 1
    );

    const slidesToFill = outline.slides.map(
      (outlineSlide: any) => filteredSchema[outlineSlide.slideIndex]
    );

    let allFilledSlides = [];
    allFilledSlides.push(firstSlide);
    allFilledSlides.push(secondSlide);
    console.log(outline, "slidesToFill");

    // Parallel content generation for all content slides
    console.log(
      `🚀 Generating ${slidesToFill.length} content slides in parallel...`
    );
    const contentPromises = slidesToFill.map((slide, i) => {
      console.log(`📄 Starting content generation for slide ${i + 3}...`);
      return generateContent(slide, outline.slides[i], "Uzbek", topic);
    });

    const contentSlides = await Promise.all(contentPromises);
    allFilledSlides.push(...contentSlides);
    console.log(
      `✅ All ${contentSlides.length} content slides generated in parallel!`
    );

    // Generate additional slides with AI placer in parallel for maximum efficiency
    console.log(
      "🚀 Generating additional slides (conclusion, references, thank you) with AI placer in parallel..."
    );

    const [conclusionSlide, referencesSlide, thankYouSlide] = await Promise.all(
      [
        aiPlacer.placeConclusion(
          aiSchema[aiSchema.length - 3],
          topic,
          language
        ),
        aiPlacer.placeReferences(
          aiSchema[aiSchema.length - 2],
          topic,
          5,
          language
        ),
        aiPlacer.placeThankYou(aiSchema[aiSchema.length - 1], language),
      ]
    );

    console.log(
      "✅ All additional slides generated with AI placer in parallel!"
    );

    // Add additional slides to the end
    allFilledSlides.push(conclusionSlide);
    allFilledSlides.push(referencesSlide);
    allFilledSlides.push(thankYouSlide);
    // Use unique filename based on sessionId and topic
    const uniqueFilename = `${sessionId}-${sanitizedTopic}.full-filled-slides.json`;
    const fullFilledSlides = path.join(
      process.cwd(),
      "generated",
      uniqueFilename
    );

    // Ensure generated directory exists before writing
    if (!fs.existsSync(path.join(process.cwd(), "generated"))) {
      fs.mkdirSync(path.join(process.cwd(), "generated"), { recursive: true });
    }

    fs.writeFileSync(
      fullFilledSlides,
      JSON.stringify(allFilledSlides, null, 2)
    );
    console.log("✅ All filled slides saved\n");

    await sleep(1000);
    // 9. Replace edited images with Bing search results
    console.log("🖼️  Replacing edited images...");
    const imageReplacer = new ImageReplacerService(
      fullFilledSlides,
      "./images"
    );

    const replacementResults = await imageReplacer.replaceEditedImages();

    console.log(`\n📊 Image Replacement Summary:`);
    console.log(`   - Total images processed: ${replacementResults.total}`);
    console.log(`   - Successfully replaced: ${replacementResults.successful}`);
    console.log(`   - Failed: ${replacementResults.failed}`);
    console.log(
      `   - Duplicate URLs avoided: ${replacementResults.duplicatesAvoided}`
    );
    console.log(`   - Unique images used: ${replacementResults.successful}`);

    if (replacementResults.failed > 0) {
      console.log(`\n⚠️  Failure Breakdown:`);
      console.log(
        `   - All search attempts failed: ${replacementResults.failureReasons.allAttemptsFailed}`
      );
    }

    if (replacementResults.errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      replacementResults.errors.forEach((error: any, index: any) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    const allFilledSlidesFromData = fs.readFileSync(fullFilledSlides, "utf-8");
    let allFilledSlidesFromDataJson = JSON.parse(allFilledSlidesFromData);

    // ===== POST-GENERATION VALIDATION STEP =====
    console.log("\n🔍 Starting post-generation validation...");
    const validator = new TextPlacementValidator();

    // Extract outline titles for validation
    const outlineTitles = outline.outline.map((item: any) => item.title);

    const validationResult = await validator.validatePresentation(
      allFilledSlidesFromDataJson,
      topic,
      author,
      outlineTitles
    );

    // Print validation report
    validator.printValidationReport(validationResult);

    // Use validated (and potentially fixed) slides
    if (validationResult.fixedSlides > 0) {
      console.log(
        `\n✅ Applied fixes to ${validationResult.fixedSlides} slides`
      );
      allFilledSlidesFromDataJson = validationResult.validatedSlides;

      // Save validated slides
      fs.writeFileSync(
        fullFilledSlides,
        JSON.stringify(allFilledSlidesFromDataJson, null, 2)
      );
      console.log("✅ Validated slides saved\n");
    }
    // ===== END VALIDATION STEP =====

    // ===== OVERLAP DETECTION & OPTIMIZATION STEP (PARALLEL) =====
    console.log(
      "\n🔍 Starting parallel overlap detection and layout optimization..."
    );

    // Get viewport dimensions from schema
    const viewportWidth = fullSxema.viewportWidth || 1920;
    const viewportHeight = fullSxema.viewportHeight || 1080;

    const layoutOptimizer = new AITextLayoutOptimizer(
      viewportWidth,
      viewportHeight
    );

    // Optimize slides in parallel batches to avoid rate limiting
    const BATCH_SIZE = 3; // Process 3 slides at a time
    let totalOverlapsFix = 0;
    let totalSlidesFix = 0;

    // Split slides into batches
    const batches: number[][] = [];
    for (let i = 0; i < allFilledSlidesFromDataJson.length; i += BATCH_SIZE) {
      batches.push(
        Array.from(
          {
            length: Math.min(
              BATCH_SIZE,
              allFilledSlidesFromDataJson.length - i
            ),
          },
          (_, j) => i + j
        )
      );
    }

    console.log(
      `   Processing ${allFilledSlidesFromDataJson.length} slides in ${batches.length} parallel batches...\n`
    );

    // Process each batch in parallel
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(
        `🔄 Batch ${batchIndex + 1}/${batches.length}: Optimizing slides ${
          batch[0] + 1
        }-${batch[batch.length - 1] + 1} in parallel...`
      );

      // Create optimization promises for all slides in batch
      const optimizationPromises = batch.map(async (slideIndex) => {
        const slide = allFilledSlidesFromDataJson[slideIndex];

        try {
          console.log(
            `   📄 Starting optimization for slide ${slideIndex + 1}...`
          );

          // Optimize layout for this slide
          const optimizationResult = await layoutOptimizer.optimizeLayout(
            slide.elements
          );

          return {
            slideIndex,
            success: true,
            result: optimizationResult,
          };
        } catch (error) {
          console.error(
            `   ❌ Error optimizing slide ${slideIndex + 1}:`,
            error
          );
          return {
            slideIndex,
            success: false,
            error,
          };
        }
      });

      // Wait for all slides in this batch to complete
      const batchResults = await Promise.all(optimizationPromises);

      // Apply results
      for (const { slideIndex, success, result, error } of batchResults) {
        if (success && result) {
          // Apply optimized elements if improvements were made
          if (result.success && result.appliedFixes.length > 0) {
            allFilledSlidesFromDataJson[slideIndex].elements =
              result.optimizedElements;
            totalOverlapsFix += result.appliedFixes.length;
            totalSlidesFix++;
            console.log(
              `   ✅ Slide ${slideIndex + 1}: ${
                result.appliedFixes.length
              } fixes applied (${result.improvementScore.toFixed(
                1
              )}% improvement)`
            );
          } else if (!result.originalAnalysis.hasIssues) {
            console.log(`   ✅ Slide ${slideIndex + 1}: No issues detected`);
          } else {
            console.log(
              `   ⚠️  Slide ${
                slideIndex + 1
              }: Some issues remain but acceptable`
            );
          }
        }
      }

      console.log(`✓ Batch ${batchIndex + 1} completed\n`);

      // Small delay between batches to avoid rate limiting
      if (batchIndex < batches.length - 1) {
        await sleep(1500);
      }
    }

    console.log(
      "\n╔═══════════════════════════════════════════════════════════╗"
    );
    console.log("║          Layout Optimization Summary                     ║");
    console.log(
      "╚═══════════════════════════════════════════════════════════╝"
    );
    console.log(
      `\n   Total Slides Analyzed: ${allFilledSlidesFromDataJson.length}`
    );
    console.log(`   Slides Optimized: ${totalSlidesFix}`);
    console.log(`   Total Fixes Applied: ${totalOverlapsFix}`);
    console.log(
      `   Processing Mode: PARALLEL (${BATCH_SIZE} slides per batch)`
    );
    console.log("");

    // Save optimized slides
    if (totalSlidesFix > 0) {
      fs.writeFileSync(
        fullFilledSlides,
        JSON.stringify(allFilledSlidesFromDataJson, null, 2)
      );
      console.log("✅ Optimized slides saved\n");
    }
    // ===== END OVERLAP DETECTION & OPTIMIZATION STEP =====

    const dataFullSxema = generateSlideFromAI(
      allFilledSlidesFromDataJson,
      fullSxema
    );
    // Use same sessionId for PPTX file to match JSON file
    const slideName = `${sessionId}-${sanitizedTopic}.pptx`;
    if (!fs.existsSync(path.join(process.cwd(), "generated"))) {
      fs.mkdirSync(path.join(process.cwd(), "generated"), { recursive: true });
    }
    await sleep(1000);
    const slidePath = path.join(process.cwd(), "generated", slideName);
    exportPPTX(
      dataFullSxema.slide,
      false,
      false,
      dataFullSxema.theme,
      {
        width: dataFullSxema.viewportWidth,
        height: dataFullSxema.viewportHeight,
      },
      slidePath
    );

    await sleep(500);

    res.json({
      success: true,
      slidePath,
      message: "Slide generated successfully",
      slideName,
      sessionId,
      jsonFilePath: fullFilledSlides,
      jsonFileName: uniqueFilename,
      validation: {
        totalSlides: validationResult.totalSlides,
        validSlides: validationResult.validSlides,
        fixedSlides: validationResult.fixedSlides,
        issuesFound: validationResult.issues.length,
        fixesApplied: validationResult.fixes.length,
      },
      overlapOptimization: {
        slidesOptimized: totalSlidesFix,
        totalSlides: allFilledSlidesFromDataJson.length,
        fixesApplied: totalOverlapsFix,
      },
    });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ success: false, error: error.message });
  }
};
