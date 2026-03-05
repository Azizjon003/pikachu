/**
 * Centralized JSON schemas for OpenAI structured outputs.
 * All schemas use `strict: true` compatible format.
 *
 * Key rules for OpenAI strict mode:
 * - Use "integer" instead of "number" for index fields
 * - Use "anyOf" instead of type arrays like ["object", "null"]
 * - Every object must have "additionalProperties: false"
 * - Every property must be in "required" array
 */

/**
 * Schema for special slides (conclusion, references, thank you).
 */
export function createSpecialSlideSchema(elementCount: number): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      slideId: { type: 'string' },
      elements: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            elementIndex: { type: 'integer', description: 'Index of the element in the slide' },
            content: { type: 'string', minLength: 1, description: 'Generated text content' },
          },
          required: ['elementIndex', 'content'],
          additionalProperties: false,
        },
        minItems: elementCount,
        maxItems: elementCount,
      },
    },
    required: ['slideId', 'elements'],
    additionalProperties: false,
  };
}

/**
 * Create outline JSON schema for OpenAI structured output.
 */
export function createOutlineSchema(
  language: string,
  outlineCount: number,
  pageCount: number,
  availableSlides: number
): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      outline: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: `Outline section title in ${language}` },
            title_eng: { type: 'string', description: 'Outline section title in English' },
            description: { type: 'string', description: `Brief description of what this section covers (1-2 sentences in ${language})` },
          },
          required: ['title', 'title_eng', 'description'],
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
            slideIndex: {
              type: 'integer',
              minimum: 0,
              maximum: availableSlides - 1,
              description: `Original slide index (0-based, valid range: 0 to ${availableSlides - 1})`,
            },
            title: { type: 'string', description: `Slide title in ${language}` },
            title_eng: { type: 'string', description: 'Slide title in English' },
            outlineIndex: {
              type: 'integer',
              minimum: 0,
              maximum: outlineCount - 1,
              description: `Which outline point this slide belongs to (0 to ${outlineCount - 1})`,
            },
            keyPoints: {
              type: 'array',
              items: { type: 'string' },
              minItems: 3,
              maxItems: 5,
              description: `3-5 specific, factual key points that this slide should cover. Each must contain a concrete fact, number, or technical detail (in ${language})`,
            },
          },
          required: ['slideIndex', 'title', 'title_eng', 'outlineIndex', 'keyPoints'],
          additionalProperties: false,
        },
        minItems: pageCount,
        maxItems: pageCount,
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
  hasTable: boolean,
  elementCount: number
): Record<string, unknown> {
  const elementProps: Record<string, unknown> = {
    elementIndex: { type: 'integer', description: 'Index of the element in the slide' },
    content: { type: 'string', minLength: 1, description: `Generated content in ${language}` },
  };

  const required = ['elementIndex', 'content'];

  if (hasTable) {
    elementProps.tableData = {
      anyOf: [
        {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { type: 'array', items: { type: 'string' } },
              minItems: 1,
            },
          },
          required: ['data'],
          additionalProperties: false,
        },
        { type: 'null' },
      ],
      description: 'Table data if this is a table element, null otherwise',
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
        minItems: elementCount,
        maxItems: elementCount,
      },
    },
    required: ['slideId', 'elements'],
    additionalProperties: false,
  };
}

/**
 * Schema for title page placement (used by LayoutPlacer).
 */
export const titlePlacementSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    title: {
      type: 'object',
      properties: {
        elementIndex: { type: 'integer', description: 'Index of the title element' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' },
      },
      required: ['elementIndex', 'confidence', 'reasoning'],
      additionalProperties: false,
    },
    author: {
      type: 'object',
      properties: {
        elementIndex: { type: 'integer', description: 'Index of the author element' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' },
      },
      required: ['elementIndex', 'confidence', 'reasoning'],
      additionalProperties: false,
    },
  },
  required: ['title', 'author'],
  additionalProperties: false,
};

/**
 * Schema for outline placement (used by LayoutPlacer).
 */
export function createOutlinePlacementSchema(itemCount: number): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      header: {
        type: 'object',
        properties: {
          elementIndex: { type: 'integer', description: 'Index of the header element' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reasoning: { type: 'string' },
        },
        required: ['elementIndex', 'confidence', 'reasoning'],
        additionalProperties: false,
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            elementIndex: { type: 'integer', description: 'Index of the outline item element' },
            order: { type: 'integer', minimum: 1, maximum: itemCount },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            reasoning: { type: 'string' },
          },
          required: ['elementIndex', 'order', 'confidence', 'reasoning'],
          additionalProperties: false,
        },
        minItems: itemCount,
        maxItems: itemCount,
      },
    },
    required: ['header', 'items'],
    additionalProperties: false,
  };
}
