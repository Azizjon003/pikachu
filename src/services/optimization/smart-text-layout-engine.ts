/**
 * Smart Text Layout Engine
 *
 * Advanced text placement system with:
 * - Intelligent space allocation algorithms
 * - Multi-column layout support
 * - Automatic font scaling with readability constraints
 * - Collision detection and avoidance
 * - Visual hierarchy preservation
 *
 * Much faster and more accurate than AI-based layout
 */

import type { TextElement } from '../layout/text-overlap-detector';

interface LayoutConstraints {
  slideWidth: number;
  slideHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  minFontSize: number;
  maxFontSize: number;
  minLineHeight: number;
  elementSpacing: number;
}

interface LayoutZone {
  x: number;
  y: number;
  width: number;
  height: number;
  priority: number;
  occupied: boolean;
}

interface TextMetrics {
  estimatedLines: number;
  estimatedHeight: number;
  charsPerLine: number;
  requiresWrapping: boolean;
}

export class SmartTextLayoutEngine {
  private constraints: LayoutConstraints;
  private zones: LayoutZone[] = [];
  private placedElements: TextElement[] = [];

  constructor(slideWidth: number = 1920, slideHeight: number = 1080) {
    this.constraints = {
      slideWidth,
      slideHeight,
      marginTop: 80,
      marginBottom: 80,
      marginLeft: 100,
      marginRight: 100,
      minFontSize: 12,
      maxFontSize: 72,
      minLineHeight: 1.2,
      elementSpacing: 20
    };

    this.initializeZones();
  }

  /**
   * Initialize layout zones (grid-based space allocation)
   */
  private initializeZones(): void {
    const contentWidth = this.constraints.slideWidth -
      this.constraints.marginLeft - this.constraints.marginRight;
    const contentHeight = this.constraints.slideHeight -
      this.constraints.marginTop - this.constraints.marginBottom;

    // Create a flexible grid of zones
    const rows = 6;
    const cols = 3;
    const zoneWidth = contentWidth / cols;
    const zoneHeight = contentHeight / rows;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        this.zones.push({
          x: this.constraints.marginLeft + col * zoneWidth,
          y: this.constraints.marginTop + row * zoneHeight,
          width: zoneWidth,
          height: zoneHeight,
          priority: row * cols + col,
          occupied: false
        });
      }
    }
  }

  /**
   * Calculate optimal text metrics for given content
   */
  private calculateTextMetrics(
    text: string,
    fontSize: number,
    maxWidth: number
  ): TextMetrics {
    // Character width estimation (rough but fast)
    const avgCharWidth = fontSize * 0.6; // Typical sans-serif ratio
    const charsPerLine = Math.floor(maxWidth / avgCharWidth);
    const estimatedLines = Math.ceil(text.length / charsPerLine);
    const lineHeight = fontSize * this.constraints.minLineHeight;
    const estimatedHeight = estimatedLines * lineHeight;

    return {
      estimatedLines,
      estimatedHeight,
      charsPerLine,
      requiresWrapping: text.length > charsPerLine
    };
  }

  /**
   * Find optimal font size for text to fit in given dimensions
   */
  private findOptimalFontSize(
    text: string,
    maxWidth: number,
    maxHeight: number,
    preferredSize: number
  ): number {
    let fontSize = Math.min(preferredSize, this.constraints.maxFontSize);

    // Binary search for optimal font size
    let low = this.constraints.minFontSize;
    let high = fontSize;
    let optimal = low;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const metrics = this.calculateTextMetrics(text, mid, maxWidth);

      if (metrics.estimatedHeight <= maxHeight) {
        optimal = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return optimal;
  }

  /**
   * Check if element overlaps with already placed elements
   */
  private checkCollision(element: TextElement): boolean {
    const box1 = {
      left: element.left,
      top: element.top,
      right: element.left + element.width,
      bottom: element.top + element.height
    };

    for (const placed of this.placedElements) {
      const box2 = {
        left: placed.left,
        top: placed.top,
        right: placed.left + placed.width,
        bottom: placed.top + placed.height
      };

      // Check overlap with spacing buffer
      const buffer = this.constraints.elementSpacing;
      if (
        box1.left - buffer < box2.right &&
        box1.right + buffer > box2.left &&
        box1.top - buffer < box2.bottom &&
        box1.bottom + buffer > box2.top
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find best zone for element
   */
  private findBestZone(requiredWidth: number, requiredHeight: number): LayoutZone | null {
    // Try to find an unoccupied zone that fits
    for (const zone of this.zones) {
      if (!zone.occupied && zone.width >= requiredWidth && zone.height >= requiredHeight) {
        return zone;
      }
    }

    // Try to find any zone that fits (will be split)
    for (const zone of this.zones) {
      if (zone.width >= requiredWidth && zone.height >= requiredHeight) {
        return zone;
      }
    }

    return null;
  }

  /**
   * Smart layout optimization for elements
   */
  optimizeLayout(elements: TextElement[]): {
    optimizedElements: TextElement[];
    improvements: number;
    processingTime: number;
  } {
    const startTime = performance.now();
    console.log('\n🎯 Smart Text Layout Engine: FAST path optimization');

    this.placedElements = [];
    const optimized: TextElement[] = [];
    let improvements = 0;

    // Sort by priority (titles first, then by vertical position)
    const sorted = [...elements].sort((a, b) => {
      const aIsTitle = a.content?.toLowerCase().includes('title') || (a.fontSize || 0) > 36;
      const bIsTitle = b.content?.toLowerCase().includes('title') || (b.fontSize || 0) > 36;

      if (aIsTitle && !bIsTitle) return -1;
      if (!aIsTitle && bIsTitle) return 1;

      return a.top - b.top;
    });

    for (const element of sorted) {
      let optimizedElement = { ...element };
      let needsOptimization = false;

      // Check if element is within bounds
      const rightEdge = element.left + element.width;
      const bottomEdge = element.top + element.height;

      if (
        element.left < this.constraints.marginLeft ||
        element.top < this.constraints.marginTop ||
        rightEdge > this.constraints.slideWidth - this.constraints.marginRight ||
        bottomEdge > this.constraints.slideHeight - this.constraints.marginBottom
      ) {
        needsOptimization = true;
      }

      // Check collision
      if (this.checkCollision(element)) {
        needsOptimization = true;
      }

      if (needsOptimization) {
        // Find best zone
        const zone = this.findBestZone(element.width, element.height);

        if (zone) {
          // Calculate optimal font size for the zone
          const text = element.content || '';
          const optimalFontSize = this.findOptimalFontSize(
            text,
            zone.width - this.constraints.elementSpacing * 2,
            zone.height - this.constraints.elementSpacing * 2,
            element.fontSize
          );

          // Update metrics
          const metrics = this.calculateTextMetrics(
            text,
            optimalFontSize,
            zone.width - this.constraints.elementSpacing * 2
          );

          // Position in zone
          optimizedElement = {
            ...element,
            left: zone.x + this.constraints.elementSpacing,
            top: zone.y + this.constraints.elementSpacing,
            width: zone.width - this.constraints.elementSpacing * 2,
            height: Math.min(
              metrics.estimatedHeight,
              zone.height - this.constraints.elementSpacing * 2
            ),
            fontSize: optimalFontSize
          } as TextElement;

          zone.occupied = true;
          improvements++;

          console.log(`   ✓ Optimized element: ${text.substring(0, 30)}...`);
          console.log(`     Font: ${element.fontSize}px → ${optimalFontSize}px`);
          console.log(`     Position: (${element.left},${element.top}) → (${optimizedElement.left},${optimizedElement.top})`);
        }
      }

      this.placedElements.push(optimizedElement);
      optimized.push(optimizedElement);
    }

    const processingTime = performance.now() - startTime;

    console.log(`\n✅ Layout optimization complete in ${processingTime.toFixed(0)}ms`);
    console.log(`   Elements processed: ${elements.length}`);
    console.log(`   Improvements made: ${improvements}`);
    console.log(`   Speed: ${(elements.length / (processingTime / 1000)).toFixed(1)} elements/sec\n`);

    return {
      optimizedElements: optimized,
      improvements,
      processingTime
    };
  }

  /**
   * Quick validation (no optimization, just checking)
   */
  validateLayout(elements: TextElement[]): {
    hasIssues: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];

      // Boundary check
      if (
        element.left < this.constraints.marginLeft ||
        element.top < this.constraints.marginTop ||
        element.left + element.width > this.constraints.slideWidth - this.constraints.marginRight ||
        element.top + element.height > this.constraints.slideHeight - this.constraints.marginBottom
      ) {
        issues.push(`Element ${i} exceeds slide boundaries`);
      }

      // Overlap check
      for (let j = i + 1; j < elements.length; j++) {
        const other = elements[j];
        if (
          element.left < other.left + other.width &&
          element.left + element.width > other.left &&
          element.top < other.top + other.height &&
          element.top + element.height > other.top
        ) {
          issues.push(`Elements ${i} and ${j} overlap`);
        }
      }

      // Font size check
      if (element.fontSize && element.fontSize < this.constraints.minFontSize) {
        issues.push(`Element ${i} font size too small`);
      }
    }

    return {
      hasIssues: issues.length > 0,
      issues
    };
  }

  /**
   * Update constraints
   */
  setConstraints(constraints: Partial<LayoutConstraints>): void {
    this.constraints = { ...this.constraints, ...constraints };
    this.initializeZones(); // Reinitialize zones
  }

  /**
   * Get current constraints
   */
  getConstraints(): LayoutConstraints {
    return { ...this.constraints };
  }
}
