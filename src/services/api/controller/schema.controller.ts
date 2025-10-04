import { Request, Response } from "express";
import fs from "fs";
import path from "path";

// Types for schema structure
interface ImageElement {
  type: "image";
  src: string;
  hasImage: boolean;
  elementIndex: number;
  isEdited?: boolean;
}

interface ShapeElement {
  type: "shape";
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  content: string;
  fontSize?: number;
  maxCharacters?: number;
  elementIndex: number;
}

interface TableElement {
  type: "table";
  data: string[][];
  elementIndex: number;
}

type SchemaElement = ImageElement | ShapeElement | TableElement;

interface SlideSchema {
  id: string;
  index: number;
  slide: number;
  elements: SchemaElement[];
  note: string;
}

type Schema = SlideSchema[];

/**
 * Validates template name to prevent path traversal attacks
 */
const validateTemplateName = (template: string): boolean => {
  // Check for path traversal attempts
  if (
    template.includes("..") ||
    template.includes("/") ||
    template.includes("\\") ||
    template.includes("\0")
  ) {
    return false;
  }

  // Must end with .pptx
  if (!template.endsWith(".pptx")) {
    return false;
  }

  return true;
};

/**
 * Gets the schema file path for a template
 */
const getSchemaPath = (template: string): string => {
  return path.join(process.cwd(), "templates", `${template}.sxema.json`);
};

/**
 * Creates a backup of the schema file
 */
const backupSchema = (schemaPath: string): void => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = schemaPath.replace(
      ".sxema.json",
      `.sxema.backup.${timestamp}.json`
    );
    fs.copyFileSync(schemaPath, backupPath);
  } catch (error) {
    console.error("Failed to create backup:", error);
    // Don't throw - backup is optional
  }
};

/**
 * GET /schema/:template
 * Get schema file by template name
 */
export const getSchema = async (req: Request, res: Response) => {
  try {
    const { template } = req.params;

    if (!template) {
      return res.status(400).json({
        success: false,
        error: "Template name is required",
      });
    }

    if (!validateTemplateName(template)) {
      return res.status(400).json({
        success: false,
        error: "Invalid template name",
      });
    }

    const schemaPath = getSchemaPath(template);

    if (!fs.existsSync(schemaPath)) {
      return res.status(404).json({
        success: false,
        error: `Schema file not found for template: ${template}`,
      });
    }

    const schemaContent = fs.readFileSync(schemaPath, "utf-8");
    const schema: Schema = JSON.parse(schemaContent);

    res.json({
      success: true,
      data: schema,
    });
  } catch (error: any) {
    console.error("Error getting schema:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get schema",
    });
  }
};

/**
 * PUT /schema
 * Update entire schema
 */
export const updateSchema = async (req: Request, res: Response) => {
  try {
    const { template, schema } = req.body;

    if (!template) {
      return res.status(400).json({
        success: false,
        error: "Template name is required",
      });
    }

    if (!schema) {
      return res.status(400).json({
        success: false,
        error: "Schema data is required",
      });
    }

    if (!validateTemplateName(template)) {
      return res.status(400).json({
        success: false,
        error: "Invalid template name",
      });
    }

    if (!Array.isArray(schema)) {
      return res.status(400).json({
        success: false,
        error: "Schema must be an array",
      });
    }

    const schemaPath = getSchemaPath(template);

    if (!fs.existsSync(schemaPath)) {
      return res.status(404).json({
        success: false,
        error: `Schema file not found for template: ${template}`,
      });
    }

    // Create backup before updating
    backupSchema(schemaPath);

    // Write updated schema with pretty print (2 spaces indent)
    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2), "utf-8");

    res.json({
      success: true,
      message: "Schema updated successfully",
      data: schema,
    });
  } catch (error: any) {
    console.error("Error updating schema:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update schema",
    });
  }
};

/**
 * PATCH /schema/image/toggle
 * Toggle isEdited flag for specific image element
 */
export const toggleImageEdited = async (req: Request, res: Response) => {
  try {
    const { template, slideIndex, elementIndex } = req.body;

    if (!template) {
      return res.status(400).json({
        success: false,
        error: "Template name is required",
      });
    }

    if (slideIndex === undefined || slideIndex === null) {
      return res.status(400).json({
        success: false,
        error: "Slide index is required",
      });
    }

    if (elementIndex === undefined || elementIndex === null) {
      return res.status(400).json({
        success: false,
        error: "Element index is required",
      });
    }

    if (!validateTemplateName(template)) {
      return res.status(400).json({
        success: false,
        error: "Invalid template name",
      });
    }

    const schemaPath = getSchemaPath(template);

    if (!fs.existsSync(schemaPath)) {
      return res.status(404).json({
        success: false,
        error: `Schema file not found for template: ${template}`,
      });
    }

    const schemaContent = fs.readFileSync(schemaPath, "utf-8");
    const schema: Schema = JSON.parse(schemaContent);

    // Validate slide index
    if (slideIndex < 0 || slideIndex >= schema.length) {
      return res.status(400).json({
        success: false,
        error: `Invalid slide index: ${slideIndex}`,
      });
    }

    const slide = schema[slideIndex];
    const element = slide.elements.find(
      (el) => el.elementIndex === elementIndex
    );

    if (!element) {
      return res.status(404).json({
        success: false,
        error: `Element not found at index: ${elementIndex}`,
      });
    }

    if (element.type !== "image") {
      return res.status(400).json({
        success: false,
        error: `Element at index ${elementIndex} is not an image`,
      });
    }

    // Toggle isEdited flag
    const imageElement = element as ImageElement;
    imageElement.isEdited = !imageElement.isEdited;

    // Create backup before updating
    backupSchema(schemaPath);

    // Write updated schema
    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2), "utf-8");

    res.json({
      success: true,
      message: `Image ${imageElement.isEdited ? "marked as edited" : "unmarked as edited"}`,
      data: {
        slideIndex,
        elementIndex,
        isEdited: imageElement.isEdited,
      },
    });
  } catch (error: any) {
    console.error("Error toggling image edited flag:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to toggle image edited flag",
    });
  }
};

/**
 * PATCH /schema/element
 * Update specific element content
 */
export const updateElement = async (req: Request, res: Response) => {
  try {
    const { template, slideIndex, elementIndex, content } = req.body;

    if (!template) {
      return res.status(400).json({
        success: false,
        error: "Template name is required",
      });
    }

    if (slideIndex === undefined || slideIndex === null) {
      return res.status(400).json({
        success: false,
        error: "Slide index is required",
      });
    }

    if (elementIndex === undefined || elementIndex === null) {
      return res.status(400).json({
        success: false,
        error: "Element index is required",
      });
    }

    if (content === undefined || content === null) {
      return res.status(400).json({
        success: false,
        error: "Content is required",
      });
    }

    if (!validateTemplateName(template)) {
      return res.status(400).json({
        success: false,
        error: "Invalid template name",
      });
    }

    const schemaPath = getSchemaPath(template);

    if (!fs.existsSync(schemaPath)) {
      return res.status(404).json({
        success: false,
        error: `Schema file not found for template: ${template}`,
      });
    }

    const schemaContent = fs.readFileSync(schemaPath, "utf-8");
    const schema: Schema = JSON.parse(schemaContent);

    // Validate slide index
    if (slideIndex < 0 || slideIndex >= schema.length) {
      return res.status(400).json({
        success: false,
        error: `Invalid slide index: ${slideIndex}`,
      });
    }

    const slide = schema[slideIndex];
    const element = slide.elements.find(
      (el) => el.elementIndex === elementIndex
    );

    if (!element) {
      return res.status(404).json({
        success: false,
        error: `Element not found at index: ${elementIndex}`,
      });
    }

    if (element.type !== "shape") {
      return res.status(400).json({
        success: false,
        error: `Element at index ${elementIndex} is not a shape`,
      });
    }

    // Update content
    const shapeElement = element as ShapeElement;
    const oldContent = shapeElement.content;
    shapeElement.content = content;

    // Create backup before updating
    backupSchema(schemaPath);

    // Write updated schema
    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2), "utf-8");

    res.json({
      success: true,
      message: "Element content updated successfully",
      data: {
        slideIndex,
        elementIndex,
        oldContent,
        newContent: content,
      },
    });
  } catch (error: any) {
    console.error("Error updating element:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update element",
    });
  }
};
