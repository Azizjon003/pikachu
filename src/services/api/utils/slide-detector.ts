/**
 * Slide Element Detection Utility
 *
 * Intelligently detects and locates specific elements in PowerPoint slides
 * based on content patterns, positioning, and formatting characteristics.
 * Works across different template structures without hardcoded indices.
 */

interface SlideElement {
  type: string;
  width: number;
  height: number;
  left: number;
  top: number;
  content: string;
  fontSize: number;
  maxCharacters: number;
  elementIndex: number;
}

interface Slide {
  elements?: SlideElement[];
  [key: string]: any;
}

/**
 * Filters elements to only include text-containing shapes
 */
function getTextShapes(slide: Slide): SlideElement[] {
  if (!slide?.elements || !Array.isArray(slide.elements)) {
    return [];
  }

  return slide.elements.filter(
    (el) =>
      el.type === 'shape' &&
      el.content &&
      typeof el.content === 'string' &&
      el.content.trim().length > 0 &&
      typeof el.fontSize === 'number'
  );
}

/**
 * Find the main title/topic element on a slide
 *
 * Strategy:
 * - Looks for the largest fontSize (typically 28-44)
 * - Must have substantial content (>= 5 characters)
 * - Prioritizes elements with larger dimensions
 *
 * @param slide - The slide object to search
 * @returns The title element or null if not found
 */
export function findTitleElement(slide: Slide): SlideElement | null {
  const textShapes = getTextShapes(slide);

  if (textShapes.length === 0) {
    return null;
  }

  // Filter out very short texts and sort by fontSize (descending)
  const candidates = textShapes
    .filter((el) => el.content.trim().length >= 5)
    .sort((a, b) => {
      // Primary: fontSize (larger first)
      if (b.fontSize !== a.fontSize) {
        return b.fontSize - a.fontSize;
      }
      // Secondary: content length (longer first)
      return b.content.length - a.content.length;
    });

  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * Find the author element on a slide
 *
 * Strategy:
 * - Looks for medium-large fontSize (22-32)
 * - Excludes the title element
 * - Prefers elements positioned lower on the slide (higher 'top' value)
 * - Should be relatively short text (author name)
 * - Typically positioned below or near the title
 *
 * @param slide - The slide object to search
 * @returns The author element or null if not found
 */
export function findAuthorElement(slide: Slide): SlideElement | null {
  const textShapes = getTextShapes(slide);

  if (textShapes.length === 0) {
    return null;
  }

  const titleElement = findTitleElement(slide);
  const titleIndex = titleElement?.elementIndex;
  const titleTop = titleElement?.top || 0;
  const titleFontSize = titleElement?.fontSize || 0;

  // Filter candidates: medium-large font size, not too long, exclude title
  const candidates = textShapes
    .filter((el) => {
      if (el.elementIndex === titleIndex) return false;

      // Author should have font size between 22-32 (larger than before)
      if (el.fontSize < 22 || el.fontSize > 32) return false;

      // Author name should be relatively short
      if (el.content.trim().length > 50) return false;

      // Author should typically be positioned below the title
      if (titleElement && el.top <= titleTop) return false;

      // Should be slightly smaller than title font
      if (el.fontSize >= titleFontSize) return false;

      return true;
    })
    .sort((a, b) => {
      // Primary: prefer closer to title (smaller distance)
      const distA = Math.abs(a.top - titleTop);
      const distB = Math.abs(b.top - titleTop);
      if (distA !== distB) {
        return distA - distB;
      }
      // Secondary: prefer larger font size
      return b.fontSize - a.fontSize;
    });

  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * Find the outline header element (e.g., "Reja:", "Plan:")
 *
 * Strategy:
 * - Very short text (< 15 characters)
 * - Large fontSize (> 35)
 * - Often contains keywords: "reja", "plan", "outline" (case insensitive)
 *
 * @param slide - The slide object to search
 * @returns The outline header element or null if not found
 */
export function findOutlineHeaderElement(slide: Slide): SlideElement | null {
  const textShapes = getTextShapes(slide);

  if (textShapes.length === 0) {
    return null;
  }

  const headerKeywords = ['reja', 'plan', 'outline', 'режа', 'план'];

  // First, try to find by keywords
  const keywordMatches = textShapes.filter((el) => {
    const content = el.content.toLowerCase().trim();
    return (
      content.length < 15 &&
      el.fontSize > 35 &&
      headerKeywords.some((keyword) => content.includes(keyword))
    );
  });

  if (keywordMatches.length > 0) {
    // Return the one with largest font size
    return keywordMatches.sort((a, b) => b.fontSize - a.fontSize)[0];
  }

  // Fallback: find very short text with large font
  const candidates = textShapes
    .filter((el) => {
      const trimmed = el.content.trim();
      return (
        trimmed.length >= 3 &&
        trimmed.length <= 15 &&
        el.fontSize > 35 &&
        trimmed.endsWith(':')
      );
    })
    .sort((a, b) => b.fontSize - a.fontSize);

  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * Find outline numbered item elements
 *
 * Strategy:
 * - Finds elements that start with "1.", "2.", "3." etc.
 * - OR medium-length texts (20-120 chars) with small-to-medium fontSize (18-24)
 * - Excludes very large font sizes (> 50) that are likely decorative numbers
 * - Sorted by vertical position or number prefix
 *
 * @param slide - The slide object to search
 * @param count - Number of outline items to find (default: 3)
 * @returns Array of outline item elements (up to count)
 */
export function findOutlineItemElements(
  slide: Slide,
  count: number = 3
): SlideElement[] {
  const textShapes = getTextShapes(slide);

  if (textShapes.length === 0) {
    return [];
  }

  // Pattern for numbered items: "1.", "2.", "3.", etc.
  const numberedPattern = /^(\d+)[.)]\s+/;

  // First pass: find explicitly numbered items with content after the number
  const numberedItems = textShapes
    .filter((el) => {
      const trimmed = el.content.trim();
      // Must start with number and have substantial content after it
      if (!numberedPattern.test(trimmed)) return false;

      // Exclude very large fonts (decorative numbers like 77px)
      if (el.fontSize > 50) return false;

      // Must have more than just the number (at least 10 chars total)
      if (trimmed.length < 10) return false;

      return true;
    })
    .sort((a, b) => {
      // Sort by the number prefix
      const numA = parseInt(a.content.match(numberedPattern)?.[1] || '0');
      const numB = parseInt(b.content.match(numberedPattern)?.[1] || '0');
      return numA - numB;
    })
    .slice(0, count);

  if (numberedItems.length >= count) {
    return numberedItems;
  }

  // Second pass: find by characteristics if we don't have enough numbered items
  const headerElement = findOutlineHeaderElement(slide);
  const headerIndex = headerElement?.elementIndex;
  const headerTop = headerElement?.top || 0;

  const candidates = textShapes
    .filter((el) => {
      // Skip the header itself
      if (el.elementIndex === headerIndex) return false;

      // Skip if already found as numbered item
      if (numberedItems.some(item => item.elementIndex === el.elementIndex)) return false;

      // Should be below the header (if header exists)
      if (headerElement && el.top <= headerTop) return false;

      // Medium length text
      const length = el.content.trim().length;
      if (length < 20 || length > 120) return false;

      // Small to medium font size (exclude very large decorative fonts)
      if (el.fontSize < 16 || el.fontSize > 28) return false;

      return true;
    })
    .sort((a, b) => a.top - b.top); // Sort by vertical position

  // Combine and deduplicate
  const allItems = [...numberedItems];
  const existingIndices = new Set(numberedItems.map((el) => el.elementIndex));

  for (const candidate of candidates) {
    if (allItems.length >= count) break;
    if (!existingIndices.has(candidate.elementIndex)) {
      allItems.push(candidate);
      existingIndices.add(candidate.elementIndex);
    }
  }

  return allItems.slice(0, count);
}

/**
 * Detects all key elements in a slide
 *
 * @param slide - The slide object to analyze
 * @returns Object containing detected elements
 */
export function detectSlideElements(slide: Slide) {
  return {
    title: findTitleElement(slide),
    author: findAuthorElement(slide),
    outlineHeader: findOutlineHeaderElement(slide),
    outlineItems: findOutlineItemElements(slide, 3),
  };
}

/**
 * Helper function to get element index safely
 *
 * @param element - The element to get index from
 * @returns Element index or null
 */
export function getElementIndex(element: SlideElement | null): number | null {
  return element?.elementIndex ?? null;
}

/**
 * Helper function to get multiple element indices
 *
 * @param elements - Array of elements
 * @returns Array of element indices
 */
export function getElementIndices(elements: SlideElement[]): number[] {
  return elements.map((el) => el.elementIndex).filter((idx) => idx !== undefined);
}
