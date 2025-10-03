/**
 * Enhanced Test Script
 * Demonstrates the integrated slide generation system with full metrics and reporting
 */

import fs from "fs";
import {
  generateOutline,
  generateContent,
  generateConculation,
  generateReferences,
  generateThankYouSlide,
  integratedGenerator,
} from "./llma-structured-enhanced";

const start = async () => {
  console.log("\n" + "=".repeat(60));
  console.log("  ENHANCED SLIDE GENERATION SYSTEM");
  console.log("=".repeat(60) + "\n");

  const startTime = Date.now();

  try {
    // 1. Load schemas
    console.log("📂 Loading slide schemas...");
    const fullschema = JSON.parse(fs.readFileSync("Amir.json", "utf-8")).slide;
    let aiSchema = JSON.parse(fs.readFileSync("Amir.sxema.json", "utf-8"));
    const topic = "Nerv tizimi o'smalari";

    console.log(`   ✓ Loaded ${fullschema.length} full slides`);
    console.log(`   ✓ Loaded ${aiSchema.length} AI schema slides\n`);

    // 2. Generate outline with integrated system
    console.log("📝 Generating outline with integrated system...");
    console.log("─".repeat(60));

    const outline = await generateOutline(
      aiSchema,
      "Uzbek",
      5, // Select 5 slides
      topic
    );

    fs.writeFileSync("Amir.outline.json", JSON.stringify(outline, null, 2));
    console.log("✅ Outline saved to Amir.outline.json\n");

    // 3. Prepare first two slides
    console.log("🔧 Preparing title and outline slides...");

    const firstSlide = {
      ...aiSchema[0],
      elements: aiSchema[0].elements.map((element: any) => {
        if (element.type === "shape" && element.elementIndex === 5) {
          return {
            ...element,
            content: outline.outline[0].title.split(" ").slice(0, 3).join(" "),
          };
        }
        return element;
      }),
    };

    const secondSlide = {
      ...aiSchema[1],
      elements: aiSchema[1].elements.map((element: any) => {
        if (element.type === "shape" && element.elementIndex === 26) {
          return { ...element, content: "Reja: " };
        }
        if (element.type === "shape" && element.elementIndex === 34) {
          return { ...element, content: `1. ${outline.outline[0].title}` };
        }
        if (element.type === "shape" && element.elementIndex === 36) {
          return { ...element, content: `2. ${outline.outline[1].title}` };
        }
        if (element.type === "shape" && element.elementIndex === 38) {
          return { ...element, content: `3. ${outline.outline[2].title}` };
        }
        return element;
      }),
    };

    console.log("   ✓ Title slide prepared");
    console.log("   ✓ Outline slide prepared\n");

    // Filter slides
    const filteredSchema = aiSchema.filter(
      (slide: any) =>
        slide.index !== 0 &&
        slide.index !== 1 &&
        slide.index !== aiSchema.length - 3 &&
        slide.index !== aiSchema.length - 2 &&
        slide.index !== aiSchema.length - 1
    );

    const filteredSchemaFull = fullschema.filter(
      (slide: any) =>
        slide.index !== 0 &&
        slide.index !== 1 &&
        slide.index !== fullschema.length - 3 &&
        slide.index !== fullschema.length - 2 &&
        slide.index !== fullschema.length - 1
    );

    // 4. Get slides to fill
    const slidesToFill = outline.slides.map(
      (outlineSlide: any) => filteredSchema[outlineSlide.slideIndex]
    );

    const slidesToFillFull = outline.slides.map(
      (outlineSlide: any) => filteredSchemaFull[outlineSlide.slideIndex]
    );

    // Initialize result array
    let allFilledSlides = [];
    allFilledSlides.push(firstSlide);
    allFilledSlides.push(secondSlide);

    fs.writeFileSync(
      "Amir.filled-slide-0.json",
      JSON.stringify(firstSlide, null, 2)
    );
    fs.writeFileSync(
      "Amir.filled-slide-1.json",
      JSON.stringify(secondSlide, null, 2)
    );

    // 5. Generate content for slides with integrated system
    console.log(`📄 Generating content for ${slidesToFill.length} slides...`);
    console.log("─".repeat(60));

    for (let i = 0; i < slidesToFill.length; i++) {
      const slide = slidesToFill[i];
      const slideFull = slidesToFillFull[i];
      const outlineForSlide = outline.slides[i];

      console.log(`\n🔄 Processing Slide ${i + 3}/${slidesToFill.length + 2}`);
      console.log(`   Topic: ${outlineForSlide.title}`);

      const filledSlide = await generateContent(slide, outlineForSlide, "Uzbek");
      allFilledSlides.push(filledSlide);

      fs.writeFileSync(
        `Amir.filled-slide-${i + 2}.json`,
        JSON.stringify(filledSlide, null, 2)
      );

      console.log(`   ✅ Slide ${i + 3} completed\n`);

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // 6. Generate special slides
    console.log("─".repeat(60));
    console.log("📄 Generating special slides...\n");

    console.log("🔄 Generating conclusion slide...");
    const consultationSlide = await generateConculation(
      topic,
      "Uzbek",
      aiSchema[aiSchema.length - 3]
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("   ✅ Conclusion slide completed\n");

    console.log("🔄 Generating references slide...");
    const referencesSlide = await generateReferences(
      topic,
      "Uzbek",
      5,
      aiSchema[aiSchema.length - 2]
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("   ✅ References slide completed\n");

    console.log("🔄 Generating thank you slide...");
    const thankYouSlide = await generateThankYouSlide(
      topic,
      "Uzbek",
      aiSchema[aiSchema.length - 1]
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("   ✅ Thank you slide completed\n");

    // Add special slides
    allFilledSlides.push(consultationSlide);
    allFilledSlides.push(referencesSlide);
    allFilledSlides.push(thankYouSlide);

    const additionalSlideIndex = slidesToFill.length + 2;
    fs.writeFileSync(
      `Amir.filled-slide-${additionalSlideIndex}.json`,
      JSON.stringify(consultationSlide, null, 2)
    );
    fs.writeFileSync(
      `Amir.filled-slide-${additionalSlideIndex + 1}.json`,
      JSON.stringify(referencesSlide, null, 2)
    );
    fs.writeFileSync(
      `Amir.filled-slide-${additionalSlideIndex + 2}.json`,
      JSON.stringify(thankYouSlide, null, 2)
    );

    // 7. Save all results
    fs.writeFileSync(
      "Amir.all-filled-slides.json",
      JSON.stringify(allFilledSlides, null, 2)
    );

    const totalDuration = Date.now() - startTime;

    // 8. Print comprehensive statistics
    console.log("\n" + "=".repeat(60));
    console.log("  GENERATION COMPLETE");
    console.log("=".repeat(60) + "\n");

    console.log("📊 Summary:");
    console.log(`   Total Slides Generated: ${allFilledSlides.length}`);
    console.log(`   Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`   Average per Slide: ${(totalDuration / allFilledSlides.length / 1000).toFixed(2)}s\n`);

    // Get integrated generator statistics
    console.log("─".repeat(60));
    integratedGenerator.printSummaryReport();

    console.log("\n✅ All slides saved successfully!");
    console.log("   - Amir.outline.json");
    console.log("   - Amir.filled-slide-*.json (individual slides)");
    console.log("   - Amir.all-filled-slides.json (complete presentation)\n");

    console.log("=".repeat(60) + "\n");

  } catch (error: any) {
    console.error("\n❌ Error during generation:", error.message);
    console.error("\nStack trace:");
    console.error(error.stack);

    // Print partial statistics even on error
    console.log("\n📊 Partial Statistics:");
    try {
      integratedGenerator.printSummaryReport();
    } catch (e) {
      console.log("   Unable to retrieve statistics");
    }

    process.exit(1);
  }
};

// Run the enhanced test
start().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
