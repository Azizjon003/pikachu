import {
  Slide,
  PPTTextElement,
  PPTShapeElement,
  PPTTableElement,
  PPTChartElement,
  PPTImageElement,
  SlideTheme,
} from "./types/slides";
import { JSDOM } from "jsdom";

// HTML dan faqat textni olish
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

// AI uchun minimal JSON sxema
export const generateAISchema = (slides: Slide[]) => {
  return slides.map((slide, index) => {
    const elements = slide.elements
      .map((el) => {
        if (el.type === "text") {
          const textContent = extractTextFromHTML(el.content);
          if (!textContent) return null;

          return {
            type: "text",
            content: textContent,
          };
        }

        if (el.type === "image") {
          return {
            type: "image",
            src: el.src,
            hasImage: true,
          };
        }

        if (el.type === "shape") {
          if (!el.text?.content) return null;

          const shapeText = extractTextFromHTML(el.text.content);
          if (!shapeText || shapeText.length === 0) return null;

          return {
            type: "shape",
            content: shapeText,
          };
        }

        if (el.type === "table") {
          const tableData = el.data
            .map((row) => row.map((cell) => cell.text.trim()))
            .filter((row) => row.some((cell) => cell.length > 0));

          if (tableData.length === 0) return null;

          return {
            type: "table",
            data: tableData,
          };
        }

        if (el.type === "chart") {
          return {
            type: "chart",
            chartType: el.chartType,
            labels: el.data.labels,
            data: el.data.series,
          };
        }

        return null;
      })
      .filter((el) => el !== null);

    return {
      id: slide.id,
      index: index,
      slide: index + 1,
      elements,
      note: slide.remark || "",
    };
  });
};

// HTML ichidagi textni yangilash (stil va strukturani saqlagan holda)
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

// AI sxemasidan to'liq Slide sxemasini yaratish
export const generateSlideFromAI = (
  aiSchema: any[],
  originalData: {
    slide: Slide[];
    theme: SlideTheme;
    viewportWidth: number;
    viewportHeight: number;
  }
) => {
  const updatedSlides = aiSchema.map((aiSlide, index) => {
    const originalSlide =
      originalData.slide.find((s) => s.id === aiSlide.id) ||
      originalData.slide[aiSlide.index];

    if (!originalSlide) {
      throw new Error(`Slide topilmadi: ${aiSlide.id}`);
    }

    let elementIndex = 0;
    const updatedElements = originalSlide.elements.map((originalEl) => {
      if (originalEl.type === "text") {
        const aiElement = aiSlide.elements.find((el: any, idx: number) => {
          if (el.type === "text" && idx >= elementIndex) {
            elementIndex = idx + 1;
            return true;
          }
          return false;
        });

        if (aiElement) {
          return {
            ...originalEl,
            content: updateHTMLContent(originalEl.content, aiElement.content),
          } as PPTTextElement;
        }
        return originalEl;
      }

      if (originalEl.type === "image") {
        const aiElement = aiSlide.elements.find((el: any, idx: number) => {
          if (el.type === "image" && idx >= elementIndex) {
            elementIndex = idx + 1;
            return true;
          }
          return false;
        });

        if (aiElement && aiElement.src) {
          return {
            ...originalEl,
            src: aiElement.src,
          } as PPTImageElement;
        }
        return originalEl;
      }

      if (originalEl.type === "shape" && originalEl.text) {
        const aiElement = aiSlide.elements.find((el: any, idx: number) => {
          if (el.type === "shape" && idx >= elementIndex) {
            elementIndex = idx + 1;
            return true;
          }
          return false;
        });

        if (aiElement) {
          return {
            ...originalEl,
            text: {
              ...originalEl.text,
              content: updateHTMLContent(
                originalEl.text.content,
                aiElement.content
              ),
            },
          } as PPTShapeElement;
        }
        return originalEl;
      }

      if (originalEl.type === "table") {
        const aiElement = aiSlide.elements.find((el: any, idx: number) => {
          if (el.type === "table" && idx >= elementIndex) {
            elementIndex = idx + 1;
            return true;
          }
          return false;
        });

        if (aiElement && aiElement.data) {
          const updatedData = originalEl.data.map((row, rowIdx) => {
            return row.map((cell, colIdx) => {
              const newText = aiElement.data[rowIdx]?.[colIdx] || cell.text;
              return {
                ...cell,
                text: newText,
              };
            });
          });

          return {
            ...originalEl,
            data: updatedData,
          } as PPTTableElement;
        }
        return originalEl;
      }

      if (originalEl.type === "chart") {
        const aiElement = aiSlide.elements.find((el: any, idx: number) => {
          if (el.type === "chart" && idx >= elementIndex) {
            elementIndex = idx + 1;
            return true;
          }
          return false;
        });

        if (aiElement) {
          return {
            ...originalEl,
            data: {
              labels: aiElement.labels || originalEl.data.labels,
              legends: originalEl.data.legends,
              series: aiElement.data || originalEl.data.series,
            },
          } as PPTChartElement;
        }
        return originalEl;
      }

      return originalEl;
    });

    return {
      ...originalSlide,
      elements: updatedElements,
      remark: aiSlide.note || originalSlide.remark,
    };
  });

  return {
    slide: updatedSlides,
    theme: originalData.theme,
    viewportWidth: originalData.viewportWidth,
    viewportHeight: originalData.viewportHeight,
  };
};
