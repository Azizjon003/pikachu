/**
 * Design System for Template-Free Slide Generation
 *
 * Provides grid system, color themes, and typography scale.
 * All layout patterns use this system for consistent, professional output.
 */

import type { ThemeName, FontPairName, CustomColorPalette } from '../types/generation';

// ============================================
// Grid System
// ============================================

export interface GridConfig {
  columns: number;
  rows: number;
  gutterPx: number;
  marginPx: number;
}

export const GRID: GridConfig = {
  columns: 12,
  rows: 8,
  gutterPx: 20,
  marginPx: 60,
};

export interface GridRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Convert grid coordinates to pixel positions.
 * col/row are 1-based: col [1,12] means full width, [1,6] means left half.
 */
export function gridToPixels(
  col: [number, number],
  row: [number, number],
  viewport: { width: number; height: number }
): GridRect {
  const contentWidth = viewport.width - GRID.marginPx * 2;
  const contentHeight = viewport.height - GRID.marginPx * 2;

  const colWidth = (contentWidth - GRID.gutterPx * (GRID.columns - 1)) / GRID.columns;
  const rowHeight = (contentHeight - GRID.gutterPx * (GRID.rows - 1)) / GRID.rows;

  const startCol = col[0] - 1;
  const endCol = col[1] - 1;
  const startRow = row[0] - 1;
  const endRow = row[1] - 1;

  const left = GRID.marginPx + startCol * (colWidth + GRID.gutterPx);
  const top = GRID.marginPx + startRow * (rowHeight + GRID.gutterPx);
  const width = (endCol - startCol + 1) * colWidth + (endCol - startCol) * GRID.gutterPx;
  const height = (endRow - startRow + 1) * rowHeight + (endRow - startRow) * GRID.gutterPx;

  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(width),
    height: Math.round(height),
  };
}

// ============================================
// Color Themes
// ============================================

export interface ColorTheme {
  name: string;
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  white: string;
  gradientStart: string;
  gradientEnd: string;
}

export const THEMES: Record<ThemeName, ColorTheme> = {
  professional: {
    name: 'Professional',
    primary: '#1B3A5C',
    accent: '#2E86DE',
    background: '#FFFFFF',
    surface: '#F0F4F8',
    text: '#1A202C',
    muted: '#718096',
    white: '#FFFFFF',
    gradientStart: '#1B3A5C',
    gradientEnd: '#2E86DE',
  },
  modern: {
    name: 'Modern',
    primary: '#6C5CE7',
    accent: '#00CEC9',
    background: '#FFFFFF',
    surface: '#F8F9FE',
    text: '#2D3436',
    muted: '#636E72',
    white: '#FFFFFF',
    gradientStart: '#6C5CE7',
    gradientEnd: '#A29BFE',
  },
  warm: {
    name: 'Warm',
    primary: '#D35400',
    accent: '#F39C12',
    background: '#FFFFFF',
    surface: '#FFF8F0',
    text: '#2C3E50',
    muted: '#7F8C8D',
    white: '#FFFFFF',
    gradientStart: '#D35400',
    gradientEnd: '#F39C12',
  },
  cool: {
    name: 'Cool',
    primary: '#0984E3',
    accent: '#74B9FF',
    background: '#FFFFFF',
    surface: '#F0F7FF',
    text: '#2D3436',
    muted: '#636E72',
    white: '#FFFFFF',
    gradientStart: '#0984E3',
    gradientEnd: '#74B9FF',
  },
  bold: {
    name: 'Bold',
    primary: '#E74C3C',
    accent: '#2ECC71',
    background: '#FFFFFF',
    surface: '#F8F9FA',
    text: '#1A1A2E',
    muted: '#6C757D',
    white: '#FFFFFF',
    gradientStart: '#E74C3C',
    gradientEnd: '#C0392B',
  },
  minimal: {
    name: 'Minimal',
    primary: '#2C3E50',
    accent: '#95A5A6',
    background: '#FFFFFF',
    surface: '#FAFAFA',
    text: '#333333',
    muted: '#999999',
    white: '#FFFFFF',
    gradientStart: '#2C3E50',
    gradientEnd: '#34495E',
  },
  custom: {
    name: 'Custom',
    primary: '#4A90D9',
    accent: '#50C878',
    background: '#FFFFFF',
    surface: '#F5F7FA',
    text: '#1A1A2E',
    muted: '#7B8794',
    white: '#FFFFFF',
    gradientStart: '#4A90D9',
    gradientEnd: '#50C878',
  },
};

// ============================================
// Typography Scale
// ============================================

export interface TypographyRange {
  min: number;
  max: number;
  default: number;
}

export const TYPOGRAPHY: Record<string, TypographyRange> = {
  title: { min: 32, max: 52, default: 40 },
  subtitle: { min: 20, max: 32, default: 24 },
  body: { min: 14, max: 20, default: 16 },
  label: { min: 10, max: 14, default: 12 },
  'stat-number': { min: 36, max: 64, default: 48 },
  'stat-label': { min: 12, max: 16, default: 14 },
};

// ============================================
// Default Viewport
// ============================================

export const DEFAULT_VIEWPORT = { width: 1920, height: 1080 };

// ============================================
// Resolve color name to hex
// ============================================

export function resolveColor(
  colorName: string | undefined,
  theme: ColorTheme
): string {
  if (!colorName) return theme.text;
  const map: Record<string, string> = {
    primary: theme.primary,
    accent: theme.accent,
    text: theme.text,
    muted: theme.muted,
    white: theme.white,
    surface: theme.surface,
    background: theme.background,
  };
  return map[colorName] || colorName;
}

// ============================================
// Font Pairs
// ============================================

export interface FontPair {
  name: FontPairName;
  title: string;
  body: string;
  description: string;
}

export const FONT_PAIRS: Record<FontPairName, FontPair> = {
  classic: {
    name: 'classic',
    title: 'Georgia',
    body: 'Arial',
    description: 'Traditional serif + clean sans-serif',
  },
  modern: {
    name: 'modern',
    title: 'Montserrat',
    body: 'Open Sans',
    description: 'Bold geometric + friendly readable',
  },
  elegant: {
    name: 'elegant',
    title: 'Playfair Display',
    body: 'Lato',
    description: 'Sophisticated serif + light sans-serif',
  },
  playful: {
    name: 'playful',
    title: 'Poppins',
    body: 'Nunito',
    description: 'Rounded modern + soft friendly',
  },
  technical: {
    name: 'technical',
    title: 'Roboto Slab',
    body: 'Roboto',
    description: 'Structured slab + clean mechanical',
  },
  minimal: {
    name: 'minimal',
    title: 'Inter',
    body: 'Inter',
    description: 'Same font, varied weights — ultra-clean',
  },
};

// ============================================
// Custom Theme Builder
// ============================================

export function buildCustomTheme(colors: CustomColorPalette): ColorTheme {
  return {
    name: 'Custom',
    primary: colors.primary,
    accent: colors.accent,
    background: colors.background,
    surface: colors.surface,
    text: colors.text,
    muted: colors.muted,
    white: '#FFFFFF',
    gradientStart: colors.gradientStart,
    gradientEnd: colors.gradientEnd,
  };
}

export function getFontPairsForPrompt(): string {
  return Object.values(FONT_PAIRS)
    .map((fp) => `"${fp.name}" — ${fp.title} + ${fp.body} (${fp.description})`)
    .join('\n');
}

// ============================================
// Resolve functions
// ============================================

export function resolveBackground(
  bg: string | undefined,
  theme: ColorTheme
): string | undefined {
  if (!bg || bg === 'none') return undefined;
  // Gradient and glass backgrounds are handled separately in SlideBuilder
  if (bg === 'gradient' || bg === 'gradient-accent' || bg === 'glass') return undefined;
  const map: Record<string, string> = {
    primary: theme.primary,
    accent: theme.accent,
    light: theme.surface,
    white: theme.white,
  };
  return map[bg] || bg;
}
