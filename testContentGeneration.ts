import fs from "fs";
import { generateOutline, generateContent } from "./llma-structured";

const start = async () => {
  // 1. Load slides
  const fullData = JSON.parse(fs.readFileSync("Amir.json", "utf-8"));
  const aiSchemaData = JSON.parse(fs.readFileSync("Amir.sxema.json", "utf-8"));

  console.log("\n🎬 STARTING CONTENT GENERATION DEMO\n");

  // 2. Generate outline
  console.log("📝 Step 1: Generating outline...");
  const outline = await generateOutline(
    aiSchemaData,
    "uz", // language
    10, // number of slides to select
    "Nerv tizimi o'smalari" // topic
  );

  console.log(`✅ Outline saved to demo.outline.json\n`);

  // 3. Generate content for first slide
  console.log("📄 Step 2: Generating content for first selected slide...");
  const firstSelectedSlide = outline.slides[0];
  const slideOutline = outline.outline[firstSelectedSlide.outlineIndex];

  console.log(`- Slide Index: ${firstSelectedSlide.slideIndex}`);
  console.log(`- Outline: ${slideOutline.title}`);

  // Get the actual slide structure from aiSchemaData
  const slideToFill = aiSchemaData[firstSelectedSlide.slideIndex];

  const filledSlide = await generateContent(slideToFill, slideOutline, "uz");

  console.log(`\n✅ Content generated for slide ${filledSlide.id}`);
  console.log(`\n📋 RESULT:\n`);

  // Show text/shape elements
  filledSlide.elements.forEach((el: any, idx: number) => {
    if (el.type === "text" || el.type === "shape") {
      console.log(`   [${idx}] ${el.type}: "${el.content}"`);
    }
  });

  console.log(`\n✅ Filled slide saved to demo.filled-slide.json`);

  // 4. Generate content for ALL selected slides
  console.log("\n📄 Step 3: Generating content for ALL selected slides...");
  const allFilledSlides = [];

  for (let i = 0; i < outline.slides.length; i++) {
    const selectedSlide = outline.slides[i];
    const slideOutlineData = outline.outline[selectedSlide.outlineIndex];
    const originalSlide = aiSchemaData[selectedSlide.slideIndex];

    console.log(
      `   Processing ${i + 1}/${outline.slides.length}: Slide ${
        selectedSlide.slideIndex
      } (${slideOutlineData.title})`
    );

    const filled = await generateContent(originalSlide, slideOutlineData, "uz");
    allFilledSlides.push(filled);

    // Small delay to avoid rate limits
    if (i < outline.slides.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n✅ All ${allFilledSlides.length} slides filled and saved!`);
  console.log(`   File: demo.all-filled-slides.json\n`);

  console.log("🎉 DEMO COMPLETE!\n");
};

start().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
