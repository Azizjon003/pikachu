/**
 * Grid Validator for Custom Layouts
 *
 * Validates AI-generated custom layouts to ensure they stay within
 * the 12-column, 8-row grid and don't have critical issues.
 *
 * Features:
 * - Clamp values to valid grid ranges
 * - Detect and fix overlapping text/image elements
 * - Fix z-order (shapes before text for card effects)
 * - Ensure minimum element sizes
 * - Validate enum values (color, background, shapeVariant, etc.)
 */

import type { CustomLayoutElement } from '../types/generation';
import { GRID } from './design-system';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fixed: CustomLayoutElement[];
}

const VALID_TYPES = ['text', 'image', 'shape', 'table'] as const;
const VALID_ROLES = ['title', 'subtitle', 'body', 'label', 'image', 'accent', 'stat-number', 'stat-label'] as const;
const VALID_COLORS = ['primary', 'text', 'muted', 'white', 'accent'] as const;
const VALID_BACKGROUNDS = ['primary', 'accent', 'light', 'white', 'none', 'gradient', 'gradient-accent', 'glass'] as const;
const VALID_SHAPE_VARIANTS = ['rect', 'circle', 'rounded-lg', 'line-h', 'line-v', 'blob'] as const;
const VALID_SHADOWS = ['sm', 'md', 'lg'] as const;
const VALID_ALIGNS = ['left', 'center', 'right'] as const;
const VALID_FONT_WEIGHTS = ['normal', 'bold'] as const;

// Minimum grid spans for different element types
const MIN_SPANS: Record<string, { cols: number; rows: number }> = {
  text: { cols: 2, rows: 1 },
  image: { cols: 2, rows: 2 },
  shape: { cols: 1, rows: 1 },
};

/**
 * Validate and fix custom layout elements.
 * Clamps values, fixes z-order, detects overlaps, and validates enums.
 */
export function validateCustomLayout(elements: CustomLayoutElement[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let fixed: CustomLayoutElement[] = [];

  if (!elements || elements.length === 0) {
    return { valid: false, errors: ['No elements provided'], warnings: [], fixed: [] };
  }

  if (elements.length > 15) {
    warnings.push(`Too many elements (${elements.length}), truncating to 15`);
    elements = elements.slice(0, 15);
  }

  let hasTitle = false;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const fixedEl = { ...el };

    // === Validate type ===
    if (!VALID_TYPES.includes(fixedEl.type as any)) {
      fixedEl.type = 'text';
      errors.push(`Element ${i}: invalid type "${el.type}", defaulting to "text"`);
    }

    // === Validate role ===
    if (!VALID_ROLES.includes(fixedEl.role as any)) {
      fixedEl.role = fixedEl.type === 'image' ? 'image' : fixedEl.type === 'shape' ? 'accent' : 'body';
      warnings.push(`Element ${i}: invalid role "${el.role}", defaulting to "${fixedEl.role}"`);
    }

    // === Clamp col to [1, 12] ===
    fixedEl.col = [
      Math.max(1, Math.min(GRID.columns, fixedEl.col[0])),
      Math.max(1, Math.min(GRID.columns, fixedEl.col[1])),
    ];
    if (fixedEl.col[0] > fixedEl.col[1]) {
      [fixedEl.col[0], fixedEl.col[1]] = [fixedEl.col[1], fixedEl.col[0]];
      errors.push(`Element ${i}: col start > end, swapped`);
    }

    // === Clamp row to [1, 8] ===
    fixedEl.row = [
      Math.max(1, Math.min(GRID.rows, fixedEl.row[0])),
      Math.max(1, Math.min(GRID.rows, fixedEl.row[1])),
    ];
    if (fixedEl.row[0] > fixedEl.row[1]) {
      [fixedEl.row[0], fixedEl.row[1]] = [fixedEl.row[1], fixedEl.row[0]];
      errors.push(`Element ${i}: row start > end, swapped`);
    }

    // === Enforce minimum span ===
    const minSpan = MIN_SPANS[fixedEl.type] || MIN_SPANS.shape;
    const colSpan = fixedEl.col[1] - fixedEl.col[0] + 1;
    const rowSpan = fixedEl.row[1] - fixedEl.row[0] + 1;

    if (colSpan < minSpan.cols) {
      fixedEl.col[1] = Math.min(GRID.columns, fixedEl.col[0] + minSpan.cols - 1);
      warnings.push(`Element ${i}: col span too small (${colSpan}), expanded to ${minSpan.cols}`);
    }
    if (rowSpan < minSpan.rows) {
      fixedEl.row[1] = Math.min(GRID.rows, fixedEl.row[0] + minSpan.rows - 1);
      warnings.push(`Element ${i}: row span too small (${rowSpan}), expanded to ${minSpan.rows}`);
    }

    // === Validate enum fields ===
    if (fixedEl.color && !VALID_COLORS.includes(fixedEl.color as any)) {
      warnings.push(`Element ${i}: invalid color "${fixedEl.color}", removing`);
      delete fixedEl.color;
    }
    if (fixedEl.background && !VALID_BACKGROUNDS.includes(fixedEl.background as any)) {
      warnings.push(`Element ${i}: invalid background "${fixedEl.background}", removing`);
      delete fixedEl.background;
    }
    if (fixedEl.shapeVariant && !VALID_SHAPE_VARIANTS.includes(fixedEl.shapeVariant as any)) {
      warnings.push(`Element ${i}: invalid shapeVariant "${fixedEl.shapeVariant}", defaulting to "rect"`);
      fixedEl.shapeVariant = 'rect';
    }
    if (fixedEl.shadow && !VALID_SHADOWS.includes(fixedEl.shadow as any)) {
      delete fixedEl.shadow;
    }
    if (fixedEl.align && !VALID_ALIGNS.includes(fixedEl.align as any)) {
      fixedEl.align = 'left';
    }
    if (fixedEl.fontWeight && !VALID_FONT_WEIGHTS.includes(fixedEl.fontWeight as any)) {
      fixedEl.fontWeight = 'normal';
    }

    // === Validate fontSize ===
    if (fixedEl.type === 'text') {
      if (!fixedEl.fontSize || fixedEl.fontSize < 10) fixedEl.fontSize = 16;
      if (fixedEl.fontSize > 72) fixedEl.fontSize = 72;
    }

    // === Validate opacity ===
    if (fixedEl.opacity !== undefined) {
      fixedEl.opacity = Math.max(0, Math.min(1, fixedEl.opacity));
    }

    // === Validate borderRadius ===
    if (fixedEl.borderRadius !== undefined) {
      fixedEl.borderRadius = Math.max(0, Math.min(40, fixedEl.borderRadius));
    }

    // === Validate maxCharacters ===
    if (fixedEl.maxCharacters !== undefined) {
      fixedEl.maxCharacters = Math.max(5, Math.min(500, fixedEl.maxCharacters));
    }

    // Track title presence
    if (fixedEl.role === 'title') hasTitle = true;

    fixed.push(fixedEl);
  }

  // === Ensure at least one title element ===
  if (!hasTitle && fixed.length > 0) {
    const firstText = fixed.find(el => el.type === 'text');
    if (firstText) {
      firstText.role = 'title';
      warnings.push('No title element found, promoted first text element');
    }
  }

  // === Fix z-order: shapes should come before text/image for card effects ===
  fixed = fixZOrder(fixed, warnings);

  // === Detect and resolve overlapping content elements ===
  fixed = resolveOverlaps(fixed, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fixed,
  };
}

/**
 * Fix z-order: shapes with backgrounds should come before text elements
 * that overlap them (to create card-behind-text effect).
 */
function fixZOrder(elements: CustomLayoutElement[], warnings: string[]): CustomLayoutElement[] {
  const shapes: Array<{ el: CustomLayoutElement; origIdx: number }> = [];
  const nonShapes: Array<{ el: CustomLayoutElement; origIdx: number }> = [];

  elements.forEach((el, idx) => {
    if (el.type === 'shape' && el.role === 'accent') {
      shapes.push({ el, origIdx: idx });
    } else {
      nonShapes.push({ el, origIdx: idx });
    }
  });

  // Check if any shape overlaps with a text element that comes before it
  let reordered = false;
  for (const shape of shapes) {
    for (const nonShape of nonShapes) {
      if (shape.origIdx > nonShape.origIdx && elementsOverlap(shape.el, nonShape.el)) {
        reordered = true;
        break;
      }
    }
    if (reordered) break;
  }

  if (reordered) {
    warnings.push('Reordered elements: shapes moved before overlapping text for card effect');
    // Stable sort: shapes (accent) first, then everything else in original order
    return [
      ...shapes.map(s => s.el),
      ...nonShapes.map(s => s.el),
    ];
  }

  return elements;
}

/**
 * Detect overlapping text/image elements and nudge them apart.
 * Shape overlaps with text are intentional (card effect) and ignored.
 */
function resolveOverlaps(elements: CustomLayoutElement[], warnings: string[]): CustomLayoutElement[] {
  const contentElements = elements
    .map((el, idx) => ({ el, idx }))
    .filter(({ el }) => el.type === 'text' || el.type === 'image');

  let fixCount = 0;

  for (let i = 0; i < contentElements.length; i++) {
    for (let j = i + 1; j < contentElements.length; j++) {
      const a = contentElements[i].el;
      const b = contentElements[j].el;

      if (elementsOverlap(a, b)) {
        const overlapCols = Math.min(a.col[1], b.col[1]) - Math.max(a.col[0], b.col[0]) + 1;
        const overlapRows = Math.min(a.row[1], b.row[1]) - Math.max(a.row[0], b.row[0]) + 1;

        // Try to fix by shifting the second element
        if (overlapCols <= overlapRows) {
          // Shift horizontally
          const shift = overlapCols;
          b.col = [
            Math.min(GRID.columns, b.col[0] + shift),
            Math.min(GRID.columns, b.col[1] + shift),
          ];
        } else {
          // Shift vertically
          const shift = overlapRows;
          b.row = [
            Math.min(GRID.rows, b.row[0] + shift),
            Math.min(GRID.rows, b.row[1] + shift),
          ];
        }
        fixCount++;
      }
    }
  }

  if (fixCount > 0) {
    warnings.push(`Fixed ${fixCount} overlapping content element(s)`);
  }

  return elements;
}

/**
 * Check if two elements overlap in the grid.
 */
function elementsOverlap(a: CustomLayoutElement, b: CustomLayoutElement): boolean {
  const colOverlap = a.col[0] <= b.col[1] && b.col[0] <= a.col[1];
  const rowOverlap = a.row[0] <= b.row[1] && b.row[0] <= a.row[1];
  return colOverlap && rowOverlap;
}
