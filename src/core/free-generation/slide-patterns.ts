/**
 * Slide Layout Patterns for Template-Free Generation
 *
 * 15 predefined layout patterns using a 12-column, 8-row grid system.
 * AI selects the best pattern per slide, then content fills each element.
 */

import type { PatternName, ElementRole } from '../types/generation';

// ============================================
// Types
// ============================================

export interface PatternElement {
  type: 'text' | 'image' | 'shape' | 'table';
  role: ElementRole;
  col: [number, number];
  row: [number, number];
  fontSize: number;
  fontWeight?: 'normal' | 'bold';
  align?: 'left' | 'center' | 'right';
  color?: 'primary' | 'text' | 'muted' | 'white' | 'accent';
  maxCharacters?: number;
  background?: 'primary' | 'accent' | 'light' | 'white' | 'none' | 'gradient' | 'gradient-accent' | 'glass';
  borderRadius?: number;
  /** Shadow depth: 'sm' | 'md' | 'lg' */
  shadow?: 'sm' | 'md' | 'lg';
  /** Opacity for the element (0-1, used for decorative/overlay shapes) */
  opacity?: number;
  /** Shape variant for more visual diversity */
  shapeVariant?: 'rect' | 'circle' | 'rounded-lg' | 'line-h' | 'line-v' | 'blob';
}

export interface SlidePattern {
  name: PatternName;
  description: string;
  suitableFor: string[];
  elements: PatternElement[];
  background?: 'white' | 'light' | 'dark' | 'gradient' | 'primary';
}

// ============================================
// Pattern Definitions
// ============================================

export const PATTERNS: Record<PatternName, SlidePattern> = {
  'title-center': {
    name: 'title-center',
    description: 'Large centered title with subtitle — for intro/cover slides',
    suitableFor: ['introduction', 'cover', 'opening'],
    background: 'gradient',
    elements: [
      {
        type: 'text', role: 'title',
        col: [2, 11], row: [3, 4],
        fontSize: 48, fontWeight: 'bold', align: 'center', color: 'white',
        maxCharacters: 60,
      },
      {
        type: 'text', role: 'subtitle',
        col: [3, 10], row: [5, 5],
        fontSize: 24, align: 'center', color: 'white',
        maxCharacters: 120,
      },
      {
        type: 'text', role: 'label',
        col: [4, 9], row: [7, 7],
        fontSize: 16, align: 'center', color: 'white',
        maxCharacters: 60,
      },
    ],
  },

  'title-subtitle': {
    name: 'title-subtitle',
    description: 'Title at top with subtitle below — clean opening with accent line',
    suitableFor: ['introduction', 'section-start'],
    background: 'white',
    elements: [
      {
        type: 'shape', role: 'accent',
        col: [1, 1], row: [1, 8],
        fontSize: 0, background: 'gradient',
        shapeVariant: 'line-v', opacity: 0.8,
      },
      {
        type: 'text', role: 'title',
        col: [2, 12], row: [2, 3],
        fontSize: 44, fontWeight: 'bold', align: 'left', color: 'primary',
        maxCharacters: 80,
      },
      {
        type: 'text', role: 'subtitle',
        col: [2, 8], row: [4, 5],
        fontSize: 20, align: 'left', color: 'muted',
        maxCharacters: 200,
      },
      {
        type: 'shape', role: 'accent',
        col: [2, 4], row: [6, 6],
        fontSize: 0, background: 'gradient',
        shapeVariant: 'line-h',
      },
    ],
  },

  'bullet-list': {
    name: 'bullet-list',
    description: 'Title + bullet point list — for informational slides',
    suitableFor: ['information', 'explanation', 'features', 'benefits'],
    background: 'white',
    elements: [
      {
        type: 'text', role: 'title',
        col: [1, 12], row: [1, 1],
        fontSize: 36, fontWeight: 'bold', align: 'left', color: 'primary',
        maxCharacters: 60,
      },
      {
        type: 'text', role: 'body',
        col: [1, 11], row: [2, 7],
        fontSize: 18, align: 'left', color: 'text',
        maxCharacters: 600,
      },
    ],
  },

  'two-column': {
    name: 'two-column',
    description: 'Title + two content columns — for dual topics',
    suitableFor: ['comparison', 'dual-topic', 'pros-cons', 'before-after'],
    background: 'white',
    elements: [
      {
        type: 'text', role: 'title',
        col: [1, 12], row: [1, 1],
        fontSize: 36, fontWeight: 'bold', align: 'left', color: 'primary',
        maxCharacters: 60,
      },
      {
        type: 'text', role: 'body',
        col: [1, 6], row: [2, 7],
        fontSize: 16, align: 'left', color: 'text',
        maxCharacters: 350,
      },
      {
        type: 'text', role: 'body',
        col: [7, 12], row: [2, 7],
        fontSize: 16, align: 'left', color: 'text',
        maxCharacters: 350,
      },
    ],
  },

  'image-right': {
    name: 'image-right',
    description: 'Text on left, image on right — visual + info',
    suitableFor: ['visual', 'example', 'case-study', 'product'],
    background: 'white',
    elements: [
      {
        type: 'text', role: 'title',
        col: [1, 6], row: [1, 1],
        fontSize: 36, fontWeight: 'bold', align: 'left', color: 'primary',
        maxCharacters: 40,
      },
      {
        type: 'text', role: 'body',
        col: [1, 6], row: [2, 7],
        fontSize: 16, align: 'left', color: 'text',
        maxCharacters: 400,
      },
      {
        type: 'image', role: 'image',
        col: [7, 12], row: [1, 7],
        fontSize: 0,
      },
    ],
  },

  'image-left': {
    name: 'image-left',
    description: 'Image on left, text on right — visual + info',
    suitableFor: ['visual', 'example', 'illustration'],
    background: 'white',
    elements: [
      {
        type: 'image', role: 'image',
        col: [1, 6], row: [1, 7],
        fontSize: 0,
      },
      {
        type: 'text', role: 'title',
        col: [7, 12], row: [1, 1],
        fontSize: 36, fontWeight: 'bold', align: 'left', color: 'primary',
        maxCharacters: 40,
      },
      {
        type: 'text', role: 'body',
        col: [7, 12], row: [2, 7],
        fontSize: 16, align: 'left', color: 'text',
        maxCharacters: 400,
      },
    ],
  },

  'image-full': {
    name: 'image-full',
    description: 'Full-screen image with overlay text — dramatic visual',
    suitableFor: ['impact', 'visual-story', 'highlight'],
    background: 'dark',
    elements: [
      {
        type: 'image', role: 'image',
        col: [1, 12], row: [1, 8],
        fontSize: 0,
      },
      {
        type: 'text', role: 'title',
        col: [2, 11], row: [3, 4],
        fontSize: 44, fontWeight: 'bold', align: 'center', color: 'white',
        maxCharacters: 60,
      },
      {
        type: 'text', role: 'subtitle',
        col: [3, 10], row: [5, 6],
        fontSize: 20, align: 'center', color: 'white',
        maxCharacters: 150,
      },
    ],
  },

  'three-cards': {
    name: 'three-cards',
    description: 'Title + 3 gradient card blocks with shadows — for features, steps, categories',
    suitableFor: ['features', 'steps', 'categories', 'pillars'],
    background: 'light',
    elements: [
      {
        type: 'text', role: 'title',
        col: [1, 12], row: [1, 1],
        fontSize: 36, fontWeight: 'bold', align: 'center', color: 'primary',
        maxCharacters: 60,
      },
      // Card 1 — background shape
      {
        type: 'shape', role: 'accent',
        col: [1, 4], row: [3, 7],
        fontSize: 0, background: 'white',
        borderRadius: 16, shadow: 'md', shapeVariant: 'rounded-lg',
      },
      {
        type: 'shape', role: 'accent',
        col: [1, 4], row: [3, 3],
        fontSize: 0, background: 'gradient',
        shapeVariant: 'line-h',
      },
      {
        type: 'text', role: 'label',
        col: [1, 4], row: [4, 4],
        fontSize: 20, fontWeight: 'bold', align: 'center', color: 'primary',
        maxCharacters: 30,
      },
      {
        type: 'text', role: 'body',
        col: [1, 4], row: [5, 7],
        fontSize: 14, align: 'center', color: 'text',
        maxCharacters: 200,
      },
      // Card 2 — background shape
      {
        type: 'shape', role: 'accent',
        col: [5, 8], row: [3, 7],
        fontSize: 0, background: 'white',
        borderRadius: 16, shadow: 'md', shapeVariant: 'rounded-lg',
      },
      {
        type: 'shape', role: 'accent',
        col: [5, 8], row: [3, 3],
        fontSize: 0, background: 'gradient',
        shapeVariant: 'line-h',
      },
      {
        type: 'text', role: 'label',
        col: [5, 8], row: [4, 4],
        fontSize: 20, fontWeight: 'bold', align: 'center', color: 'primary',
        maxCharacters: 30,
      },
      {
        type: 'text', role: 'body',
        col: [5, 8], row: [5, 7],
        fontSize: 14, align: 'center', color: 'text',
        maxCharacters: 200,
      },
      // Card 3 — background shape
      {
        type: 'shape', role: 'accent',
        col: [9, 12], row: [3, 7],
        fontSize: 0, background: 'white',
        borderRadius: 16, shadow: 'md', shapeVariant: 'rounded-lg',
      },
      {
        type: 'shape', role: 'accent',
        col: [9, 12], row: [3, 3],
        fontSize: 0, background: 'gradient',
        shapeVariant: 'line-h',
      },
      {
        type: 'text', role: 'label',
        col: [9, 12], row: [4, 4],
        fontSize: 20, fontWeight: 'bold', align: 'center', color: 'primary',
        maxCharacters: 30,
      },
      {
        type: 'text', role: 'body',
        col: [9, 12], row: [5, 7],
        fontSize: 14, align: 'center', color: 'text',
        maxCharacters: 200,
      },
    ],
  },

  'stats-grid': {
    name: 'stats-grid',
    description: 'Title + 3 big stat numbers in cards with gradient accent — for data highlights',
    suitableFor: ['statistics', 'data', 'metrics', 'kpi', 'numbers'],
    background: 'light',
    elements: [
      {
        type: 'text', role: 'title',
        col: [1, 12], row: [1, 1],
        fontSize: 36, fontWeight: 'bold', align: 'center', color: 'primary',
        maxCharacters: 60,
      },
      // Stat 1 card
      {
        type: 'shape', role: 'accent',
        col: [1, 4], row: [3, 7],
        fontSize: 0, background: 'white',
        borderRadius: 16, shadow: 'lg', shapeVariant: 'rounded-lg',
      },
      {
        type: 'text', role: 'stat-number',
        col: [1, 4], row: [3, 5],
        fontSize: 52, fontWeight: 'bold', align: 'center', color: 'accent',
        maxCharacters: 10,
      },
      {
        type: 'text', role: 'stat-label',
        col: [1, 4], row: [6, 7],
        fontSize: 16, align: 'center', color: 'muted',
        maxCharacters: 50,
      },
      // Stat 2 card
      {
        type: 'shape', role: 'accent',
        col: [5, 8], row: [3, 7],
        fontSize: 0, background: 'white',
        borderRadius: 16, shadow: 'lg', shapeVariant: 'rounded-lg',
      },
      {
        type: 'text', role: 'stat-number',
        col: [5, 8], row: [3, 5],
        fontSize: 52, fontWeight: 'bold', align: 'center', color: 'accent',
        maxCharacters: 10,
      },
      {
        type: 'text', role: 'stat-label',
        col: [5, 8], row: [6, 7],
        fontSize: 16, align: 'center', color: 'muted',
        maxCharacters: 50,
      },
      // Stat 3 card
      {
        type: 'shape', role: 'accent',
        col: [9, 12], row: [3, 7],
        fontSize: 0, background: 'white',
        borderRadius: 16, shadow: 'lg', shapeVariant: 'rounded-lg',
      },
      {
        type: 'text', role: 'stat-number',
        col: [9, 12], row: [3, 5],
        fontSize: 52, fontWeight: 'bold', align: 'center', color: 'accent',
        maxCharacters: 10,
      },
      {
        type: 'text', role: 'stat-label',
        col: [9, 12], row: [6, 7],
        fontSize: 16, align: 'center', color: 'muted',
        maxCharacters: 50,
      },
    ],
  },

  comparison: {
    name: 'comparison',
    description: 'Two sided comparison with labels — for vs/pros-cons',
    suitableFor: ['comparison', 'versus', 'pros-cons', 'advantages-disadvantages'],
    background: 'white',
    elements: [
      {
        type: 'text', role: 'title',
        col: [1, 12], row: [1, 1],
        fontSize: 36, fontWeight: 'bold', align: 'center', color: 'primary',
        maxCharacters: 60,
      },
      {
        type: 'text', role: 'label',
        col: [1, 6], row: [2, 2],
        fontSize: 22, fontWeight: 'bold', align: 'center', color: 'white',
        maxCharacters: 30, background: 'primary',
      },
      {
        type: 'text', role: 'body',
        col: [1, 6], row: [3, 7],
        fontSize: 16, align: 'left', color: 'text',
        maxCharacters: 300, background: 'light',
      },
      {
        type: 'text', role: 'label',
        col: [7, 12], row: [2, 2],
        fontSize: 22, fontWeight: 'bold', align: 'center', color: 'white',
        maxCharacters: 30, background: 'accent',
      },
      {
        type: 'text', role: 'body',
        col: [7, 12], row: [3, 7],
        fontSize: 16, align: 'left', color: 'text',
        maxCharacters: 300, background: 'light',
      },
    ],
  },

  timeline: {
    name: 'timeline',
    description: 'Horizontal timeline with 4 points — for process/history',
    suitableFor: ['timeline', 'process', 'history', 'roadmap', 'steps'],
    background: 'white',
    elements: [
      {
        type: 'text', role: 'title',
        col: [1, 12], row: [1, 1],
        fontSize: 36, fontWeight: 'bold', align: 'center', color: 'primary',
        maxCharacters: 60,
      },
      // 4 timeline points
      {
        type: 'text', role: 'label',
        col: [1, 3], row: [3, 3],
        fontSize: 18, fontWeight: 'bold', align: 'center', color: 'accent',
        maxCharacters: 20,
      },
      {
        type: 'text', role: 'body',
        col: [1, 3], row: [4, 7],
        fontSize: 14, align: 'center', color: 'text',
        maxCharacters: 120,
      },
      {
        type: 'text', role: 'label',
        col: [4, 6], row: [3, 3],
        fontSize: 18, fontWeight: 'bold', align: 'center', color: 'accent',
        maxCharacters: 20,
      },
      {
        type: 'text', role: 'body',
        col: [4, 6], row: [4, 7],
        fontSize: 14, align: 'center', color: 'text',
        maxCharacters: 120,
      },
      {
        type: 'text', role: 'label',
        col: [7, 9], row: [3, 3],
        fontSize: 18, fontWeight: 'bold', align: 'center', color: 'accent',
        maxCharacters: 20,
      },
      {
        type: 'text', role: 'body',
        col: [7, 9], row: [4, 7],
        fontSize: 14, align: 'center', color: 'text',
        maxCharacters: 120,
      },
      {
        type: 'text', role: 'label',
        col: [10, 12], row: [3, 3],
        fontSize: 18, fontWeight: 'bold', align: 'center', color: 'accent',
        maxCharacters: 20,
      },
      {
        type: 'text', role: 'body',
        col: [10, 12], row: [4, 7],
        fontSize: 14, align: 'center', color: 'text',
        maxCharacters: 120,
      },
    ],
  },

  'table-slide': {
    name: 'table-slide',
    description: 'Title + data table — for structured data',
    suitableFor: ['data', 'comparison-table', 'specifications', 'schedule'],
    background: 'white',
    elements: [
      {
        type: 'text', role: 'title',
        col: [1, 12], row: [1, 1],
        fontSize: 36, fontWeight: 'bold', align: 'left', color: 'primary',
        maxCharacters: 60,
      },
      {
        type: 'table', role: 'body',
        col: [1, 12], row: [2, 7],
        fontSize: 14, color: 'text',
      },
    ],
  },

  quote: {
    name: 'quote',
    description: 'Large centered quote with decorative accent and attribution — for emphasis',
    suitableFor: ['quote', 'testimonial', 'key-insight', 'highlight'],
    background: 'light',
    elements: [
      // Decorative large quote mark (blob shape top-left)
      {
        type: 'shape', role: 'accent',
        col: [1, 2], row: [1, 2],
        fontSize: 0, background: 'gradient',
        shapeVariant: 'blob', opacity: 0.12,
      },
      // Vertical accent line
      {
        type: 'shape', role: 'accent',
        col: [1, 1], row: [2, 5],
        fontSize: 0, background: 'gradient',
        shapeVariant: 'line-v',
      },
      {
        type: 'text', role: 'body',
        col: [2, 11], row: [2, 5],
        fontSize: 28, align: 'center', color: 'primary',
        maxCharacters: 200,
      },
      {
        type: 'shape', role: 'accent',
        col: [5, 8], row: [6, 6],
        fontSize: 0, background: 'gradient',
        shapeVariant: 'line-h',
      },
      {
        type: 'text', role: 'label',
        col: [3, 10], row: [7, 7],
        fontSize: 18, align: 'center', color: 'muted',
        maxCharacters: 60,
      },
    ],
  },

  'section-break': {
    name: 'section-break',
    description: 'Bold section title — for separating presentation sections',
    suitableFor: ['section-divider', 'transition', 'chapter'],
    background: 'primary',
    elements: [
      {
        type: 'text', role: 'title',
        col: [2, 11], row: [3, 5],
        fontSize: 48, fontWeight: 'bold', align: 'center', color: 'white',
        maxCharacters: 40,
      },
      {
        type: 'text', role: 'subtitle',
        col: [3, 10], row: [6, 6],
        fontSize: 20, align: 'center', color: 'white',
        maxCharacters: 80,
      },
    ],
  },

  'thank-you': {
    name: 'thank-you',
    description: 'Thank you / closing slide',
    suitableFor: ['closing', 'end', 'thank-you'],
    background: 'gradient',
    elements: [
      {
        type: 'text', role: 'title',
        col: [2, 11], row: [3, 4],
        fontSize: 52, fontWeight: 'bold', align: 'center', color: 'white',
        maxCharacters: 30,
      },
      {
        type: 'text', role: 'subtitle',
        col: [3, 10], row: [5, 5],
        fontSize: 20, align: 'center', color: 'white',
        maxCharacters: 100,
      },
      {
        type: 'text', role: 'label',
        col: [4, 9], row: [7, 7],
        fontSize: 16, align: 'center', color: 'white',
        maxCharacters: 60,
      },
    ],
  },
  // ============================================
  // NEW: Chart/Diagram Patterns
  // ============================================

  'process-flow': {
    name: 'process-flow',
    description: 'Horizontal 4-step process flow with arrows — for workflows, steps, procedures',
    suitableFor: ['process', 'workflow', 'steps', 'procedure', 'methodology', 'pipeline'],
    background: 'white',
    elements: [
      {
        type: 'text', role: 'title',
        col: [1, 12], row: [1, 1],
        fontSize: 36, fontWeight: 'bold', align: 'center', color: 'primary',
        maxCharacters: 60,
      },
      // Step 1
      {
        type: 'shape', role: 'accent',
        col: [1, 3], row: [3, 5],
        fontSize: 0, background: 'gradient',
        borderRadius: 12, shadow: 'md', shapeVariant: 'rounded-lg',
      },
      {
        type: 'text', role: 'label',
        col: [1, 3], row: [3, 4],
        fontSize: 18, fontWeight: 'bold', align: 'center', color: 'white',
        maxCharacters: 25,
      },
      {
        type: 'text', role: 'body',
        col: [1, 3], row: [6, 7],
        fontSize: 13, align: 'center', color: 'text',
        maxCharacters: 80,
      },
      // Arrow 1→2
      {
        type: 'shape', role: 'accent',
        col: [3, 4], row: [4, 4],
        fontSize: 0, background: 'accent',
        shapeVariant: 'line-h',
      },
      // Step 2
      {
        type: 'shape', role: 'accent',
        col: [4, 6], row: [3, 5],
        fontSize: 0, background: 'gradient',
        borderRadius: 12, shadow: 'md', shapeVariant: 'rounded-lg',
      },
      {
        type: 'text', role: 'label',
        col: [4, 6], row: [3, 4],
        fontSize: 18, fontWeight: 'bold', align: 'center', color: 'white',
        maxCharacters: 25,
      },
      {
        type: 'text', role: 'body',
        col: [4, 6], row: [6, 7],
        fontSize: 13, align: 'center', color: 'text',
        maxCharacters: 80,
      },
      // Arrow 2→3
      {
        type: 'shape', role: 'accent',
        col: [6, 7], row: [4, 4],
        fontSize: 0, background: 'accent',
        shapeVariant: 'line-h',
      },
      // Step 3
      {
        type: 'shape', role: 'accent',
        col: [7, 9], row: [3, 5],
        fontSize: 0, background: 'gradient',
        borderRadius: 12, shadow: 'md', shapeVariant: 'rounded-lg',
      },
      {
        type: 'text', role: 'label',
        col: [7, 9], row: [3, 4],
        fontSize: 18, fontWeight: 'bold', align: 'center', color: 'white',
        maxCharacters: 25,
      },
      {
        type: 'text', role: 'body',
        col: [7, 9], row: [6, 7],
        fontSize: 13, align: 'center', color: 'text',
        maxCharacters: 80,
      },
      // Arrow 3→4
      {
        type: 'shape', role: 'accent',
        col: [9, 10], row: [4, 4],
        fontSize: 0, background: 'accent',
        shapeVariant: 'line-h',
      },
      // Step 4
      {
        type: 'shape', role: 'accent',
        col: [10, 12], row: [3, 5],
        fontSize: 0, background: 'gradient',
        borderRadius: 12, shadow: 'md', shapeVariant: 'rounded-lg',
      },
      {
        type: 'text', role: 'label',
        col: [10, 12], row: [3, 4],
        fontSize: 18, fontWeight: 'bold', align: 'center', color: 'white',
        maxCharacters: 25,
      },
      {
        type: 'text', role: 'body',
        col: [10, 12], row: [6, 7],
        fontSize: 13, align: 'center', color: 'text',
        maxCharacters: 80,
      },
    ],
  },

  pyramid: {
    name: 'pyramid',
    description: 'Pyramid hierarchy with 3 levels — for hierarchy, importance levels, structure',
    suitableFor: ['hierarchy', 'levels', 'structure', 'importance', 'organization', 'tiers'],
    background: 'white',
    elements: [
      {
        type: 'text', role: 'title',
        col: [1, 12], row: [1, 1],
        fontSize: 36, fontWeight: 'bold', align: 'center', color: 'primary',
        maxCharacters: 60,
      },
      // Top level (narrow)
      {
        type: 'shape', role: 'accent',
        col: [5, 8], row: [2, 3],
        fontSize: 0, background: 'gradient',
        borderRadius: 8, shadow: 'md', shapeVariant: 'rounded-lg',
      },
      {
        type: 'text', role: 'label',
        col: [5, 8], row: [2, 3],
        fontSize: 18, fontWeight: 'bold', align: 'center', color: 'white',
        maxCharacters: 30,
      },
      // Middle level (medium)
      {
        type: 'shape', role: 'accent',
        col: [3, 10], row: [4, 5],
        fontSize: 0, background: 'gradient-accent',
        borderRadius: 8, shadow: 'md', shapeVariant: 'rounded-lg',
      },
      {
        type: 'text', role: 'label',
        col: [3, 10], row: [4, 5],
        fontSize: 18, fontWeight: 'bold', align: 'center', color: 'white',
        maxCharacters: 50,
      },
      // Bottom level (wide)
      {
        type: 'shape', role: 'accent',
        col: [1, 12], row: [6, 7],
        fontSize: 0, background: 'primary',
        borderRadius: 8, shadow: 'md', shapeVariant: 'rounded-lg',
      },
      {
        type: 'text', role: 'label',
        col: [1, 12], row: [6, 7],
        fontSize: 18, fontWeight: 'bold', align: 'center', color: 'white',
        maxCharacters: 70,
      },
    ],
  },

  'icon-grid': {
    name: 'icon-grid',
    description: '2x2 grid with labeled feature boxes — for features, capabilities, services overview',
    suitableFor: ['features', 'capabilities', 'services', 'overview', 'quadrant', 'categories'],
    background: 'light',
    elements: [
      {
        type: 'text', role: 'title',
        col: [1, 12], row: [1, 1],
        fontSize: 36, fontWeight: 'bold', align: 'center', color: 'primary',
        maxCharacters: 60,
      },
      // Box 1 (top-left)
      {
        type: 'shape', role: 'accent',
        col: [1, 6], row: [2, 4],
        fontSize: 0, background: 'white',
        borderRadius: 16, shadow: 'md', shapeVariant: 'rounded-lg',
      },
      {
        type: 'text', role: 'label',
        col: [1, 6], row: [2, 2],
        fontSize: 20, fontWeight: 'bold', align: 'center', color: 'primary',
        maxCharacters: 30,
      },
      {
        type: 'text', role: 'body',
        col: [1, 6], row: [3, 4],
        fontSize: 14, align: 'center', color: 'text',
        maxCharacters: 120,
      },
      // Box 2 (top-right)
      {
        type: 'shape', role: 'accent',
        col: [7, 12], row: [2, 4],
        fontSize: 0, background: 'white',
        borderRadius: 16, shadow: 'md', shapeVariant: 'rounded-lg',
      },
      {
        type: 'text', role: 'label',
        col: [7, 12], row: [2, 2],
        fontSize: 20, fontWeight: 'bold', align: 'center', color: 'primary',
        maxCharacters: 30,
      },
      {
        type: 'text', role: 'body',
        col: [7, 12], row: [3, 4],
        fontSize: 14, align: 'center', color: 'text',
        maxCharacters: 120,
      },
      // Box 3 (bottom-left)
      {
        type: 'shape', role: 'accent',
        col: [1, 6], row: [5, 7],
        fontSize: 0, background: 'white',
        borderRadius: 16, shadow: 'md', shapeVariant: 'rounded-lg',
      },
      {
        type: 'text', role: 'label',
        col: [1, 6], row: [5, 5],
        fontSize: 20, fontWeight: 'bold', align: 'center', color: 'primary',
        maxCharacters: 30,
      },
      {
        type: 'text', role: 'body',
        col: [1, 6], row: [6, 7],
        fontSize: 14, align: 'center', color: 'text',
        maxCharacters: 120,
      },
      // Box 4 (bottom-right)
      {
        type: 'shape', role: 'accent',
        col: [7, 12], row: [5, 7],
        fontSize: 0, background: 'white',
        borderRadius: 16, shadow: 'md', shapeVariant: 'rounded-lg',
      },
      {
        type: 'text', role: 'label',
        col: [7, 12], row: [5, 5],
        fontSize: 20, fontWeight: 'bold', align: 'center', color: 'primary',
        maxCharacters: 30,
      },
      {
        type: 'text', role: 'body',
        col: [7, 12], row: [6, 7],
        fontSize: 14, align: 'center', color: 'text',
        maxCharacters: 120,
      },
    ],
  },

  'custom': {
    name: 'custom',
    description: 'AI-designed custom layout — elements are provided dynamically',
    suitableFor: ['any', 'creative', 'unique'],
    elements: [],
  },
};

/**
 * Get all pattern names with descriptions for AI prompt.
 */
export function getPatternsForPrompt(): string {
  return Object.values(PATTERNS)
    .filter(p => p.name !== 'custom')
    .map((p, i) => `${i + 1}. "${p.name}" — ${p.description}. Best for: ${p.suitableFor.join(', ')}`)
    .join('\n');
}

/**
 * Get a pattern by name.
 */
export function getPattern(name: PatternName): SlidePattern {
  return PATTERNS[name];
}
