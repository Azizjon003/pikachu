/**
 * Color Harmony Agent
 *
 * Ensures visual consistency and accessibility:
 * 1. WCAG contrast ratio validation between text and backgrounds
 * 2. Chart color harmonization with the theme
 * 3. Auto-fix low-contrast combinations
 */

import tinycolor from 'tinycolor2';
import type { ColorTheme } from '../design-system';

export interface ContrastIssue {
  slideIndex: number;
  elementIndex: number;
  foreground: string;
  background: string;
  ratio: number;
  fix: string;
}

export interface HarmonyResult {
  issuesFound: number;
  issuesFixed: number;
  contrastIssues: ContrastIssue[];
  chartColorsFixed: number;
}

// WCAG AA minimum contrast ratios
const MIN_CONTRAST_LARGE = 3.0;   // Large text (>= 18px bold or >= 24px)
const MIN_CONTRAST_NORMAL = 4.5;  // Normal text

export class ColorHarmonyAgent {
  private theme: ColorTheme;

  constructor(theme: ColorTheme) {
    this.theme = theme;
  }

  /**
   * Check and fix contrast issues across all slides
   */
  harmonize(slides: any[]): HarmonyResult {
    const issues: ContrastIssue[] = [];
    let chartColorsFixed = 0;

    for (let si = 0; si < slides.length; si++) {
      const slide = slides[si];
      const slideBg = this.getSlideBackgroundColor(slide);

      for (let ei = 0; ei < slide.elements.length; ei++) {
        const el = slide.elements[ei];

        if (el.type === 'text') {
          const fixed = this.fixTextContrast(el, slideBg, si, ei, issues);
          if (fixed) slide.elements[ei] = fixed;
        }

        if (el.type === 'chart') {
          const fixCount = this.harmonizeChartColors(el);
          chartColorsFixed += fixCount;
        }
      }
    }

    return {
      issuesFound: issues.length,
      issuesFixed: issues.filter(i => i.fix !== 'none').length,
      contrastIssues: issues,
      chartColorsFixed,
    };
  }

  /**
   * Extract slide background color
   */
  private getSlideBackgroundColor(slide: any): string {
    const bg = slide.background;
    if (!bg) return this.theme.background;

    if (bg.type === 'solid') return bg.color || this.theme.background;
    if (bg.type === 'gradient' && bg.gradient?.colors?.length) {
      // Use the lighter gradient color for contrast check
      const colors = bg.gradient.colors.map((c: any) => c.color);
      return colors.reduce((lightest: string, c: string) =>
        tinycolor(c).getLuminance() > tinycolor(lightest).getLuminance() ? c : lightest
      );
    }
    return this.theme.background;
  }

  /**
   * Check text element contrast and fix if needed
   */
  private fixTextContrast(
    el: any,
    slideBg: string,
    slideIndex: number,
    elementIndex: number,
    issues: ContrastIssue[]
  ): any | null {
    const content = el.content || '';
    const colorMatch = content.match(/color:\s*(#[0-9a-fA-F]{6}|rgba?\([^)]+\))/);
    if (!colorMatch) return null;

    const textColor = colorMatch[1];
    const bgColor = el.fill?.value || slideBg;
    const fontSize = this.extractFontSize(content);

    const ratio = tinycolor.readability(textColor, bgColor);
    const minRequired = fontSize >= 18 ? MIN_CONTRAST_LARGE : MIN_CONTRAST_NORMAL;

    if (ratio >= minRequired) return null;

    // Fix: darken text on light bg, lighten text on dark bg
    const bgLuminance = tinycolor(bgColor).getLuminance();
    let fixedColor: string;

    if (bgLuminance > 0.5) {
      // Light background — darken text until contrast met
      fixedColor = this.darkenUntilContrast(textColor, bgColor, minRequired);
    } else {
      // Dark background — lighten text
      fixedColor = this.lightenUntilContrast(textColor, bgColor, minRequired);
    }

    issues.push({
      slideIndex,
      elementIndex,
      foreground: textColor,
      background: bgColor,
      ratio: Math.round(ratio * 100) / 100,
      fix: fixedColor,
    });

    // Apply fix to content HTML
    const fixedContent = content.replace(
      colorMatch[0],
      `color: ${fixedColor}`
    );
    return { ...el, content: fixedContent };
  }

  /**
   * Darken a color until contrast ratio is met
   */
  private darkenUntilContrast(fg: string, bg: string, minRatio: number): string {
    let color = tinycolor(fg);
    for (let i = 0; i < 20; i++) {
      if (tinycolor.readability(color.toHexString(), bg) >= minRatio) {
        return color.toHexString();
      }
      color = color.darken(5);
    }
    return '#1A1A1A'; // Fallback to near-black
  }

  /**
   * Lighten a color until contrast ratio is met
   */
  private lightenUntilContrast(fg: string, bg: string, minRatio: number): string {
    let color = tinycolor(fg);
    for (let i = 0; i < 20; i++) {
      if (tinycolor.readability(color.toHexString(), bg) >= minRatio) {
        return color.toHexString();
      }
      color = color.lighten(5);
    }
    return '#FFFFFF'; // Fallback to white
  }

  /**
   * Harmonize chart colors with theme — ensure distinct, accessible colors
   */
  private harmonizeChartColors(el: any): number {
    if (!el.themeColors || el.themeColors.length === 0) return 0;

    let fixes = 0;
    const colors = [...el.themeColors];

    // Ensure adjacent chart colors are visually distinct (deltaE > 30)
    for (let i = 1; i < colors.length; i++) {
      const prev = tinycolor(colors[i - 1]);
      const curr = tinycolor(colors[i]);

      // Use hue distance as proxy for distinctiveness
      const hueDiff = Math.abs(prev.toHsl().h - curr.toHsl().h);
      if (hueDiff < 25 && hueDiff > 0) {
        // Shift hue to increase distinctiveness
        const newHue = (curr.toHsl().h + 40) % 360;
        const hsl = curr.toHsl();
        colors[i] = tinycolor({ h: newHue, s: hsl.s, l: hsl.l }).toHexString();
        fixes++;
      }
    }

    if (fixes > 0) {
      el.themeColors = colors;
    }

    return fixes;
  }

  /**
   * Extract font size from HTML content
   */
  private extractFontSize(content: string): number {
    const match = content.match(/font-size:\s*(\d+)/);
    return match ? parseInt(match[1]) : 16;
  }

  /**
   * Generate accessible chart color palette from theme
   */
  generateChartPalette(seriesCount: number): string[] {
    const baseColors = [
      this.theme.primary,
      this.theme.accent,
    ];

    // Generate additional colors by rotating hue
    const primaryHsl = tinycolor(this.theme.primary).toHsl();
    const step = 360 / Math.max(seriesCount, 3);

    for (let i = 2; i < seriesCount; i++) {
      const hue = (primaryHsl.h + step * i) % 360;
      const color = tinycolor({
        h: hue,
        s: Math.max(primaryHsl.s * 0.8, 0.4),
        l: Math.max(primaryHsl.l, 0.35),
      }).toHexString();
      baseColors.push(color);
    }

    return baseColors.slice(0, seriesCount);
  }
}
