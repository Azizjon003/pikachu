import fs from "fs";
import { generateOutline, generateContent } from "./llma-structured";

const start = async () => {
  // 1. Load AI schema (simplified slide structure)
  let aiSchema = JSON.parse(fs.readFileSync("Amir.sxema.json", "utf-8"));

  // 2. Generate outline
  console.log("📝 Generating outline...");
  const outline = await generateOutline(
    aiSchema,
    "Uzbek",
    10, // Select 5 slides
    "Nerv tizimi o'smalari "
  );

  fs.writeFileSync("Amir.outline.json", JSON.stringify(outline, null, 2));
  console.log("✅ Outline saved\n");

  // 3. Filter slides (skip first 2 and last 3)
  console.log("🔧 Filtering slides...");
  const filteredSchema = aiSchema.filter(
    (slide: any) =>
      slide.index !== 0 &&
      slide.index !== 1 &&
      slide.index !== aiSchema.length - 3 &&
      slide.index !== aiSchema.length - 2 &&
      slide.index !== aiSchema.length - 1
  );
  console.log(`   - Original: ${aiSchema.length} slides`);
  console.log(`   - Filtered: ${filteredSchema.length} slides\n`);

  // 4. Get slides to fill based on outline selection
  const slidesToFill = outline.slides.map(
    (outlineSlide: any) => filteredSchema[outlineSlide.slideIndex]
  );

  // 5. Generate content for ALL slides at once
  console.log(`📄 Generating content for ${slidesToFill.length} slides...`);
  let allFilledSlides = [];
  for (let i = 0; i < slidesToFill.length; i++) {
    const slide = slidesToFill[i];
    const outlineForSlide = outline.slides[i];
    console.log(
      `📄 Generating content for slide ${i + 1}...`,
      slide,
      outlineForSlide,
      i
    );
    const filledSlide = await generateContent(slide, outlineForSlide, "Uzbek");
    allFilledSlides.push(filledSlide);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log(`📄 Generated content for slide ${i + 1}...`);
    fs.writeFileSync(
      `Amir.filled-slide-${i}.json`,
      JSON.stringify(filledSlide, null, 2)
    );
  }

  // 6. Save results
  fs.writeFileSync(
    "Amir.all-filled-slides.json",
    JSON.stringify(allFilledSlides, null, 2)
  );
  console.log("✅ All filled slides saved\n");
};

start();
