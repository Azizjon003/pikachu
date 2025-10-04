import fs from "fs";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type TableData = { data: string[][]; header?: string[] } | null;

type FilledElement = {
  elementIndex: number;
  content: string;
  tableData: TableData; // null for non-table
};

type GeneratedPayload = {
  slideId: string;
  elements: FilledElement[];
};

const JSON_SCHEMA = {
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
          elementIndex: { type: "number" },
          content: { type: "string" },
          tableData: {
            anyOf: [
              { type: "null" },
              {
                type: "object",
                properties: {
                  data: {
                    type: "array",
                    items: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  header: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["data"],
                additionalProperties: false,
              },
            ],
            description: "null for non-table; object for table elements",
          },
        },
        required: ["elementIndex", "content", "tableData"],
        additionalProperties: false,
      },
    },
  },
  required: ["slideId", "elements"],
  additionalProperties: false,
} as const;

/** --- Heuristika: rol va char-byudjet hisoblash --- */
function computeCharBudget(width = 0, height = 0): number {
  // Approx: avg char width ~7px, line height ~18px (96dpi taxmin)
  const charsPerLine = Math.max(6, Math.floor(width / 7));
  const lines = Math.max(1, Math.floor(height / 18));
  return Math.max(12, Math.floor(charsPerLine * lines * 0.9));
}

type ElementRole =
  | "TITLE"
  | "SUBTITLE"
  | "BODY"
  | "LABEL"
  | "LIST"
  | "TIMELINE"
  | "CHART"
  | "REFERENCES"
  | "CONCLUSION"
  | "GENERIC";

function classifyRole(el: any): ElementRole {
  const c = String(el.content || "")
    .toLowerCase()
    .trim();
  const { width = 0, height = 0, top = 0 } = el;

  // Semantik markerlar
  if (/^\s*reja\s*$/i.test(el.content || "")) return "LIST";
  if (/overview/i.test(c)) return "BODY";
  if (/core principles/i.test(c)) return "BODY";
  if (/timeline/i.test(c)) return "TIMELINE";
  if (/charts?/i.test(c)) return "CHART";
  if (/foydalanilgan adabiyot/i.test(c)) return "REFERENCES";
  if (/consolu|conclus|xulosa/i.test(c)) return "CONCLUSION";

  // Geometriya asosida
  const largeBox = width > 300 && height > 180;
  const smallBox = width < 200 || height < 80;

  if (top < 140 && width > 400 && height <= 80) return "TITLE";
  if (top < 200 && width > 300 && height <= 100) return "SUBTITLE";
  if (smallBox) return "LABEL";
  if (largeBox) return "BODY";

  return "GENERIC";
}

function structuralHint(
  role: ElementRole,
  width: number,
  height: number
): string {
  switch (role) {
    case "TITLE":
      return `MAIN TITLE. 3–8 so'z. Juda qisqa va impactful. Max ${computeCharBudget(
        width,
        height
      )} ta belgi.`;
    case "SUBTITLE":
      return `SUBTITLE. 5–12 so'z. Max ${computeCharBudget(
        width,
        height
      )} ta belgi.`;
    case "LIST":
      return `AGENDA/LIST. 3–5 banddan oshmasin. Har band 3–6 so'z. Max ${computeCharBudget(
        width,
        height
      )} ta belgi.`;
    case "TIMELINE":
      return `TIMELINE. 3 ta sana+voqea. Har biri 1 satr. Max ${computeCharBudget(
        width,
        height
      )} ta belgi.`;
    case "CHART":
      return `CHART annotatsiyasi. 1–2 gap. Raqamlar bo'lishi mumkin. Max ${computeCharBudget(
        width,
        height
      )} ta belgi.`;
    case "REFERENCES":
      return `REFERENCES. 3–5 manba. Har biri 1 satr. Max ${computeCharBudget(
        width,
        height
      )} ta belgi.`;
    case "CONCLUSION":
      return `CONCLUSION. 1–2 qisqa gap. Max ${computeCharBudget(
        width,
        height
      )} ta belgi.`;
    case "LABEL":
      return `LABEL. Juda qisqa (1–5 so'z). Max ${computeCharBudget(
        width,
        height
      )} ta belgi.`;
    case "BODY":
    case "GENERIC":
    default:
      return `BODY/GENERIC. 1–3 gap. Max ${computeCharBudget(
        width,
        height
      )} ta belgi.`;
  }
}

/** Matnni byudjetga sig‘dirish (jumla chegarasini saqlab) */
function enforceBudget(text: string, budget: number): string {
  if (!text) return text;
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= budget) return clean;
  // Yaxshi kesish: oxirgi nuqta yoki verguldan oldin
  const soft = clean.slice(0, budget);
  const cutAt = Math.max(
    soft.lastIndexOf(". "),
    soft.lastIndexOf("; "),
    soft.lastIndexOf(", ")
  );
  const candidate = (
    cutAt > budget * 0.6 ? soft.slice(0, cutAt + 1) : soft
  ).trim();
  return candidate || soft.trim();
}

/** Minimal sanitizatsiya */
function sanitize(text: string): string {
  return String(text || "")
    .replace(/\u00A0/g, " ") // &nbsp;
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
}

/** Non-table elementlar uchun tableData = null */
function normalizeTableDataForType(elType: string, td: any): TableData {
  if (elType === "table") {
    if (!td || typeof td !== "object" || !Array.isArray(td.data)) {
      return { data: [] };
    }
    return {
      data: td.data,
      header: Array.isArray(td.header) ? td.header : undefined,
    };
  }
  return null;
}

/** Outline'dan fallback kontent (agar LLM to‘ldirmasa) */
function fallbackFromOutline(
  role: ElementRole,
  outline: any,
  budget: number,
  language: string
): string {
  const t = String(outline?.title || outline?.title_eng || "").trim();
  const items: string[] = Array.isArray(outline?.items) ? outline.items : [];

  const short = (s: string) => enforceBudget(s, budget);

  switch (role) {
    case "TITLE":
      return short(t || (language === "uz" ? "Prezentatsiya" : "Presentation"));
    case "LIST":
      return short(
        (items.slice(0, 4) as string[]).map((s) => `• ${s}`).join(" ")
      );
    case "CONCLUSION":
      return short(
        language === "uz"
          ? "Xulosa: asosiy g‘oyalar amaliyotda qo‘llansa, natija yaxshilanadi."
          : "Conclusion: applying the key ideas improves outcomes."
      );
    case "REFERENCES":
      return short(
        (outline?.refs || [])
          .slice(0, 4)
          .map((r: string, i: number) => `${i + 1}. ${r}`)
          .join(" ")
      );
    default:
      return short(language === "uz" ? "Qisqa izoh." : "Brief note.");
  }
}

/** LLM promptini tayyorlash */
function buildPrompt(
  slide: any,
  outline: any,
  language: string,
  targets: any[]
) {
  const header = `TASK BRIEF: Expert-level, formal corporate tone. NO emojis. NO markdown. Respect strict character budgets to avoid overflow.`;

  const detail = targets
    .map((t, i) => {
      const hint = structuralHint(t.role, t.width, t.height);
      return `
${i + 1}. Element [${t.index}] 
   - Type: ${t.type.toUpperCase()} 
   - Role: ${t.role} 
   - Size (w×h): ${t.width}×${t.height} 
   - Char budget: ${t.budget}
   - Current content: "${sanitize(t.currentContent)}"
   - GUIDANCE: ${hint}
   - Table?: ${
     t.type === "table" ? "YES (if yes, fill tableData)" : "NO (tableData=null)"
   }`;
    })
    .join("\n");

  return `${header}

CONTEXT:
- Slide ID: ${slide.id}
- Topic: ${outline?.title || outline?.title_eng || "Untitled"}
- Language: ${language}
- Total target elements: ${targets.length}

DIRECTIVES:
1) Generate content for EVERY target element.
2) Keep each content UNIQUE and non-repetitive across the slide.
3) NEVER exceed the char budget per element. If small, keep 1–2 words.
4) For TABLE: put caption/title in "content", rows in "tableData.data" (2–5 rows).
5) For NON-TABLE: set "tableData" = null.
6) Output MUST strictly match the provided JSON schema.

ELEMENTS:
${detail}

RETURN: Valid JSON only.`;
}

/** --- Yaxshilangan generateContent --- */
export const generateContent = async (
  slide: any,
  outline: any,
  language: string
) => {
  // 1) Elementlarni yig‘ib olish
  const textShapeTableElements = slide.elements
    .map((el: any, idx: number) => ({
      index: idx,
      type: el.type,
      width: el.width || 0,
      height: el.height || 0,
      left: el.left || 0,
      top: el.top || 0,
      currentContent: el.content || "",
      tableData: el.data || null,
      role: classifyRole(el),
      budget: computeCharBudget(el.width || 0, el.height || 0),
    }))
    .filter(
      (el: any) =>
        el.type === "text" || el.type === "shape" || el.type === "table"
    );

  // 2) JSON schema
  const contentSchema = JSON_SCHEMA;

  // 3) LLM chaqiruvi (retry bilan)
  const messages = [
    {
      role: "system" as const,
      content: `You are a world-class slide content generator. Always return VALID JSON conforming to the provided schema. Use ${language} language. Tone: formal, professional, concise, corporate.`,
    },
    {
      role: "user" as const,
      content: buildPrompt(slide, outline, language, textShapeTableElements),
    },
  ];

  // Helper: completion call
  async function callOnce(): Promise<GeneratedPayload> {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "slide_content_generation",
          strict: true,
          schema: contentSchema as any,
        },
      },
      temperature: 0.5,
    });

    const raw = completion.choices[0].message.content ?? "{}";
    let parsed: GeneratedPayload = JSON.parse(raw);

    // Post-validate: presence and nullability sanity
    if (!parsed.slideId) parsed.slideId = String(slide.id);
    if (!Array.isArray(parsed.elements)) parsed.elements = [];

    // Force tableData null for non-table; sanitize & enforce budgets
    parsed.elements = parsed.elements.map((ge) => {
      const spec = textShapeTableElements.find(
        (t: any) => t.index === ge.elementIndex
      );
      if (!spec) return ge;
      const safeContent = enforceBudget(
        sanitize(ge.content || ""),
        spec.budget
      );
      const normalizedTable = normalizeTableDataForType(
        spec.type,
        ge.tableData
      );
      return {
        elementIndex: ge.elementIndex,
        content: safeContent,
        tableData: normalizedTable,
      };
    });

    return parsed;
  }

  // 4) Run with up to 2 retries (repair if incomplete)
  let generatedData: GeneratedPayload;
  try {
    generatedData = await callOnce();

    const expectedCount = textShapeTableElements.length;
    const got = new Set(generatedData.elements.map((e) => e.elementIndex));
    const missing = textShapeTableElements.filter(
      (t: any) => !got.has(t.index)
    );

    if (missing.length > 0) {
      // Repair pass: request only missing items
      const repairUser = {
        role: "user" as const,
        content: `REPAIR PASS: You missed ${
          missing.length
        } elements. Generate ONLY the missing ones, keep previous valid items intact. Elements to fill: ${missing
          .map(
            (m: any) =>
              `#${m.index} (${m.role}, budget=${m.budget}, size=${m.width}x${m.height})`
          )
          .join(", ")}.`,
      };
      const repairMessages = [...messages, repairUser];

      const repair = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: repairMessages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "slide_content_generation",
            strict: true,
            schema: contentSchema as any,
          },
        },
        temperature: 0.3,
      });

      const raw2 = repair.choices[0].message.content ?? "{}";
      const parsed2: GeneratedPayload = JSON.parse(raw2);

      // Merge: take existing, override/add missing by index
      const map = new Map<number, FilledElement>(
        generatedData.elements.map((e) => [e.elementIndex, e])
      );
      for (const e of parsed2.elements || []) {
        const spec = textShapeTableElements.find(
          (t: any) => t.index === e.elementIndex
        );
        if (!spec) continue;
        map.set(e.elementIndex, {
          elementIndex: e.elementIndex,
          content: enforceBudget(sanitize(e.content || ""), spec.budget),
          tableData: normalizeTableDataForType(spec.type, e.tableData),
        });
      }
      generatedData = {
        slideId: String(slide.id),
        elements: Array.from(map.values()),
      };
    }
  } catch (err) {
    // LLM xatosida minimal fallback’lar
    const fallbacks: FilledElement[] = textShapeTableElements.map((t: any) => ({
      elementIndex: t.index,
      content: fallbackFromOutline(t.role, outline, t.budget, language),
      tableData: t.type === "table" ? { data: [] } : null,
    }));
    generatedData = { slideId: String(slide.id), elements: fallbacks };
  }

  // 5) Yakuniy tozalash va update
  const expected = textShapeTableElements.length;
  const filled = generatedData.elements.length;

  // Qo‘shimcha: yo‘qolgan bo‘lsa, fallback bilan to‘ldirish
  if (filled < expected) {
    const existing = new Set(generatedData.elements.map((e) => e.elementIndex));
    const topUp: FilledElement[] = textShapeTableElements
      .filter((t: any) => !existing.has(t.index))
      .map((t: any) => ({
        elementIndex: t.index,
        content: fallbackFromOutline(t.role, outline, t.budget, language),
        tableData: t.type === "table" ? { data: [] } : null,
      }));
    generatedData.elements.push(...topUp);
  }

  console.log(`✅ Content generated for slide ${slide.id}`);
  console.log(
    `   - Filled: ${generatedData.elements.length}/${textShapeTableElements.length}`
  );

  // 6) Slide ni yangilash
  const updatedSlide = {
    ...slide,
    elements: slide.elements.map((el: any, idx: number) => {
      const g = generatedData.elements.find((ge) => ge.elementIndex === idx);
      if (!g) return el;

      if (el.type === "text" || el.type === "shape") {
        return { ...el, content: g.content };
      }
      if (el.type === "table") {
        const next = { ...el, content: g.content };
        if (g.tableData && Array.isArray(g.tableData.data)) {
          next.data = g.tableData.data;
          if (Array.isArray((g.tableData as any).header))
            next.header = (g.tableData as any).header;
        }
        return next;
      }
      return el;
    }),
  };

  return updatedSlide as typeof slide;
};
