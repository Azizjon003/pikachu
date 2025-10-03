// OpenAI Structured Outputs version (requires openai >= 4.52.0)
import OpenAI from "openai";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
import { OutlineSchema, OutlineResponse } from "./schema";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  // Parse the full JSON string
  const slideJsonString = JSON.stringify(slide);

  // Extract and prepare text/shape/table elements with full details
  const textShapeTableElements = slide.elements
    .map((el: any, idx: number) => ({
      index: idx,
      type: el.type,
      width: el.width || 0,
      height: el.height || 0,
      left: el.left || 0,
      top: el.top || 0,
      currentContent: el.content || "",
      // For table elements, also include table structure
      tableData: el.tableData || null,
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
4. Use element properties to determine content style:
   - Large width/height + top position = Main title (3-8 words)
   - Medium size + center = Body text (concise paragraphs or bullets)
   - Small size = Labels or callouts (1-3 words)
   - Table elements = Generate appropriate table data with rows and columns

QUALITY GUIDELINES:
- Main titles: Short, impactful, clear
- Subtitles: Descriptive and informative
- Body text: Concise, professional, engaging
- Labels: Brief but meaningful
- Tables: Relevant data with proper headers and content
- ALL content must relate to: "${outline.title || outline.title_eng}"`,
      },
      {
        role: "user",
        content: `SLIDE ID: ${slide.id}
OUTLINE TOPIC: ${outline.title || outline.title_eng}
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
2. Match content to outline topic: "${outline.title || outline.title_eng}"
3. Consider size and position for content style
4. For table elements, generate appropriate tableData with rows
5. Write in ${language} language
6. Return content for EVERY element (slideId: "${
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

/**
 * Generate content for ALL slides at once (batch processing)
 */
export const generateAllContent = async (
  slides: any[],
  outline: any,
  language: string
) => {
  // Prepare text/shape elements for each slide
  const slidesData = slides.map((slide, idx) => {
    const textShapeElements = slide.elements
      .map((el: any, elIdx: number) => ({
        index: elIdx,
        type: el.type,
        width: el.width || 0,
        height: el.height || 0,
        left: el.left || 0,
        top: el.top || 0,
        currentContent: el.content || "",
      }))
      .filter((el: any) => el.type === "text" || el.type === "shape");

    return {
      slideIndex: idx,
      slideId: slide.id,
      originalIndex: slide.index,
      textShapeElements: textShapeElements,
      totalElements: slide.elements.length,
    };
  });

  // JSON schema for batch content generation
  const batchContentSchema = {
    type: "object",
    properties: {
      slides: {
        type: "array",
        items: {
          type: "object",
          properties: {
            slideIndex: {
              type: "number",
              description: "Index in the provided slides array (0-based)",
            },
            slideId: {
              type: "string",
              description: "ID of the slide",
            },
            outlineIndex: {
              type: "number",
              description: "Which outline topic this slide belongs to (0-2)",
            },
            elements: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  elementIndex: {
                    type: "number",
                    description: "Index of element in slide's elements array",
                  },
                  content: {
                    type: "string",
                    description: `Generated content in ${language}`,
                  },
                },
                required: ["elementIndex", "content"],
                additionalProperties: false,
              },
            },
          },
          required: ["slideIndex", "slideId", "outlineIndex", "elements"],
          additionalProperties: false,
        },
      },
    },
    required: ["slides"],
    additionalProperties: false,
  };

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a professional presentation content writer. Generate content for ALL text and shape elements in ALL slides.

CRITICAL RULES:
1. You MUST generate content for EVERY text/shape element in EVERY slide
2. Do NOT skip any elements
3. Content MUST be in ${language} language
4. Assign each slide to an appropriate outline topic (0, 1, or 2)
5. Use element properties to determine content style:
   - Large width/height + top position = Main title (3-8 words)
   - Medium size + center = Body text (concise paragraphs or bullets)
   - Small size = Labels or callouts (1-3 words)

OUTLINE TOPICS:
${outline.outline
  .map((o: any, idx: number) => `[${idx}] ${o.title || o.title_eng}`)
  .join("\n")}

QUALITY GUIDELINES:
- Main titles: Short, impactful, clear
- Subtitles: Descriptive and informative
- Body text: Concise, professional, engaging
- Labels: Brief but meaningful
- Content should flow logically across slides`,
      },
      {
        role: "user",
        content: `LANGUAGE: ${language}
TOTAL SLIDES: ${slides.length}

SLIDES WITH TEXT/SHAPE ELEMENTS TO FILL:
${slidesData
  .map(
    (s: any) => `
━━━ SLIDE ${s.slideIndex + 1} ━━━
ID: ${s.slideId} (Original Index: ${s.originalIndex})
Text/Shape Elements: ${s.textShapeElements.length}

ELEMENTS TO FILL (ALL ${s.textShapeElements.length} MUST be filled):
${s.textShapeElements
  .map(
    (el: any, i: number) =>
      `${i + 1}. [${el.index}] ${el.type.toUpperCase()}
   Size: ${el.width}×${el.height}, Position: (${el.left}, ${el.top})
   Current: "${el.currentContent || "EMPTY"}"${
        el.top < 100 && el.width > 500
          ? " >>> MAIN TITLE"
          : el.height > 300
          ? " >>> BODY CONTENT"
          : el.width < 200 && el.height < 100
          ? " >>> LABEL"
          : ""
      }`
  )
  .join("\n")}`
  )
  .join("\n")}

MANDATORY TASK:
1. Generate content for EVERY text/shape element in ALL ${slides.length} slides
2. Assign each slide to outline topic 0, 1, or 2 based on best fit
3. Match content to assigned outline topic
4. Consider element size and position for content style
5. Write in ${language} language
6. Return complete data for ALL slides with ALL their elements filled`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "batch_slides_content",
        strict: true,
        schema: batchContentSchema,
      },
    },
    temperature: 0.7,
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const generatedData = JSON.parse(raw);

  console.log(
    `✅ Content generated for ${generatedData.slides?.length || 0}/${
      slides.length
    } slides`
  );

  // Apply generated content to all slides
  const updatedSlides = slides.map((slide, slideIdx) => {
    const generatedSlide = generatedData.slides?.find(
      (gs: any) => gs.slideIndex === slideIdx
    );

    if (!generatedSlide) {
      console.warn(`⚠️ No generated content for slide ${slideIdx}`);
      return slide;
    }

    const slideData = slidesData[slideIdx];
    const expectedCount = slideData.textShapeElements.length;
    const filledCount = generatedSlide.elements?.length || 0;

    console.log(
      `   - Slide ${slideIdx}: ${filledCount}/${expectedCount} elements filled (Outline: ${generatedSlide.outlineIndex})`
    );

    if (filledCount < expectedCount) {
      console.warn(
        `     ⚠️ WARNING: ${
          expectedCount - filledCount
        } elements were not filled!`
      );
      const missingIndexes = slideData.textShapeElements
        .filter(
          (el: any) =>
            !generatedSlide.elements?.find(
              (ge: any) => ge.elementIndex === el.index
            )
        )
        .map((el: any) => el.index);
      console.log(`     Missing indexes:`, missingIndexes);
    }

    return {
      ...slide,
      outlineIndex: generatedSlide.outlineIndex,
      elements: slide.elements.map((el: any, elIdx: number) => {
        const generatedElement = generatedSlide.elements?.find(
          (ge: any) => ge.elementIndex === elIdx
        );

        if (generatedElement && (el.type === "text" || el.type === "shape")) {
          return {
            ...el,
            content: generatedElement.content,
          };
        }

        return el;
      }),
    };
  });

  return updatedSlides;
};
