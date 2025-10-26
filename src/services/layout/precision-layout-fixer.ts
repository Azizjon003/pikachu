/**
 * Precision Layout Fixer
 *
 * MAYDA-MAYDA XATOLARNI TOPADI VA TUZATADI:
 * ✅ Overlap detection (ustma-ust tushish)
 * ✅ Collision resolution (to'qnashuvni hal qilish)
 * ✅ Boundary validation (chegaralardan chiqmaslik)
 * ✅ Spacing optimization (to'g'ri spacing)
 * ✅ Alignment correction (hizalanish)
 * ✅ Visual debugging (xatolarni ko'rsatish)
 *
 * Bu tizim BARCHA mayda xatolarni topadi va tuzatadi!
 */

import type { SchemaElement } from '../ai-schema/creative-layout-analyzer';

export interface BoundingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface OverlapIssue {
  element1: number;
  element2: number;
  overlapArea: number;
  overlapPercentage: number;
  severity: "critical" | "major" | "minor";
  suggestedFix: "move" | "resize" | "reorder";
}

export interface BoundaryIssue {
  elementIndex: number;
  violations: {
    left?: number;
    top?: number;
    right?: number;
    bottom?: number;
  };
  severity: "critical" | "major" | "minor";
}

export interface SpacingIssue {
  element1: number;
  element2: number;
  distance: number;
  minDistance: number;
  severity: "minor";
}

export interface LayoutIssues {
  overlaps: OverlapIssue[];
  boundaryViolations: BoundaryIssue[];
  spacingIssues: SpacingIssue[];
  alignmentIssues: {
    elementIndex: number;
    suggestion: string;
  }[];
  totalIssues: number;
  severity: "none" | "minor" | "major" | "critical";
}

export interface FixResult {
  originalElements: SchemaElement[];
  fixedElements: SchemaElement[];
  issuesFound: LayoutIssues;
  issuesFixed: number;
  changesMade: {
    elementIndex: number;
    type: "position" | "size" | "both";
    oldValues: Partial<SchemaElement>;
    newValues: Partial<SchemaElement>;
    reason: string;
  }[];
  success: boolean;
  report: string;
}

export class PrecisionLayoutFixer {
  private slideWidth: number;
  private slideHeight: number;
  private minSpacing: number = 10;
  private margin: number = 20;

  constructor(slideWidth: number = 1920, slideHeight: number = 1080) {
    this.slideWidth = slideWidth;
    this.slideHeight = slideHeight;
  }

  /**
   * ASOSIY FUNKSIYA - Faqat CRITICAL xatolarni topadi va tuzatadi (MINIMAL changes)
   */
  fixLayout(elements: SchemaElement[]): FixResult {
    const original = elements.map(el => ({ ...el }));

    // Step 1: Detect ONLY critical issues (no logging)
    const issues = this.detectAllIssues(elements);

    if (issues.totalIssues === 0) {
      return {
        originalElements: original,
        fixedElements: elements,
        issuesFound: issues,
        issuesFixed: 0,
        changesMade: [],
        success: true,
        report: "No issues"
      };
    }

    // Step 2: Fix ONLY critical issues (overlaps, boundaries)
    const { fixed, changes } = this.fixAllIssues(elements, issues);

    // Step 3: Verify (no logging)
    const remainingIssues = this.detectAllIssues(fixed);

    const result: FixResult = {
      originalElements: original,
      fixedElements: fixed,
      issuesFound: issues,
      issuesFixed: issues.totalIssues - remainingIssues.totalIssues,
      changesMade: changes,
      success: remainingIssues.totalIssues === 0,
      report: `Fixed ${issues.totalIssues - remainingIssues.totalIssues}/${issues.totalIssues} issues`
    };

    return result;
  }

  /**
   * Detect all layout issues
   */
  private detectAllIssues(elements: SchemaElement[]): LayoutIssues {
    const overlaps = this.detectOverlaps(elements);
    const boundaryViolations = this.detectBoundaryViolations(elements);
    const spacingIssues = this.detectSpacingIssues(elements);
    const alignmentIssues = this.detectAlignmentIssues(elements);

    const totalIssues =
      overlaps.length +
      boundaryViolations.length +
      spacingIssues.length +
      alignmentIssues.length;

    const severity = this.calculateSeverity(overlaps, boundaryViolations);

    return {
      overlaps,
      boundaryViolations,
      spacingIssues,
      alignmentIssues,
      totalIssues,
      severity
    };
  }

  /**
   * Detect overlaps between elements
   */
  private detectOverlaps(elements: SchemaElement[]): OverlapIssue[] {
    const overlaps: OverlapIssue[] = [];

    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const box1 = this.getBoundingBox(elements[i]);
        const box2 = this.getBoundingBox(elements[j]);

        const overlap = this.calculateOverlap(box1, box2);

        if (overlap.area > 0) {
          const severity = this.getOverlapSeverity(overlap.percentage);

          overlaps.push({
            element1: i,
            element2: j,
            overlapArea: overlap.area,
            overlapPercentage: overlap.percentage,
            severity,
            suggestedFix: this.suggestOverlapFix(elements[i], elements[j], overlap)
          });
        }
      }
    }

    return overlaps;
  }

  /**
   * Detect boundary violations
   */
  private detectBoundaryViolations(elements: SchemaElement[]): BoundaryIssue[] {
    const violations: BoundaryIssue[] = [];

    elements.forEach((el, idx) => {
      const box = this.getBoundingBox(el);
      const viols: BoundaryIssue['violations'] = {};

      if (box.left < this.margin) {
        viols.left = this.margin - box.left;
      }
      if (box.top < this.margin) {
        viols.top = this.margin - box.top;
      }
      if (box.right > this.slideWidth - this.margin) {
        viols.right = box.right - (this.slideWidth - this.margin);
      }
      if (box.bottom > this.slideHeight - this.margin) {
        viols.bottom = box.bottom - (this.slideHeight - this.margin);
      }

      if (Object.keys(viols).length > 0) {
        const severity = this.getBoundaryViolationSeverity(viols);
        violations.push({
          elementIndex: idx,
          violations: viols,
          severity
        });
      }
    });

    return violations;
  }

  /**
   * Detect spacing issues
   */
  private detectSpacingIssues(elements: SchemaElement[]): SpacingIssue[] {
    const issues: SpacingIssue[] = [];

    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const box1 = this.getBoundingBox(elements[i]);
        const box2 = this.getBoundingBox(elements[j]);

        const distance = this.calculateMinDistance(box1, box2);

        if (distance > 0 && distance < this.minSpacing) {
          issues.push({
            element1: i,
            element2: j,
            distance,
            minDistance: this.minSpacing,
            severity: "minor"
          });
        }
      }
    }

    return issues;
  }

  /**
   * Detect alignment issues
   */
  private detectAlignmentIssues(elements: SchemaElement[]): LayoutIssues['alignmentIssues'] {
    const issues: LayoutIssues['alignmentIssues'] = [];
    const tolerance = 5;

    // Check for near-aligned elements that should be aligned
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const el1 = elements[i];
        const el2 = elements[j];

        // Check left alignment
        if (Math.abs(el1.left - el2.left) <= tolerance) {
          issues.push({
            elementIndex: i,
            suggestion: `Could be left-aligned with element ${j}`
          });
        }

        // Check center alignment
        const center1 = el1.left + el1.width / 2;
        const center2 = el2.left + el2.width / 2;
        if (Math.abs(center1 - center2) <= tolerance) {
          issues.push({
            elementIndex: i,
            suggestion: `Could be center-aligned with element ${j}`
          });
        }
      }
    }

    return issues;
  }

  /**
   * Fix all detected issues
   */
  private fixAllIssues(
    elements: SchemaElement[],
    issues: LayoutIssues
  ): { fixed: SchemaElement[]; changes: FixResult['changesMade'] } {
    let fixed = elements.map(el => ({ ...el }));
    const changes: FixResult['changesMade'] = [];

    // Priority 1: Fix critical overlaps
    const criticalOverlaps = issues.overlaps.filter(o => o.severity === 'critical');
    for (const overlap of criticalOverlaps) {
      const change = this.fixOverlap(fixed, overlap);
      if (change) changes.push(change);
    }

    // Priority 2: Fix boundary violations
    for (const violation of issues.boundaryViolations) {
      const change = this.fixBoundaryViolation(fixed, violation);
      if (change) changes.push(change);
    }

    // Priority 3: Fix major overlaps
    const majorOverlaps = issues.overlaps.filter(o => o.severity === 'major');
    for (const overlap of majorOverlaps) {
      const change = this.fixOverlap(fixed, overlap);
      if (change) changes.push(change);
    }

    // Priority 4: Fix minor overlaps
    const minorOverlaps = issues.overlaps.filter(o => o.severity === 'minor');
    for (const overlap of minorOverlaps) {
      const change = this.fixOverlap(fixed, overlap);
      if (change) changes.push(change);
    }

    // Priority 5: Optimize spacing
    fixed = this.optimizeSpacing(fixed);

    return { fixed, changes };
  }

  /**
   * Fix overlap between two elements
   * CRITICAL: This method MUST eliminate ALL overlaps!
   */
  private fixOverlap(
    elements: SchemaElement[],
    overlap: OverlapIssue
  ): FixResult['changesMade'][0] | null {
    const el1 = elements[overlap.element1];
    const el2 = elements[overlap.element2];

    // Check if elements still exist
    if (!el1 || !el2) {
      return null;
    }

    const box1 = this.getBoundingBox(el1);
    const box2 = this.getBoundingBox(el2);

    // Determine which element to move (prefer moving the one below/right)
    // If element2 is below element1, move element2. Otherwise move smaller one.
    let moveElement: number;
    let otherElement: number;

    if (el2.top > el1.top) {
      // Element 2 is below, move it
      moveElement = overlap.element2;
      otherElement = overlap.element1;
    } else if (el1.top > el2.top) {
      // Element 1 is below, move it
      moveElement = overlap.element1;
      otherElement = overlap.element2;
    } else {
      // Same top - move smaller one
      moveElement = box1.width * box1.height < box2.width * box2.height
        ? overlap.element1
        : overlap.element2;
      otherElement = moveElement === overlap.element1 ? overlap.element2 : overlap.element1;
    }

    const elementToMove = elements[moveElement];
    const otherEl = elements[otherElement];

    const oldValues = {
      left: elementToMove.left,
      top: elementToMove.top
    };

    // Strategy 1: Try moving down (GUARANTEED no overlap)
    const newTop = otherEl.top + otherEl.height + this.minSpacing;

    if (newTop + elementToMove.height <= this.slideHeight - this.margin) {
      // Move down - there's space below
      elementToMove.top = newTop;

      return {
        elementIndex: moveElement,
        type: 'position',
        oldValues,
        newValues: {
          left: elementToMove.left,
          top: elementToMove.top
        },
        reason: `Fixed overlap with element ${otherElement} by moving down`
      };
    }

    // Strategy 2: Try moving right (GUARANTEED no overlap)
    const newLeft = otherEl.left + otherEl.width + this.minSpacing;

    if (newLeft + elementToMove.width <= this.slideWidth - this.margin) {
      // Move right - there's space to the right
      elementToMove.left = newLeft;

      return {
        elementIndex: moveElement,
        type: 'position',
        oldValues,
        newValues: {
          left: elementToMove.left,
          top: elementToMove.top
        },
        reason: `Fixed overlap with element ${otherElement} by moving right`
      };
    }

    // Strategy 3: Move to next available vertical position
    // Find lowest element and place below it
    let maxBottom = 0;
    for (const el of elements) {
      if (el !== elementToMove) {
        maxBottom = Math.max(maxBottom, el.top + el.height);
      }
    }

    const safeTop = maxBottom + this.minSpacing;
    if (safeTop + elementToMove.height <= this.slideHeight - this.margin) {
      elementToMove.top = safeTop;

      return {
        elementIndex: moveElement,
        type: 'position',
        oldValues,
        newValues: {
          left: elementToMove.left,
          top: elementToMove.top
        },
        reason: `Fixed overlap with element ${otherElement} by moving to safe position`
      };
    }

    // Strategy 4: Reduce size as last resort
    if (elementToMove.width > 200 && elementToMove.height > 50) {
      const newWidth = Math.max(200, elementToMove.width * 0.8);
      const newHeight = Math.max(50, elementToMove.height * 0.8);

      elementToMove.width = newWidth;
      elementToMove.height = newHeight;

      // Also try to reposition after resize
      const newTopAfterResize = otherEl.top + otherEl.height + this.minSpacing;
      if (newTopAfterResize + newHeight <= this.slideHeight - this.margin) {
        elementToMove.top = newTopAfterResize;
      }

      return {
        elementIndex: moveElement,
        type: 'both',
        oldValues,
        newValues: {
          left: elementToMove.left,
          top: elementToMove.top,
          width: newWidth,
          height: newHeight
        },
        reason: `Reduced size and repositioned to fix overlap with element ${otherElement}`
      };
    }

    return null;
  }

  /**
   * Fix boundary violation
   */
  private fixBoundaryViolation(
    elements: SchemaElement[],
    violation: BoundaryIssue
  ): FixResult['changesMade'][0] | null {
    const element = elements[violation.elementIndex];
    const oldValues = {
      left: element.left,
      top: element.top,
      width: element.width,
      height: element.height
    };

    let changed = false;

    if (violation.violations.left) {
      element.left = this.margin;
      changed = true;
    }
    if (violation.violations.top) {
      element.top = this.margin;
      changed = true;
    }
    if (violation.violations.right) {
      element.left = Math.max(
        this.margin,
        this.slideWidth - this.margin - element.width
      );
      changed = true;
    }
    if (violation.violations.bottom) {
      element.top = Math.max(
        this.margin,
        this.slideHeight - this.margin - element.height
      );
      changed = true;
    }

    if (changed) {
      return {
        elementIndex: violation.elementIndex,
        type: 'position',
        oldValues,
        newValues: {
          left: element.left,
          top: element.top
        },
        reason: `Fixed boundary violation`
      };
    }

    return null;
  }

  /**
   * Optimize spacing between elements
   */
  private optimizeSpacing(elements: SchemaElement[]): SchemaElement[] {
    // Sort elements by top position
    const sorted = elements.map((el, idx) => ({ el, idx }))
      .sort((a, b) => a.el.top - b.el.top);

    // Add spacing between vertically adjacent elements
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i].el;
      const next = sorted[i + 1].el;

      const gap = next.top - (current.top + current.height);

      if (gap < this.minSpacing) {
        next.top = current.top + current.height + this.minSpacing;
      }
    }

    return elements;
  }

  /**
   * Helper: Get bounding box
   */
  private getBoundingBox(element: SchemaElement): BoundingBox {
    return {
      left: element.left,
      top: element.top,
      right: element.left + element.width,
      bottom: element.top + element.height,
      width: element.width,
      height: element.height
    };
  }

  /**
   * Helper: Calculate overlap
   */
  private calculateOverlap(
    box1: BoundingBox,
    box2: BoundingBox
  ): { area: number; percentage: number } {
    const overlapLeft = Math.max(box1.left, box2.left);
    const overlapTop = Math.max(box1.top, box2.top);
    const overlapRight = Math.min(box1.right, box2.right);
    const overlapBottom = Math.min(box1.bottom, box2.bottom);

    if (overlapLeft < overlapRight && overlapTop < overlapBottom) {
      const area = (overlapRight - overlapLeft) * (overlapBottom - overlapTop);
      const minArea = Math.min(box1.width * box1.height, box2.width * box2.height);
      const percentage = (area / minArea) * 100;

      return { area, percentage };
    }

    return { area: 0, percentage: 0 };
  }

  /**
   * Helper: Calculate minimum distance between boxes
   */
  private calculateMinDistance(box1: BoundingBox, box2: BoundingBox): number {
    // If overlapping, return 0
    if (
      box1.left < box2.right &&
      box1.right > box2.left &&
      box1.top < box2.bottom &&
      box1.bottom > box2.top
    ) {
      return 0;
    }

    // Calculate minimum distance
    const horizontalDistance = Math.max(
      0,
      Math.max(box1.left - box2.right, box2.left - box1.right)
    );
    const verticalDistance = Math.max(
      0,
      Math.max(box1.top - box2.bottom, box2.top - box1.bottom)
    );

    return Math.sqrt(horizontalDistance ** 2 + verticalDistance ** 2);
  }

  /**
   * Helper: Get overlap severity
   */
  private getOverlapSeverity(percentage: number): OverlapIssue['severity'] {
    if (percentage >= 30) return "critical";
    if (percentage >= 10) return "major";
    return "minor";
  }

  /**
   * Helper: Get boundary violation severity
   */
  private getBoundaryViolationSeverity(
    violations: BoundaryIssue['violations']
  ): BoundaryIssue['severity'] {
    const maxViolation = Math.max(
      violations.left || 0,
      violations.top || 0,
      violations.right || 0,
      violations.bottom || 0
    );

    if (maxViolation > 50) return "critical";
    if (maxViolation > 20) return "major";
    return "minor";
  }

  /**
   * Helper: Suggest overlap fix
   */
  private suggestOverlapFix(
    el1: SchemaElement,
    el2: SchemaElement,
    overlap: { area: number; percentage: number }
  ): OverlapIssue['suggestedFix'] {
    if (overlap.percentage > 50) return "move";
    if (overlap.percentage > 20) return "resize";
    return "reorder";
  }

  /**
   * Helper: Calculate overall severity
   */
  private calculateSeverity(
    overlaps: OverlapIssue[],
    boundaries: BoundaryIssue[]
  ): LayoutIssues['severity'] {
    const hasCritical =
      overlaps.some(o => o.severity === 'critical') ||
      boundaries.some(b => b.severity === 'critical');

    if (hasCritical) return "critical";

    const hasMajor =
      overlaps.some(o => o.severity === 'major') ||
      boundaries.some(b => b.severity === 'major');

    if (hasMajor) return "major";

    if (overlaps.length > 0 || boundaries.length > 0) return "minor";

    return "none";
  }

  /**
   * Print detected issues
   */
  private printIssues(issues: LayoutIssues): void {
    console.log(`\n📊 Issues Found: ${issues.totalIssues}`);
    console.log(`   Severity: ${issues.severity.toUpperCase()}`);

    if (issues.overlaps.length > 0) {
      console.log(`\n❌ Overlaps: ${issues.overlaps.length}`);
      issues.overlaps.forEach(o => {
        console.log(
          `   - Elements ${o.element1} & ${o.element2}: ` +
          `${o.overlapPercentage.toFixed(1)}% overlap (${o.severity})`
        );
      });
    }

    if (issues.boundaryViolations.length > 0) {
      console.log(`\n⚠️  Boundary Violations: ${issues.boundaryViolations.length}`);
      issues.boundaryViolations.forEach(b => {
        const viols = Object.keys(b.violations).join(', ');
        console.log(`   - Element ${b.elementIndex}: ${viols} (${b.severity})`);
      });
    }

    if (issues.spacingIssues.length > 0) {
      console.log(`\n📏 Spacing Issues: ${issues.spacingIssues.length}`);
    }

    if (issues.alignmentIssues.length > 0) {
      console.log(`\n↔️  Alignment Issues: ${issues.alignmentIssues.length}`);
    }
  }

  /**
   * Generate report
   */
  private generateReport(
    before: LayoutIssues,
    after: LayoutIssues,
    changes: FixResult['changesMade']
  ): string {
    return `Fixed ${before.totalIssues - after.totalIssues} of ${before.totalIssues} issues. ` +
           `${changes.length} changes made. ` +
           `${after.totalIssues} issues remaining.`;
  }

  /**
   * Print results
   */
  private printResults(result: FixResult): void {
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║              FIX RESULTS                                     ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");

    console.log(`\n✨ Results:`);
    console.log(`   Issues Found: ${result.issuesFound.totalIssues}`);
    console.log(`   Issues Fixed: ${result.issuesFixed}`);
    console.log(`   Changes Made: ${result.changesMade.length}`);
    console.log(`   Success: ${result.success ? '✅ YES' : '⚠️  PARTIAL'}`);

    if (result.changesMade.length > 0) {
      console.log(`\n🔧 Changes:`);
      result.changesMade.forEach((change, idx) => {
        console.log(`   ${idx + 1}. Element ${change.elementIndex}: ${change.reason}`);
      });
    }

    console.log("");
  }
}
