import { importPPTX } from "@/src/core/processors/json-processor";
import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { sleep } from "../utils/utils";
import { generateAISchema } from "@/src/core/processors";

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
    const templateName = originalName.replace(/\.pptx$/i, '');

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

    fs.writeFileSync(
      path.join(templatesDir, `${originalName}.sxema.json`),
      JSON.stringify(aiSchema, null, 2)
    );

    res.json({
      success: true,
      filename: originalName,
      path: targetPath,
      message: "Template uploaded successfully",
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

export const getTemplates = async (req: Request, res: Response) => {
  const templatesDir = path.join(process.cwd(), "templates");
  const templates = fs
    .readdirSync(templatesDir)
    .filter((file) => file.endsWith(".sxema.json"));
  res.json({
    success: true,
    templates,
  });
};

export { uploadAndCreateTemplate };
