/**
 * Slide Builder for Template-Free Generation
 *
 * Converts layout patterns + content into Slide[] objects
 * compatible with the existing exportPPTX function.
 */

import crypto from 'crypto';
import type {
  Slide,
  SlideTheme,
  PPTTextElement,
  PPTImageElement,
  PPTShapeElement,
  PPTTableElement,
  PPTChartElement,
  PPTLineElement,
  PPTElement,
  TableCell,
  SlideBackground,
  ChartType,
  ChartData,
  LinePoint,
} from '../../../types/slides';
import type { PatternName, CustomLayoutElement } from '../types/generation';
import { gridToPixels, ColorTheme, resolveColor, resolveBackground, DEFAULT_VIEWPORT } from './design-system';
import { getPattern, type SlidePattern, type PatternElement } from './slide-patterns';
import { validateCustomLayout } from './grid-validator';

// ============================================
// Types
// ============================================

export interface SlideContent {
  /** Content for each element, keyed by element index in the pattern */
  elements: ElementContent[];
}

export interface ChartContentData {
  labels: string[];
  legends: string[];
  series: number[][];
}

export interface ElementContent {
  /** Text content (HTML or plain text) */
  text?: string;
  /** Image source URL */
  imageSrc?: string;
  /** Table data (2D array) */
  tableData?: string[][];
  /** Chart data (labels, legends, series) */
  chartData?: ChartContentData;
}

// ============================================
// SlideBuilder
// ============================================

export class SlideBuilder {
  private theme: ColorTheme;
  private viewport: { width: number; height: number };
  private titleFont: string;
  private bodyFont: string;

  constructor(
    theme: ColorTheme,
    viewport: { width: number; height: number } = DEFAULT_VIEWPORT,
    titleFont: string = 'Arial',
    bodyFont: string = 'Arial'
  ) {
    this.theme = theme;
    this.viewport = viewport;
    this.titleFont = titleFont;
    this.bodyFont = bodyFont;
  }

  /**
   * Build a Slide from a pattern name and content.
   */
  buildFromPattern(patternName: PatternName, content: SlideContent): Slide {
    const pattern = getPattern(patternName);
    return this.buildSlide(pattern, content);
  }

  /**
   * Build a Slide from a pattern definition and content.
   */
  buildSlide(pattern: SlidePattern, content: SlideContent): Slide {
    const elements: PPTElement[] = [];

    for (let i = 0; i < pattern.elements.length; i++) {
      const patEl = pattern.elements[i];
      const elContent = content.elements[i] || {};
      const rect = gridToPixels(patEl.col, patEl.row, this.viewport);

      if (patEl.type === 'text') {
        elements.push(this.createTextElement(patEl, rect, elContent));
      } else if (patEl.type === 'image') {
        elements.push(this.createImageElement(patEl, rect, elContent));
      } else if (patEl.type === 'shape') {
        elements.push(this.createShapeElement(patEl, rect));
      } else if (patEl.type === 'table') {
        elements.push(this.createTableElement(patEl, rect, elContent));
      } else if (patEl.type === 'chart') {
        elements.push(this.createChartElement(patEl, rect, elContent));
      } else if (patEl.type === 'line') {
        elements.push(this.createLineElement(patEl, rect));
      }
    }

    return {
      id: crypto.randomUUID(),
      elements,
      background: this.createBackground(pattern.background),
    };
  }

  /**
   * Build a Slide from AI-generated custom layout elements.
   * Validates and fixes the layout before building.
   */
  buildFromCustomLayout(
    customElements: CustomLayoutElement[],
    content: SlideContent,
    background?: string
  ): Slide {
    const { fixed } = validateCustomLayout(customElements);

    // Convert CustomLayoutElement[] to PatternElement[] for reuse
    const patternElements: PatternElement[] = fixed.map((el) => ({
      type: el.type as PatternElement['type'],
      role: el.role,
      col: el.col,
      row: el.row,
      fontSize: el.fontSize || (el.type === 'shape' || el.type === 'line' ? 0 : 16),
      fontWeight: el.fontWeight,
      align: el.align,
      color: el.color,
      maxCharacters: el.maxCharacters,
      background: el.background,
      borderRadius: el.borderRadius,
      shadow: el.shadow,
      opacity: el.opacity,
      shapeVariant: el.shapeVariant,
      chartType: el.chartType,
      lineStyle: el.lineStyle,
      linePoints: el.linePoints,
    }));

    // Build using the same element creation logic
    const elements: PPTElement[] = [];

    for (let i = 0; i < patternElements.length; i++) {
      const patEl = patternElements[i];
      const elContent = content.elements[i] || {};
      const rect = gridToPixels(patEl.col, patEl.row, this.viewport);

      if (patEl.type === 'text') {
        elements.push(this.createTextElement(patEl, rect, elContent));
      } else if (patEl.type === 'image') {
        elements.push(this.createImageElement(patEl, rect, elContent));
      } else if (patEl.type === 'shape') {
        elements.push(this.createShapeElement(patEl, rect));
      } else if (patEl.type === 'table') {
        elements.push(this.createTableElement(patEl, rect, elContent));
      } else if (patEl.type === 'chart') {
        elements.push(this.createChartElement(patEl, rect, elContent));
      } else if (patEl.type === 'line') {
        elements.push(this.createLineElement(patEl, rect));
      }
    }

    return {
      id: crypto.randomUUID(),
      elements,
      background: this.createBackground(background),
    };
  }

  /**
   * Add slide number label to the bottom-right of a slide.
   */
  addSlideNumber(slide: Slide, slideNumber: number, totalSlides: number): void {
    const label: PPTTextElement = {
      type: 'text',
      id: crypto.randomUUID(),
      left: this.viewport.width - 140,
      top: this.viewport.height - 50,
      width: 80,
      height: 30,
      rotate: 0,
      content: `<p style="font-size: 12px; color: ${this.theme.muted}; text-align: right; font-family: '${this.bodyFont}';">${slideNumber} / ${totalSlides}</p>`,
      defaultFontName: this.bodyFont,
      defaultColor: this.theme.muted,
      lineHeight: 1.2,
    };
    slide.elements.push(label);
  }

  /**
   * Get the SlideTheme for export.
   */
  getSlideTheme(): SlideTheme {
    return {
      backgroundColor: this.theme.background,
      themeColors: [this.theme.primary, this.theme.accent, this.theme.muted],
      fontColor: this.theme.text,
      fontName: this.bodyFont,
      outline: { style: 'solid', width: 0, color: 'transparent' },
      shadow: { h: 0, v: 0, blur: 0, color: 'transparent' },
    };
  }

  /** Get the appropriate font based on element role */
  private getFontForRole(role: string): string {
    const titleRoles = ['title', 'subtitle', 'stat-number'];
    return titleRoles.includes(role) ? this.titleFont : this.bodyFont;
  }

  // ============================================
  // Element Creators
  // ============================================

  private createTextElement(
    patEl: PatternElement,
    rect: { left: number; top: number; width: number; height: number },
    content: ElementContent
  ): PPTTextElement {
    const color = resolveColor(patEl.color, this.theme);
    const fontSize = patEl.fontSize;
    const fontWeight = patEl.fontWeight === 'bold' ? 'bold' : 'normal';
    const align = patEl.align || 'left';
    const text = content.text || '';
    const fontName = this.getFontForRole(patEl.role);

    // Build HTML content with inline styles
    const htmlContent = this.wrapTextAsHTML(text, fontSize, color, fontWeight, align, fontName);

    // Tighter line height for titles, more spacing for body text
    const lineHeight = patEl.role === 'title' || patEl.role === 'stat-number' ? 1.2
      : patEl.role === 'body' ? 1.7
      : 1.5;

    const element: PPTTextElement = {
      type: 'text',
      id: crypto.randomUUID(),
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      rotate: 0,
      content: htmlContent,
      defaultFontName: fontName,
      defaultColor: color,
      lineHeight,
    };

    // Add background fill if specified
    const bgColor = resolveBackground(patEl.background, this.theme);
    if (bgColor) {
      element.fill = { value: bgColor };
    }

    // Add shadow for card-like elements
    if (patEl.background && patEl.background !== 'none' && patEl.borderRadius) {
      element.shadow = {
        h: 2,
        v: 4,
        blur: 12,
        color: 'rgba(0,0,0,0.08)',
      };
    }

    return element;
  }

  private createImageElement(
    _patEl: PatternElement,
    rect: { left: number; top: number; width: number; height: number },
    content: ElementContent
  ): PPTImageElement {
    return {
      type: 'image',
      id: crypto.randomUUID(),
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      rotate: 0,
      src: content.imageSrc || '',
      fixedRatio: false,
    };
  }

  private createShapeElement(
    patEl: PatternElement,
    rect: { left: number; top: number; width: number; height: number }
  ): PPTShapeElement {
    const isGradient = patEl.background === 'gradient' || patEl.background === 'gradient-accent';
    const bgColor = isGradient
      ? this.theme.primary
      : resolveBackground(patEl.background, this.theme) || this.theme.primary;

    const variant = patEl.shapeVariant || 'rect';
    const { path, viewBox } = this.getShapePath(variant, patEl.borderRadius);

    const element: PPTShapeElement = {
      type: 'shape',
      id: crypto.randomUUID(),
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      rotate: 0,
      viewBox,
      path,
      fixedRatio: variant === 'circle' || variant === 'blob',
      fill: bgColor,
    };

    // Gradient fill
    if (isGradient) {
      const gradStart = patEl.background === 'gradient-accent'
        ? this.theme.accent
        : this.theme.gradientStart;
      const gradEnd = patEl.background === 'gradient-accent'
        ? this.theme.primary
        : this.theme.gradientEnd;
      element.gradient = {
        type: 'linear',
        colors: [
          { pos: 0, color: gradStart },
          { pos: 100, color: gradEnd },
        ],
        rotate: 135,
      };
    }

    // Glass effect
    if (patEl.background === 'glass') {
      element.fill = this.theme.white;
      element.opacity = 0.65;
    }

    // Opacity
    if (patEl.opacity !== undefined) {
      element.opacity = patEl.opacity;
    }

    // Shadow
    if (patEl.shadow) {
      const shadowMap = {
        sm: { h: 1, v: 2, blur: 6, color: 'rgba(0,0,0,0.06)' },
        md: { h: 2, v: 4, blur: 12, color: 'rgba(0,0,0,0.1)' },
        lg: { h: 4, v: 8, blur: 24, color: 'rgba(0,0,0,0.15)' },
      };
      element.shadow = shadowMap[patEl.shadow];
    }

    return element;
  }

  private getShapePath(
    variant: string,
    borderRadius?: number
  ): { path: string; viewBox: [number, number] } {
    switch (variant) {
      case 'circle': {
        const r = 100;
        return {
          path: `M ${r} 0 A ${r} ${r} 0 1 1 ${r} ${r * 2} A ${r} ${r} 0 1 1 ${r} 0 Z`,
          viewBox: [200, 200],
        };
      }
      case 'rounded-lg': {
        const w = 200, h = 200, cr = Math.min(borderRadius || 16, 40);
        return {
          path: `M ${cr} 0 L ${w - cr} 0 Q ${w} 0 ${w} ${cr} L ${w} ${h - cr} Q ${w} ${h} ${w - cr} ${h} L ${cr} ${h} Q 0 ${h} 0 ${h - cr} L 0 ${cr} Q 0 0 ${cr} 0 Z`,
          viewBox: [w, h],
        };
      }
      case 'line-h': {
        return {
          path: 'M 0 0 L 200 0 L 200 4 L 0 4 Z',
          viewBox: [200, 4],
        };
      }
      case 'line-v': {
        return {
          path: 'M 0 0 L 6 0 L 6 200 L 0 200 Z',
          viewBox: [6, 200],
        };
      }
      case 'blob': {
        return {
          path: 'M 100 10 Q 170 0 180 70 Q 200 140 140 170 Q 80 200 30 150 Q -10 100 30 50 Q 60 10 100 10 Z',
          viewBox: [200, 200],
        };
      }
      default: {
        const w = 200, h = 20;
        const r = Math.min(borderRadius || 0, h / 2, w / 2);
        if (r > 0) {
          return {
            path: `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`,
            viewBox: [w, h],
          };
        }
        return {
          path: `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`,
          viewBox: [w, h],
        };
      }
    }
  }

  private createTableElement(
    patEl: PatternElement,
    rect: { left: number; top: number; width: number; height: number },
    content: ElementContent
  ): PPTTableElement {
    const tableData = content.tableData || [['Header 1', 'Header 2'], ['Data 1', 'Data 2']];
    const colCount = tableData[0]?.length || 2;
    const colWidth = Math.round(100 / colCount);
    const colWidths = Array(colCount).fill(colWidth);
    const textColor = resolveColor(patEl.color, this.theme);

    const data: TableCell[][] = tableData.map((row, rowIdx) => {
      const isHeader = rowIdx === 0;
      const isAltRow = rowIdx > 0 && rowIdx % 2 === 0;
      return row.map((cellText) => ({
        id: crypto.randomUUID(),
        colspan: 1,
        rowspan: 1,
        text: cellText,
        style: {
          fontsize: `${isHeader ? Math.max((patEl.fontSize || 14), 14) : (patEl.fontSize || 14)}`,
          fontname: isHeader ? this.titleFont : this.bodyFont,
          color: isHeader ? this.theme.white : textColor,
          bold: isHeader,
          backcolor: isHeader ? this.theme.primary : isAltRow ? this.theme.surface : undefined,
        },
      }));
    });

    return {
      type: 'table',
      id: crypto.randomUUID(),
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      rotate: 0,
      outline: { style: 'solid', width: 1, color: this.theme.muted },
      colWidths,
      cellMinHeight: 36,
      data,
      theme: {
        color: this.theme.primary,
        rowHeader: true,
        rowFooter: false,
        colHeader: false,
        colFooter: false,
      },
    };
  }

  private createChartElement(
    patEl: PatternElement,
    rect: { left: number; top: number; width: number; height: number },
    content: ElementContent
  ): PPTChartElement {
    const chartType = (patEl.chartType || 'bar') as ChartType;
    const cd = content.chartData;

    const data: ChartData = cd
      ? { labels: cd.labels, legends: cd.legends, series: cd.series }
      : { labels: ['A', 'B', 'C', 'D'], legends: ['Series 1'], series: [[10, 20, 30, 40]] };

    return {
      type: 'chart',
      id: crypto.randomUUID(),
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      rotate: 0,
      chartType,
      data,
      themeColors: [
        this.theme.primary, this.theme.accent,
        '#4ECDC4', '#FF6B6B', '#45B7D1', '#96CEB4',
        '#F9CA24', '#6C5CE7', '#FD79A8', '#00B894',
      ],
      textColor: this.theme.text,
      lineColor: this.theme.surface,
      fill: this.theme.background,
    };
  }

  private createLineElement(
    patEl: PatternElement,
    rect: { left: number; top: number; width: number; height: number }
  ): PPTLineElement {
    const color = resolveColor(patEl.color, this.theme) || this.theme.muted;
    const style = patEl.lineStyle || 'solid';
    const points = patEl.linePoints || ['', ''];

    return {
      type: 'line',
      id: crypto.randomUUID(),
      left: rect.left,
      top: rect.top,
      width: rect.width,
      start: [0, 0],
      end: [rect.width, 0],
      style,
      color,
      points: points as [LinePoint, LinePoint],
    };
  }

  // ============================================
  // Helpers
  // ============================================

  private wrapTextAsHTML(
    text: string,
    fontSize: number,
    color: string,
    fontWeight: string,
    align: string,
    fontName?: string
  ): string {
    if (!text) return '';

    // Strip wrapping quotes that AI sometimes adds around content
    text = this.stripWrappingQuotes(text);

    // If text already contains HTML tags, wrap with style
    if (text.includes('<p') || text.includes('<div') || text.includes('<ul')) {
      return text;
    }

    const boldStyle = fontWeight === 'bold' ? 'font-weight: bold;' : '';
    const fontStyle = fontName ? `font-family: '${fontName}';` : '';
    const lines = text.split('\n').filter(Boolean);

    return lines
      .map((line) => {
        // Style bullet points with accent color and better formatting
        const isBullet = line.startsWith('• ') || line.startsWith('- ');
        if (isBullet) {
          const bulletText = line.replace(/^[•\-]\s*/, '');
          return `<p style="font-size: ${fontSize}px; color: ${color}; text-align: ${align}; ${fontStyle} margin-bottom: 4px; line-height: 1.6;"><span style="color: ${this.theme.accent}; font-weight: bold;">\u25CF </span>${bulletText}</p>`;
        }
        return `<p style="font-size: ${fontSize}px; color: ${color}; text-align: ${align}; ${boldStyle} ${fontStyle} line-height: 1.5;">${line}</p>`;
      })
      .join('');
  }

  /**
   * Strip wrapping quotes from AI-generated text.
   * AI often wraps content in "..." which renders as literal quotes on slides.
   */
  private stripWrappingQuotes(text: string): string {
    // Strip per-line quotes for multi-line content (bullets, etc.)
    const lines = text.split('\n');
    const stripped = lines.map(line => {
      let l = line.trim();
      // Strip "..." or «...» wrapping
      if ((l.startsWith('"') && l.endsWith('"')) || (l.startsWith('«') && l.endsWith('»'))) {
        l = l.slice(1, -1).trim();
      }
      // Preserve bullet prefix if original line had it
      if (line.trimStart().startsWith('• ') || line.trimStart().startsWith('- ')) {
        const prefix = line.trimStart().startsWith('• ') ? '• ' : '- ';
        if (!l.startsWith('• ') && !l.startsWith('- ')) {
          l = prefix + l;
        }
      }
      return l;
    });
    return stripped.join('\n');
  }

  private createBackground(bg?: string): SlideBackground | undefined {
    if (!bg) return { type: 'solid', color: this.theme.background };

    switch (bg) {
      case 'white':
        return { type: 'solid', color: '#FFFFFF' };
      case 'light':
        return { type: 'solid', color: this.theme.surface };
      case 'dark':
        return { type: 'solid', color: '#1A1A2E' };
      case 'primary':
        return { type: 'solid', color: this.theme.primary };
      case 'gradient':
        return {
          type: 'gradient',
          gradient: {
            type: 'linear',
            colors: [
              { pos: 0, color: this.theme.gradientStart },
              { pos: 100, color: this.theme.gradientEnd },
            ],
            rotate: 135,
          },
        };
      default:
        return { type: 'solid', color: this.theme.background };
    }
  }
}
