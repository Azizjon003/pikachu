/**
 * Layout Designer
 *
 * Post-processor that optimizes slide layouts after content generation.
 * Runs on full Slide[] objects (after generateSlideFromAI merge, before exportPPTX).
 *
 * Optimizations:
 * - Font size auto-fit based on content length
 * - Typography hierarchy (title > subtitle > body > label)
 * - Edge margin enforcement
 * - Overlap resolution
 * - Vertical rhythm equalization
 * - Title centering
 *
 * No AI calls — purely algorithmic for speed.
 */

import type {
  Slide,
  PPTElement,
  PPTTextElement,
  PPTShapeElement,
  TextType,
} from '../../../types/slides';

// ===== Types =====

type TextRole = 'title' | 'subtitle' | 'body' | 'label';

interface LayoutDesignerConfig {
  slideWidth: number;
  slideHeight: number;
  margin: number;
  minSpacing: number;
  enableStyling: boolean;
}

export interface LayoutDesignSummary {
  slidesProcessed: number;
  fontAdjustments: number;
  positionAdjustments: number;
  spacingFixes: number;
  hierarchyFixes: number;
}

interface TextElementInfo {
  element: PPTTextElement | PPTShapeElement;
  index: number;
  role: TextRole;
  plainText: string;
  fontSize: number;
  charCount: number;
  maxCharacters: number;
  bounds: BoundingBox;
}

interface BoundingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

// ===== Constants =====

const ROLE_FONT_LIMITS: Record<TextRole, { min: number; max: number }> = {
  title: { min: 24, max: 60 },
  subtitle: { min: 18, max: 40 },
  body: { min: 12, max: 28 },
  label: { min: 8, max: 18 },
};

const ROLE_PRIORITY: Record<TextRole, number> = {
  title: 4,
  subtitle: 3,
  body: 2,
  label: 1,
};

const DEFAULT_CONFIG: LayoutDesignerConfig = {
  slideWidth: 960,
  slideHeight: 540,
  margin: 40,
  minSpacing: 15,
  enableStyling: true,
};

// ===== LayoutDesigner =====

export class LayoutDesigner {
  private config: LayoutDesignerConfig;
  private summary: LayoutDesignSummary;

  constructor(config?: Partial<LayoutDesignerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.summary = {
      slidesProcessed: 0,
      fontAdjustments: 0,
      positionAdjustments: 0,
      spacingFixes: 0,
      hierarchyFixes: 0,
    };
  }

  /**
   * Main entry point — process all slides
   */
  designSlides(slides: Slide[]): { slides: Slide[]; summary: LayoutDesignSummary } {
    for (let i = 0; i < slides.length; i++) {
      this.designSlide(slides[i]);
      this.summary.slidesProcessed++;
    }
    return { slides, summary: this.summary };
  }

  /**
   * Process a single slide
   */
  private designSlide(slide: Slide): void {
    const textElements = this.extractTextElements(slide);
    if (textElements.length === 0) return;

    // Step 1: Auto-fit font sizes based on content
    this.autoFitFontSizes(textElements);

    // Step 2: Enforce typography hierarchy
    this.enforceTypographyHierarchy(textElements);

    // Step 3: Fix edge margins
    this.fixEdgeMargins(textElements);

    // Step 4: Resolve overlaps
    this.fixOverlaps(textElements);

    // Step 5: Ensure vertical rhythm
    this.ensureVerticalRhythm(textElements);

    // Step 6: Center titles
    this.centerTitles(textElements);
  }

  // ===== Analysis =====

  private extractTextElements(slide: Slide): TextElementInfo[] {
    const infos: TextElementInfo[] = [];

    for (let i = 0; i < slide.elements.length; i++) {
      const el = slide.elements[i] as any;

      if (el.type === 'text') {
        const textEl = el as PPTTextElement;
        const plainText = this.stripHTML(textEl.content || '');
        const fontSize = this.extractFontSize(textEl.content || '');
        const maxChars = this.estimateMaxChars(textEl.width, textEl.height, fontSize);
        const info: TextElementInfo = {
          element: textEl,
          index: i,
          role: 'body', // will be classified below
          plainText,
          fontSize,
          charCount: plainText.length,
          maxCharacters: maxChars,
          bounds: this.getBounds(textEl),
        };
        infos.push(info);
      } else if (el.type === 'shape' && (el as PPTShapeElement).text?.content) {
        const shapeEl = el as PPTShapeElement;
        const plainText = this.stripHTML(shapeEl.text!.content || '');
        const fontSize = this.extractFontSize(shapeEl.text!.content || '');
        const maxChars = this.estimateMaxChars(shapeEl.width, shapeEl.height, fontSize);
        const info: TextElementInfo = {
          element: shapeEl,
          index: i,
          role: 'body',
          plainText,
          fontSize,
          charCount: plainText.length,
          maxCharacters: maxChars,
          bounds: this.getBounds(shapeEl),
        };
        infos.push(info);
      }
    }

    // Classify roles
    for (const info of infos) {
      info.role = this.classifyRole(info, infos);
    }

    return infos;
  }

  private classifyRole(info: TextElementInfo, allInfos: TextElementInfo[]): TextRole {
    const el = info.element;

    // Signal 1: Explicit textType from template
    let textType: TextType | undefined;
    if (el.type === 'text') {
      textType = (el as PPTTextElement).textType;
    } else if (el.type === 'shape') {
      textType = (el as PPTShapeElement).text?.type;
    }

    if (textType) {
      if (textType === 'title' || textType === 'header') return 'title';
      if (textType === 'subtitle') return 'subtitle';
      if (textType === 'content' || textType === 'item' || textType === 'itemTitle') return 'body';
      if (textType === 'notes' || textType === 'footer' || textType === 'partNumber' || textType === 'itemNumber') return 'label';
    }

    // Signal 2: Font size heuristic
    const maxFontSize = Math.max(...allInfos.map(i => i.fontSize), 14);

    if (info.fontSize >= maxFontSize * 0.9 && el.top < this.config.slideHeight * 0.3) return 'title';
    if (info.fontSize >= maxFontSize * 0.65 && el.top < this.config.slideHeight * 0.4) return 'subtitle';
    if (info.fontSize < 12 || (el.width < 200 && el.height < 80)) return 'label';
    return 'body';
  }

  // ===== Font Size Auto-Fit =====

  private autoFitFontSizes(elements: TextElementInfo[]): void {
    for (const info of elements) {
      if (info.charCount === 0) continue;

      const newSize = this.calculateOptimalFontSize(info);
      if (Math.abs(newSize - info.fontSize) > 1) {
        this.applyFontSize(info, newSize);
        info.fontSize = newSize;
        this.summary.fontAdjustments++;
      }
    }
  }

  private calculateOptimalFontSize(info: TextElementInfo): number {
    const { charCount, maxCharacters, fontSize, role } = info;
    const limits = ROLE_FONT_LIMITS[role];
    const fillRatio = maxCharacters > 0 ? charCount / maxCharacters : 1;

    let newSize = fontSize;

    if (fillRatio < 0.3 && charCount > 0) {
      // Content is very short — increase font for visual impact
      const scaleFactor = 1.0 + (0.3 - fillRatio) * 1.5; // up to 1.45x
      newSize = fontSize * scaleFactor;
    } else if (fillRatio > 1.1) {
      // Content overflows — decrease font to fit
      const scaleFactor = maxCharacters / charCount;
      newSize = fontSize * Math.max(scaleFactor, 0.6); // never shrink more than 40%
    }

    // Clamp to role limits
    return Math.round(Math.max(limits.min, Math.min(limits.max, newSize)));
  }

  private applyFontSize(info: TextElementInfo, newSize: number): void {
    const el = info.element;

    if (el.type === 'text') {
      const textEl = el as PPTTextElement;
      textEl.content = this.updateFontSizeInHTML(textEl.content, newSize);
    } else if (el.type === 'shape') {
      const shapeEl = el as PPTShapeElement;
      if (shapeEl.text?.content) {
        shapeEl.text.content = this.updateFontSizeInHTML(shapeEl.text.content, newSize);
      }
    }
  }

  // ===== Typography Hierarchy =====

  private enforceTypographyHierarchy(elements: TextElementInfo[]): void {
    const byRole = {
      title: elements.filter(e => e.role === 'title'),
      subtitle: elements.filter(e => e.role === 'subtitle'),
      body: elements.filter(e => e.role === 'body'),
      label: elements.filter(e => e.role === 'label'),
    };

    const titleMaxFont = byRole.title.length > 0
      ? Math.max(...byRole.title.map(e => e.fontSize)) : 36;
    const subtitleMaxFont = byRole.subtitle.length > 0
      ? Math.max(...byRole.subtitle.map(e => e.fontSize)) : titleMaxFont * 0.7;

    // Enforce: subtitle < title
    for (const info of byRole.subtitle) {
      if (info.fontSize >= titleMaxFont) {
        const newSize = Math.round(titleMaxFont * 0.7);
        this.applyFontSize(info, newSize);
        info.fontSize = newSize;
        this.summary.hierarchyFixes++;
      }
    }

    // Enforce: body < subtitle
    const effectiveSubtitleMax = byRole.subtitle.length > 0
      ? Math.max(...byRole.subtitle.map(e => e.fontSize)) : subtitleMaxFont;
    for (const info of byRole.body) {
      if (info.fontSize >= effectiveSubtitleMax) {
        const newSize = Math.round(effectiveSubtitleMax * 0.75);
        this.applyFontSize(info, newSize);
        info.fontSize = newSize;
        this.summary.hierarchyFixes++;
      }
    }

    // Enforce: label < body
    const effectiveBodyMax = byRole.body.length > 0
      ? Math.max(...byRole.body.map(e => e.fontSize)) : 16;
    for (const info of byRole.label) {
      if (info.fontSize >= effectiveBodyMax) {
        const newSize = Math.round(effectiveBodyMax * 0.7);
        this.applyFontSize(info, newSize);
        info.fontSize = newSize;
        this.summary.hierarchyFixes++;
      }
    }
  }

  // ===== Edge Margins =====

  private fixEdgeMargins(elements: TextElementInfo[]): void {
    const { margin, slideWidth, slideHeight } = this.config;

    for (const info of elements) {
      const el = info.element;
      let changed = false;

      // Push away from left edge
      if (el.left < margin) {
        const shift = margin - el.left;
        el.left = margin;
        el.width = Math.max(80, el.width - shift);
        changed = true;
      }

      // Push away from top edge
      if (el.top < margin) {
        const shift = margin - el.top;
        el.top = margin;
        el.height = Math.max(30, el.height - shift);
        changed = true;
      }

      // Pull back from right edge
      if (el.left + el.width > slideWidth - margin) {
        el.width = Math.max(80, slideWidth - margin - el.left);
        changed = true;
      }

      // Pull back from bottom edge
      if (el.top + el.height > slideHeight - margin) {
        el.height = Math.max(30, slideHeight - margin - el.top);
        changed = true;
      }

      if (changed) {
        info.bounds = this.getBounds(el);
        this.summary.positionAdjustments++;
      }
    }
  }

  // ===== Overlap Resolution =====

  private fixOverlaps(elements: TextElementInfo[]): void {
    // Sort by priority (higher first), then by top position
    const sorted = [...elements].sort((a, b) => {
      const priorityDiff = ROLE_PRIORITY[b.role] - ROLE_PRIORITY[a.role];
      if (priorityDiff !== 0) return priorityDiff;
      return a.element.top - b.element.top;
    });

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j]; // lower priority or lower position

        if (!this.boundsOverlap(a.bounds, b.bounds)) continue;

        const overlapArea = this.getOverlapArea(a.bounds, b.bounds);
        if (overlapArea < 100) continue; // negligible

        // Push the lower-priority element down
        const requiredTop = a.bounds.bottom + this.config.minSpacing;
        b.element.top = requiredTop;

        // If pushed past slide bottom, shrink instead
        if (b.element.top + b.element.height > this.config.slideHeight - this.config.margin) {
          b.element.height = Math.max(30, this.config.slideHeight - this.config.margin - b.element.top);
        }

        b.bounds = this.getBounds(b.element);
        this.summary.spacingFixes++;
      }
    }
  }

  // ===== Vertical Rhythm =====

  private ensureVerticalRhythm(elements: TextElementInfo[]): void {
    // Group elements by horizontal alignment (similar left position)
    const columns = this.groupByColumn(elements, 100);

    for (const column of columns) {
      if (column.length < 3) continue; // need 3+ elements for rhythm

      const sorted = column.sort((a, b) => a.element.top - b.element.top);

      // Calculate spacings between consecutive elements
      const spacings: number[] = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = sorted[i + 1].bounds.top - sorted[i].bounds.bottom;
        spacings.push(gap);
      }

      if (spacings.length === 0) continue;

      const avgSpacing = spacings.reduce((s, v) => s + v, 0) / spacings.length;
      const targetSpacing = Math.max(this.config.minSpacing, Math.min(60, avgSpacing));

      // Check if spacing varies too much (>40% difference)
      const maxSpacing = Math.max(...spacings);
      const minSpacing = Math.min(...spacings);
      if (maxSpacing - minSpacing < targetSpacing * 0.4) continue; // already balanced

      // Redistribute: keep first element, equalize rest
      let currentTop = sorted[0].bounds.bottom + targetSpacing;
      for (let i = 1; i < sorted.length; i++) {
        if (Math.abs(sorted[i].element.top - currentTop) > 5) {
          sorted[i].element.top = currentTop;
          sorted[i].bounds = this.getBounds(sorted[i].element);
          this.summary.spacingFixes++;
        }
        currentTop = sorted[i].bounds.bottom + targetSpacing;
      }
    }
  }

  // ===== Center Titles =====

  private centerTitles(elements: TextElementInfo[]): void {
    const slideCenter = this.config.slideWidth / 2;

    for (const info of elements) {
      if (info.role !== 'title') continue;

      const el = info.element;
      const elementCenter = el.left + el.width / 2;
      const offset = Math.abs(elementCenter - slideCenter);

      // If element is near-center (within 15% of slide width), snap to center
      if (offset < this.config.slideWidth * 0.15 && offset > 5) {
        el.left = slideCenter - el.width / 2;
        info.bounds = this.getBounds(el);
        this.summary.positionAdjustments++;
      }
    }
  }

  // ===== Utilities =====

  private getBounds(el: { left: number; top: number; width: number; height: number }): BoundingBox {
    return {
      left: el.left,
      top: el.top,
      right: el.left + el.width,
      bottom: el.top + el.height,
      width: el.width,
      height: el.height,
    };
  }

  private boundsOverlap(a: BoundingBox, b: BoundingBox): boolean {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  private getOverlapArea(a: BoundingBox, b: BoundingBox): number {
    const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return xOverlap * yOverlap;
  }

  private groupByColumn(elements: TextElementInfo[], threshold: number): TextElementInfo[][] {
    const columns: TextElementInfo[][] = [];

    for (const info of elements) {
      let added = false;
      for (const col of columns) {
        // Check if this element's left is within threshold of column's average left
        const avgLeft = col.reduce((s, e) => s + e.element.left, 0) / col.length;
        if (Math.abs(info.element.left - avgLeft) < threshold) {
          col.push(info);
          added = true;
          break;
        }
      }
      if (!added) {
        columns.push([info]);
      }
    }

    return columns;
  }

  private stripHTML(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
  }

  private extractFontSize(html: string): number {
    // Extract the most common or first font-size from HTML
    const matches = html.match(/font-size:\s*(\d+(?:\.\d+)?)\s*px/gi);
    if (!matches || matches.length === 0) return 14;

    const sizes = matches.map(m => {
      const num = m.match(/(\d+(?:\.\d+)?)/);
      return num ? parseFloat(num[1]) : 14;
    });

    // Return the most common font size (mode)
    const freq = new Map<number, number>();
    for (const s of sizes) {
      const rounded = Math.round(s);
      freq.set(rounded, (freq.get(rounded) || 0) + 1);
    }

    let maxCount = 0;
    let modeSize = 14;
    for (const [size, count] of freq) {
      if (count > maxCount) {
        maxCount = count;
        modeSize = size;
      }
    }

    return modeSize;
  }

  private updateFontSizeInHTML(html: string, newSize: number): string {
    // Replace all font-size declarations in style attributes
    return html.replace(
      /font-size:\s*\d+(?:\.\d+)?\s*px/gi,
      `font-size: ${newSize.toFixed(1)}px`
    );
  }

  private estimateMaxChars(width: number, height: number, fontSize: number): number {
    if (fontSize <= 0) fontSize = 14;
    const charsPerLine = Math.floor(width / (fontSize * 0.6));
    const lines = Math.floor(height / (fontSize * 1.4));
    return Math.max(20, charsPerLine * Math.max(1, lines));
  }
}
