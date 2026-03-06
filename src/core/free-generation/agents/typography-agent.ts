/**
 * Multi-language Typography Agent
 *
 * Selects appropriate fonts based on content language:
 * 1. Latin scripts (English, Spanish, etc.) — use chosen font pair
 * 2. Cyrillic (Russian, Ukrainian) — ensure Cyrillic-compatible fonts
 * 3. CJK (Chinese, Japanese, Korean) — use system CJK fonts
 * 4. Arabic/Persian/Urdu — RTL-compatible fonts
 * 5. Devanagari/Bengali/Thai — appropriate Indic fonts
 *
 * Also handles mixed-language presentations (e.g., Uzbek with Latin+Cyrillic).
 */

import type { FontPair } from '../design-system';

export interface TypographyConfig {
  titleFont: string;
  bodyFont: string;
  isRTL: boolean;
  textDirection: 'ltr' | 'rtl';
  fallbackFonts: string[];
}

// Language → font configuration mapping
const LANGUAGE_FONTS: Record<string, TypographyConfig> = {
  // Latin-script languages — use user-selected fonts
  english: { titleFont: '', bodyFont: '', isRTL: false, textDirection: 'ltr', fallbackFonts: ['Arial', 'Helvetica'] },
  spanish: { titleFont: '', bodyFont: '', isRTL: false, textDirection: 'ltr', fallbackFonts: ['Arial', 'Helvetica'] },
  french: { titleFont: '', bodyFont: '', isRTL: false, textDirection: 'ltr', fallbackFonts: ['Arial', 'Helvetica'] },
  german: { titleFont: '', bodyFont: '', isRTL: false, textDirection: 'ltr', fallbackFonts: ['Arial', 'Helvetica'] },
  uzbek: { titleFont: '', bodyFont: '', isRTL: false, textDirection: 'ltr', fallbackFonts: ['Arial', 'Helvetica'] },
  turkish: { titleFont: '', bodyFont: '', isRTL: false, textDirection: 'ltr', fallbackFonts: ['Arial', 'Helvetica'] },

  // Cyrillic languages
  russian: { titleFont: 'Segoe UI', bodyFont: 'Segoe UI', isRTL: false, textDirection: 'ltr', fallbackFonts: ['Arial', 'Noto Sans'] },
  ukrainian: { titleFont: 'Segoe UI', bodyFont: 'Segoe UI', isRTL: false, textDirection: 'ltr', fallbackFonts: ['Arial', 'Noto Sans'] },

  // CJK languages
  chinese: { titleFont: 'Microsoft YaHei', bodyFont: 'Microsoft YaHei', isRTL: false, textDirection: 'ltr', fallbackFonts: ['SimHei', 'Noto Sans SC'] },
  japanese: { titleFont: 'Yu Gothic', bodyFont: 'Yu Gothic', isRTL: false, textDirection: 'ltr', fallbackFonts: ['MS Gothic', 'Noto Sans JP'] },
  korean: { titleFont: 'Malgun Gothic', bodyFont: 'Malgun Gothic', isRTL: false, textDirection: 'ltr', fallbackFonts: ['Noto Sans KR'] },

  // RTL languages
  arabic: { titleFont: 'Sakkal Majalla', bodyFont: 'Sakkal Majalla', isRTL: true, textDirection: 'rtl', fallbackFonts: ['Arial', 'Noto Sans Arabic'] },
  persian: { titleFont: 'B Nazanin', bodyFont: 'B Nazanin', isRTL: true, textDirection: 'rtl', fallbackFonts: ['Arial', 'Noto Sans Arabic'] },
  hebrew: { titleFont: 'David', bodyFont: 'David', isRTL: true, textDirection: 'rtl', fallbackFonts: ['Arial', 'Noto Sans Hebrew'] },
  urdu: { titleFont: 'Jameel Noori Nastaleeq', bodyFont: 'Jameel Noori Nastaleeq', isRTL: true, textDirection: 'rtl', fallbackFonts: ['Arial', 'Noto Nastaliq Urdu'] },

  // Indic languages
  hindi: { titleFont: 'Nirmala UI', bodyFont: 'Nirmala UI', isRTL: false, textDirection: 'ltr', fallbackFonts: ['Mangal', 'Noto Sans Devanagari'] },
  bengali: { titleFont: 'Nirmala UI', bodyFont: 'Nirmala UI', isRTL: false, textDirection: 'ltr', fallbackFonts: ['Vrinda', 'Noto Sans Bengali'] },
  thai: { titleFont: 'Leelawadee UI', bodyFont: 'Leelawadee UI', isRTL: false, textDirection: 'ltr', fallbackFonts: ['Tahoma', 'Noto Sans Thai'] },
};

// Cyrillic-safe font pairs (fonts that render Cyrillic correctly)
const CYRILLIC_SAFE: Record<string, { title: string; body: string }> = {
  classic: { title: 'Georgia', body: 'Arial' },
  modern: { title: 'Segoe UI', body: 'Segoe UI' },
  elegant: { title: 'Georgia', body: 'Calibri' },
  playful: { title: 'Segoe UI', body: 'Segoe UI' },
  technical: { title: 'Consolas', body: 'Segoe UI' },
  minimal: { title: 'Calibri', body: 'Calibri' },
};

export class TypographyAgent {
  /**
   * Get the optimal font configuration for a given language and font pair
   */
  getTypography(language: string, fontPair: FontPair): TypographyConfig {
    const langKey = language.toLowerCase().trim();
    const config = LANGUAGE_FONTS[langKey];

    if (!config) {
      // Unknown language — use the selected font pair as-is
      return {
        titleFont: fontPair.title,
        bodyFont: fontPair.body,
        isRTL: false,
        textDirection: 'ltr',
        fallbackFonts: ['Arial', 'Helvetica'],
      };
    }

    // For Latin-script languages, use the selected font pair
    if (config.titleFont === '') {
      return {
        ...config,
        titleFont: fontPair.title,
        bodyFont: fontPair.body,
      };
    }

    // For Cyrillic, check if the selected font pair is Cyrillic-safe
    if (langKey === 'russian' || langKey === 'ukrainian') {
      const cyrillicFonts = CYRILLIC_SAFE[fontPair.name];
      if (cyrillicFonts) {
        return {
          ...config,
          titleFont: cyrillicFonts.title,
          bodyFont: cyrillicFonts.body,
        };
      }
    }

    return config;
  }

  /**
   * Apply RTL text direction to slide elements if needed
   */
  applyRTL(slides: any[], isRTL: boolean): number {
    if (!isRTL) return 0;

    let adjustments = 0;
    for (const slide of slides) {
      for (const el of slide.elements) {
        if (el.type !== 'text') continue;

        // Mirror horizontal alignment: left → right, right → left
        if (el.content) {
          el.content = el.content
            .replace(/text-align:\s*left/g, 'text-align: right')
            .replace(/text-align:\s*right(?!;)/g, 'text-align: left'); // Avoid double-replace
          adjustments++;
        }

        // Mirror element positions for asymmetric layouts
        // Elements in the left half move to right half and vice versa
        const slideWidth = 1920;
        const elRight = el.left + el.width;
        const mirroredLeft = slideWidth - elRight;

        // Only mirror if element is clearly on one side
        const centerX = el.left + el.width / 2;
        if (centerX < slideWidth * 0.35 || centerX > slideWidth * 0.65) {
          el.left = mirroredLeft;
          adjustments++;
        }
      }
    }

    return adjustments;
  }

  /**
   * Update font references in all text elements
   */
  applyFonts(slides: any[], titleFont: string, bodyFont: string): number {
    let updates = 0;

    for (const slide of slides) {
      for (const el of slide.elements) {
        if (el.type !== 'text' || !el.content) continue;

        // Update defaultFontName
        if (el.defaultFontName) {
          const isTitle = el.content.includes('font-weight: bold') ||
            this.extractFontSize(el.content) >= 24;
          el.defaultFontName = isTitle ? titleFont : bodyFont;
        }

        // Update inline font-family references
        const oldContent = el.content;
        el.content = el.content.replace(
          /font-family:\s*'[^']+'/g,
          (match: string) => {
            const isTitle = el.content.indexOf(match) < el.content.indexOf(match) + 100 &&
              (el.content.includes('font-weight: bold') || this.extractFontSize(el.content) >= 24);
            return `font-family: '${isTitle ? titleFont : bodyFont}'`;
          }
        );

        if (el.content !== oldContent) updates++;
      }
    }

    return updates;
  }

  private extractFontSize(content: string): number {
    const match = content.match(/font-size:\s*(\d+)/);
    return match ? parseInt(match[1]) : 16;
  }
}
