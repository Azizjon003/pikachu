/**
 * Font Quality Agent
 *
 * Validates and fixes font-related issues across slides:
 * 1. Font size hierarchy (title > subtitle > body > label)
 * 2. Minimum/maximum font size enforcement per role
 * 3. Consistent font sizes within the same role across slides
 * 4. Truncated text detection (content too long for element)
 */

export interface FontIssue {
  slideIndex: number;
  elementIndex: number;
  type: 'hierarchy' | 'too-large' | 'too-small' | 'inconsistent' | 'truncated';
  description: string;
  fixed: boolean;
}

export interface FontQualityResult {
  issuesFound: number;
  issuesFixed: number;
  issues: FontIssue[];
}

// Expected font size ranges per role
const FONT_RANGES: Record<string, { min: number; max: number }> = {
  title: { min: 26, max: 52 },
  subtitle: { min: 16, max: 32 },
  body: { min: 13, max: 20 },
  label: { min: 10, max: 18 },
  'stat-number': { min: 28, max: 64 },
  'stat-label': { min: 11, max: 16 },
};

import type { AgentMemory } from './agent-memory';

export class FontQualityAgent {
  private memory?: AgentMemory;

  constructor(memory?: AgentMemory) {
    this.memory = memory;
  }

  /**
   * Audit and fix font issues across all slides
   */
  audit(slides: any[]): FontQualityResult {
    const issues: FontIssue[] = [];

    // Collect font sizes by role across all slides for consistency check
    const sizesByRole = new Map<string, number[]>();

    for (let si = 0; si < slides.length; si++) {
      const slide = slides[si];
      let titleSize = 0;
      let subtitleSize = 0;

      for (let ei = 0; ei < slide.elements.length; ei++) {
        const el = slide.elements[ei];
        if (el.type !== 'text' || !el.content) continue;

        const fontSize = this.extractFontSize(el.content);
        if (fontSize === 0) continue;

        const role = this.detectRole(el, fontSize);

        // Track sizes per role
        if (!sizesByRole.has(role)) sizesByRole.set(role, []);
        sizesByRole.get(role)!.push(fontSize);

        // 1. Check font size range for role
        const range = FONT_RANGES[role];
        if (range) {
          if (fontSize > range.max) {
            const newSize = range.max;
            el.content = this.replaceFontSize(el.content, fontSize, newSize);
            issues.push({
              slideIndex: si, elementIndex: ei,
              type: 'too-large',
              description: `${role} font ${fontSize}px exceeds max ${range.max}px, reduced to ${newSize}px`,
              fixed: true,
            });
          } else if (fontSize < range.min) {
            const newSize = range.min;
            el.content = this.replaceFontSize(el.content, fontSize, newSize);
            issues.push({
              slideIndex: si, elementIndex: ei,
              type: 'too-small',
              description: `${role} font ${fontSize}px below min ${range.min}px, increased to ${newSize}px`,
              fixed: true,
            });
          }
        }

        // 2. Track for hierarchy check
        if (role === 'title') titleSize = fontSize;
        if (role === 'subtitle') subtitleSize = fontSize;

        // 3. Check for text truncation (content too long for element area)
        const plainText = el.content.replace(/<[^>]+>/g, '').trim();
        const charsPerLine = Math.floor(el.width / (fontSize * 0.6));
        const availableLines = Math.floor(el.height / (fontSize * 1.5));
        const maxChars = charsPerLine * availableLines;

        if (plainText.length > maxChars * 1.5 && maxChars > 0) {
          // Auto-reduce font size to fit
          const scaleFactor = Math.sqrt(maxChars / plainText.length);
          const reducedSize = Math.max(12, Math.round(fontSize * scaleFactor));
          if (reducedSize < fontSize) {
            el.content = this.replaceFontSize(el.content, fontSize, reducedSize);
            issues.push({
              slideIndex: si, elementIndex: ei,
              type: 'truncated',
              description: `Text may be truncated (${plainText.length} chars, ~${maxChars} fit), font reduced from ${fontSize}px to ${reducedSize}px`,
              fixed: true,
            });
          }
        }
      }

      // 4. Check hierarchy within slide
      if (titleSize > 0 && subtitleSize > 0 && subtitleSize >= titleSize) {
        issues.push({
          slideIndex: si, elementIndex: -1,
          type: 'hierarchy',
          description: `Subtitle (${subtitleSize}px) should be smaller than title (${titleSize}px)`,
          fixed: false,
        });
      }
    }

    // 5. Check consistency across slides
    for (const [role, sizes] of sizesByRole) {
      if (sizes.length < 3) continue;
      const avg = sizes.reduce((s, v) => s + v, 0) / sizes.length;
      const variance = sizes.reduce((s, v) => s + (v - avg) ** 2, 0) / sizes.length;
      const stdDev = Math.sqrt(variance);

      // If standard deviation is more than 30% of mean, flag inconsistency
      if (stdDev > avg * 0.3 && stdDev > 3) {
        issues.push({
          slideIndex: -1, elementIndex: -1,
          type: 'inconsistent',
          description: `${role} font sizes vary too much: avg=${avg.toFixed(0)}px, stdDev=${stdDev.toFixed(1)}px (range: ${Math.min(...sizes)}-${Math.max(...sizes)}px)`,
          fixed: false,
        });
      }
    }

    // Log to shared memory
    if (this.memory) {
      for (const issue of issues) {
        if (issue.fixed) {
          this.memory.logFix('FontQuality', issue.slideIndex, issue.elementIndex, issue.description);
        } else {
          this.memory.logWarning('FontQuality', issue.slideIndex, issue.description);
        }
      }
      this.memory.logInfo('FontQuality', `Completed: ${issues.length} issues found, ${issues.filter(i => i.fixed).length} fixed`);
    }

    return {
      issuesFound: issues.length,
      issuesFixed: issues.filter(i => i.fixed).length,
      issues,
    };
  }

  private detectRole(el: any, fontSize: number): string {
    const isBold = el.content?.includes('font-weight: bold') || el.content?.includes('font-weight:bold');
    const plainText = (el.content || '').replace(/<[^>]+>/g, '').trim();

    if (fontSize >= 32 && isBold) return 'title';
    if (fontSize >= 36 && plainText.length < 12) return 'stat-number';
    if (fontSize >= 24) return 'subtitle';
    if (fontSize <= 14 && plainText.length < 40) return 'label';
    if (fontSize <= 15 && plainText.length < 60 && !plainText.includes('\n')) return 'stat-label';
    return 'body';
  }

  private extractFontSize(content: string): number {
    const match = content.match(/font-size:\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  private replaceFontSize(content: string, oldSize: number, newSize: number): string {
    return content.replace(
      new RegExp(`font-size:\\s*${oldSize}`, 'g'),
      `font-size: ${newSize}`
    );
  }
}
