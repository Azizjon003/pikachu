import fs from "fs";
import {
  generateOutline,
  generateContent,
  generateConculation,
  generateReferences,
  generateThankYouSlide,
} from "./llma-structured";

const start = async () => {
  // 1. Load AI schema (simplified slide structure)
  const fullschema = JSON.parse(fs.readFileSync("Amir.json", "utf-8")).slide;
  let aiSchema = JSON.parse(fs.readFileSync("Amir.sxema.json", "utf-8"));
  const topic = "Nerv tizimi o'smalari";
  // 2. Generate outline
  console.log("📝 Generating outline...");
  const outline = await generateOutline(
    aiSchema,
    "Uzbek",
    5, // Select 5 slides
    topic
  );

  fs.writeFileSync("Amir.outline.json", JSON.stringify(outline, null, 2));
  console.log("✅ Outline saved\n");

  // 3. Prepare first two slides with topic and outlines
  console.log("🔧 Preparing first two slides...");

  // First slide: Dynamic topic name from outline
  const firstSlide = {
    ...aiSchema[0],
    elements: aiSchema[0].elements.map((element: any) => {
      if (element.type === "shape" && element.elementIndex === 5) {
        return {
          ...element,
          content: outline.outline[0].title.split(" ").slice(0, 3).join(" "), // Dynamic topic from outline
        };
      }
      return element;
    }),
  };

  const secondSlide = {
    ...aiSchema[1],
    elements: aiSchema[1].elements.map((element: any) => {
      if (element.type === "shape" && element.elementIndex === 26) {
        return {
          ...element,
          content: "Reja: ",
        };
      }
      if (element.type === "shape" && element.elementIndex === 34) {
        return {
          ...element,
          content: `1. ${outline.outline[0].title}`,
        };
      }
      if (element.type === "shape" && element.elementIndex === 36) {
        return {
          ...element,
          content: `2. ${outline.outline[1].title}`,
        };
      }
      if (element.type === "shape" && element.elementIndex === 38) {
        return {
          ...element,
          content: `3. ${outline.outline[2].title}`,
        };
      }
      return element;
    }),
  };

  // Filter remaining slides (skip first 2 and last 3)
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
  console.log(`   - Original: ${aiSchema.length} slides`);
  console.log(`   - Filtered: ${filteredSchema.length} slides\n`);

  // 4. Get slides to fill based on outline selection
  const slidesToFill = outline.slides.map(
    (outlineSlide: any) => filteredSchema[outlineSlide.slideIndex]
  );
  const slidesToFillFull = outline.slides.map(
    (outlineSlide: any) => filteredSchemaFull[outlineSlide.slideIndex]
  );
  // 5. Initialize allFilledSlides and add first two slides
  let allFilledSlides = [];
  allFilledSlides.push(firstSlide);
  allFilledSlides.push(secondSlide);

  // Save first two slides
  fs.writeFileSync(
    "Amir.filled-slide-0.json",
    JSON.stringify(firstSlide, null, 2)
  );
  fs.writeFileSync(
    "Amir.filled-slide-1.json",
    JSON.stringify(secondSlide, null, 2)
  );

  // 6. Generate content for remaining slides
  console.log(`📄 Generating content for ${slidesToFill.length} slides...`);
  for (let i = 0; i < slidesToFill.length; i++) {
    const slide = slidesToFill[i];
    const slideFull = slidesToFillFull[i];
    const outlineForSlide = outline.slides[i];

    const filledSlide = await generateContent(slide, outlineForSlide, "Uzbek");
    allFilledSlides.push(filledSlide);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log(`📄 Generated content for slide ${i + 3}...`);
    fs.writeFileSync(
      `Amir.filled-slide-${i + 2}.json`,
      JSON.stringify(filledSlide, null, 2)
    );
  }

  // 7. Generate additional slides using LLM with topic-specific content
  console.log("📄 Generating additional slides using LLM...");

  // Create dynamic context from the main presentation
  // Generate consultation slide content
  console.log("📄 Generating consultation slide...");
  // Generate consultation slide content
  console.log("📄 Generating consultation slide...");

  const consultationSlide = await generateConculation(
    topic,
    "Uzbek",
    aiSchema[aiSchema.length - 3]
  );
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log("✅ Consultation slide generated");

  // Generate references slide content with numbered format
  console.log("📄 Generating references slide...");

  const referencesSlide = await generateReferences(
    topic,
    "Uzbek",
    5,
    aiSchema[aiSchema.length - 2]
  );
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log("✅ References slide generated");

  // Generate conclusion slide content
  console.log("📄 Generating conclusion slide...");

  const thankYouSlide = await generateThankYouSlide(
    topic,
    "Uzbek",
    aiSchema[aiSchema.length - 1]
  );
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log("✅ Thank you slide generated");

  // Add additional slides to the end
  allFilledSlides.push(consultationSlide);
  allFilledSlides.push(referencesSlide);
  allFilledSlides.push(thankYouSlide);

  // Save additional slides
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

  console.log("✅ Additional slides generated\n");

  // 8. Save results
  fs.writeFileSync(
    "Amir.all-filled-slides.json",
    JSON.stringify(allFilledSlides, null, 2)
  );
  console.log("✅ All filled slides saved\n");
};

start();
