/**
 * Layout Quality Agent
 *
 * Validates element positioning and visual structure:
 * 1. Title always in top region of slide
 * 2. Elements not overlapping slide boundaries
 * 3. Consistent left-alignment across body elements
 * 4. Proper vertical ordering (title → subtitle → body)
 * 5. Element dimensions reasonable (not zero-width/height)
 *
 * IMPORTANT: This agent is conservative — it only fixes clear positioning
 * errors, not subjective layout preferences. Pattern layouts are trusted.
 */

const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;

export interface LayoutIssue {
  slideIndex: number;
  elementIndex: number;
  type: 'title-position' | 'overflow' | 'zero-size' | 'vertical-order' | 'alignment';
  description: string;
  fixed: boolean;
}

export interface LayoutQualityResult {
  issuesFound: number;
  issuesFixed: number;
  issues: LayoutIssue[];
}

import type { AgentMemory } from './agent-memory';

export class LayoutQualityAgent {
  private memory?: AgentMemory;

  constructor(memory?: AgentMemory) {
    this.memory = memory;
  }

  /**
   * Audit and fix layout issues across all slides
   */
  audit(slides: any[]): LayoutQualityResult {
    const issues: LayoutIssue[] = [];

    for (let si = 0; si < slides.length; si++) {
      const slide = slides[si];
      if (!slide.elements || slide.elements.length === 0) continue;

      // 1. Find title element and check position
      const titleEl = this.findTitle(slide);
      if (titleEl && titleEl.el.top > SLIDE_HEIGHT * 0.4) {
        // Title is in bottom half — move to top
        const oldTop = titleEl.el.top;
        titleEl.el.top = 50;
        issues.push({
          slideIndex: si, elementIndex: titleEl.idx,
          type: 'title-position',
          description: `Title was at y=${oldTop}, moved to top (y=50)`,
          fixed: true,
        });
      }

      // 2. Check for zero or invalid dimensions
      for (let ei = 0; ei < slide.elements.length; ei++) {
        const el = slide.elements[ei];
        if (el.type === 'line') continue;

        if (el.width <= 0 || el.height <= 0) {
          issues.push({
            slideIndex: si, elementIndex: ei,
            type: 'zero-size',
            description: `Element has invalid dimensions: ${el.width}x${el.height}`,
            fixed: false,
          });
        }
      }

      // 3. Check overflow (elements partially outside slide)
      for (let ei = 0; ei < slide.elements.length; ei++) {
        const el = slide.elements[ei];
        if (el.type === 'line') continue;

        const right = el.left + el.width;
        const bottom = el.top + el.height;
        let fixed = false;

        // Only fix if significantly outside (>100px overflow)
        if (right > SLIDE_WIDTH + 100) {
          el.width = Math.max(100, SLIDE_WIDTH - el.left - 40);
          fixed = true;
        }
        if (bottom > SLIDE_HEIGHT + 100) {
          el.height = Math.max(40, SLIDE_HEIGHT - el.top - 40);
          fixed = true;
        }

        if (fixed) {
          issues.push({
            slideIndex: si, elementIndex: ei,
            type: 'overflow',
            description: `Element resized to fit within slide boundaries`,
            fixed: true,
          });
        }
      }

      // 4. Check vertical ordering (title should be above body text)
      const textElements = slide.elements
        .map((el: any, idx: number) => ({ el, idx }))
        .filter(({ el }: any) => el.type === 'text' && el.content);

      if (textElements.length >= 2) {
        const titleInfo = textElements.find(({ el }: any) => {
          const fs = this.extractFontSize(el.content);
          return fs >= 28;
        });
        const bodyInfo = textElements.find(({ el }: any) => {
          const fs = this.extractFontSize(el.content);
          return fs >= 13 && fs <= 20;
        });

        if (titleInfo && bodyInfo && titleInfo.el.top > bodyInfo.el.top + 50) {
          issues.push({
            slideIndex: si, elementIndex: titleInfo.idx,
            type: 'vertical-order',
            description: `Title (y=${titleInfo.el.top}) is below body text (y=${bodyInfo.el.top})`,
            fixed: false, // Don't auto-fix — might be intentional
          });
        }
      }

      // 5. Check horizontal alignment consistency among body elements
      const bodyElements = textElements.filter(({ el }: any) => {
        const fs = this.extractFontSize(el.content);
        return fs >= 13 && fs <= 20;
      });

      if (bodyElements.length >= 2) {
        const lefts = bodyElements.map(({ el }: any) => el.left);
        const commonLeft = this.findMostCommon(lefts, 30);

        for (const { el, idx } of bodyElements) {
          if (Math.abs(el.left - commonLeft) > 10 && Math.abs(el.left - commonLeft) < 60) {
            // Close but not aligned — snap to common left
            el.left = commonLeft;
            issues.push({
              slideIndex: si, elementIndex: idx,
              type: 'alignment',
              description: `Body element snapped to common left alignment (${commonLeft}px)`,
              fixed: true,
            });
          }
        }
      }
    }

    // Log to shared memory
    if (this.memory) {
      // Read font quality warnings to be aware of prior changes
      const fontWarnings = this.memory.getByAgent('FontQuality').filter(e => e.type === 'warning');
      if (fontWarnings.length > 0) {
        this.memory.logDecision('LayoutQuality', -1, `Aware of ${fontWarnings.length} font warnings from FontQuality agent`);
      }

      for (const issue of issues) {
        if (issue.fixed) {
          this.memory.logFix('LayoutQuality', issue.slideIndex, issue.elementIndex, issue.description);
        } else {
          this.memory.logWarning('LayoutQuality', issue.slideIndex, issue.description);
        }
      }
      this.memory.logInfo('LayoutQuality', `Completed: ${issues.length} issues found, ${issues.filter(i => i.fixed).length} fixed`);
    }

    return {
      issuesFound: issues.length,
      issuesFixed: issues.filter(i => i.fixed).length,
      issues,
    };
  }

  private findTitle(slide: any): { el: any; idx: number } | null {
    for (let i = 0; i < slide.elements.length; i++) {
      const el = slide.elements[i];
      if (el.type !== 'text' || !el.content) continue;
      const fs = this.extractFontSize(el.content);
      const isBold = el.content.includes('font-weight: bold');
      if (fs >= 28 && isBold) return { el, idx: i };
    }
    return null;
  }

  private extractFontSize(content: string): number {
    const match = content.match(/font-size:\s*(\d+)/);
    return match ? parseInt(match[1]) : 16;
  }

  /**
   * Find the most common value within a tolerance range
   */
  private findMostCommon(values: number[], tolerance: number): number {
    let bestValue = values[0];
    let bestCount = 0;

    for (const v of values) {
      const count = values.filter(x => Math.abs(x - v) <= tolerance).length;
      if (count > bestCount) {
        bestCount = count;
        bestValue = v;
      }
    }

    return bestValue;
  }
}
