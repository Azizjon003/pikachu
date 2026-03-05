import { Request, Response } from "express";
import prisma from "../../../lib/prisma";

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
  if (
    template.includes("..") ||
    template.includes("/") ||
    template.includes("\\") ||
    template.includes("\0")
  ) {
    return false;
  }

  if (!template.endsWith(".pptx")) {
    return false;
  }

  return true;
};

/**
 * Find template and its schema from DB
 */
const findTemplateSchema = async (templateName: string): Promise<{ id: string; schema: Schema } | null> => {
  const template = await prisma.template.findFirst({
    where: { name: templateName },
    select: { id: true, schema: true },
  });

  if (!template || !template.schema) return null;
  return { id: template.id, schema: template.schema as unknown as Schema };
};

/**
 * GET /schema/:template
 * Get schema by template name from DB
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

    const result = await findTemplateSchema(template);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: `Schema not found for template: ${template}`,
      });
    }

    res.json({
      success: true,
      data: result.schema,
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
 * Update entire schema in DB
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

    const existing = await prisma.template.findFirst({
      where: { name: template },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Template not found: ${template}`,
      });
    }

    await prisma.template.update({
      where: { id: existing.id },
      data: { schema: schema as any },
    });

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

    const result = await findTemplateSchema(template);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: `Schema not found for template: ${template}`,
      });
    }

    const schema = result.schema;

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

    // Save updated schema to DB
    await prisma.template.update({
      where: { id: result.id },
      data: { schema: schema as any },
    });

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

    const result = await findTemplateSchema(template);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: `Schema not found for template: ${template}`,
      });
    }

    const schema = result.schema;

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

    // Save updated schema to DB
    await prisma.template.update({
      where: { id: result.id },
      data: { schema: schema as any },
    });

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
