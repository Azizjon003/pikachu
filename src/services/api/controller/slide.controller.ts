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

export const generateSlide = async (req: Request, res: Response) => {
  try {
    const { template, language, page, topic, author } = req.body;

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

    const firstSlide = {
      ...aiSchema[0],
      elements: aiSchema[0].elements.map((element: any) => {
        if (element.type === "shape" && element.elementIndex === 7) {
          return {
            ...element,
            content: topic, // Dynamic topic from outline
          };
        }
        if (element.type === "shape" && element.elementIndex === 13) {
          return {
            ...element,
            content: author,
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

    const slidesToFill = outline.slides.map(
      (outlineSlide: any) => filteredSchema[outlineSlide.slideIndex]
    );

    let allFilledSlides = [];
    allFilledSlides.push(firstSlide);
    allFilledSlides.push(secondSlide);

    for (let i = 0; i < slidesToFill.length; i++) {
      const slide = slidesToFill[i];
      const outlineForSlide = outline.slides[i];

      const filledSlide = await generateContent(
        slide,
        outlineForSlide,
        "Uzbek"
      );
      allFilledSlides.push(filledSlide);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log(`📄 Generated content for slide ${i + 3}...`);
    }

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
    const fullFilledSlides = path.join(
      process.cwd(),
      template.replace(".sxema.json", "full-filled-slides.json")
    );
    fs.writeFileSync(
      fullFilledSlides,
      JSON.stringify(allFilledSlides, null, 2)
    );
    console.log("✅ All filled slides saved\n");

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
    // console.log(`   - Skipped: ${replacementResults.skipped}`);

    if (replacementResults.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered:`);
      replacementResults.errors.forEach((error: any, index: any) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    const dataFullSxema = generateSlideFromAI(allFilledSlides, fullSxema);
    const slideName = `${Date.now()}.pptx`;
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
    });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ success: false, error: error.message });
  }
};
