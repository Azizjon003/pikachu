// OpenAI Structured Outputs version (requires openai >= 4.52.0)
import OpenAI from "openai";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
import { OutlineSchema, OutlineResponse } from "./schema";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Helper function to identify nearby elements (within 50px)
 * Used for spatial awareness to prevent content overlap
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
      Math.abs(el.left + el.width - (currentElement.left + currentElement.width)) < threshold ||
      Math.abs(el.top + el.height - (currentElement.top + currentElement.height)) < threshold;

    return isNearby;
  });
};

/**
 * TASK 1: Apply reduced font size to HTML content
 * Replaces the font-size value in HTML string while preserving other styles
 */
const applyFontSize = (htmlContent: string, newFontSize: number): string => {
  // Replace font-size value in style attribute
  return htmlContent.replace(
    /font-size:\s*\d+(?:\.\d+)?\s*px/gi,
    `font-size: ${newFontSize.toFixed(1)}px`
  );
};

/**
 * TASK 1: Validate generated content with font size reduction instead of truncation
 * Returns validation result with adjusted fontSize if content exceeds maxCharacters
 *
 * TASK 2: Improved validation with flexible content length requirements
 */
const validateContent = (
  element: any,
  generatedContent: string,
  originalFontSize: number,
  maxCharacters: number
): { isValid: boolean; content: string; fontSize?: number; warnings: string[] } => {
  const warnings: string[] = [];
  let content = generatedContent;
  let adjustedFontSize: number | undefined;

  // Check for missing spaces (words merged together)
  if (/[a-z][A-Z]/.test(content)) {
    warnings.push("Content may have missing spaces between words");
  }

  // TASK 1: Instead of truncating, calculate reduced font size
  if (content.length > maxCharacters) {
    // Calculate how much smaller the font should be
    let newFontSize = originalFontSize * (maxCharacters / content.length);

    // Ensure minimum readability (8px minimum)
    const MIN_FONT_SIZE = 8;
    newFontSize = Math.max(newFontSize, MIN_FONT_SIZE);

    adjustedFontSize = newFontSize;

    warnings.push(
      `Font size reduced from ${originalFontSize}px to ${newFontSize.toFixed(1)}px due to content length (${content.length} chars, max: ${maxCharacters})`
    );
  }

  // TASK 2: Flexible content length validation based on element size
  let minExpectedRatio: number;
  if (maxCharacters > 200) {
    // Large elements: minimum 40% usage
    minExpectedRatio = 0.4;
  } else if (maxCharacters >= 50) {
    // Medium elements: minimum 30% usage
    minExpectedRatio = 0.3;
  } else {
    // Small elements: minimum 20% usage
    minExpectedRatio = 0.2;
  }

  const minExpectedChars = maxCharacters * minExpectedRatio;
  if (
    element.width > 300 &&
    element.height > 100 &&
    content.length < minExpectedChars
  ) {
    warnings.push(
      `Content may be too short for element size (${content.length} chars, expected ~${Math.floor(minExpectedChars)})`
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
 * TASK 2: Group elements by similar sizes for diversity awareness
 */
const groupBySimilarSize = (elements: any[], threshold: number = 50): Map<number, any[]> => {
  const groups = new Map<number, any[]>();

  elements.forEach((el) => {
    let foundGroup = false;

    // Try to find existing group with similar maxCharacters
    for (const [key, group] of groups.entries()) {
      if (Math.abs(key - el.maxCharacters) < threshold) {
        group.push(el);
        foundGroup = true;
        break;
      }
    }

    // Create new group if no similar group found
    if (!foundGroup) {
      groups.set(el.maxCharacters, [el]);
    }
  });

  return groups;
};

export const generateOutline = async (
  slides: any[],
  language: string,
  page: number,
  topic: string
): Promise<OutlineResponse> => {
  // Validate and adjust slide count

  // slides object remove 0,1 and slides lengths -2,-1,0
  slides = slides.filter(
    (slide, index) =>
      index !== 0 &&
      index !== 1 &&
      index !== slides.length - 3 &&
      index !== slides.length - 2 &&
      index !== slides.length - 1
  );
  const availableSlidesCount = slides.length;
  const actualPageCount = page; // Always generate requested count

  console.log(`📊 Available slides: ${availableSlidesCount}`);
  console.log(`🎯 Requested: ${page}, Will select: ${actualPageCount}`);

  // Manual JSON schema definition
  const jsonSchema = {
    type: "object",
    properties: {
      outline: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: `Outline title in ${language}`,
            },
            title_eng: {
              type: "string",
              description: "Outline title in English",
            },
          },
          required: ["title", "title_eng"],
          additionalProperties: false,
        },
      },
      slides: {
        type: "array",
        items: {
          type: "object",
          properties: {
            slideIndex: {
              type: "number",
              description:
                "Which slide index from the original slides array (0-based index)",
            },
            title: { type: "string" },
            title_eng: { type: "string" },
            outlineIndex: {
              type: "number",
              description: "Which outline point it belongs to (0-2)",
            },
          },
          required: ["slideIndex", "title", "title_eng", "outlineIndex"],
          additionalProperties: false,
        },
      },
    },
    required: ["outline", "slides"],
    additionalProperties: false,
  };

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a professional presentation assistant. Analyze the provided slides and create a structured outline based on the given topic.

STRICT RULES:

1. OUTLINE GENERATION:
   - Create EXACTLY 3 main topic outlines
   - Each outline must have:
     * "title": Outline title in ${language} (based on topic "${topic}")
     * "title_eng": Outline title in English (based on topic "${topic}")
   - Outlines must cover the main aspects of "${topic}"
   - Outlines must follow a logical sequence

2. SLIDES SELECTION:
   ⚠️ CRITICAL: Total available slides = ${availableSlidesCount}
   - You MUST generate EXACTLY ${actualPageCount} slides (NO LESS, NO MORE)
   - You can ONLY use indexes from 0 to ${availableSlidesCount - 1}
   - If ${actualPageCount} > ${availableSlidesCount}, you MUST REUSE slides until the total reaches ${actualPageCount}
   - For each slide:
     * "slideIndex": MUST be a valid index from the available range
     * "title": Slide title in ${language}
     * "title_eng": Slide title in English
     * "outlineIndex": Which outline it belongs to (0, 1, or 2)


3. IMPORTANT GUIDELINES:
   - ❌ DO NOT create fake slideIndex numbers
   - ✅ ONLY use slideIndex from the provided list [0-${
     availableSlidesCount - 1
   }]
   - Outline titles must be directly related to the topic "${topic}"
   - Each outline must represent a logical section
   - Group slides under the appropriate outline

EXAMPLE for topic "The Future of AI":
{
  "outline": [
    {"title": "Fundamentals and History of AI", "title_eng": "Fundamentals and History of AI"},
    {"title": "Current AI Technologies", "title_eng": "Current AI Technologies"},
    {"title": "Future Prospects of AI", "title_eng": "Future Prospects of AI"}
  ],
  "slides": [
    {"slideIndex": 0, "title": "...", "title_eng": "...", "outlineIndex": 0},
    {"slideIndex": 3, "title": "...", "title_eng": "...", "outlineIndex": 1}
  ]
}`,
      },
      {
        role: "user",
        content: `MAIN TOPIC: "${topic}"
LANGUAGE: ${language}
TOTAL AVAILABLE SLIDES: ${availableSlidesCount}
SLIDES TO SELECT: ${actualPageCount}
VALID SLIDE INDEXES: 0 to ${availableSlidesCount - 1}

AVAILABLE SLIDES (with their ACTUAL index numbers):
${JSON.stringify(slides)}

YOUR TASK:
1. Analyze the main topic "${topic}"
2. Create 3 logical outline topics that cover different aspects of "${topic}"
   - Write each outline title in both ${language} and English
   - Make sure outlines logically divide the main topic into 3 parts
3. Select EXACTLY ${actualPageCount} slides from the ${availableSlidesCount} slides listed above
4. ⚠️ IMPORTANT: Use ONLY the actual index numbers shown in brackets [0] to [${
          availableSlidesCount - 1
        }]
5. Assign each slide to the appropriate outline (outlineIndex: 0, 1, or 2)
6. Write slide titles in both ${language} and English`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "outline",
        strict: true,
        schema: jsonSchema,
      },
    },
    temperature: 0.7,
  });

  const raw = completion.choices[0].message.content ?? "{}";
  let parsed;
  try {
    const jsonData = JSON.parse(raw);

    // Validate with Zod
    parsed = OutlineSchema.parse(jsonData);

    // Slide index validation
    const invalidIndexes = parsed.slides.filter(
      (slide) =>
        slide.slideIndex < 0 || slide.slideIndex >= availableSlidesCount
    );

    if (invalidIndexes.length > 0) {
      console.error(`❌ Invalid slideIndex found:`, invalidIndexes);
      throw new Error(
        `Invalid slideIndex detected. Valid range: 0-${
          availableSlidesCount - 1
        }`
      );
    }

    // Validate slide count
    if (parsed.slides.length !== actualPageCount) {
      console.warn(
        `⚠️ Expected ${actualPageCount} slides, got ${parsed.slides.length}`
      );
    }

    console.log(`✅ Validated response:`);
    console.log(`   - ${parsed.outline.length} outlines`);
    console.log(`   - ${parsed.slides.length} slides selected`);
    console.log(
      `   - Slide indexes: [${parsed.slides
        .map((s) => s.slideIndex)
        .join(", ")}]`
    );
  } catch (e) {
    console.error("❌ Validation error:", e);
    throw e;
  }

  return parsed;
};

export const generateContent = async (
  slide: any,
  outline: any,
  language: string
) => {
  // Extract and prepare text/shape/table elements with full details including fontSize and maxCharacters
  const textShapeTableElements = slide.elements
    .map((el: any, idx: number) => ({
      index: idx,
      type: el.type,
      width: el.width || 0,
      height: el.height || 0,
      left: el.left || 0,
      top: el.top || 0,
      currentContent: el.content || "",
      fontSize: el.fontSize || 14, // Font size from schema
      maxCharacters: el.maxCharacters || 100, // Max characters from schema
      // For table elements, also include table structure
      tableData: el.tableData || null,
    }))
    .filter(
      (el: any) =>
        el.type === "text" || el.type === "shape" || el.type === "table"
    );

  // TASK 2: Group elements by similar sizes for diversity awareness
  const sizeGroups = groupBySimilarSize(textShapeTableElements);

  // Track previously generated content to avoid repetition
  const previouslyGenerated: Array<{ index: number; content: string }> = [];

  const contentSchema = {
    type: "object",
    properties: {
      slideId: {
        type: "string",
        description: "The ID of the slide being filled",
      },
      elements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            elementIndex: {
              type: "number",
              description: "Index of the element in the slide's elements array",
            },
            content: {
              type: "string",
              description: `Generated content in ${language} language`,
            },
            tableData: {
              type: "object",
              description: "Table data structure for table elements",
              properties: {
                data: {
                  type: "array",
                  items: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                },
              },
              required: ["data"],
              additionalProperties: false,
            },
          },
          required: ["elementIndex", "content", "tableData"],
          additionalProperties: false,
        },
      },
    },
    required: ["slideId", "elements"],
    additionalProperties: false,
  };

  // TASK 2: Build diversity context for prompt
  let diversityContext = "";
  for (const [maxChars, group] of sizeGroups.entries()) {
    if (group.length > 1) {
      diversityContext += `\n⚠️ CONTENT DIVERSITY: There are ${group.length} similar-sized elements (maxChars ~${maxChars}).`;
      diversityContext += `\n   Each MUST have UNIQUE, DIFFERENT content. Do NOT repeat similar text!`;
      diversityContext += `\n   Provide diverse topics/aspects for each element.`;
    }
  }

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a professional presentation content writer. Generate content for ALL text, shape, and table elements.

CRITICAL RULES:
1. You MUST generate content for EVERY element listed
2. Do NOT skip any elements
3. Content MUST be in ${language} language
4. ⚠️ STRICT CHARACTER LIMITS: Each element has a maxCharacters limit. Try to stay within it, but don't worry too much - font size will be adjusted if needed.
5. ⚠️ CONTENT DIVERSITY: Each element MUST have UNIQUE content. NEVER repeat the same text across different elements!
6. For similar-sized elements, provide DIFFERENT topics, aspects, or perspectives
7. Use element properties to determine content style:
   - Large width/height + top position = Main title (3-8 words)
   - Medium size + center = Body text (concise paragraphs or bullets)
   - Small size = Labels or callouts (1-3 words)
   - Table elements = Generate appropriate table data with rows and columns

CHARACTER LIMIT GUIDELINES:
- For small elements (maxChars < 50): Use very short text (1-5 words)
- For medium elements (maxChars 50-200): Use concise phrases or sentences
- For large elements (maxChars > 200): Use paragraphs
- Add spaces between words - NEVER merge words together!
- If content is slightly longer than maxChars, it's OK - the font size will automatically adjust

CONTENT VARIETY RULES:
- NEVER use the same or similar text for different elements
- Each element should cover a DIFFERENT aspect of the topic
- Similar-sized elements should have DISTINCT, non-overlapping content
- Vary your language and phrasing across elements

GOOD CONTENT EXAMPLES:
✅ Element 1: "Introduction to AI" (title)
✅ Element 2: "Machine Learning Fundamentals" (different subtitle)
✅ Element 3: "Neural networks process data through interconnected layers" (unique body text)

BAD CONTENT EXAMPLES:
❌ Element 1: "Introduction" and Element 2: "Introduction" (DUPLICATE!)
❌ Element 1: "Key Points" and Element 2: "Key Points" (DUPLICATE!)
❌ "THISISATITLEWITHOUTSPACES" (missing spaces)

QUALITY GUIDELINES:
- Main titles: Short, impactful, clear
- Subtitles: Descriptive and informative
- Body text: Concise, professional, engaging
- Labels: Brief but meaningful
- Tables: Relevant data with proper headers and content
- ALL content must relate to: "${outline.title || outline.title_eng}"
- EVERY element must have DIFFERENT, UNIQUE content!${diversityContext}`,
      },
      {
        role: "user",
        content: `SLIDE ID: ${slide.id}
OUTLINE TOPIC: ${outline.title || outline.title_eng}
LANGUAGE: ${language}
TOTAL TEXT/SHAPE/TABLE ELEMENTS: ${textShapeTableElements.length}

ELEMENTS TO FILL (you must fill ALL ${textShapeTableElements.length} elements):
${textShapeTableElements
  .map((el: any, i: number) => {
    const nearby = findNearbyElements(el, textShapeTableElements);
    const nearbyInfo = nearby.length > 0
      ? `\n   ⚠️ NEARBY ELEMENTS: ${nearby.map(n => `[${n.index}] at (${n.left},${n.top})`).join(", ")}`
      : "";

    return `
${i + 1}. Element [${el.index}] - ${el.type.toUpperCase()} - ID: #${el.index}
   Size: ${el.width} x ${el.height}
   Position: (${el.left}, ${el.top})
   Font Size: ${el.fontSize}px
   ⚠️ MAX CHARACTERS: ${el.maxCharacters} (guideline - font will auto-adjust if slightly exceeded)
   Current: "${el.currentContent || "EMPTY - FILL THIS"}"
   ${
     el.type === "table"
       ? `Table Data: ${JSON.stringify(el.tableData) || "EMPTY"}`
       : ""
   }
   ${el.top < 100 && el.width > 500 ? ">>> LIKELY MAIN TITLE (keep it short and UNIQUE!)" : ""}
   ${el.height > 300 ? ">>> LIKELY BODY CONTENT (detailed and DISTINCT from other elements!)" : ""}
   ${el.width < 200 && el.height < 100 ? ">>> LIKELY LABEL (very brief and UNIQUE!)" : ""}
   ${el.type === "table" ? ">>> TABLE - GENERATE ROWS AND COLUMNS" : ""}${nearbyInfo}`;
  })
  .join("\n")}

MANDATORY TASK:
1. Generate content for ALL ${textShapeTableElements.length} elements above
2. ⚠️ CRITICAL: Each element MUST have UNIQUE, DIFFERENT content - NO DUPLICATES OR SIMILARITIES!
3. Match content to outline topic: "${outline.title || outline.title_eng}"
4. Consider size, position, and fontSize for content style
5. Stay close to maxCharacters limit (slight overflow is OK)
6. Ensure proper spacing between words (NO merged words!)
7. For nearby elements, ensure content doesn't visually clash
8. For table elements, generate appropriate tableData with rows
9. Write in ${language} language
10. Return content for EVERY element (slideId: "${
          slide.id
        }", elements: array of ${textShapeTableElements.length} items)`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "slide_content",
        strict: true,
        schema: contentSchema,
      },
    },
    temperature: 0.7,
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const generatedData = JSON.parse(raw);

  // TASK 1 & 2: Validate and apply font size reduction
  const validationResults: any[] = [];

  if (generatedData.elements) {
    generatedData.elements = generatedData.elements.map((genEl: any) => {
      const originalEl = textShapeTableElements.find(
        (el: any) => el.index === genEl.elementIndex
      );

      if (originalEl && genEl.content) {
        const validation = validateContent(
          originalEl,
          genEl.content,
          originalEl.fontSize,
          originalEl.maxCharacters
        );

        validationResults.push({
          index: genEl.elementIndex,
          ...validation,
        });

        // Keep the original content (no truncation!)
        genEl.content = validation.content;

        // Store font size adjustment if needed
        if (validation.fontSize) {
          genEl.adjustedFontSize = validation.fontSize;
        }
      }

      return genEl;
    });
  }

  fs.writeFileSync(
    `${slide.id}.generatedData.json`,
    JSON.stringify(generatedData, null, 2)
  );

  // Log validation results
  const hasWarnings = validationResults.some((v) => v.warnings.length > 0);
  if (hasWarnings) {
    console.log(`⚠️ Content validation warnings for slide ${slide.id}:`);
    validationResults.forEach((v) => {
      if (v.warnings.length > 0) {
        console.log(`   Element [${v.index}]: ${v.warnings.join(", ")}`);
      }
    });
  }

  const filledCount = generatedData.elements?.length || 0;
  const expectedCount = textShapeTableElements.length;

  console.log(`✅ Content generated for slide ${slide.id}`);
  console.log(
    `   - Filled: ${filledCount}/${expectedCount} text/shape/table elements`
  );

  if (filledCount < expectedCount) {
    console.warn(
      `   ⚠️ WARNING: ${expectedCount - filledCount} elements were not filled!`
    );
    console.log(
      "   Missing indexes:",
      textShapeTableElements
        .filter(
          (el: any) =>
            !generatedData.elements?.find(
              (ge: any) => ge.elementIndex === el.index
            )
        )
        .map((el: any) => el.index)
    );
  }

  // TASK 1: Apply font size adjustments when merging back to slide
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
        const updatedElement = {
          ...el,
          content: generatedElement.content,
        };

        // TASK 1: Apply font size reduction if needed
        if (generatedElement.adjustedFontSize) {
          if (el.type === "text") {
            updatedElement.content = applyFontSize(
              generatedElement.content,
              generatedElement.adjustedFontSize
            );
          } else if (el.type === "shape" && el.text?.content) {
            updatedElement.text = {
              ...el.text,
              content: applyFontSize(
                generatedElement.content,
                generatedElement.adjustedFontSize
              ),
            };
          }
        }

        // For table elements, also update tableData if provided
        if (el.type === "table" && generatedElement.tableData) {
          // updatedElement.tableData = generatedElement.tableData;
          updatedElement.data =
            generatedElement.tableData?.data || generatedElement.tableData;
        }

        return updatedElement;
      }

      return el;
    }),
  };

  return updatedSlide;
};

export const generateConculation = async (
  topicName: string,
  language: string,
  slide: any
) => {
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
      slideId: {
        type: "string",
        description: "The ID of the slide being filled",
      },
      elements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            elementIndex: {
              type: "number",
              description: "Index of the element in the slide's elements array",
            },
            content: {
              type: "string",
              description: `Generated content in ${language} language`,
            },
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
        content: `Generate a conclusion slide for the topic: **${topicName}**.
The content must be a concise summary of approximately 100 to 150 words, informative, well-structured, and written entirely in the **${language}** language.

Return the result strictly as a JSON object following the given **json_structure**, without any deviations.

**Requirements:**

- **Language Focus**: All generated text, including the title, must be fluent and grammatically correct **${language}**. Do not use any other language.
- **Title**: Use the topic name as the main title in **${language}**.
- **Content**:
  - Provide a brief yet informative overview of the topic, focusing on key takeaways and essential information.
  - Structure the content into clear, complete, declarative sentences that convey the main ideas (e.g., use periods/full stops).
  - Avoid using interrogative sentences (questions).
  - Try to stay within maxCharacters limits, but slight overflow is OK - font size will adjust.
  - ⚠️ Each element MUST have UNIQUE content - NO DUPLICATES!

Do not include any additional information outside of the specified format. Stick strictly to the **json_structure** provided.

QUALITY GUIDELINES:
- Main titles: Short, impactful, clear, and in **${language}**
- Subtitles: Descriptive and informative
- Body text: Concise, professional, engaging
- Labels: Brief but meaningful
- Tables: Relevant data with proper headers and content
- ALL content must relate to: "${topicName}"

SLIDE ID: ${slide.id}
TOPIC: ${topicName}
LANGUAGE: ${language}
TOTAL TEXT/SHAPE/TABLE ELEMENTS: ${textShapeTableElements.length}

ELEMENTS TO FILL (you must fill ALL ${textShapeTableElements.length} elements):
${textShapeTableElements
  .map(
    (el: any, i: number) =>
      `
${i + 1}. Element [${el.index}] - ${el.type.toUpperCase()}
   Size: ${el.width} x ${el.height}
   Position: (${el.left}, ${el.top})
   Font Size: ${el.fontSize}px
   ⚠️ MAX CHARACTERS: ${el.maxCharacters} (guideline - font will auto-adjust)
   Current: "${el.currentContent || "EMPTY - FILL THIS"}"
   ${
     el.type === "table"
       ? `Table Data: ${JSON.stringify(el.tableData) || "EMPTY"}`
       : ""
   }
   ${el.top < 100 && el.width > 500 ? ">>> LIKELY MAIN TITLE" : ""}
   ${el.height > 300 ? ">>> LIKELY BODY CONTENT" : ""}
   ${el.width < 200 && el.height < 100 ? ">>> LIKELY LABEL" : ""}
   ${el.type === "table" ? ">>> TABLE - GENERATE ROWS AND COLUMNS" : ""}`
  )
  .join("\n")}

MANDATORY TASK:
1. Generate content for ALL ${textShapeTableElements.length} elements above
2. ⚠️ Each element MUST have UNIQUE content - NO DUPLICATES!
3. Match content to outline topic: "${topicName}"
4. Consider size and position for content style
5. For table elements, generate appropriate **tableData** with rows/columns
6. Write in **${language}** language
7. Stay close to maxCharacters limit (slight overflow is OK)
8. Return content for EVERY element (slideId: "${
          slide.id
        }", elements: array of ${textShapeTableElements.length} items)
        `,
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

  fs.writeFileSync(
    `${slide.id}.generatedData.json`,
    JSON.stringify(generatedData, null, 2)
  );
  const filledCount = generatedData.elements?.length || 0;
  const expectedCount = textShapeTableElements.length;

  console.log(`✅ Content generated for slide ${slide.id}`);
  console.log(
    `   - Filled: ${filledCount}/${expectedCount} text/shape/table elements`
  );

  if (filledCount < expectedCount) {
    console.warn(
      `   ⚠️ WARNING: ${expectedCount - filledCount} elements were not filled!`
    );
    console.log(
      "   Missing indexes:",
      textShapeTableElements
        .filter(
          (el: any) =>
            !generatedData.elements?.find(
              (ge: any) => ge.elementIndex === el.index
            )
        )
        .map((el: any) => el.index)
    );
  }

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
        const updatedElement = {
          ...el,
          content: generatedElement.content,
        };

        return updatedElement;
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

  // Identify the likely main title element and the large body element for the list
  const mainTitleElement = textShapeTableElements.find(
    (el: any) => el.top < 100 && el.width > 500
  );
  const bodyContentElement = textShapeTableElements.find(
    (el: any) => el.height > 300
  );

  const contentSchema = {
    type: "object",
    properties: {
      slideId: {
        type: "string",
        description: "The ID of the slide being filled",
      },
      elements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            elementIndex: {
              type: "number",
              description: "Index of the element in the slide's elements array",
            },
            content: {
              type: "string",
              description: `Generated content in ${language} language`,
            },
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
        content: `Generate a comprehensive list of **${count} academic literature sources** related to the topic: **${topicName}**. The content, including all reference entries and the main slide title, must be written entirely in **${language}**.

Return the result strictly as a JSON object following the given **json_structure**, without any deviations.

**Requirements:**

- **Main Title Translation:** Translate the English term "**References**" (or equivalent, like "List of Literature" or "Sources") into the **${language}** language. Use this translation as the content for the element identified as the **>>> LIKELY MAIN TITLE**.
- **Reference List Content:**
    - Generate **${count}** sources.
    - Each source must include: author(s), title, publication date, publisher/journal.
    - Sources should be a mix of books, academic articles, and scientific papers.
    - Sources should be relevant to the topic and presented in **alphabetical order** by author's last name.
    - Format the references as a **single block of text** with numbered list items (1., 2., 3., etc.). Do not use markdown headings, bullets, or bolding within the list items.
- **Content Placement:** Place the full, numbered list of all **${count}** references into the element identified as the **>>> LIKELY BODY CONTENT** (if it exists).
- Stay close to maxCharacters limits (slight overflow is OK - font will auto-adjust)
- ⚠️ Each element MUST have UNIQUE content - NO DUPLICATES!

**Language & Formatting:**
- All content must be in **${language}** language.
- The reference list must be structured sequentially, one reference after another.
- Fill content for **ALL** ${
          textShapeTableElements.length
        } elements. Other elements should receive short, appropriate titles or labels in ${language} if their size/position suggests a non-body role.

Do not include any additional information outside of the specified format. Stick strictly to the **json_structure** provided.

SLIDE ID: ${slide.id}
TOPIC: ${topicName}
LANGUAGE: ${language}
TOTAL TEXT/SHAPE/TABLE ELEMENTS: ${textShapeTableElements.length}

ELEMENTS TO FILL (you must fill ALL ${textShapeTableElements.length} elements):
${textShapeTableElements
  .map(
    (el: any, i: number) =>
      `
${i + 1}. Element [${el.index}] - ${el.type.toUpperCase()}
   Size: ${el.width} x ${el.height}
   Position: (${el.left}, ${el.top})
   Font Size: ${el.fontSize}px
   ⚠️ MAX CHARACTERS: ${el.maxCharacters} (guideline - font will auto-adjust)
   Current: "${el.currentContent || "EMPTY - FILL THIS"}"
   ${
     el.type === "table"
       ? `Table Data: ${JSON.stringify(el.tableData) || "EMPTY"}`
       : ""
   }
   ${
     el.top < 100 && el.width > 500
       ? ">>> LIKELY MAIN TITLE (Use the translated term for 'References')"
       : ""
   }
   ${
     el.height > 300
       ? `>>> LIKELY BODY CONTENT (Use this for the complete, numbered list of ${count} references)`
       : ""
   }
   ${el.width < 200 && el.height < 100 ? ">>> LIKELY LABEL" : ""}
   ${el.type === "table" ? ">>> TABLE - GENERATE ROWS AND COLUMNS" : ""}`
  )
  .join("\n")}

MANDATORY TASK:
1. Generate content for ALL ${textShapeTableElements.length} elements above.
2. ⚠️ Each element MUST have UNIQUE content - NO DUPLICATES!
3. Match content to outline topic: "${topicName}".
4. Consider size and position for content style.
5. For table elements, generate appropriate tableData with rows.
6. Write in ${language} language.
7. Stay close to maxCharacters limit (slight overflow is OK)
8. Return content for EVERY element (slideId: "${
          slide.id
        }", elements: array of ${textShapeTableElements.length} items).
`,
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

  fs.writeFileSync(
    `${slide.id}.generatedData.json`,
    JSON.stringify(generatedData, null, 2)
  );
  const filledCount = generatedData.elements?.length || 0;
  const expectedCount = textShapeTableElements.length;

  console.log(`✅ Content generated for slide ${slide.id}`);
  console.log(
    `   - Filled: ${filledCount}/${expectedCount} text/shape/table elements`
  );

  if (filledCount < expectedCount) {
    console.warn(
      `   ⚠️ WARNING: ${expectedCount - filledCount} elements were not filled!`
    );
    console.log(
      "   Missing indexes:",
      textShapeTableElements
        .filter(
          (el: any) =>
            !generatedData.elements?.find(
              (ge: any) => ge.elementIndex === el.index
            )
        )
        .map((el: any) => el.index)
    );
  }

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
        const updatedElement = {
          ...el,
          content: generatedElement.content,
        };

        return updatedElement;
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
      slideId: {
        type: "string",
        description: "The ID of the slide being filled",
      },
      elements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            elementIndex: {
              type: "number",
              description: "Index of the element in the slide's elements array",
            },
            content: {
              type: "string",
              description: `Generated content in ${language} language`,
            },
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
        content: `Generate a thank you slide for the topic: **${topicName}**. The slide should be written entirely in **${language}**.

**CRITICAL INSTRUCTION**: Ensure the main title or a prominent element on the slide contains the phrase for "Thank you for your attention" or "Thank you for listening" translated into the **${language}** language. For example, if the language is Uzbek, use "Etiboringiz uchun rahmat".

Try to stay within maxCharacters limits (slight overflow is OK - font will auto-adjust)
⚠️ Each element MUST have UNIQUE content - NO DUPLICATES!`,
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

  fs.writeFileSync(
    `${slide.id}.generatedData.json`,
    JSON.stringify(generatedData, null, 2)
  );
  const filledCount = generatedData.elements?.length || 0;
  const expectedCount = textShapeTableElements.length;

  console.log(`✅ Content generated for slide ${slide.id}`);
  console.log(
    `   - Filled: ${filledCount}/${expectedCount} text/shape/table elements`
  );

  if (filledCount < expectedCount) {
    console.warn(
      `   ⚠️ WARNING: ${expectedCount - filledCount} elements were not filled!`
    );
    console.log(
      "   Missing indexes:",
      textShapeTableElements
        .filter(
          (el: any) =>
            !generatedData.elements?.find(
              (ge: any) => ge.elementIndex === el.index
            )
        )
        .map((el: any) => el.index)
    );
  }

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
        const updatedElement = {
          ...el,
          content: generatedElement.content,
        };

        return updatedElement;
      }

      return el;
    }),
  };

  return updatedSlide;
};
