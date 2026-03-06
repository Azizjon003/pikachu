/**
 * Whitespace Balance Agent
 *
 * Lightweight post-processing agent that only fixes critical layout issues:
 * 1. Elements bleeding completely outside slide boundaries
 * 2. Elements with negative coordinates
 *
 * IMPORTANT: This agent is intentionally conservative.
 * Pattern layouts (slide-builder) position elements precisely — aggressive
 * repositioning (density scaling, spacing equalization, centering) was
 * destroying those carefully designed layouts.
 */

export interface WhitespaceIssue {
  slideIndex: number;
  type: 'out-of-bounds' | 'negative-coords';
  description: string;
  fixed: boolean;
}

export interface WhitespaceResult {
  issuesFound: number;
  issuesFixed: number;
  issues: WhitespaceIssue[];
}

const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;
const EDGE_MARGIN = 10;

import type { AgentMemory } from './agent-memory';

export class WhitespaceBalanceAgent {
  private memory?: AgentMemory;

  constructor(memory?: AgentMemory) {
    this.memory = memory;
  }

  /**
   * Fix only critical boundary issues — don't touch pattern-designed positions
   */
  balance(slides: any[]): WhitespaceResult {
    const issues: WhitespaceIssue[] = [];

    for (let si = 0; si < slides.length; si++) {
      const slide = slides[si];
      const elements = slide.elements;
      if (!elements || elements.length === 0) continue;

      for (const el of elements) {
        // Skip decorative/full-bleed elements
        if (el.type === 'line') continue;
        if ((el.type === 'shape' || el.type === 'image') && el.width > SLIDE_WIDTH * 0.9) continue;

        let fixed = false;

        // Fix negative coordinates
        if (el.left < 0) {
          el.left = EDGE_MARGIN;
          fixed = true;
        }
        if (el.top < 0) {
          el.top = EDGE_MARGIN;
          fixed = true;
        }

        // Fix elements clearly past the right edge (50px tolerance)
        if (el.left + el.width > SLIDE_WIDTH + 50) {
          el.left = Math.max(EDGE_MARGIN, SLIDE_WIDTH - el.width - EDGE_MARGIN);
          fixed = true;
        }

        // Fix elements clearly past the bottom edge (50px tolerance)
        if (el.top + el.height > SLIDE_HEIGHT + 50) {
          el.top = Math.max(EDGE_MARGIN, SLIDE_HEIGHT - el.height - EDGE_MARGIN);
          fixed = true;
        }

        if (fixed) {
          issues.push({
            slideIndex: si,
            type: el.left < 0 || el.top < 0 ? 'negative-coords' : 'out-of-bounds',
            description: 'Element repositioned to stay within slide boundaries',
            fixed: true,
          });
        }
      }
    }

    // Log to shared memory — check if layout agent already fixed some elements
    if (this.memory) {
      const layoutFixes = this.memory.getByAgent('LayoutQuality').filter(e => e.type === 'fix');
      if (layoutFixes.length > 0) {
        this.memory.logDecision('Whitespace', -1, `LayoutQuality already fixed ${layoutFixes.length} elements, being extra conservative`);
      }
      for (const issue of issues) {
        this.memory.logFix('Whitespace', issue.slideIndex, -1, issue.description);
      }
      this.memory.logInfo('Whitespace', `Completed: ${issues.length} boundary fixes`);
    }

    return {
      issuesFound: issues.length,
      issuesFixed: issues.filter(i => i.fixed).length,
      issues,
    };
  }
}
