import { z } from "zod";
import {
  Slide,
  PPTTextElement,
  PPTShapeElement,
  PPTTableElement,
  PPTChartElement,
  PPTImageElement,
  SlideTheme,
} from "../../../types/slides";
import { JSDOM } from "jsdom";

/**
 * Outline Schema Definition
 * Used for generating presentation structure
 */
export const OutlineSchema = z.object({
  outline: z
    .array(
      z.object({
        title: z.string(),
        title_eng: z.string(),
        description: z.string().optional(),
      })
    )
    .min(2)
    .max(6), // Dynamic: 2-6 sections based on page count
  slides: z.array(
    z.object({
      slideIndex: z.number().int().min(0),
      title: z.string(),
      title_eng: z.string(),
      outlineIndex: z.number().int().min(0).max(5), // Max 6 sections (0-5)
      keyPoints: z.array(z.string()).min(1), // At least 1 key point per slide
    })
  ),
});

export type OutlineResponse = z.infer<typeof OutlineSchema>;

/**
 * HTML dan faqat textni olish
 */
const extractTextFromHTML = (html: string): string => {
  if (!html || typeof html !== "string") return "";

  try {
    const dom = new JSDOM(`<body>${html}</body>`);
    const text = dom.window.document.body.textContent || "";
    return text.replace(/\s+/g, " ").trim();
  } catch (error) {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
};

/**
 * Extract font size from HTML content
 * Looks for font-size style attribute (e.g., "font-size: 48.0px")
 */
const extractFontSize = (html: string): number => {
  if (!html || typeof html !== "string") return 14; // Default font size

  try {
    // Match font-size in style attribute: font-size: XXpx or font-size:XXpx
    const fontSizeMatch = html.match(/font-size:\s*(\d+(?:\.\d+)?)\s*px/i);
    if (fontSizeMatch && fontSizeMatch[1]) {
      return parseFloat(fontSizeMatch[1]);
    }
  } catch (error) {
    console.warn("Error extracting font size:", error);
  }

  return 14; // Default fallback
};

/**
 * TASK 2: Calculate maximum characters with more generous limits (multiplied by 1.2)
 * Based on element dimensions and font size
 *
 * Formula accounts for:
 * - Average character width (fontSize * 0.6)
 * - Line height (fontSize * 1.2)
 * - Available space (width and height)
 * - 20% buffer for more natural content (multiplied by 1.2)
 */
const calculateMaxCharacters = (
  width: number,
  height: number,
  fontSize: number
): number => {
  const avgCharWidth = fontSize * 0.6; // Average character width
  const lineHeight = fontSize * 1.2; // Typical line height

  const charsPerLine = Math.floor(width / avgCharWidth);
  const maxLines = Math.floor(height / lineHeight);

  const baseMaxChars = charsPerLine * maxLines;

  // TASK 2: Apply 1.2x multiplier for more generous character limits
  const generousMaxChars = Math.floor(baseMaxChars * 1.2);

  // Return at least 10 characters to avoid too restrictive limits
  return Math.max(10, generousMaxChars);
};

/**
 * AI uchun minimal JSON sxema (fontSize va maxCharacters qo'shildi)
 */
export const generateAISchema = (slides: Slide[]) => {
  return slides.map((slide, slideIndex) => {
    const elements = slide.elements
      .map((el, elementIndex) => {
        let aiElement = null;

        if (el.type === "text") {
          const textContent = extractTextFromHTML(el.content);
          const fontSize = extractFontSize(el.content);
          const maxCharacters = calculateMaxCharacters(el.width, el.height, fontSize);

          if (textContent) {
            aiElement = {
              type: "text",
              width: el.width,
              height: el.height,
              left: el.left,
              top: el.top,
              content: textContent,
              fontSize, // Added font size
              maxCharacters, // Added character limit (now 1.2x more generous)
            };
          }
        } else if (el.type === "image") {
          aiElement = {
            type: "image",
            src: el.src || "",
            hasImage: true,
            isEdited: false,
            width: el.width,
            height: el.height,
            left: el.left,
            top: el.top,
          };
        } else if (el.type === "shape") {
          if (el.text?.content) {
            const shapeText = extractTextFromHTML(el.text.content);
            const fontSize = extractFontSize(el.text.content);
            const maxCharacters = calculateMaxCharacters(el.width, el.height, fontSize);

            if (shapeText) {
              aiElement = {
                type: "shape",
                width: el.width,
                height: el.height,
                left: el.left,
                top: el.top,
                content: shapeText,
                fontSize, // Added font size
                maxCharacters, // Added character limit (now 1.2x more generous)
              };
            }
          }
        } else if (el.type === "table") {
          const tableData = el.data
            .map((row) => row.map((cell) => cell.text.trim()))
            .filter((row) => row.some((cell) => cell.length > 0));

          if (tableData.length > 0) {
            aiElement = {
              type: "table",
              data: tableData,
            };
          }
        } else if (el.type === "chart") {
          aiElement = {
            type: "chart",
            chartType: el.chartType,
            labels: el.data.labels,
            data: el.data.series,
          };
        }

        // ElementIndex ni qo'shish
        return aiElement ? { ...aiElement, elementIndex } : null;
      })
      .filter((el) => el !== null);

    return {
      id: slide.id,
      index: slideIndex,
      slide: slideIndex + 1,
      elements,
      note: slide.remark || "",
    };
  });
};

/**
 * HTML ichidagi textni yangilash (stil va strukturani saqlagan holda)
 */
const updateHTMLContent = (originalHTML: string, newText: string): string => {
  if (!originalHTML || typeof originalHTML !== "string") {
    return `<p><span>${newText}</span></p>`;
  }

  try {
    const dom = new JSDOM(`<body>${originalHTML}</body>`);
    const body = dom.window.document.body;

    // Birinchi text node yoki span ni topish
    const walker = dom.window.document.createTreeWalker(
      body,
      dom.window.NodeFilter.SHOW_TEXT,
      null
    );

    const textNodes: any[] = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent && node.textContent.trim().length > 0) {
        textNodes.push(node);
      }
    }

    if (textNodes.length > 0) {
      // Faqat birinchi text node contentini o'zgartirish
      textNodes[0].textContent = newText;

      // Qolgan text nodelarni tozalash
      for (let i = 1; i < textNodes.length; i++) {
        textNodes[i].textContent = "";
      }
    } else {
      // Agar text node topilmasa, yangi qo'shish
      const span = body.querySelector("span") || body.querySelector("p");
      if (span) {
        span.textContent = newText;
      } else {
        body.innerHTML = `<p><span>${newText}</span></p>`;
      }
    }

    return body.innerHTML;
  } catch (error) {
    return originalHTML;
  }
};

/**
 * AI sxemasidan to'liq Slide sxemasini yaratish (Optimallashtirilgan)
 */
export const generateSlideFromAI = (
  aiSchema: any[],
  originalData: {
    slide: Slide[];
    theme: SlideTheme;
    viewportWidth: number;
    viewportHeight: number;
  }
) => {
  const updatedSlides: Slide[] = aiSchema.map((aiSlide) => {
    // 1. Original slaydni topish
    const originalSlide = originalData.slide.find((s) => s.id === aiSlide.id);

    if (!originalSlide) {
      // Agar slayd ID topilmasa, xato berish (yoki original ma'lumotni qaytarish)
      console.error(`Slide topilmadi: ${aiSlide.id}`);
      return originalData.slide[aiSlide.index] || aiSlide;
    }

    // 2. Original elementlarni elementIndex bo'yicha Map ga solish
    const originalElementsMap = new Map<number, any>();
    originalSlide.elements.forEach((el, idx) => {
      originalElementsMap.set(idx, el);
    });

    // 3. Yangi elementlar uchun Map yaratish (original elementlar nusxasi)
    const newElementsMap = new Map(originalElementsMap);

    // 4. AI dan kelgan ma'lumotlar bilan yangilash
    aiSlide.elements.forEach((aiElement: any) => {
      const elementIndex = aiElement.elementIndex;

      if (elementIndex === undefined) return; // elementIndex mavjudligini tekshirish

      const originalElement = originalElementsMap.get(elementIndex);

      if (!originalElement || originalElement.type !== aiElement.type) {
        console.warn(
          `Element topilmadi yoki turi mos emas: index ${elementIndex}`
        );
        return;
      }

      let updatedElement = { ...originalElement };

      // Turiga qarab ma'lumotni yangilash
      if (aiElement.type === "text" && originalElement.type === "text") {
        updatedElement = {
          ...originalElement,
          content: updateHTMLContent(
            originalElement.content,
            aiElement.content
          ),
        } as PPTTextElement;
      } else if (
        aiElement.type === "image" &&
        originalElement.type === "image" &&
        aiElement.src
      ) {
        updatedElement = {
          ...originalElement,
          src: aiElement.src,
        } as PPTImageElement;
      } else if (
        aiElement.type === "shape" &&
        originalElement.type === "shape" &&
        originalElement.text
      ) {
        updatedElement = {
          ...originalElement,
          text: {
            ...originalElement.text,
            content: updateHTMLContent(
              originalElement.text.content,
              aiElement.content
            ),
          },
        } as PPTShapeElement;
      } else if (
        aiElement.type === "table" &&
        originalElement.type === "table" &&
        aiElement.data
      ) {
        // AI dan kelgan tableData ni original formatga o'tkazish
        const updatedData = aiElement.data.map(
          (row: string[], rowIndex: number) => {
            // Original satrni topish (agar mavjud bo'lsa, stilni saqlash uchun)
            const originalRow = originalElement.data[rowIndex] || [];

            return row.map((cellText: string, colIndex: number) => {
              // Original uslubni (style) saqlashga harakat qilish
              const originalCell = originalRow[colIndex] || {};
              return {
                text: cellText,
                style: originalCell.style || { fontSize: 14, color: "#000000" },
              };
            });
          }
        );

        updatedElement = {
          ...originalElement,
          data: updatedData,
        } as PPTTableElement;
      } else if (
        aiElement.type === "chart" &&
        originalElement.type === "chart"
      ) {
        updatedElement = {
          ...originalElement,
          data: {
            labels: aiElement.labels || originalElement.data.labels,
            legends: originalElement.data.legends,
            series: aiElement.data || originalElement.data.series,
          },
        } as PPTChartElement;
      }

      // Yangilangan elementni Map ga joylash
      newElementsMap.set(elementIndex, updatedElement);
    });

    // 5. Natijaviy elementlarni original tartibda olish
    // Map kalitlari (indexlar) bo'yicha tartiblash
    const finalElements = Array.from(newElementsMap.keys())
      .sort((a, b) => a - b)
      .map((key) => newElementsMap.get(key));

    // 6. Yakuniy slayd obyektini yaratish
    return {
      ...originalSlide,
      elements: finalElements.filter((el) => el !== undefined), // undefined elementlarni filtrlash
      remark: aiSlide.note || originalSlide.remark,
    } as Slide;
  });

  return {
    slide: updatedSlides,
    theme: originalData.theme,
    viewportWidth: originalData.viewportWidth,
    viewportHeight: originalData.viewportHeight,
  };
};
