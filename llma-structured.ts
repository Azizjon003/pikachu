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

// export const generateContent = async (
//   slide: any,
//   outline: any,
//   language: string
// ) => {
//   // Extract and prepare text/shape/table elements with full details
//   const textShapeTableElements = slide.elements
//     .map((el: any, idx: number) => ({
//       index: idx,
//       type: el.type,
//       width: el.width || 0,
//       height: el.height || 0,
//       left: el.left || 0,
//       top: el.top || 0,
//       currentContent: el.content || "",
//       tableData: el.data || null,
//     }))
//     .filter(
//       (el: any) =>
//         el.type === "text" || el.type === "shape" || el.type === "table"
//     );

//   const contentSchema = {
//     type: "object",
//     properties: {
//       slideId: {
//         type: "string",
//         description: "The ID of the slide being filled",
//       },
//       elements: {
//         type: "array",
//         items: {
//           type: "object",
//           properties: {
//             elementIndex: {
//               type: "number",
//               description: "Index of the element in the slide's elements array",
//             },
//             content: {
//               type: "string",
//               description: `Generated content in ${language} language`,
//             },
//             tableData: {
//               type: "object",
//               description: "Table data structure for table elements",
//               properties: {
//                 data: {
//                   type: "array",
//                   items: {
//                     type: "array",
//                     items: {
//                       type: "string",
//                     },
//                   },
//                 },
//               },
//               required: ["data"],
//               additionalProperties: false,
//             },
//           },
//           required: ["elementIndex", "content", "tableData"],
//           additionalProperties: false,
//         },
//       },
//     },
//     required: ["slideId", "elements"],
//     additionalProperties: false,
//   };

//   const completion = await client.chat.completions.create({
//     model: "gpt-4o-mini",
//     messages: [
//       {
//         role: "system",
//         content: `You are a world-class presentation strategist and an expert content creator specializing in the topic: "${
//           outline.title || outline.title_eng
//         }".
// Your mission is to transform a slide's structural layout into a visually perfect and informative narrative.

// ### Core Directives
// 1.  **COMPLETE COVERAGE:** You MUST generate content for EVERY SINGLE element provided.
// 2.  **LANGUAGE ADHERENCE:** All generated content MUST be in ${language}.
// 3.  **JSON SCHEMA COMPLIANCE:** Your output MUST strictly follow the provided JSON schema. For non-table elements, "tableData" MUST be \`null\`.
// 4.  **CONTEXTUAL INTELLIGENCE:** Analyze element relationships to create a coherent and non-redundant narrative.
// 5.  **VISUAL AND SPATIAL AWARENESS (NO OVERFLOW) - CRITICAL RULE:** The provided dimensions (width, height) for each element are strict boundaries. The content you generate **MUST** be concise enough to fit comfortably within its element without overflowing or overlapping with other elements. **Shorten your text aggressively if the element size is small.**

// ### Content Generation Philosophy
// -   **Expert-Level Depth:** Provide insightful, accurate, and valuable content.
// -   **Clarity and Conciseness:** Maximum impact, minimum words. **Adjust content length based on element dimensions to prevent visual overflow.**
// -   **Information Hierarchy and Synergy:** Each element must have a distinct purpose and add new value. Avoid restating the same information in different boxes. The title states the 'what', the body explains the 'why/how'.
// -   **Meticulous Proofreading:** All text must be grammatically perfect and professionally toned.

// ### Thought Process (Your internal monologue before generating the JSON)
// 1.  What is the core message of this slide for the topic "${
//           outline.title || outline.title_eng
//         }"?
// 2.  How does the layout guide the information flow?
// 3.  How can I ensure each element has a unique, non-repeating purpose?
// 4.  I will generate content for each element sequentially, ensuring a logical build-up.
// 5.  **Fit-Check:** Before finalizing the content for an element, I will mentally check its length against the element's size (width x height). The text must fit comfortably. I will shorten it if necessary to prevent any overflow.
// 6.  Finally, I will double-check that all ${
//           textShapeTableElements.length
//         } elements are filled and the JSON is perfect.`,
//       },
//       {
//         role: "user",
//         content: `TASK BRIEF: Generate expert-level presentation content. Pay critical attention to element dimensions to ensure text fits perfectly without overflowing.

// CONTEXT:
// - Slide ID: ${slide.id}
// - Core Topic: ${outline.title || outline.title_eng}
// - Language: ${language}
// - Total Elements to Fill: ${textShapeTableElements.length}

// SLIDE ELEMENTS TO POPULATE (You must provide distinct, non-repetitive, and properly sized content for all ${
//           textShapeTableElements.length
//         } elements):
// ${textShapeTableElements
//   .map(
//     (el: any, i: number) =>
//       `
// ---
// ${i + 1}. Element [${el.index}]
//    - Type: ${el.type.toUpperCase()}
//    - Size (w x h): ${el.width} x ${el.height}
//    - Position (left, top): (${el.left}, ${el.top})
//    - STRUCTURAL HINT: ${
//      el.type === "table"
//        ? "This is a TABLE. Generate a concise title and structured data."
//        : el.top < 150 && el.width > 400
//        ? "This is the MAIN TITLE. Keep it short and impactful (3-8 words)."
//        : el.height > 200 && el.width > 300
//        ? `This is BODY CONTENT. Elaborate on the title's message. **CRITICAL: The element size is ${el.width}x${el.height}. Keep your text concise enough to fit within these dimensions to avoid overflow.**`
//        : el.width < 200 || el.height < 100
//        ? `This is likely a LABEL or CALLOUT. The size is small (${el.width}x${el.height}). Use very short text (1-5 words).`
//        : `Standard content block. **Ensure text length is appropriate for its size (${el.width}x${el.height}).**`
//    }`
//   )
//   .join("\n")}

// MANDATORY FINAL INSTRUCTIONS:
// 1.  Generate content for ALL ${textShapeTableElements.length} elements.
// 2.  Ensure content is unique, non-repetitive, and **appropriately sized for each element's dimensions.** NO TEXT OVERFLOW.
// 3.  Adhere to all directives from the system prompt.
// 4.  Return a single, valid JSON object for slideId "${slide.id}".`,
//       },
//     ],
//     response_format: {
//       type: "json_schema",
//       json_schema: {
//         name: "slide_content_generation",
//         strict: true,
//         schema: contentSchema,
//       },
//     },
//     temperature: 0.6,
//   });

//   const raw = completion.choices[0].message.content ?? "{}";
//   // ... (qolgan mantiq o'zgarishsiz qoladi)
//   // ...
//   // ... (rest of your logic remains the same)
//   const generatedData = JSON.parse(raw);

//   fs.writeFileSync(
//     `${slide.id}.generatedData.json`,
//     JSON.stringify(generatedData, null, 2)
//   );
//   const filledCount = generatedData.elements?.length || 0;
//   const expectedCount = textShapeTableElements.length;

//   console.log(`✅ Content generated for slide ${slide.id}`);
//   console.log(
//     `   - Filled: ${filledCount}/${expectedCount} text/shape/table elements`
//   );

//   if (filledCount < expectedCount) {
//     console.warn(
//       `   ⚠️ WARNING: ${expectedCount - filledCount} elements were not filled!`
//     );
//     console.log(
//       "   Missing indexes:",
//       textShapeTableElements
//         .filter(
//           (el: any) =>
//             !generatedData.elements?.find(
//               (ge: any) => ge.elementIndex === el.index
//             )
//         )
//         .map((el: any) => el.index)
//     );
//   }

//   const updatedSlide = {
//     ...slide,
//     elements: slide.elements.map((el: any, idx: number) => {
//       const generatedElement = generatedData.elements?.find(
//         (ge: any) => ge.elementIndex === idx
//       );

//       if (
//         generatedElement &&
//         (el.type === "text" || el.type === "shape" || el.type === "table")
//       ) {
//         const updatedElement = {
//           ...el,
//           content: generatedElement.content,
//         }; // For table elements, also update tableData if provided

//         if (el.type === "table" && generatedElement.tableData) {
//           updatedElement.data =
//             generatedElement.tableData?.data || generatedElement.tableData;
//         }

//         return updatedElement;
//       }

//       return el;
//     }),
//   };

//   return updatedSlide;
// };

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
2. Match content to outline topic: "${topicName}"
3. Consider size and position for content style
4. For table elements, generate appropriate **tableData** with rows/columns
5. Write in **${language}** language
6. Return content for EVERY element (slideId: "${
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
2. Match content to outline topic: "${topicName}".
3. Consider size and position for content style.
4. For table elements, generate appropriate tableData with rows.
5. Write in ${language} language.
6. Return content for EVERY element (slideId: "${
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
        
**CRITICAL INSTRUCTION**: Ensure the main title or a prominent element on the slide contains the phrase for "Thank you for your attention" or "Thank you for listening" translated into the **${language}** language. For example, if the language is Uzbek, use "Etiboringiz uchun rahmat".`,
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
