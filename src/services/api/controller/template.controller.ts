import { importPPTX } from "@/src/core/processors/json-processor";
import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { sleep } from "../utils/utils";
import { generateAISchema } from "@/src/core/processors";
import { ImageStorageManager } from "@/src/services/image/image-storage-manager";
import { getOpenAIService } from "@/src/services/openai";
import sharp from "sharp";
import prisma from "../../../lib/prisma";

/**
 * Interface for template metadata
 */
interface TemplateMetadata {
  [templateName: string]: string; // templateName: preview filename
}

/**
 * Interface for slide elements that may contain images
 */
interface SlideElement {
  type: string;
  src?: string;
  id?: string;
  [key: string]: any;
}

interface Slide {
  id: string;
  elements: SlideElement[];
  background?: {
    type: string;
    image?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface SlidesData {
  slide: Slide[];
}

/**
 * Get metadata file path
 */
const getMetadataPath = (): string => {
  return path.join(process.cwd(), "templates", "metadata.json");
};

/**
 * Load template metadata from file
 */
const loadMetadata = (): TemplateMetadata => {
  const metadataPath = getMetadataPath();
  try {
    if (fs.existsSync(metadataPath)) {
      const data = fs.readFileSync(metadataPath, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading metadata:", error);
  }
  return {};
};

/**
 * Save template metadata to file
 */
const saveMetadata = (metadata: TemplateMetadata): void => {
  const metadataPath = getMetadataPath();
  try {
    // Ensure templates directory exists
    const templatesDir = path.dirname(metadataPath);
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
  } catch (error) {
    console.error("Error saving metadata:", error);
    throw error;
  }
};

/**
 * Delete file with retry (handles Windows file locking issues)
 */
const deleteFileWithRetry = async (filePath: string, maxRetries: number = 3): Promise<void> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return; // Success
    } catch (error: any) {
      if (i === maxRetries - 1) {
        console.error(`Failed to delete file after ${maxRetries} attempts:`, filePath);
        // Don't throw - file cleanup is not critical
      } else {
        // Wait a bit before retrying (Windows file handle issue)
        await sleep(100);
      }
    }
  }
};

/**
 * AI-powered image classification for template schema.
 * Analyzes each image element and decides if it should be replaced with topic-specific content.
 * Icons, logos, decorative backgrounds → keep (isEdited: false)
 * Content placeholder images → replace (isEdited: true)
 */
const classifyTemplateImages = async (aiSchema: any[]): Promise<void> => {
  // Collect all image elements across slides
  const imageElements: Array<{
    slideIdx: number;
    elIdx: number;
    src: string;
    width: number;
    height: number;
    left: number;
    top: number;
  }> = [];

  for (let si = 0; si < aiSchema.length; si++) {
    const slide = aiSchema[si];
    for (let ei = 0; ei < slide.elements.length; ei++) {
      const el = slide.elements[ei];
      if (el.type === "image") {
        imageElements.push({
          slideIdx: si,
          elIdx: ei,
          src: el.src || "",
          width: el.width || 0,
          height: el.height || 0,
          left: el.left || 0,
          top: el.top || 0,
        });
      }
    }
  }

  if (imageElements.length === 0) return;

  console.log(`[ImageClassifier] Classifying ${imageElements.length} images...`);

  // Phase 1: Heuristic pre-classification for obvious cases
  const ambiguous: number[] = []; // indexes into imageElements that need AI
  let heuristicMarked = 0;

  for (let i = 0; i < imageElements.length; i++) {
    const img = imageElements[i];
    const w = img.width;
    const h = img.height;
    const area = w * h;

    // Obvious KEEP: tiny icons, bullets, decorative dots
    if (w < 60 && h < 60) {
      // keep as false
      continue;
    }

    // Obvious KEEP: full-slide background (covers >80% of typical 960x540 slide)
    if (w > 900 && h > 500) {
      continue;
    }

    // Obvious REPLACE: medium-large content images
    if (area > 20000 && w > 100 && h > 100) {
      aiSchema[img.slideIdx].elements[img.elIdx].isEdited = true;
      heuristicMarked++;
      continue;
    }

    // Ambiguous: send to AI
    ambiguous.push(i);
  }

  console.log(`[ImageClassifier] Heuristic: ${heuristicMarked} marked, ${ambiguous.length} ambiguous → AI`);

  // Phase 2: AI classification for ambiguous images (in chunks)
  if (ambiguous.length > 0) {
    const CHUNK_SIZE = 50;
    let aiMarked = 0;

    try {
      const openai = getOpenAIService();

      for (let c = 0; c < ambiguous.length; c += CHUNK_SIZE) {
        const chunk = ambiguous.slice(c, c + CHUNK_SIZE);
        const imageSummary = chunk.map((imgIdx) => {
          const img = imageElements[imgIdx];
          return {
            id: imgIdx,
            slide: img.slideIdx + 1,
            size: `${Math.round(img.width)}x${Math.round(img.height)}`,
            pos: `(${Math.round(img.left)},${Math.round(img.top)})`,
            src: img.src.substring(0, 80),
          };
        });

        const response = await openai.createChatCompletion({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You classify images in a presentation template. Decide which should be REPLACED with topic-specific images.
REPLACE: content photos, placeholder images, stock photos in content area.
KEEP: icons, logos, decorative borders, thin separator lines.
Return JSON: { "replace": [id1, id2] } — array of image IDs to REPLACE. Only JSON.`,
            },
            {
              role: "user",
              content: JSON.stringify(imageSummary),
            },
          ],
          temperature: 0.1,
          maxTokens: Math.min(500, chunk.length * 10 + 50),
        });

        const content = response.content?.trim() || "{}";
        const jsonStr = content.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
        const result = JSON.parse(jsonStr);
        const replaceIds: number[] = result.replace || [];

        for (const id of replaceIds) {
          if (id >= 0 && id < imageElements.length) {
            const img = imageElements[id];
            aiSchema[img.slideIdx].elements[img.elIdx].isEdited = true;
            aiMarked++;
          }
        }
      }

      console.log(`[ImageClassifier] AI marked ${aiMarked} more images`);
    } catch (error: any) {
      console.error(`[ImageClassifier] AI failed for ambiguous images: ${error.message}`);
      // For ambiguous images that AI couldn't classify, mark them for replacement (safer)
      for (const imgIdx of ambiguous) {
        const img = imageElements[imgIdx];
        aiSchema[img.slideIdx].elements[img.elIdx].isEdited = true;
      }
    }
  }

  const totalMarked = imageElements.filter((_, i) => {
    const img = imageElements[i];
    return aiSchema[img.slideIdx].elements[img.elIdx].isEdited === true;
  }).length;

  console.log(`[ImageClassifier] Total: ${totalMarked}/${imageElements.length} images marked for replacement`);
};

/**
 * Extract all image URLs from slides data
 */
const extractImageUrls = (slides: any): Array<{
  url: string;
  slideIndex: number;
  elementType: string;
  elementId?: string;
}> => {
  const imageUrls: Array<{
    url: string;
    slideIndex: number;
    elementType: string;
    elementId?: string;
  }> = [];

  // Handle both array format and object format with slide property
  const slideArray = Array.isArray(slides) ? slides : (slides.slide || []);

  slideArray.forEach((slide: any, slideIndex: number) => {
    // Extract images from slide elements
    if (slide.elements && Array.isArray(slide.elements)) {
      slide.elements.forEach((element: any) => {
        if (element.type === "image" && element.src) {
          // Check if it's a URL (starts with http/https) or a local path
          if (element.src.startsWith("http://") || element.src.startsWith("https://")) {
            imageUrls.push({
              url: element.src,
              slideIndex,
              elementType: "content",
              elementId: element.id,
            });
          }
        }
      });
    }

    // Extract background images if any
    if (
      slide.background &&
      slide.background.type === "image" &&
      slide.background.image
    ) {
      if (
        slide.background.image.startsWith("http://") ||
        slide.background.image.startsWith("https://")
      ) {
        imageUrls.push({
          url: slide.background.image,
          slideIndex,
          elementType: "background",
        });
      }
    }
  });

  return imageUrls;
};

const uploadAndCreateTemplate = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    const originalName = req.file.originalname;
    const tempPath = req.file.path;
    const targetPath = path.join(process.cwd(), "templates", originalName);

    const templatesDir = path.join(process.cwd(), "templates");
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }

    fs.renameSync(tempPath, targetPath);

    await sleep(1000);

    // Extract template name without extension
    const templateName = originalName.replace(/\.pptx$/i, "");

    const slides = await importPPTX(
      fs.readFileSync(targetPath).buffer as ArrayBuffer,
      {
        cover: true,
        templateName: templateName,
      }
    );

    // write to templates directory slides to json file
    fs.writeFileSync(
      path.join(templatesDir, `${originalName}.json`),
      JSON.stringify(slides, null, 2)
    );

    const aiSchema = generateAISchema(
      Array.isArray(slides) ? slides : (slides as { slide: any[] }).slide
    );

    // AI classifies which images should be replaced during generation
    await classifyTemplateImages(aiSchema);

    fs.writeFileSync(
      path.join(templatesDir, `${originalName}.sxema.json`),
      JSON.stringify(aiSchema, null, 2)
    );

    // Process and download images from the template
    console.log("\n========================================");
    console.log(`Processing images for template: ${templateName}`);
    console.log("========================================");

    let imageDownloadResults = {
      totalFound: 0,
      totalDownloaded: 0,
      totalFailed: 0,
      totalSkipped: 0,
      errors: [] as string[],
    };

    try {
      // Extract all image URLs from slides
      const imageUrls = extractImageUrls(slides);
      imageDownloadResults.totalFound = imageUrls.length;

      console.log(`Found ${imageUrls.length} image(s) in the template`);

      if (imageUrls.length > 0) {
        // Initialize image storage manager
        const imageStorage = new ImageStorageManager(
          path.join(process.cwd(), "images")
        );

        // Prepare batch download data
        const imagesToDownload = imageUrls.map((img) => ({
          url: img.url,
          slideIndex: img.slideIndex,
          elementType: img.elementType as "background" | "content" | "icon" | "illustration",
          tags: [templateName, `slide-${img.slideIndex}`, img.elementType],
        }));

        // Download all images using batch processing
        console.log("\nStarting batch image download...");
        const batchResult = await imageStorage.downloadBatch(
          imagesToDownload,
          templateName,
          {
            concurrency: 3, // Download 3 images at a time
            forceDownload: false, // Skip duplicates
            onProgress: (current, total, result) => {
              console.log(
                `Progress: ${current}/${total} - ${result.success ? "Success" : "Failed"}: ${result.filename || "N/A"}`
              );
            },
          }
        );

        // Update results
        imageDownloadResults.totalDownloaded = batchResult.totalSuccess;
        imageDownloadResults.totalFailed = batchResult.totalFailed;
        imageDownloadResults.totalSkipped = batchResult.totalDuplicates;

        // Collect error messages
        batchResult.failed.forEach((failedResult) => {
          if (failedResult.error) {
            imageDownloadResults.errors.push(failedResult.error);
          }
        });

        console.log("\n========================================");
        console.log("Image Download Summary:");
        console.log(`  Total Found: ${imageDownloadResults.totalFound}`);
        console.log(`  Successfully Downloaded: ${imageDownloadResults.totalDownloaded}`);
        console.log(`  Skipped (Duplicates): ${imageDownloadResults.totalSkipped}`);
        console.log(`  Failed: ${imageDownloadResults.totalFailed}`);
        console.log(`  Duration: ${(batchResult.duration / 1000).toFixed(2)}s`);
        console.log("========================================\n");
      } else {
        console.log("No images found in this template");
      }
    } catch (imageError: any) {
      // Image processing failed, but template upload should still succeed
      const errorMessage = imageError.message || "Unknown error";
      console.error("Image processing error:", errorMessage);
      imageDownloadResults.errors.push(errorMessage);
      imageDownloadResults.totalFailed = imageDownloadResults.totalFound;

      console.log(
        "\nWarning: Template uploaded successfully, but image processing failed"
      );
    }

    // Save template to database (schema JSON directly in DB)
    const slideArray = Array.isArray(slides) ? slides : (slides as { slide: any[] }).slide;
    const dbTemplate = await prisma.template.upsert({
      where: { name: originalName },
      update: {
        schema: aiSchema as any,
        slideCount: slideArray.length,
        imageCount: imageDownloadResults.totalFound,
        updatedAt: new Date(),
      },
      create: {
        name: originalName,
        schema: aiSchema as any,
        slideCount: slideArray.length,
        imageCount: imageDownloadResults.totalFound,
      },
    });

    // Return success response with image processing results
    res.json({
      success: true,
      filename: originalName,
      path: targetPath,
      templateId: dbTemplate?.id || null,
      message: "Template uploaded successfully",
      imageProcessing: {
        totalImagesFound: imageDownloadResults.totalFound,
        successfullyDownloaded: imageDownloadResults.totalDownloaded,
        skippedDuplicates: imageDownloadResults.totalSkipped,
        failed: imageDownloadResults.totalFailed,
        errors:
          imageDownloadResults.errors.length > 0
            ? imageDownloadResults.errors
            : undefined,
      },
    });
  } catch (error: any) {
    // Clean up temp file if it exists
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
    }

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Upload preview/thumbnail image for a template
 * POST /api/template/:templateName/preview
 */
export const uploadTemplatePreview = async (req: Request, res: Response) => {
  const tempFilePath = req.file?.path;

  try {
    const { templateName } = req.params;

    if (!templateName) {
      return res.status(400).json({
        success: false,
        error: "Template name is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    // Validate file size (should be handled by multer, but double-check)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
      // Clean up uploaded file
      await deleteFileWithRetry(req.file.path);
      return res.status(400).json({
        success: false,
        error: "File size exceeds 5MB limit",
      });
    }

    // Create previews directory if it doesn't exist
    const previewsDir = path.join(process.cwd(), "templates", "previews");
    if (!fs.existsSync(previewsDir)) {
      fs.mkdirSync(previewsDir, { recursive: true });
    }

    // Final filename will always be .jpg since we convert to JPEG
    const finalFilename = `${templateName}.jpg`;
    const finalPath = path.join(previewsDir, finalFilename);

    // Process image with sharp: resize and optimize
    try {
      // Remove old preview if exists
      if (fs.existsSync(finalPath)) {
        await deleteFileWithRetry(finalPath);
      }

      // Process and save the image
      await sharp(req.file.path)
        .resize(800, 600, {
          fit: "inside", // Maintain aspect ratio
          withoutEnlargement: true, // Don't enlarge if smaller
        })
        .jpeg({ quality: 85 }) // Convert to JPEG and compress
        .toFile(finalPath);

      console.log(`Preview image uploaded for template: ${templateName}`);

      // Update metadata (file-based)
      const metadata = loadMetadata();
      metadata[templateName] = finalFilename;
      saveMetadata(metadata);

      // Update DB
      await prisma.template.updateMany({
        where: { name: templateName },
        data: { hasPreview: true },
      });

      // Clean up temporary file (with retry for Windows)
      await deleteFileWithRetry(req.file.path);

      res.json({
        success: true,
        previewUrl: `/templates/previews/${finalFilename}`,
        message: "Preview image uploaded successfully",
      });
    } catch (sharpError: any) {
      // Clean up files on error
      await deleteFileWithRetry(req.file.path);
      throw new Error(`Image processing failed: ${sharpError.message}`);
    }
  } catch (error: any) {
    // Clean up uploaded file on error
    if (tempFilePath) {
      await deleteFileWithRetry(tempFilePath);
    }

    res.status(500).json({
      success: false,
      error: error.message || "Failed to upload preview image",
    });
  }
};

/**
 * Get preview image for a specific template
 * GET /api/template/:templateName/preview
 */
export const getTemplatePreview = async (req: Request, res: Response) => {
  try {
    const { templateName } = req.params;

    if (!templateName) {
      return res.status(400).json({
        success: false,
        error: "Template name is required",
      });
    }

    // Load metadata to find preview filename
    const metadata = loadMetadata();
    const previewFilename = metadata[templateName];

    if (!previewFilename) {
      return res.status(404).json({
        success: false,
        error: "No preview image found for this template",
      });
    }

    const previewPath = path.join(process.cwd(), "templates", "previews", previewFilename);

    // Check if preview file exists
    if (!fs.existsSync(previewPath)) {
      return res.status(404).json({
        success: false,
        error: "Preview image file not found",
      });
    }

    // Send the image file
    res.sendFile(previewPath);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to retrieve preview image",
    });
  }
};

export const getTemplates = async (req: Request, res: Response) => {
  try {
    const dbTemplates = await prisma.template.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { presentations: true } },
      },
    });

    const imageStorageManager = new ImageStorageManager(path.join(process.cwd(), "images"));

    const templatesWithImages = await Promise.all(
      dbTemplates.map(async (t) => {
        const metadata = await imageStorageManager.loadAllMetadata(t.name);

        const images = metadata.map((img) => ({
          filename: img.filename,
          url: `/images/${t.name}/images/${img.filename}`,
          originalUrl: img.originalUrl,
          dimensions: img.dimensions,
          format: img.format,
          fileSize: img.fileSize,
          slideIndex: img.slideIndex,
          elementType: img.elementType,
          downloadedAt: img.downloadedAt,
        }));

        return {
          id: t.id,
          name: t.name,
          templateName: t.name,
          previewImage: t.hasPreview ? `/templates/previews/${t.name}.jpg` : null,
          slideCount: t.slideCount,
          imageCount: t.imageCount,
          presentationCount: t._count.presentations,
          hasSchema: t.schema !== null,
          images,
          createdAt: t.createdAt,
        };
      })
    );

    res.json({
      success: true,
      templates: templatesWithImages,
      totalTemplates: templatesWithImages.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export { uploadAndCreateTemplate };
