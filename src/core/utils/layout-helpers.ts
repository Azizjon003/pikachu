/**
 * Shared layout helper functions for slide generation
 * Extracted from structured-generator.ts and enhanced-generator.ts
 */

import { AISlideElement, ContentValidationResult } from '../types/generation';

/**
 * Identify nearby elements within a distance threshold.
 * Used for spatial awareness to prevent content overlap.
 */
export function findNearbyElements(
  currentElement: AISlideElement,
  allElements: AISlideElement[],
  threshold: number = 50
): AISlideElement[] {
  return allElements.filter((el) => {
    if (el.index === currentElement.index || el.type === 'image') return false;

    const isNearby =
      Math.abs(el.left - currentElement.left) < threshold ||
      Math.abs(el.top - currentElement.top) < threshold ||
      Math.abs(el.left + el.width - (currentElement.left + currentElement.width)) < threshold ||
      Math.abs(el.top + el.height - (currentElement.top + currentElement.height)) < threshold;

    return isNearby;
  });
}

/**
 * Create ASCII visual representation of slide layout.
 * Helps AI understand element positioning better.
 */
export function createLayoutVisualization(elements: AISlideElement[]): string {
  if (elements.length === 0) return 'No elements';

  const maxLeft = Math.max(...elements.map((e) => e.left + e.width));
  const maxTop = Math.max(...elements.map((e) => e.top + e.height));

  const gridWidth = Math.min(80, Math.ceil(maxLeft / 50));
  const gridHeight = Math.min(20, Math.ceil(maxTop / 50));

  const grid: string[][] = Array(gridHeight)
    .fill(null)
    .map(() => Array(gridWidth).fill(' '));

  elements.forEach((el) => {
    const startCol = Math.min(Math.floor((el.left / maxLeft) * gridWidth), gridWidth - 1);
    const startRow = Math.min(Math.floor((el.top / maxTop) * gridHeight), gridHeight - 1);
    const endCol = Math.min(Math.ceil(((el.left + el.width) / maxLeft) * gridWidth), gridWidth - 1);
    const endRow = Math.min(Math.ceil(((el.top + el.height) / maxTop) * gridHeight), gridHeight - 1);

    const elementChar = String(el.index);
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (row >= 0 && col >= 0) {
          grid[row][col] = elementChar;
        }
      }
    }
  });

  let visualization = 'SLIDE LAYOUT VISUALIZATION:\n';
  visualization += '┌' + '─'.repeat(gridWidth) + '┐\n';
  grid.forEach((row) => {
    visualization += '│' + row.join('') + '│\n';
  });
  visualization += '└' + '─'.repeat(gridWidth) + '┘\n';

  return visualization;
}

/**
 * Get detailed position description for an element.
 */
export function getPositionDescription(element: AISlideElement, _allElements: AISlideElement[]): string {
  const positions: string[] = [];

  if (element.top < 100) positions.push('TOP of slide');
  else if (element.top > 400) positions.push('BOTTOM of slide');
  else positions.push('MIDDLE of slide');

  if (element.left < 100) positions.push('LEFT side');
  else if (element.left > 500) positions.push('RIGHT side');
  else positions.push('CENTER horizontally');

  if (element.width > 600 && element.height > 400) positions.push('LARGE FULL-WIDTH');
  else if (element.width > 300 && element.height > 200) positions.push('MEDIUM sized');
  else if (element.width > 150 || element.height > 100) positions.push('SMALL-MEDIUM');
  else positions.push('SMALL/LABEL');

  return positions.join(', ');
}

/**
 * Apply reduced font size to HTML content.
 * Replaces the font-size value while preserving other styles.
 */
export function applyFontSize(htmlContent: string, newFontSize: number): string {
  return htmlContent.replace(
    /font-size:\s*\d+(?:\.\d+)?\s*px/gi,
    `font-size: ${newFontSize.toFixed(1)}px`
  );
}

/**
 * Validate generated content with font size reduction instead of truncation.
 * Returns validation result with adjusted fontSize if content exceeds maxCharacters.
 */
export function validateContent(
  element: AISlideElement,
  generatedContent: string,
  originalFontSize: number,
  maxCharacters: number,
  minFontSize: number = 8
): ContentValidationResult {
  const warnings: string[] = [];
  const content = generatedContent;
  let adjustedFontSize: number | undefined;

  // Check for missing spaces (words merged together)
  if (/[a-z][A-Z]/.test(content)) {
    warnings.push('Content may have missing spaces between words');
  }

  // Calculate font size reduction if content exceeds limit
  if (content.length > maxCharacters) {
    let newFontSize = originalFontSize * (maxCharacters / content.length);
    newFontSize = Math.max(newFontSize, minFontSize);
    adjustedFontSize = newFontSize;

    warnings.push(
      `Font size reduced from ${originalFontSize}px to ${newFontSize.toFixed(1)}px due to content length (${content.length} chars, max: ${maxCharacters})`
    );
  }

  // Flexible content length validation based on element size
  let minExpectedRatio: number;
  if (maxCharacters > 200) minExpectedRatio = 0.4;
  else if (maxCharacters >= 50) minExpectedRatio = 0.3;
  else minExpectedRatio = 0.2;

  const minExpectedChars = maxCharacters * minExpectedRatio;
  if (element.width > 300 && element.height > 100 && content.length < minExpectedChars) {
    warnings.push(
      `Content may be too short for element size (${content.length} chars, expected ~${Math.floor(minExpectedChars)})`
    );
  }

  return {
    isValid: warnings.length === 0,
    content,
    fontSize: adjustedFontSize,
    warnings,
  };
}

/**
 * Group elements by similar maxCharacters for diversity awareness.
 */
export function groupBySimilarSize(
  elements: AISlideElement[],
  threshold: number = 50
): Map<number, AISlideElement[]> {
  const groups = new Map<number, AISlideElement[]>();

  elements.forEach((el) => {
    let foundGroup = false;

    for (const [key, group] of groups.entries()) {
      if (Math.abs(key - el.maxCharacters) < threshold) {
        group.push(el);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      groups.set(el.maxCharacters, [el]);
    }
  });

  return groups;
}
