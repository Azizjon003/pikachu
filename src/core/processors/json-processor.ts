import {
  parse,
  type Shape,
  type Element,
  type ChartItem,
  type BaseElement,
} from "pptxtojson";
import { nanoid } from "nanoid";
import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
// @ts-ignore
import pptxtojson from "pptxtojson/dist/index.cjs";
import { SVGPathData } from "svg-pathdata";
import sharp from "sharp";

import {
  type ShapePoolItem,
  SHAPE_LIST,
  SHAPE_PATH_FORMULAS,
} from "../../../configs/shapes";
import { getSvgPathRange } from "../../../utils/svgPathParser";
import type {
  Slide,
  TableCellStyle,
  TableCell,
  ChartType,
  SlideBackground,
  PPTShapeElement,
  PPTLineElement,
  PPTImageElement,
  ShapeTextAlign,
  PPTTextElement,
  ChartOptions,
  Gradient,
  SlideTheme,
} from "../../../types/slides";

let theme: SlideTheme = {
  backgroundColor: "#ffffff",
  themeColors: ["#000000"],
  fontColor: "#000000",
  fontName: "Arial",
  outline: { style: "solid", width: 1, color: "#000000" },
  shadow: { h: 0, v: 0, blur: 0, color: "#000000" },
};

const typeMap: { [key: number]: string } = {
  1: "Z",
  2: "M",
  4: "H",
  8: "V",
  16: "L",
  32: "C",
  64: "S",
  128: "Q",
  256: "T",
  512: "A",
};

const isPathComplex = (path: string): boolean => {
  try {
    const pathData = new SVGPathData(path);
    for (const cmd of pathData.commands) {
      const type = typeMap[cmd.type];
      if (type === "H" || type === "V" || type === "S" || type === "T") {
        return true;
      }
    }
    return false;
  } catch (error) {
    return true;
  }
};

const imageCounter = { value: 0 };
const imagesDir = "images";

// Rasmni format o'zgartirishsiz saqlash (original sifat)
const saveBase64ImageRaw = (base64: string, slideIndex: number): string => {
  if (!base64 || typeof base64 !== "string") return "";

  if (
    base64.startsWith("http://") ||
    base64.startsWith("https://") ||
    base64.startsWith("./") ||
    base64.startsWith("../")
  ) {
    return base64;
  }

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  let base64Data = base64;
  let extension = "png";

  if (base64.startsWith("data:")) {
    const matches = base64.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (matches) {
      const format = matches[1].toLowerCase().replace("+xml", "");
      base64Data = matches[2];

      if (format === "jpeg" || format === "jpg") extension = "jpeg";
      else if (format === "png") extension = "png";
      else if (format === "gif") extension = "gif";
      else if (format === "webp") extension = "webp";
      else if (format === "svg" || format === "svg+xml") extension = "svg";
      else if (format === "bmp") extension = "bmp";
      else extension = format;
    }
  } else {
    const firstChars = base64.substring(0, 20);
    if (firstChars.startsWith("/9j/")) extension = "jpeg";
    else if (firstChars.startsWith("iVBOR")) extension = "png";
    else if (firstChars.startsWith("R0lGOD")) extension = "gif";
    else if (firstChars.startsWith("UklGR")) extension = "webp";
    else if (
      firstChars.startsWith("PHN2Zy") ||
      firstChars.startsWith("PD94bW") ||
      firstChars.startsWith("PHN2ZyB")
    )
      extension = "svg";
    else if (firstChars.startsWith("Qk")) extension = "bmp";
  }

  imageCounter.value++;
  const filename = `slide${slideIndex}_img${imageCounter.value}.${extension}`;
  const filepath = path.join(imagesDir, filename);

  try {
    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(filepath, buffer);
    return `./${filepath}`;
  } catch (error) {
    console.error(`Error saving raw image ${filename}:`, error);
    return "";
  }
};

const saveBase64Image = async (
  base64: string,
  slideIndex: number,
  isBackground: boolean = false
): Promise<string> => {
  if (!base64 || typeof base64 !== "string") return "";

  // URL manzillarni o'zgartirmay qaytarish
  if (
    base64.startsWith("http://") ||
    base64.startsWith("https://") ||
    base64.startsWith("./") ||
    base64.startsWith("../")
  ) {
    return base64;
  }

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  let base64Data = base64;
  let extension = "png";
  let mimeType = "image/png";

  // Data URL dan formatni aniqlash
  if (base64.startsWith("data:")) {
    const matches = base64.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (matches) {
      const format = matches[1].toLowerCase().replace("+xml", "");
      base64Data = matches[2];
      mimeType = `image/${format}`;

      // Extension mapping
      if (format === "jpeg" || format === "jpg") extension = "jpeg";
      else if (format === "png") extension = "png";
      else if (format === "gif") extension = "gif";
      else if (format === "webp") extension = "webp";
      else if (format === "svg" || format === "svg+xml") extension = "svg";
      else if (format === "bmp") extension = "bmp";
      else extension = format;
    }
  } else {
    // Base64 boshidan formatni aniqlash
    const firstChars = base64.substring(0, 20);
    if (firstChars.startsWith("/9j/")) {
      extension = "jpeg";
      mimeType = "image/jpeg";
    } else if (firstChars.startsWith("iVBOR")) {
      extension = "png";
      mimeType = "image/png";
    } else if (firstChars.startsWith("R0lGOD")) {
      extension = "gif";
      mimeType = "image/gif";
    } else if (firstChars.startsWith("UklGR")) {
      extension = "webp";
      mimeType = "image/webp";
    } else if (
      firstChars.startsWith("PHN2Zy") ||
      firstChars.startsWith("PD94bW") ||
      firstChars.startsWith("PHN2ZyB")
    ) {
      extension = "svg";
      mimeType = "image/svg+xml";
    } else if (firstChars.startsWith("Qk")) {
      extension = "bmp";
      mimeType = "image/bmp";
    }
  }

  imageCounter.value++;
  const filename = `slide${slideIndex}_img${imageCounter.value}.${extension}`;
  const filepath = path.join(imagesDir, filename);

  try {
    const buffer = Buffer.from(base64Data, "base64");

    // SVG va GIF ni to'g'ridan-to'g'ri saqlash (siqmasdan)
    if (extension === "svg" || extension === "gif") {
      fs.writeFileSync(filepath, buffer);
      return `./${filepath}`;
    }

    // Raster rasmlarni optimallash bilan saqlash
    if (extension === "png") {
      // PNG ni siqmasdan saqlash (lossless)
      await sharp(buffer)
        .png({
          compressionLevel: 6, // 0-9, default 6
          quality: 70,
        })
        .toFile(filepath);
    } else if (extension === "jpeg") {
      // JPEG ni minimal siqish bilan saqlash
      const quality = isBackground ? 50 : 70; // Yuqori sifat
      await sharp(buffer)
        .jpeg({
          quality,
          mozjpeg: true, // Yaxshiroq siqish algoritmi
        })
        .toFile(filepath);
    } else if (extension === "webp") {
      // WebP original formatda saqlash
      await sharp(buffer)
        .webp({ quality: 50, lossless: false })
        .toFile(filepath);
    } else {
      // Boshqa formatlar uchun oddiy saqlash
      fs.writeFileSync(filepath, buffer);
    }

    return `./${filepath}`;
  } catch (error) {
    console.error(`Error saving image ${filename}:`, error);
    // Xatolik bo'lsa, original bufferdan to'g'ridan-to'g'ri saqlash
    try {
      const buffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(filepath, buffer);
      return `./${filepath}`;
    } catch (fallbackError) {
      console.error(`Fallback save failed for ${filename}:`, fallbackError);
      return "";
    }
  }
};

export const ensureBase64Header = (base64: string): string => {
  if (!base64 || typeof base64 !== "string") return base64 || "";

  if (base64.startsWith("data:")) {
    return base64;
  }

  if (
    base64.startsWith("http://") ||
    base64.startsWith("https://") ||
    base64.startsWith("./") ||
    base64.startsWith("../")
  ) {
    return base64;
  }

  let mimeType = "image/png";
  const firstChars = base64.substring(0, 10);

  if (firstChars.startsWith("/9j/")) mimeType = "image/jpeg";
  else if (firstChars.startsWith("iVBOR")) mimeType = "image/png";
  else if (firstChars.startsWith("R0lGOD")) mimeType = "image/gif";
  else if (firstChars.startsWith("UklGR")) mimeType = "image/webp";
  else if (
    firstChars.startsWith("PHN2Zy") ||
    firstChars.startsWith("PD94bW") ||
    firstChars.startsWith("PHN2ZyB")
  )
    mimeType = "image/svg+xml";
  else if (firstChars.startsWith("Qk")) mimeType = "image/bmp";

  return `data:${mimeType};base64,${base64}`;
};

const convertFontSizePtToPx = (html: string, ratio: number) => {
  return html.replace(/font-size:\s*([\d.]+)pt/g, (match, p1) => {
    return `font-size: ${(parseFloat(p1) * ratio).toFixed(1)}px`;
  });
};

const extractDefaultColorFromHTML = (html: string): string | null => {
  if (!html) return null;
  try {
    const dom = new JSDOM(`<body>${html}</body>`);
    const body = dom.window.document.body;
    const span = body.querySelector("span");
    if (span?.style.color) {
      return span.style.color;
    }
    const colorMatch = html.match(/color:\s*([^;]+)/);
    if (colorMatch && colorMatch[1]) {
      return colorMatch[1].trim();
    }
  } catch (error) {
    return null;
  }
  return null;
};

const extractDefaultFontFromHTML = (html: string): string | null => {
  if (!html) return null;
  try {
    const dom = new JSDOM(`<body>${html}</body>`);
    const body = dom.window.document.body;
    const span = body.querySelector("span");
    if (span?.style.fontFamily) {
      return span.style.fontFamily.replace(/['"]/g, "");
    }
    const fontMatch = html.match(/font-family:\s*([^;]+)/);
    if (fontMatch && fontMatch[1]) {
      return fontMatch[1].trim().replace(/['"]/g, "");
    }
  } catch (error) {
    return null;
  }
  return null;
};

const rotateLine = (line: PPTLineElement, angleDeg: number) => {
  const { start, end } = line;

  const angleRad = (angleDeg * Math.PI) / 180;

  const midX = (start[0] + end[0]) / 2;
  const midY = (start[1] + end[1]) / 2;

  const startTransX = start[0] - midX;
  const startTransY = start[1] - midY;
  const endTransX = end[0] - midX;
  const endTransY = end[1] - midY;

  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  const startRotX = startTransX * cosA - startTransY * sinA;
  const startRotY = startTransX * sinA + startTransY * cosA;

  const endRotX = endTransX * cosA - endTransY * sinA;
  const endRotY = endTransX * sinA + endTransY * cosA;

  const startNewX = startRotX + midX;
  const startNewY = startRotY + midY;
  const endNewX = endRotX + midX;
  const endNewY = endRotY + midY;

  const beforeMinX = Math.min(start[0], end[0]);
  const beforeMinY = Math.min(start[1], end[1]);

  const afterMinX = Math.min(startNewX, endNewX);
  const afterMinY = Math.min(startNewY, endNewY);

  const startAdjustedX = startNewX - afterMinX;
  const startAdjustedY = startNewY - afterMinY;
  const endAdjustedX = endNewX - afterMinX;
  const endAdjustedY = endNewY - afterMinY;

  const startAdjusted: [number, number] = [startAdjustedX, startAdjustedY];
  const endAdjusted: [number, number] = [endAdjustedX, endAdjustedY];
  const offset = [afterMinX - beforeMinX, afterMinY - beforeMinY];

  return {
    start: startAdjusted,
    end: endAdjusted,
    offset,
  };
};

const parseLineElement = (el: Shape, ratio: number) => {
  let start: [number, number] = [0, 0];
  let end: [number, number] = [0, 0];

  if (!el.isFlipV && !el.isFlipH) {
    // 右下
    start = [0, 0];
    end = [el.width, el.height];
  } else if (el.isFlipV && el.isFlipH) {
    // 左上
    start = [el.width, el.height];
    end = [0, 0];
  } else if (el.isFlipV && !el.isFlipH) {
    // 右上
    start = [0, el.height];
    end = [el.width, 0];
  } else {
    // 左下
    start = [el.width, 0];
    end = [0, el.height];
  }

  const data: PPTLineElement = {
    type: "line",
    id: nanoid(10),
    width: +((el.borderWidth || 1) * ratio).toFixed(2),
    left: el.left,
    top: el.top,
    start,
    end,
    style: el.borderType,
    color: el.borderColor,
    points: ["", /straightConnector/.test(el.shapType) ? "arrow" : ""],
  };
  if (el.rotate) {
    const { start, end, offset } = rotateLine(data, el.rotate);

    data.start = start;
    data.end = end;
    data.left = data.left + offset[0];
    data.top = data.top + offset[1];
  }
  if (/bentConnector/.test(el.shapType)) {
    data.broken2 = [
      Math.abs(data.start[0] - data.end[0]) / 2,
      Math.abs(data.start[1] - data.end[1]) / 2,
    ];
  }
  if (/curvedConnector/.test(el.shapType)) {
    const cubic: [number, number] = [
      Math.abs(data.start[0] - data.end[0]) / 2,
      Math.abs(data.start[1] - data.end[1]) / 2,
    ];
    data.cubic = [cubic, cubic];
  }

  return data;
};

const flipGroupElements = (elements: BaseElement[], axis: "x" | "y") => {
  const minX = Math.min(...elements.map((el) => el.left));
  const maxX = Math.max(...elements.map((el) => el.left + el.width));
  const minY = Math.min(...elements.map((el) => el.top));
  const maxY = Math.max(...elements.map((el) => el.top + el.height));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return elements.map((element) => {
    const newElement = { ...element };

    if (axis === "y")
      newElement.left = 2 * centerX - element.left - element.width;
    if (axis === "x")
      newElement.top = 2 * centerY - element.top - element.height;

    return newElement;
  });
};

const calculateRotatedPosition = (
  x: number,
  y: number,
  w: number,
  h: number,
  ox: number,
  oy: number,
  k: number
) => {
  const radians = k * (Math.PI / 180);

  const containerCenterX = x + w / 2;
  const containerCenterY = y + h / 2;

  const relativeX = ox - w / 2;
  const relativeY = oy - h / 2;

  const rotatedX =
    relativeX * Math.cos(radians) + relativeY * Math.sin(radians);
  const rotatedY =
    -relativeX * Math.sin(radians) + relativeY * Math.cos(radians);

  const graphicX = containerCenterX + rotatedX;
  const graphicY = containerCenterY + rotatedY;

  return { x: graphicX, y: graphicY };
};

export const importPPTX = async (
  buffer: ArrayBuffer,
  options?: { cover?: boolean; fixedViewport?: boolean }
) => {
  const defaultOptions = {
    cover: false,
    fixedViewport: false,
  };
  const { cover, fixedViewport } = { ...defaultOptions, ...options };
  const shapeList: ShapePoolItem[] = [];
  for (const item of SHAPE_LIST) {
    shapeList.push(...item.children);
  }

  let json = null;
  try {
    json = await pptxtojson.parse(buffer);
  } catch (e) {
    console.log(e, "e");
    return [];
  }

  if (!json) return [];

  let ratio = 96 / 72;
  const { width, height } = json.size;
  console.log(width, height, "width, height");
  let viewportWidth;
  let viewportHeight;

  if (fixedViewport) {
    ratio = 1000 / width;
    viewportWidth = 1920;
    viewportHeight = (1920 * height) / width;
  } else {
    viewportWidth = width * ratio;
    viewportHeight = height * ratio;
  }

  theme = {
    themeColors: json.themeColors,
    fontName: "Arial",
    fontColor: "#000000",
    backgroundColor: "#ffffff",
    outline: { style: "solid", width: 1, color: "#000000" },
    shadow: { h: 0, v: 0, blur: 0, color: "#000000" },
  };

  const slides: Slide[] = [];
  imageCounter.value = 0;

  for (let slideIndex = 0; slideIndex < json.slides.length; slideIndex++) {
    const item = json.slides[slideIndex];
    const { type, value } = item.fill;
    let background: SlideBackground;
    if (type === "image") {
      background = {
        type: "image",
        image: {
          src: await saveBase64Image(value.picBase64, slideIndex, true),
          size: "cover",
        },
      };
    } else if (type === "gradient") {
      background = {
        type: "gradient",
        gradient: {
          type: value.path === "line" ? "linear" : "radial",
          colors: value.colors.map((item: any) => ({
            ...item,
            pos: parseInt(item.pos),
          })),
          rotate: value.rot + 90,
        },
      };
    } else {
      background = {
        type: "solid",
        color: value || "#fff",
      };
    }

    const slide: Slide = {
      id: nanoid(10),
      elements: [],
      background,
      remark: item.note || "",
    };

    const parseElements = async (
      elements: Element[],
      currentSlideIndex: number
    ) => {
      const sortedElements = elements.sort((a, b) => a.order - b.order);

      for (const el of sortedElements) {
        const originWidth = el.width || 1;
        const originHeight = el.height || 1;
        const originLeft = el.left;
        const originTop = el.top;

        el.width = el.width * ratio;
        el.height = el.height * ratio;
        el.left = el.left * ratio;
        el.top = el.top * ratio;

        if (el.type === "text") {
          const extractedColor = extractDefaultColorFromHTML(el.content);
          const extractedFont = extractDefaultFontFromHTML(el.content);
          const textEl: PPTTextElement = {
            type: "text",
            id: nanoid(10),
            width: el.width,
            height: el.height,
            left: el.left,
            top: el.top,
            rotate: el.rotate,
            defaultFontName: extractedFont || theme.fontName,
            defaultColor: extractedColor || theme.fontColor,
            content: convertFontSizePtToPx(el.content, ratio),
            lineHeight: 1,
            outline: {
              color: el.borderColor,
              width: +(el.borderWidth * ratio).toFixed(2),
              style: el.borderType,
            },
            fill: el.fill.type === "color" ? el.fill.value : "",
            vertical: el.isVertical,
          };
          if (el.shadow) {
            textEl.shadow = {
              h: el.shadow.h * ratio,
              v: el.shadow.v * ratio,
              blur: el.shadow.blur * ratio,
              color: el.shadow.color,
            };
          }
          slide.elements.push(textEl);
        } else if (el.type === "image") {
          const element: PPTImageElement = {
            type: "image",
            id: nanoid(10),
            src: await saveBase64Image(el.src, currentSlideIndex),
            width: el.width,
            height: el.height,
            left: el.left,
            top: el.top,
            fixedRatio: true,
            rotate: el.rotate,
            flipH: el.isFlipH,
            flipV: el.isFlipV,
          };
          if (el.borderWidth) {
            element.outline = {
              color: el.borderColor,
              width: +(el.borderWidth * ratio).toFixed(2),
              style: el.borderType,
            };
          }
          const clipShapeTypes = [
            "roundRect",
            "ellipse",
            "triangle",
            "rhombus",
            "pentagon",
            "hexagon",
            "heptagon",
            "octagon",
            "parallelogram",
            "trapezoid",
          ];
          if (el.rect) {
            element.clip = {
              shape:
                el.geom && clipShapeTypes.includes(el.geom) ? el.geom : "rect",
              range: [
                [el.rect.l || 0, el.rect.t || 0],
                [100 - (el.rect.r || 0), 100 - (el.rect.b || 0)],
              ],
            };
          } else if (el.geom && clipShapeTypes.includes(el.geom)) {
            element.clip = {
              shape: el.geom,
              range: [
                [0, 0],
                [100, 100],
              ],
            };
          }
          slide.elements.push(element);
        } else if (el.type === "math") {
          slide.elements.push({
            type: "image",
            id: nanoid(10),
            src: await saveBase64Image(el.picBase64, currentSlideIndex),
            width: el.width,
            height: el.height,
            left: el.left,
            top: el.top,
            fixedRatio: true,
            rotate: 0,
          });
        } else if (el.type === "audio") {
          slide.elements.push({
            type: "audio",
            id: nanoid(10),
            src: el.blob,
            width: el.width,
            height: el.height,
            left: el.left,
            top: el.top,
            rotate: 0,
            fixedRatio: false,
            color: theme.themeColors[0],
            loop: false,
            autoplay: false,
          });
        } else if (el.type === "video") {
          slide.elements.push({
            type: "video",
            id: nanoid(10),
            src: (el.blob || el.src)!,
            width: el.width,
            height: el.height,
            left: el.left,
            top: el.top,
            rotate: 0,
            autoplay: false,
          });
        } else if (el.type === "shape") {
          if (el.shapType === "line" || /Connector/.test(el.shapType)) {
            const lineElement = parseLineElement(el, ratio);
            slide.elements.push(lineElement);
          } else {
            const shape = shapeList.find(
              (item) => item.pptxShapeType === el.shapType
            );

            const vAlignMap: { [key: string]: ShapeTextAlign } = {
              mid: "middle",
              down: "bottom",
              up: "top",
            };

            const gradient: Gradient | undefined =
              el.fill?.type === "gradient"
                ? {
                    type: el.fill.value.path === "line" ? "linear" : "radial",
                    colors: el.fill.value.colors.map((item) => ({
                      ...item,
                      pos: parseInt(item.pos),
                    })),
                    rotate: el.fill.value.rot,
                  }
                : undefined;

            const pattern: string | undefined =
              el.fill?.type === "image"
                ? await saveBase64Image(
                    el.fill.value.picBase64,
                    currentSlideIndex
                  )
                : undefined;

            const fill = el.fill?.type === "color" ? el.fill.value : "";

            const element: PPTShapeElement = {
              type: "shape",
              id: nanoid(10),
              width: el.width,
              height: el.height,
              left: el.left,
              top: el.top,
              viewBox: [200, 200],
              path: "M 0 0 L 200 0 L 200 200 L 0 200 Z",
              fill,
              gradient,
              pattern,
              fixedRatio: false,
              rotate: el.rotate,
              outline: {
                color: el.borderColor,
                width: +(el.borderWidth * ratio).toFixed(2),
                style: el.borderType,
              },
              text: {
                content: convertFontSizePtToPx(el.content, ratio),
                defaultFontName:
                  extractDefaultFontFromHTML(el.content) || theme.fontName,
                defaultColor:
                  extractDefaultColorFromHTML(el.content) || theme.fontColor,
                align: vAlignMap[el.vAlign] || "middle",
              },
              flipH: el.isFlipH,
              flipV: el.isFlipV,
            };
            if (el.shadow) {
              element.shadow = {
                h: el.shadow.h * ratio,
                v: el.shadow.v * ratio,
                blur: el.shadow.blur * ratio,
                color: el.shadow.color,
              };
            }

            if (shape) {
              element.path = shape.path;
              element.viewBox = shape.viewBox;

              if (shape.pathFormula) {
                element.pathFormula = shape.pathFormula;
                element.viewBox = [el.width, el.height];

                const pathFormula = SHAPE_PATH_FORMULAS[shape.pathFormula];
                if ("editable" in pathFormula && pathFormula.editable) {
                  element.path = pathFormula.formula(
                    el.width,
                    el.height,
                    pathFormula.defaultValue
                  );
                  element.keypoints = pathFormula.defaultValue;
                } else element.path = pathFormula.formula(el.width, el.height);
              }
            } else if (el.path && el.path.indexOf("NaN") === -1) {
              const { maxX, maxY } = getSvgPathRange(el.path);
              element.path = el.path;
              if (maxX / maxY > originWidth / originHeight) {
                element.viewBox = [maxX, (maxX * originHeight) / originWidth];
              } else {
                element.viewBox = [(maxY * originWidth) / originHeight, maxY];
              }
            }
            if (el.shapType === "custom") {
              if (el.path!.indexOf("NaN") !== -1) {
                if (element.width === 0) element.width = 0.1;
                if (element.height === 0) element.height = 0.1;
                element.path = el.path!.replace(/NaN/g, "0");
                element.special = true;
              } else {
                element.path = el.path!;
                element.special = isPathComplex(element.path);
              }
              const { maxX, maxY } = getSvgPathRange(element.path);
              if (maxX / maxY > originWidth / originHeight) {
                element.viewBox = [maxX, (maxX * originHeight) / originWidth];
              } else {
                element.viewBox = [(maxY * originWidth) / originHeight, maxY];
              }
            }

            if (element.path) slide.elements.push(element);
          }
        } else if (el.type === "table") {
          const row = el.data.length;
          const col = el.data[0].length;

          const style: TableCellStyle = {
            fontname: theme.fontName,
            color: theme.fontColor,
          };
          const data: TableCell[][] = [];
          for (let i = 0; i < row; i++) {
            const rowCells: TableCell[] = [];
            for (let j = 0; j < col; j++) {
              const cellData = el.data[i][j];

              const dom = new JSDOM(`<body>${cellData.text}</body>`);
              const textBody = dom.window.document.body;
              const p = textBody.querySelector("p");
              const align = p?.style.textAlign || "left";

              const span = textBody.querySelector("span");
              const fontsize = span?.style.fontSize
                ? (parseInt(span.style.fontSize) * ratio).toFixed(1) + "px"
                : "";
              const fontname = span?.style.fontFamily || "";
              const color = span?.style.color || cellData.fontColor;

              rowCells.push({
                id: nanoid(10),
                colspan: cellData.colSpan || 1,
                rowspan: cellData.rowSpan || 1,
                text: textBody.textContent || "",
                style: {
                  ...style,
                  align: ["left", "right", "center"].includes(align)
                    ? (align as "left" | "right" | "center")
                    : "left",
                  fontsize,
                  fontname,
                  color,
                  bold: cellData.fontBold,
                  backcolor: cellData.fillColor,
                },
              });
            }
            data.push(rowCells);
          }

          const allWidth = el.colWidths.reduce((a, b) => a + b, 0);
          const colWidths: number[] = el.colWidths.map(
            (item) => item / allWidth
          );

          const firstCell = el.data[0][0];
          const border =
            firstCell.borders.top ||
            firstCell.borders.bottom ||
            el.borders.top ||
            el.borders.bottom ||
            firstCell.borders.left ||
            firstCell.borders.right ||
            el.borders.left ||
            el.borders.right;
          const borderWidth = border?.borderWidth || 0;
          const borderStyle = border?.borderType || "solid";
          const borderColor = border?.borderColor || "#eeece1";

          slide.elements.push({
            type: "table",
            id: nanoid(10),
            width: el.width,
            height: el.height,
            left: el.left,
            top: el.top,
            colWidths,
            rotate: 0,
            data,
            outline: {
              width: +(borderWidth * ratio || 2).toFixed(2),
              style: borderStyle,
              color: borderColor,
            },
            cellMinHeight: el.rowHeights[0] ? el.rowHeights[0] * ratio : 36,
          });
        } else if (el.type === "chart") {
          let labels: string[];
          let legends: string[];
          let series: number[][];

          if (
            el.chartType === "scatterChart" ||
            el.chartType === "bubbleChart"
          ) {
            labels = el.data[0].map((item, index) => `坐标${index + 1}`);
            legends = ["X", "Y"];
            series = el.data;
          } else {
            const data = el.data as ChartItem[];
            labels = Object.values(data[0].xlabels);
            legends = data.map((item) => item.key);
            series = data.map((item) => item.values.map((v) => v.y));
          }

          const options: ChartOptions = {};

          let chartType: ChartType = "bar";

          switch (el.chartType) {
            case "barChart":
            case "bar3DChart":
              chartType = "bar";
              if (el.barDir === "bar") chartType = "column";
              if (el.grouping === "stacked" || el.grouping === "percentStacked")
                options.stack = true;
              break;
            case "lineChart":
            case "line3DChart":
              if (el.grouping === "stacked" || el.grouping === "percentStacked")
                options.stack = true;
              chartType = "line";
              break;
            case "areaChart":
            case "area3DChart":
              if (el.grouping === "stacked" || el.grouping === "percentStacked")
                options.stack = true;
              chartType = "area";
              break;
            case "scatterChart":
            case "bubbleChart":
              chartType = "scatter";
              break;
            case "pieChart":
            case "pie3DChart":
              chartType = "pie";
              break;
            case "radarChart":
              chartType = "radar";
              break;
            case "doughnutChart":
              chartType = "ring";
              break;
            default:
          }

          slide.elements.push({
            type: "chart",
            id: nanoid(10),
            chartType: chartType,
            width: el.width,
            height: el.height,
            left: el.left,
            top: el.top,
            rotate: 0,
            themeColors: el.colors.length ? el.colors : theme.themeColors,
            textColor: theme.fontColor,
            data: {
              labels,
              legends,
              series,
            },
            options,
          });
        } else if (el.type === "group") {
          let elements: BaseElement[] = el.elements.map((_el) => {
            let left = _el.left + originLeft;
            let top = _el.top + originTop;

            if (el.rotate) {
              const { x, y } = calculateRotatedPosition(
                originLeft,
                originTop,
                originWidth,
                originHeight,
                _el.left,
                _el.top,
                el.rotate
              );
              left = x;
              top = y;
            }

            const element = {
              ..._el,
              left,
              top,
            };
            if (el.isFlipH && "isFlipH" in element) element.isFlipH = true;
            if (el.isFlipV && "isFlipV" in element) element.isFlipV = true;

            return element;
          });
          if (el.isFlipH) elements = flipGroupElements(elements, "y");
          if (el.isFlipV) elements = flipGroupElements(elements, "x");
          await parseElements(elements, currentSlideIndex);
        } else if (el.type === "diagram") {
          const elements = el.elements.map((_el) => ({
            ..._el,
            left: _el.left + originLeft,
            top: _el.top + originTop,
          }));
          await parseElements(elements, currentSlideIndex);
        }
      }
    };
    await parseElements([...item.elements, ...item.layoutElements], slideIndex);
    slides.push(slide);
  }

  return {
    slide: slides,
    theme,
    viewportWidth,
    viewportHeight,
  };
};
