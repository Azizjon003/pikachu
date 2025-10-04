import { trim } from "lodash";
import pptxgen from "pptxgenjs";
import tinycolor from "tinycolor2";
import fs from "fs";
import path from "path";
import type {
  PPTElementOutline,
  PPTElementShadow,
  PPTElementLink,
  Slide,
  SlideTheme,
} from "./types/slides";
import {
  getElementRange,
  getLineElementPath,
  getTableSubThemeColor,
} from "./utils/element";
import { type SvgPoints, toPoints } from "./utils/svgPathParser";
import { svg2Base64 } from "./utils/svg2Base64";
import { ensureBase64Header } from "./json";

import { AST, toAST } from "./utils/htmlParser/index";

const defaultFontSize = 14;

let viewportSize = { value: 1920 };
let viewportHeight = { value: 1080 };
let viewportRatio = { value: viewportHeight.value / viewportSize.value };
console.log(viewportRatio.value, "viewportRatio");

const formatColor = (_color: string) => {
  if (!_color) {
    return {
      alpha: 0,
      color: "#000000",
    };
  }

  const c = tinycolor(_color);
  const alpha = c.getAlpha();
  const color = alpha === 0 ? "#ffffff" : c.setAlpha(1).toHexString();
  return {
    alpha,
    color,
  };
};

type FormatColor = ReturnType<typeof formatColor>;
const formatHTML = (html: string, ratioPx2Pt: number) => {
  const ast = toAST(html);
  let bulletFlag = false;
  let indent = 0;

  const slices: pptxgen.TextProps[] = [];
  const parse = (obj: AST[], baseStyleObj: { [key: string]: string } = {}) => {
    for (const item of obj) {
      const isBlockTag =
        "tagName" in item && ["div", "li", "p"].includes(item.tagName);

      if (isBlockTag && slices.length) {
        const lastSlice: any = slices[slices.length - 1];
        if (!lastSlice?.options) lastSlice.options = {};
        lastSlice.options.breakLine = true;
      }

      const styleObj = { ...baseStyleObj };
      const styleAttr =
        "attributes" in item
          ? item.attributes.find((attr) => attr.key === "style")
          : null;
      if (styleAttr && styleAttr.value) {
        const styleArr = styleAttr.value.split(";");
        for (const styleItem of styleArr) {
          const [_key, _value] = styleItem.split(": ");
          const [key, value] = [trim(_key), trim(_value)];
          if (key && value) styleObj[key] = value;
        }
      }

      if ("tagName" in item) {
        if (item.tagName === "em") {
          styleObj["font-style"] = "italic";
        }
        if (item.tagName === "strong") {
          styleObj["font-weight"] = "bold";
        }
        if (item.tagName === "sup") {
          styleObj["vertical-align"] = "super";
        }
        if (item.tagName === "sub") {
          styleObj["vertical-align"] = "sub";
        }
        if (item.tagName === "a") {
          const attr = item.attributes.find((attr) => attr.key === "href");
          styleObj["href"] = attr?.value || "";
        }
        if (item.tagName === "ul") {
          styleObj["list-type"] = "ul";
        }
        if (item.tagName === "ol") {
          styleObj["list-type"] = "ol";
        }
        if (item.tagName === "li") {
          bulletFlag = true;
        }
        if (item.tagName === "p") {
          if ("attributes" in item) {
            const dataIndentAttr = item.attributes.find(
              (attr) => attr.key === "data-indent"
            );
            if (dataIndentAttr && dataIndentAttr.value)
              indent = +dataIndentAttr.value;
          }
        }
      }

      if ("tagName" in item && item.tagName === "br") {
        slices.push({ text: "", options: { breakLine: true } });
      } else if ("content" in item) {
        const text = item.content
          .replace(/&nbsp;/g, " ")
          .replace(/&gt;/g, ">")
          .replace(/&lt;/g, "<")
          .replace(/&amp;/g, "&")
          .replace(/\n/g, "");
        const options: pptxgen.TextPropsOptions = {};

        if (styleObj["font-size"]) {
          options.fontSize = parseInt(styleObj["font-size"]) / ratioPx2Pt;
        }
        if (styleObj["color"]) {
          options.color = formatColor(styleObj["color"]).color;
        }
        if (styleObj["background-color"]) {
          options.highlight = formatColor(styleObj["background-color"]).color;
        }
        if (styleObj["text-decoration-line"]) {
          if (styleObj["text-decoration-line"].indexOf("underline") !== -1) {
            options.underline = {
              color: options.color || "#000000",
              style: "sng",
            };
          }
          if (styleObj["text-decoration-line"].indexOf("line-through") !== -1) {
            options.strike = "sngStrike";
          }
        }
        if (styleObj["text-decoration"]) {
          if (styleObj["text-decoration"].indexOf("underline") !== -1) {
            options.underline = {
              color: options.color || "#000000",
              style: "sng",
            };
          }
          if (styleObj["text-decoration"].indexOf("line-through") !== -1) {
            options.strike = "sngStrike";
          }
        }
        if (styleObj["vertical-align"]) {
          if (styleObj["vertical-align"] === "super")
            options.superscript = true;
          if (styleObj["vertical-align"] === "sub") options.subscript = true;
        }
        if (styleObj["text-align"])
          options.align = styleObj["text-align"] as pptxgen.HAlign;
        if (styleObj["font-weight"])
          options.bold = styleObj["font-weight"] === "bold";
        if (styleObj["font-style"])
          options.italic = styleObj["font-style"] === "italic";
        if (styleObj["font-family"]) options.fontFace = styleObj["font-family"];
        if (styleObj["href"]) options.hyperlink = { url: styleObj["href"] };

        if (bulletFlag && styleObj["list-type"] === "ol") {
          options.bullet = {
            type: "number",
            indent: (options.fontSize || defaultFontSize) * 1.25,
          };
          options.paraSpaceBefore = 0.1;
          bulletFlag = false;
        }
        if (bulletFlag && styleObj["list-type"] === "ul") {
          options.bullet = {
            indent: (options.fontSize || defaultFontSize) * 1.25,
          };
          options.paraSpaceBefore = 0.1;
          bulletFlag = false;
        }
        if (indent) {
          options.indentLevel = indent;
          indent = 0;
        }

        slices.push({ text, options });
      } else if ("children" in item) parse(item.children, styleObj);
    }
  };
  parse(ast);
  return slices;
};

type Points = Array<
  | { x: number; y: number; moveTo?: boolean }
  | {
      x: number;
      y: number;
      curve: {
        type: "arc";
        hR: number;
        wR: number;
        stAng: number;
        swAng: number;
      };
    }
  | {
      x: number;
      y: number;
      curve: { type: "quadratic"; x1: number; y1: number };
    }
  | {
      x: number;
      y: number;
      curve: {
        type: "cubic";
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      };
    }
  | { close: true }
>;

// 将SVG路径信息格式化为pptxgenjs所需要的格式
const formatPoints = (
  points: SvgPoints,
  ratioPx2Inch: number,
  scale = { x: 1, y: 1 }
): Points => {
  const dpi = ratioPx2Inch; // px per inch
  return points.map((point: any) => {
    if (point.close !== undefined) {
      return { close: true };
    } else if (point.type === "M") {
      return {
        x: (point.x / dpi) * scale.x,
        y: (point.y / dpi) * scale.y,
        moveTo: true,
      };
    } else if (point.curve) {
      if (point.curve.type === "cubic") {
        return {
          x: (point.x / dpi) * scale.x,
          y: (point.y / dpi) * scale.y,
          curve: {
            type: "cubic",
            x1: ((point.curve.x1 as number) / dpi) * scale.x,
            y1: ((point.curve.y1 as number) / dpi) * scale.y,
            x2: ((point.curve.x2 as number) / dpi) * scale.x,
            y2: ((point.curve.y2 as number) / dpi) * scale.y,
          },
        };
      } else if (point.curve.type === "quadratic") {
        return {
          x: (point.x / dpi) * scale.x,
          y: (point.y / dpi) * scale.y,
          curve: {
            type: "quadratic",
            x1: ((point.curve.x1 as number) / dpi) * scale.x,
            y1: ((point.curve.y1 as number) / dpi) * scale.y,
          },
        };
      }
    }
    return {
      x: (point.x / dpi) * scale.x,
      y: (point.y / dpi) * scale.y,
    };
  });
};

// 获取阴影配置
const getShadowOption = (
  shadow: PPTElementShadow,
  ratioPx2Pt: number
): pptxgen.ShadowProps => {
  const c = formatColor(shadow.color);
  const { h, v } = shadow;

  let offset = 4;
  let angle = 45;

  if (h === 0 && v === 0) {
    offset = 4;
    angle = 45;
  } else if (h === 0) {
    if (v > 0) {
      offset = v;
      angle = 90;
    } else {
      offset = -v;
      angle = 270;
    }
  } else if (v === 0) {
    if (h > 0) {
      offset = h;
      angle = 1;
    } else {
      offset = -h;
      angle = 180;
    }
  } else if (h > 0 && v > 0) {
    offset = Math.max(h, v);
    angle = 45;
  } else if (h > 0 && v < 0) {
    offset = Math.max(h, -v);
    angle = 315;
  } else if (h < 0 && v > 0) {
    offset = Math.max(-h, v);
    angle = 135;
  } else if (h < 0 && v < 0) {
    offset = Math.max(-h, -v);
    angle = 225;
  }

  return {
    type: "outer",
    color: c.color.replace("#", ""),
    opacity: c.alpha,
    blur: shadow.blur / ratioPx2Pt,
    offset,
    angle,
  };
};

const dashTypeMap = {
  solid: "solid",
  dashed: "dash",
  dotted: "sysDot",
};

// 获取边框配置
const getOutlineOption = (
  outline: PPTElementOutline,
  ratioPx2Pt: number
): pptxgen.ShapeLineProps => {
  const c = formatColor(outline?.color || "#000000");

  return {
    color: c.color,
    transparency: (1 - c.alpha) * 100,
    width: (outline.width || 1) / ratioPx2Pt,
    dashType: outline.style
      ? (dashTypeMap[outline.style] as "solid" | "dash" | "sysDot")
      : "solid",
  };
};

// 获取超链接配置
const getLinkOption = (
  link: PPTElementLink,
  slides: Slide[]
): pptxgen.HyperlinkProps | null => {
  const { type, target } = link;
  if (type === "web") return { url: target };
  if (type === "slide") {
    const index = slides.findIndex((slide) => slide.id === target);
    if (index !== -1) return { slide: index + 1 };
  }

  return null;
};

// 判断是否为Base64图片地址
const isBase64Image = (url: string) => {
  const regex = /^data:image\/[^;]+;base64,/;
  return url.match(regex) !== null;
};

// 判断是否为SVG图片地址
const isSVGImage = (url: string) => {
  const isSVGBase64 = /^data:image\/svg\+xml;base64,/.test(url);
  const isSVGUrl = /\.svg$/.test(url);
  return isSVGBase64 || isSVGUrl;
};

// 从文件路径读取并转换为base64
const loadImageAsBase64 = (imagePath: string): string => {
  try {
    if (!imagePath || typeof imagePath !== "string") {
      return "";
    }

    if (imagePath.startsWith("data:")) {
      return imagePath;
    }

    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
      return imagePath;
    }

    // Normalize path for cross-platform compatibility
    const normalizedPath = imagePath.replace(/\\/g, "/");

    if (fs.existsSync(normalizedPath)) {
      const buffer = fs.readFileSync(normalizedPath);
      const base64 = buffer.toString("base64");

      const ext = path.extname(normalizedPath).toLowerCase().substring(1);
      let mimeType = "image/png";

      if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
      else if (ext === "png") mimeType = "image/png";
      else if (ext === "gif") mimeType = "image/gif";
      else if (ext === "webp") mimeType = "image/webp";
      else if (ext === "svg") mimeType = "image/svg+xml";
      else if (ext === "bmp") mimeType = "image/bmp";

      return `data:${mimeType};base64,${base64}`;
    }

    console.warn(`Image file not found: ${imagePath}`);
    return "";
  } catch (error) {
    console.error(`Error loading image ${imagePath}:`, error);
    return "";
  }
};

export const exportPPTX = (
  _slides: Slide[],
  masterOverwrite: boolean,
  ignoreMedia: boolean,
  theme: SlideTheme,
  viewPort: { width: number; height: number }
) => {
  viewportSize.value = viewPort.width;
  viewportHeight.value = viewPort.height;
  viewportRatio.value = viewportHeight.value / viewportSize.value;
  const pptx = new pptxgen();
  const ratio = viewportRatio.value;

  let slideWidthInches = 10;
  let slideHeightInches = 5.625;

  if (Math.abs(ratio - 0.625) < 0.001) {
    pptx.layout = "LAYOUT_16x10";
    slideWidthInches = 10;
    slideHeightInches = 6.25;
  } else if (Math.abs(ratio - 0.75) < 0.001) {
    pptx.layout = "LAYOUT_4x3";
    slideWidthInches = 10;
    slideHeightInches = 7.5;
  } else if (Math.abs(ratio - 0.70710678) < 0.0000001) {
    slideWidthInches = 10;
    slideHeightInches = 7.0710678;
    pptx.defineLayout({
      name: "A3",
      width: slideWidthInches,
      height: slideHeightInches,
    });
    pptx.layout = "A3";
  } else if (Math.abs(ratio - 1.41421356) < 0.0000001) {
    slideWidthInches = 10;
    slideHeightInches = 14.1421356;
    pptx.defineLayout({
      name: "A3_V",
      width: slideWidthInches,
      height: slideHeightInches,
    });
    pptx.layout = "A3_V";
  } else if (Math.abs(ratio - 1) < 0.001) {
    slideWidthInches = 10;
    slideHeightInches = 10;
    pptx.defineLayout({
      name: "SQUARE",
      width: slideWidthInches,
      height: slideHeightInches,
    });
    pptx.layout = "SQUARE";
  } else if (Math.abs(ratio - 16 / 9) < 0.01) {
    slideWidthInches = 9;
    slideHeightInches = 16;
    pptx.defineLayout({
      name: "PORTRAIT_9x16",
      width: slideWidthInches,
      height: slideHeightInches,
    });
    pptx.layout = "PORTRAIT_9x16";
  } else if (Math.abs(ratio - 4 / 3) < 0.01) {
    slideWidthInches = 9;
    slideHeightInches = 12;
    pptx.defineLayout({
      name: "PORTRAIT_4x3",
      width: slideWidthInches,
      height: slideHeightInches,
    });
    pptx.layout = "PORTRAIT_4x3";
  } else if (Math.abs(ratio - 2 / 3) < 0.01) {
    slideWidthInches = 12;
    slideHeightInches = 8;
    pptx.defineLayout({
      name: "LANDSCAPE_3x2",
      width: slideWidthInches,
      height: slideHeightInches,
    });
    pptx.layout = "LANDSCAPE_3x2";
  } else {
    pptx.layout = "LAYOUT_16x9";
    slideWidthInches = 10;
    slideHeightInches = 5.625;
  }

  const ratioPx2Inch = viewportSize.value / slideWidthInches;
  const ratioPx2Pt = ratioPx2Inch / 72;

  if (masterOverwrite) {
    const { color: bgColor, alpha: bgAlpha } = formatColor(
      theme.backgroundColor
    );
    pptx.defineSlideMaster({
      title: "PPTIST_MASTER",
      background: { color: bgColor, transparency: (1 - bgAlpha) * 100 },
    });
  }

  for (const slide of _slides) {
    const pptxSlide = pptx.addSlide();

    if (slide.background) {
      const background = slide.background;
      if (background.type === "image" && background.image) {
        const src = loadImageAsBase64(background.image.src);
        if (src) {
          if (isSVGImage(src)) {
            pptxSlide.addImage({
              data: src,
              x: 0,
              y: 0,
              w: viewportSize.value / ratioPx2Inch,
              h: (viewportSize.value * viewportRatio.value) / ratioPx2Inch,
            });
          } else if (isBase64Image(src)) {
            pptxSlide.background = { data: src };
          } else {
            pptxSlide.background = { path: src };
          }
        }
      } else if (background.type === "solid" && background.color) {
        const c = formatColor(background.color);
        pptxSlide.background = {
          color: c.color,
          transparency: (1 - c.alpha) * 100,
        };
      } else if (background.type === "gradient" && background.gradient) {
        const colors: any[] = background.gradient.colors;
        const color1 = colors[0].color;
        const color2 = colors[colors.length - 1].color;
        const color = tinycolor.mix(color1, color2).toHexString();
        const c = formatColor(color);
        pptxSlide.background = {
          color: c.color,
          transparency: (1 - c.alpha) * 100,
        };
      }
    }
    if (slide.remark) {
      const doc = new DOMParser().parseFromString(slide.remark, "text/html");
      const pList: any = doc.body.querySelectorAll("p");
      const text: string[] = [];
      for (const p of pList) {
        const textContent = p.textContent;
        text.push(textContent || "");
      }
      pptxSlide.addNotes(text.join("\n"));
    }

    if (!slide.elements) continue;

    const sortedElements = [...slide.elements];

    for (const el of sortedElements) {
      if (el.type === "text") {
        const textProps = formatHTML(el.content, ratioPx2Pt);

        const options: pptxgen.TextPropsOptions = {
          x: el.left / ratioPx2Inch,
          y: el.top / ratioPx2Inch,
          w: el.width / ratioPx2Inch,
          h: el.height / ratioPx2Inch,
          fontSize: defaultFontSize / ratioPx2Pt,
          fontFace: "微软雅黑",
          color: "#000000",
          valign: "top",
          margin: 10 / ratioPx2Pt,
          paraSpaceBefore: 5 / ratioPx2Pt,
          lineSpacingMultiple: 1.5 / 1.25,
          autoFit: true,
        };
        if (el.rotate) options.rotate = el.rotate;
        if (el.wordSpace) options.charSpacing = el.wordSpace / ratioPx2Pt;
        if (el.lineHeight) options.lineSpacingMultiple = el.lineHeight / 1.25;
        if (el.fill) {
          const c = formatColor(el.fill?.value || "#ffffff");
          const opacity = el.opacity === undefined ? 1 : el.opacity;
          options.fill = {
            color: c.color,
            transparency: (1 - c.alpha * opacity) * 100,
          };
        }
        if (el.defaultColor) options.color = formatColor(el.defaultColor).color;
        if (el.defaultFontName) options.fontFace = el.defaultFontName;
        if (el.shadow) options.shadow = getShadowOption(el.shadow, ratioPx2Pt);
        if (el.outline?.width)
          options.line = getOutlineOption(el.outline, ratioPx2Pt);
        if (el.opacity !== undefined)
          options.transparency = (1 - el.opacity) * 100;
        if (el.paragraphSpace !== undefined)
          options.paraSpaceBefore = el.paragraphSpace / ratioPx2Pt;
        if (el.vertical) options.vert = "eaVert";
        pptxSlide.addText(textProps, options);
      } else if (el.type === "image") {
        const options: pptxgen.ImageProps = {
          x: el.left / ratioPx2Inch,
          y: el.top / ratioPx2Inch,
          w: el.width / ratioPx2Inch,
          h: el.height / ratioPx2Inch,
        };
        options.path = el.src;
        if (el.flipH) options.flipH = el.flipH;
        if (el.flipV) options.flipV = el.flipV;
        if (el.rotate) options.rotate = el.rotate;
        if (el.link) {
          const linkOption = getLinkOption(el.link, _slides);
          if (linkOption) options.hyperlink = linkOption;
        }
        if (el.filters?.opacity)
          options.transparency = 100 - parseInt(el.filters?.opacity);
        if (el.clip) {
          if (el.clip.shape === "ellipse") options.rounding = true;

          const [start, end] = el.clip.range;
          const [startX, startY] = start;
          const [endX, endY] = end;

          const originW = el.width / ((endX - startX) / ratioPx2Inch);
          const originH = el.height / ((endY - startY) / ratioPx2Inch);

          options.w = originW / ratioPx2Inch;
          options.h = originH / ratioPx2Inch;

          options.sizing = {
            type: "crop",
            x: ((startX / ratioPx2Inch) * originW) / ratioPx2Inch,
            y: ((startY / ratioPx2Inch) * originH) / ratioPx2Inch,
            w: (((endX - startX) / ratioPx2Inch) * originW) / 100,
            h: (((endY - startY) / ratioPx2Inch) * originH) / 100,
          };
        }

        pptxSlide.addImage(options);
      } else if (el.type === "shape") {
        if (el.special) {
          if (
            el.path &&
            (el.path.startsWith("data:") ||
              el.path.startsWith("http") ||
              el.path.startsWith("./") ||
              el.path.startsWith("../"))
          ) {
            const pathData = loadImageAsBase64(el.path);
            if (pathData) {
              const options: pptxgen.ImageProps = {
                data: pathData,
                x: el.left / ratioPx2Inch,
                y: el.top / ratioPx2Inch,
                w: el.width / ratioPx2Inch,
                h: el.height / ratioPx2Inch,
              };
              if (el.rotate) options.rotate = el.rotate;
              if (el.flipH) options.flipH = el.flipH;
              if (el.flipV) options.flipV = el.flipV;
              if (el.link) {
                const linkOption = getLinkOption(el.link, _slides);
                if (linkOption) options.hyperlink = linkOption;
              }

              pptxSlide.addImage(options);
            }
          } else {
            const scale = {
              x: el.width / el.viewBox[0],
              y: el.height / el.viewBox[1],
            };
            const points = formatPoints(toPoints(el.path), ratioPx2Inch, scale);

            let fillColor = formatColor(el.fill);

            if (el.gradient) {
              const colors: any = el.gradient.colors;
              const color1 = colors[0].color;
              const color2 = colors[colors.length - 1].color;
              const color = tinycolor.mix(color1, color2).toHexString();
              fillColor = formatColor(color);
            }
            if (el.pattern) fillColor = formatColor("#00000000");
            const opacity = el.opacity === undefined ? 1 : el.opacity;

            const options: pptxgen.ShapeProps = {
              x: el.left / ratioPx2Inch,
              y: el.top / ratioPx2Inch,
              w: el.width / ratioPx2Inch,
              h: el.height / ratioPx2Inch,
              fill: {
                color: fillColor.color,
                transparency: (1 - fillColor.alpha * opacity) * 100,
              },
              points,
            };
            if (el.flipH) options.flipH = el.flipH;
            if (el.flipV) options.flipV = el.flipV;
            if (el.shadow)
              options.shadow = getShadowOption(el.shadow, ratioPx2Pt);
            if (el.outline?.width)
              options.line = getOutlineOption(el.outline, ratioPx2Pt);
            if (el.rotate) options.rotate = el.rotate;
            if (el.link) {
              const linkOption = getLinkOption(el.link, _slides);
              if (linkOption) options.hyperlink = linkOption;
            }

            pptxSlide.addShape("custGeom" as pptxgen.ShapeType, options);
          }
        } else {
          const scale = {
            x: el.width / el.viewBox[0],
            y: el.height / el.viewBox[1],
          };
          const points = formatPoints(toPoints(el.path), ratioPx2Inch, scale);

          let fillColor = formatColor(el.fill);

          if (el.gradient) {
            const colors: any = el.gradient.colors;
            const color1 = colors[0].color;
            const color2 = colors[colors.length - 1].color;
            const color = tinycolor.mix(color1, color2).toHexString();
            fillColor = formatColor(color);
          }
          if (el.pattern) fillColor = formatColor("#00000000");
          const opacity = el.opacity === undefined ? 1 : el.opacity;

          const options: pptxgen.ShapeProps = {
            x: el.left / ratioPx2Inch,
            y: el.top / ratioPx2Inch,
            w: el.width / ratioPx2Inch,
            h: el.height / ratioPx2Inch,
            fill: {
              color: fillColor.color,
              transparency: (1 - fillColor.alpha * opacity) * 100,
            },
            points,
          };
          if (el.flipH) options.flipH = el.flipH;
          if (el.flipV) options.flipV = el.flipV;
          if (el.shadow)
            options.shadow = getShadowOption(el.shadow, ratioPx2Pt);
          if (el.outline?.width)
            options.line = getOutlineOption(el.outline, ratioPx2Pt);
          if (el.rotate) options.rotate = el.rotate;
          if (el.link) {
            const linkOption = getLinkOption(el.link, _slides);
            if (linkOption) options.hyperlink = linkOption;
          }

          pptxSlide.addShape("custGeom" as pptxgen.ShapeType, options);
        }
        if (el.text) {
          const textProps = formatHTML(el.text.content, ratioPx2Pt);

          const options: pptxgen.TextPropsOptions = {
            x: el.left / ratioPx2Inch,
            y: el.top / ratioPx2Inch,
            w: el.width / ratioPx2Inch,
            h: el.height / ratioPx2Inch,
            fontSize: defaultFontSize / ratioPx2Pt,
            fontFace: "微软雅黑",
            color: "#000000",
            paraSpaceBefore: 5 / ratioPx2Pt,
            valign: el.text.align,
          };
          if (el.rotate) options.rotate = el.rotate;
          if (el.text.defaultColor)
            options.color = formatColor(el.text.defaultColor).color;
          if (el.text.defaultFontName)
            options.fontFace = el.text.defaultFontName;

          pptxSlide.addText(textProps, options);
        }
        if (el.pattern) {
          const pattern = loadImageAsBase64(el.pattern);
          if (pattern) {
            const options: pptxgen.ImageProps = {
              x: el.left / ratioPx2Inch,
              y: el.top / ratioPx2Inch,
              w: el.width / ratioPx2Inch,
              h: el.height / ratioPx2Inch,
            };
            if (isBase64Image(pattern)) options.data = pattern;
            else options.path = pattern;

            if (el.flipH) options.flipH = el.flipH;
            if (el.flipV) options.flipV = el.flipV;
            if (el.rotate) options.rotate = el.rotate;
            if (el.link) {
              const linkOption = getLinkOption(el.link, _slides);
              if (linkOption) options.hyperlink = linkOption;
            }

            pptxSlide.addImage(options);
          }
        }
      } else if (el.type === "line") {
        const path = getLineElementPath(el);
        const points = formatPoints(toPoints(path), ratioPx2Inch);
        const { minX, maxX, minY, maxY }: any = getElementRange(el);
        const c = formatColor(el.color);

        const options: pptxgen.ShapeProps = {
          x: el.left / ratioPx2Inch,
          y: el.top / ratioPx2Inch,
          w: (maxX - minX) / ratioPx2Inch,
          h: (maxY - minY) / ratioPx2Inch,
          line: {
            color: c.color,
            transparency: (1 - c.alpha) * 100,
            width: el.width / ratioPx2Pt,
            dashType: dashTypeMap[el.style] as "solid" | "dash" | "sysDot",
            beginArrowType: el.points[0] ? "arrow" : "none",
            endArrowType: el.points[1] ? "arrow" : "none",
          },
          points,
        };
        if (el.shadow) options.shadow = getShadowOption(el.shadow, ratioPx2Pt);

        pptxSlide.addShape("custGeom" as pptxgen.ShapeType, options);
      } else if (el.type === "chart") {
        const chartData: {
          name: string;
          labels: string[];
          values: number[];
        }[] = [];
        for (let i = 0; i < el.data.series.length; i++) {
          const item = el.data.series[i];
          chartData.push({
            name: `系列${i + 1}`,
            labels: el.data.labels,
            values: item || [],
          });
        }

        let chartColors: string[] = [];
        if (el.themeColors.length === 10)
          chartColors = el.themeColors.map((color) => formatColor(color).color);
        else if (el.themeColors.length === 1)
          chartColors = tinycolor(el.themeColors[0])
            .analogous(10)
            .map((color) => formatColor(color.toHexString()).color);
        else {
          const len = el.themeColors.length;
          const supplement = tinycolor(el.themeColors[len - 1])
            .analogous(10 + 1 - len)
            .map((color) => color.toHexString());
          chartColors = [
            ...el.themeColors.slice(0, len - 1),
            ...supplement,
          ].map((color) => formatColor(color).color);
        }

        const options: pptxgen.IChartOpts = {
          x: el.left / ratioPx2Inch,
          y: el.top / ratioPx2Inch,
          w: el.width / ratioPx2Inch,
          h: el.height / ratioPx2Inch,
          chartColors:
            el.chartType === "pie" || el.chartType === "ring"
              ? chartColors
              : chartColors.slice(0, el.data.series.length),
        };

        const textColor = formatColor(el.textColor || "#000000").color;
        options.catAxisLabelColor = textColor;
        options.valAxisLabelColor = textColor;

        const fontSize = 14 / ratioPx2Pt;
        options.catAxisLabelFontSize = fontSize;
        options.valAxisLabelFontSize = fontSize;

        if (el.fill || el.outline) {
          const plotArea: pptxgen.IChartPropsFillLine = {};
          if (el.fill) {
            plotArea.fill = { color: formatColor(el.fill).color };
          }
          if (el.outline) {
            plotArea.border = {
              pt: el.outline.width! / ratioPx2Pt,
              color: formatColor(el.outline.color!).color,
            };
          }
          options.plotArea = plotArea;
        }

        if (
          (el.data.series.length > 1 && el.chartType !== "scatter") ||
          el.chartType === "pie" ||
          el.chartType === "ring"
        ) {
          options.showLegend = true;
          options.legendPos = "b";
          options.legendColor = textColor;
          options.legendFontSize = fontSize;
        }

        let type = pptx.ChartType.bar;
        if (el.chartType === "bar") {
          type = pptx.ChartType.bar;
          options.barDir = "col";
          if (el.options?.stack) options.barGrouping = "stacked";
        } else if (el.chartType === "column") {
          type = pptx.ChartType.bar;
          options.barDir = "bar";
          if (el.options?.stack) options.barGrouping = "stacked";
        } else if (el.chartType === "line") {
          type = pptx.ChartType.line;
          if (el.options?.lineSmooth) options.lineSmooth = true;
        } else if (el.chartType === "area") {
          type = pptx.ChartType.area;
        } else if (el.chartType === "radar") {
          type = pptx.ChartType.radar;
        } else if (el.chartType === "scatter") {
          type = pptx.ChartType.scatter;
          options.lineSize = 0;
        } else if (el.chartType === "pie") {
          type = pptx.ChartType.pie;
        } else if (el.chartType === "ring") {
          type = pptx.ChartType.doughnut;
          options.holeSize = 60;
        }

        pptxSlide.addChart(type, chartData, options);
      } else if (el.type === "table") {
        const hiddenCells: any[] = [];
        for (let i = 0; i < el.data.length; i++) {
          const rowData: any = el.data[i];

          for (let j = 0; j < rowData?.length; j++) {
            const cell = rowData[j];
            if (cell.colspan > 1 || cell.rowspan > 1) {
              for (let row = i; row < i + cell.rowspan; row++) {
                for (
                  let col = row === i ? j + 1 : j;
                  col < j + cell.colspan;
                  col++
                )
                  hiddenCells.push(`${row}_${col}` as never);
              }
            }
          }
        }

        const tableData: any[] = [];

        const theme = el.theme;
        let themeColor: FormatColor | null = null;
        let subThemeColors: FormatColor[] = [];
        if (theme) {
          themeColor = formatColor(theme.color);
          subThemeColors = getTableSubThemeColor(theme.color).map((item) =>
            formatColor(item)
          );
        }

        for (let i = 0; i < el.data.length; i++) {
          const row: any = el.data[i];
          const _row: any[] = [];

          for (let j = 0; j < row.length; j++) {
            const cell = row[j];
            const cellOptions: pptxgen.TableCellProps = {
              colspan: cell.colspan,
              rowspan: cell.rowspan,
              bold: cell.style?.bold || false,
              italic: cell.style?.em || false,
              underline: { style: cell.style?.underline ? "sng" : "none" },
              align: cell.style?.align || "left",
              valign: "middle",
              fontFace: cell.style?.fontname || "微软雅黑",
              fontSize:
                (cell.style?.fontsize ? parseInt(cell.style?.fontsize) : 14) /
                ratioPx2Pt,
            };
            if (theme && themeColor) {
              let c: FormatColor;
              if (i % 2 === 0)
                c = subThemeColors[1] || { alpha: 0, color: "#000000" };
              else c = subThemeColors[0] || { alpha: 0, color: "#000000" };

              if (theme.rowHeader && i === 0) c = themeColor;
              else if (theme.rowFooter && i === el.data.length - 1)
                c = themeColor;
              else if (theme.colHeader && j === 0) c = themeColor;
              else if (theme.colFooter && j === row.length - 1) c = themeColor;

              cellOptions.fill = {
                color: c.color,
                transparency: (1 - c.alpha) * 100,
              };
            }
            if (cell.style?.backcolor) {
              const c = formatColor(cell.style.backcolor);
              cellOptions.fill = {
                color: c.color,
                transparency: (1 - c.alpha) * 100,
              };
            }
            if (cell.style?.color)
              cellOptions.color = formatColor(cell.style.color).color;

            if (!hiddenCells.includes(`${i}_${j}` as never)) {
              _row.push({
                text: cell.text,
                options: cellOptions,
              } as never);
            }
          }
          if (_row.length) tableData.push(_row as never);
        }

        const options: pptxgen.TableProps = {
          x: el.left / ratioPx2Inch,
          y: el.top / ratioPx2Inch,
          w: el.width / ratioPx2Inch,
          h: el.height / ratioPx2Inch,
          colW: el.colWidths.map((item) => (el.width * item) / ratioPx2Inch),
        };
        if (el.theme) options.fill = { color: "#ffffff" };
        if (el.outline.width && el.outline.color) {
          options.border = {
            type: el.outline.style === "solid" ? "solid" : "dash",
            pt: el.outline.width / ratioPx2Pt,
            color: formatColor(el.outline.color).color,
          };
        }

        pptxSlide.addTable(tableData, options);
      } else if (el.type === "latex") {
        const svgRef = document.querySelector(
          `.thumbnail-list .base-element-${el.id} svg`
        ) as HTMLElement;
        const base64SVG = svg2Base64(svgRef);

        const options: pptxgen.ImageProps = {
          data: base64SVG,
          x: el.left / ratioPx2Inch,
          y: el.top / ratioPx2Inch,
          w: el.width / ratioPx2Inch,
          h: el.height / ratioPx2Inch,
        };
        if (el.link) {
          const linkOption = getLinkOption(el.link, _slides);
          if (linkOption) options.hyperlink = linkOption;
        }

        pptxSlide.addImage(options);
      } else if (!ignoreMedia && (el.type === "video" || el.type === "audio")) {
        const options: pptxgen.MediaProps = {
          x: el.left / ratioPx2Inch,
          y: el.top / ratioPx2Inch,
          w: el.width / ratioPx2Inch,
          h: el.height / ratioPx2Inch,
          path: el.src,
          type: el.type,
        };
        if (el.type === "video" && el.poster) {
          const poster = loadImageAsBase64(el.poster);
          if (poster) options.cover = poster;
        }

        const extMatch = el.src.match(/\.([a-zA-Z0-9]+)(?:[\?#]|$)/);
        if (extMatch && extMatch[1]) options.extn = extMatch[1];
        else if (el.ext) options.extn = el.ext;

        const videoExts = ["avi", "mp4", "m4v", "mov", "wmv"];
        const audioExts = ["mp3", "m4a", "mp4", "wav", "wma"];
        if (
          options.extn &&
          [...videoExts, ...audioExts].includes(options.extn)
        ) {
          pptxSlide.addMedia(options);
        }
      }
    }
  }

  setTimeout(() => {
    pptx
      .writeFile({ fileName: `azimut.pptx` as never })
      .then(() => {})
      .catch((e) => {
        console.log("Error writing file", e);
      });
  }, 200);
};
