/**
 * Enhanced LLM-based Slide Generation with Integrated System
 * Uses the new resilient, quality-validated, and optimized generation pipeline
 */

import OpenAI from "openai";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

import { OutlineSchema, OutlineResponse } from "./schema";
import { IntegratedSlideGenerator } from "./integrated-generator";
import { EnhancedLogger, LogLevel } from "./enhanced-logger";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const logger = new EnhancedLogger(LogLevel.INFO);

// Initialize integrated generator
const integratedGenerator = new IntegratedSlideGenerator(
  process.env.OPENAI_API_KEY || ""
);

/**
 * Helper function to identify nearby elements (within 50px)
 */
const findNearbyElements = (
  currentElement: any,
  allElements: any[],
  threshold: number = 50
): any[] => {
  return allElements.filter((el) => {
    if (el.index === currentElement.index || el.type === "image") return false;

    const isNearby =
      Math.abs(el.left - currentElement.left) < threshold ||
      Math.abs(el.top - currentElement.top) < threshold ||
      Math.abs(
        el.left + el.width - (currentElement.left + currentElement.width)
      ) < threshold ||
      Math.abs(
        el.top + el.height - (currentElement.top + currentElement.height)
      ) < threshold;

    return isNearby;
  });
};

/**
 * Apply reduced font size to HTML content
 */
const applyFontSize = (htmlContent: string, newFontSize: number): string => {
  return htmlContent.replace(
    /font-size:\s*\d+(?:\.\d+)?\s*px/gi,
    `font-size: ${newFontSize.toFixed(1)}px`
  );
};

/**
 * Validate generated content with font size reduction
 */
const validateContent = (
  element: any,
  generatedContent: string,
  originalFontSize: number,
  maxCharacters: number
): {
  isValid: boolean;
  content: string;
  fontSize?: number;
  warnings: string[];
} => {
  const warnings: string[] = [];
  let content = generatedContent;
  let adjustedFontSize: number | undefined;

  // Check for missing spaces
  if (/[a-z][A-Z]/.test(content)) {
    warnings.push("Content may have missing spaces between words");
  }

  // Calculate font size reduction if needed
  if (content.length > maxCharacters) {
    let newFontSize = originalFontSize * (maxCharacters / content.length);
    const MIN_FONT_SIZE = 8;
    newFontSize = Math.max(newFontSize, MIN_FONT_SIZE);
    adjustedFontSize = newFontSize;

    warnings.push(
      `Font size reduced from ${originalFontSize}px to ${newFontSize.toFixed(
        1
      )}px due to content length`
    );
  }

  // Flexible content length validation
  let minExpectedRatio: number;
  if (maxCharacters > 200) {
    minExpectedRatio = 0.4;
  } else if (maxCharacters >= 50) {
    minExpectedRatio = 0.3;
  } else {
    minExpectedRatio = 0.2;
  }

  const minExpectedChars = maxCharacters * minExpectedRatio;
  if (
    element.width > 300 &&
    element.height > 100 &&
    content.length < minExpectedChars
  ) {
    warnings.push(
      `Content may be too short for element size (${
        content.length
      } chars, expected ~${Math.floor(minExpectedChars)})`
    );
  }

  return {
    isValid: warnings.length === 0,
    content,
    fontSize: adjustedFontSize,
    warnings,
  };
};

/**
 * Generate outline using integrated system
 */
export const generateOutline = async (
  slides: any[],
  language: string,
  page: number,
  topic: string
): Promise<OutlineResponse> => {
  logger.info("Starting outline generation", {
    topic,
    language,
    slideCount: slides.length,
  });

  // Filter slides (remove first 2 and last 3)
  slides = slides.filter(
    (slide, index) =>
      index !== 0 &&
      index !== 1 &&
      index !== slides.length - 3 &&
      index !== slides.length - 2 &&
      index !== slides.length - 1
  );

  logger.info(`Filtered slides`, { available: slides.length, requested: page });

  // Use integrated generator
  const result = await integratedGenerator.generateOutline(
    slides,
    language,
    page,
    topic
  );

  if (!result.success) {
    logger.error("Outline generation failed", undefined, {
      errors: result.errors,
    });
    throw new Error(`Outline generation failed: ${result.errors?.join(", ")}`);
  }

  // Validate with Zod
  const parsed = OutlineSchema.parse(result.data);

  // Log metadata
  logger.info("Outline generated successfully", {
    duration: `${result.metadata.totalDuration}ms`,
    qualityScore: result.metadata.qualityScore,
    outlines: parsed.outline.length,
    slides: parsed.slides.length,
    tokenUsage: result.metadata.tokenUsage.totalTokens,
    cost: `$${result.metadata.tokenUsage.estimatedCost.toFixed(4)}`,
  });

  return parsed;
};

/**
 * Generate content using integrated system
 */
export const generateContent = async (
  slide: any,
  outline: any,
  language: string
) => {
  logger.info(`Generating content for slide ${slide.id}`, {
    outline: outline.title || outline.title_eng,
  });

  // Use integrated generator
  const result = await integratedGenerator.generateSlideContent(
    slide,
    outline,
    language
  );

  if (!result.success) {
    logger.error(`Content generation failed for slide ${slide.id}`, undefined, {
      errors: result.errors,
    });
    throw new Error(`Content generation failed: ${result.errors?.join(", ")}`);
  }

  // Log metadata
  logger.info(`Content generated for slide ${slide.id}`, {
    duration: `${result.metadata.totalDuration}ms`,
    qualityScore: result.metadata.qualityScore,
    qualityRating:
      result.metadata.validationResult.score >= 90
        ? "Excellent"
        : result.metadata.validationResult.score >= 75
        ? "Good"
        : result.metadata.validationResult.score >= 60
        ? "Fair"
        : "Poor",
    issues: result.metadata.validationResult.issues.length,
    tokenUsage: result.metadata.tokenUsage.totalTokens,
  });

  // Log quality issues if any
  if (result.metadata.validationResult.issues.length > 0) {
    logger.warn(`Quality issues detected for slide ${slide.id}`, {
      issues: result.metadata.validationResult.issues.slice(0, 3), // First 3 issues
    });
  }

  return result.data;
};

/**
 * Legacy functions remain for backward compatibility
 * These now use the basic OpenAI client but could be upgraded to use integrated system
 */

export const generateConculation = async (
  topicName: string,
  language: string,
  slide: any
) => {
  logger.info("Generating conclusion slide", { topic: topicName, language });

  const textShapeTableElements = slide.elements
    .map((el: any, idx: number) => ({
      index: idx,
      type: el.type,
      width: el.width || 0,
      height: el.height || 0,
      left: el.left || 0,
      top: el.top || 0,
      currentContent: el.content || "",
      fontSize: el.fontSize || 14,
      maxCharacters: el.maxCharacters || 100,
    }))
    .filter(
      (el: any) =>
        el.type === "text" || el.type === "shape" || el.type === "table"
    );

  const contentSchema = {
    type: "object",
    properties: {
      slideId: { type: "string" },
      elements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            elementIndex: { type: "number" },
            content: { type: "string" },
          },
          required: ["elementIndex", "content"],
          additionalProperties: false,
        },
      },
    },
    required: ["slideId", "elements"],
    additionalProperties: false,
  };

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Generate conclusion for "${topicName}" in ${language}. 100-150 words, concise summary. Each element MUST be UNIQUE.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "conclusion",
        strict: true,
        schema: contentSchema,
      },
    },
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const generatedData = JSON.parse(raw);

  logger.info("Conclusion slide generated", { slideId: slide.id });

  const updatedSlide = {
    ...slide,
    elements: slide.elements.map((el: any, idx: number) => {
      const generatedElement = generatedData.elements?.find(
        (ge: any) => ge.elementIndex === idx
      );

      if (
        generatedElement &&
        (el.type === "text" || el.type === "shape" || el.type === "table")
      ) {
        return { ...el, content: generatedElement.content };
      }

      return el;
    }),
  };

  return updatedSlide;
};

export const generateReferences = async (
  topicName: string,
  language: string,
  count: number = 5,
  slide: any
) => {
  logger.info("Generating references slide", { topic: topicName, count });

  const textShapeTableElements = slide.elements
    .map((el: any, idx: number) => ({
      index: idx,
      type: el.type,
      width: el.width || 0,
      height: el.height || 0,
      left: el.left || 0,
      top: el.top || 0,
      currentContent: el.content || "",
      fontSize: el.fontSize || 14,
      maxCharacters: el.maxCharacters || 100,
    }))
    .filter(
      (el: any) =>
        el.type === "text" || el.type === "shape" || el.type === "table"
    );

  const contentSchema = {
    type: "object",
    properties: {
      slideId: { type: "string" },
      elements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            elementIndex: { type: "number" },
            content: { type: "string" },
          },
          required: ["elementIndex", "content"],
          additionalProperties: false,
        },
      },
    },
    required: ["slideId", "elements"],
    additionalProperties: false,
  };

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Generate ${count} academic references for "${topicName}" in ${language}. Numbered list with author, title, date, publisher.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "references",
        strict: true,
        schema: contentSchema,
      },
    },
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const generatedData = JSON.parse(raw);

  logger.info("References slide generated", { slideId: slide.id });

  const updatedSlide = {
    ...slide,
    elements: slide.elements.map((el: any, idx: number) => {
      const generatedElement = generatedData.elements?.find(
        (ge: any) => ge.elementIndex === idx
      );

      if (
        generatedElement &&
        (el.type === "text" || el.type === "shape" || el.type === "table")
      ) {
        return { ...el, content: generatedElement.content };
      }

      return el;
    }),
  };

  return updatedSlide;
};

export const generateThankYouSlide = async (
  topicName: string,
  language: string,
  slide: any
) => {
  logger.info("Generating thank you slide", { topic: topicName });

  const textShapeTableElements = slide.elements
    .map((el: any, idx: number) => ({
      index: idx,
      type: el.type,
      width: el.width || 0,
      height: el.height || 0,
      left: el.left || 0,
      top: el.top || 0,
      currentContent: el.content || "",
      fontSize: el.fontSize || 14,
      maxCharacters: el.maxCharacters || 100,
    }))
    .filter(
      (el: any) =>
        el.type === "text" || el.type === "shape" || el.type === "table"
    );

  const contentSchema = {
    type: "object",
    properties: {
      slideId: { type: "string" },
      elements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            elementIndex: { type: "number" },
            content: { type: "string" },
          },
          required: ["elementIndex", "content"],
          additionalProperties: false,
        },
      },
    },
    required: ["slideId", "elements"],
    additionalProperties: false,
  };

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Generate thank you slide for "${topicName}" in ${language}. Main element: "Thank you for your attention" in ${language}.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "thankYouSlide",
        strict: true,
        schema: contentSchema,
      },
    },
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const generatedData = JSON.parse(raw);

  logger.info("Thank you slide generated", { slideId: slide.id });

  const updatedSlide = {
    ...slide,
    elements: slide.elements.map((el: any, idx: number) => {
      const generatedElement = generatedData.elements?.find(
        (ge: any) => ge.elementIndex === idx
      );

      if (
        generatedElement &&
        (el.type === "text" || el.type === "shape" || el.type === "table")
      ) {
        return { ...el, content: generatedElement.content };
      }

      return el;
    }),
  };

  return updatedSlide;
};

// Export integrated generator for advanced usage
export { integratedGenerator };
