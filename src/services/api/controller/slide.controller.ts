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

export const generateSlide = async (req: Request, res: Response) => {
  try {
    const { template, language, page, topic, author } = req.body;

    // Generate unique session ID and sanitized topic for file naming
    const sessionId = Date.now();
    const sanitizedTopic = topic
      .replace(/[^a-zA-Z0-9\u0400-\u04FF\u0600-\u06FF]/g, '-') // Latin, Cyrillic, Arabic scripts
      .replace(/-+/g, '-') // Replace multiple dashes with single dash
      .replace(/^-|-$/g, '') // Remove leading/trailing dashes
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
    console.log('\n📄 Processing First Slide (Title Page)...');
    const firstSlide = await aiPlacer.placeTitlePage(aiSchema[0], topic, author);

    // Use AI to intelligently place outline on second slide
    console.log('\n📄 Processing Second Slide (Outline Page)...');
    const outlineTitlesForSecondSlide = outline.outline.map((item: any) => item.title);
    const secondSlide = await aiPlacer.placeOutline(aiSchema[1], outlineTitlesForSecondSlide);

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
    console.log(`🚀 Generating ${slidesToFill.length} content slides in parallel...`);
    const contentPromises = slidesToFill.map((slide, i) => {
      console.log(`📄 Starting content generation for slide ${i + 3}...`);
      return generateContent(
        slide,
        outline.slides[i],
        "Uzbek",
        topic
      );
    });

    const contentSlides = await Promise.all(contentPromises);
    allFilledSlides.push(...contentSlides);
    console.log(`✅ All ${contentSlides.length} content slides generated in parallel!`);

    // Generate additional slides with AI placer in parallel for maximum efficiency
    console.log("🚀 Generating additional slides (conclusion, references, thank you) with AI placer in parallel...");

    const [conclusionSlide, referencesSlide, thankYouSlide] = await Promise.all([
      aiPlacer.placeConclusion(aiSchema[aiSchema.length - 3], topic, language),
      aiPlacer.placeReferences(aiSchema[aiSchema.length - 2], topic, 5, language),
      aiPlacer.placeThankYou(aiSchema[aiSchema.length - 1], language)
    ]);

    console.log("✅ All additional slides generated with AI placer in parallel!");

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
    console.log('\n🔍 Starting post-generation validation...');
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
      console.log(`\n✅ Applied fixes to ${validationResult.fixedSlides} slides`);
      allFilledSlidesFromDataJson = validationResult.validatedSlides;

      // Save validated slides
      fs.writeFileSync(
        fullFilledSlides,
        JSON.stringify(allFilledSlidesFromDataJson, null, 2)
      );
      console.log('✅ Validated slides saved\n');
    }
    // ===== END VALIDATION STEP =====

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
        fixesApplied: validationResult.fixes.length
      }
    });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ success: false, error: error.message });
  }
};
