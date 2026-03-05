/**
 * Centralized JSON schemas for OpenAI structured outputs.
 * These schemas are used across multiple generators to avoid duplication.
 */

/**
 * Schema for special slides (conclusion, references, thank you).
 */
export const specialSlideContentSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    slideId: { type: 'string' },
    elements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          elementIndex: { type: 'number' },
          content: { type: 'string' },
        },
        required: ['elementIndex', 'content'],
        additionalProperties: false,
      },
    },
  },
  required: ['slideId', 'elements'],
  additionalProperties: false,
};

/**
 * Create outline JSON schema for OpenAI structured output.
 */
export function createOutlineSchema(language: string, outlineCount: number = 3): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      outline: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: `Outline title in ${language}` },
            title_eng: { type: 'string', description: 'Outline title in English' },
          },
          required: ['title', 'title_eng'],
          additionalProperties: false,
        },
        minItems: outlineCount,
        maxItems: outlineCount,
      },
      slides: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            slideIndex: { type: 'number', description: 'Original slide index (0-based)' },
            title: { type: 'string', description: `Slide title in ${language}` },
            title_eng: { type: 'string', description: 'Slide title in English' },
            outlineIndex: { type: 'number', description: `Outline point (0-${outlineCount - 1})` },
          },
          required: ['slideIndex', 'title', 'title_eng', 'outlineIndex'],
          additionalProperties: false,
        },
      },
    },
    required: ['outline', 'slides'],
    additionalProperties: false,
  };
}

/**
 * Create content generation JSON schema for a slide.
 */
export function createContentSchema(
  language: string,
  hasTable: boolean
): Record<string, unknown> {
  const elementProps: Record<string, unknown> = {
    elementIndex: { type: 'number' },
    content: { type: 'string', description: `Generated content in ${language}` },
  };

  const required = ['elementIndex', 'content'];

  if (hasTable) {
    elementProps.tableData = {
      type: ['object', 'null'],
      properties: {
        data: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
      },
      required: ['data'],
      additionalProperties: false,
    };
    required.push('tableData');
  }

  return {
    type: 'object',
    properties: {
      slideId: { type: 'string' },
      elements: {
        type: 'array',
        items: {
          type: 'object',
          properties: elementProps,
          required,
          additionalProperties: false,
        },
      },
    },
    required: ['slideId', 'elements'],
    additionalProperties: false,
  };
}
