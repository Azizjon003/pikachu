/**
 * Text Overlap Detector
 *
 * Detects overlapping text elements and boundary violations in slide layouts
 * Provides comprehensive collision detection and spatial analysis
 */

export interface BoundingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface TextElement {
  id: string;
  type: string;
  content: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize?: number;
  elementIndex: number;
  [key: string]: any;
}

export interface OverlapIssue {
  severity: 'critical' | 'major' | 'minor';
  element1: TextElement;
  element2: TextElement;
  overlapArea: number;
  overlapPercentage: number;
  overlapBox: BoundingBox;
  description: string;
  suggestedFix: string;
}

export interface BoundaryIssue {
  severity: 'critical' | 'major' | 'minor';
  element: TextElement;
  estimatedTextHeight: number;
  availableHeight: number;
  overflow: number;
  description: string;
  suggestedFix: string;
}

export interface SpatialAnalysis {
  totalElements: number;
  textElements: number;
  overlapIssues: OverlapIssue[];
  boundaryIssues: BoundaryIssue[];
  hasIssues: boolean;
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
  layoutDensity: number;
  recommendations: string[];
}

export class TextOverlapDetector {
  private slideWidth: number;
  private slideHeight: number;

  // Overlap detection thresholds
  private minOverlapThreshold: number = 5; // Minimum 5px overlap to consider
  private criticalOverlapPercent: number = 30; // 30%+ overlap is critical
  private majorOverlapPercent: number = 15; // 15%+ overlap is major

  constructor(slideWidth: number = 1920, slideHeight: number = 1080) {
    this.slideWidth = slideWidth;
    this.slideHeight = slideHeight;
  }

  /**
   * Analyze entire slide for overlaps and boundary issues
   */
  analyzeSlide(elements: TextElement[]): SpatialAnalysis {
    console.log(`\n🔍 Analyzing slide with ${elements.length} elements...`);

    // Filter text elements
    const textElements = elements.filter(el =>
      (el.type === 'shape' || el.type === 'text') &&
      el.content &&
      el.content.trim().length > 0
    );

    console.log(`   Found ${textElements.length} text elements to analyze`);

    // Detect overlaps between all pairs of elements
    const overlapIssues = this.detectOverlaps(textElements);

    // Detect boundary violations
    const boundaryIssues = this.detectBoundaryViolations(textElements);

    // Calculate metrics
    const criticalIssues =
      overlapIssues.filter(i => i.severity === 'critical').length +
      boundaryIssues.filter(i => i.severity === 'critical').length;

    const majorIssues =
      overlapIssues.filter(i => i.severity === 'major').length +
      boundaryIssues.filter(i => i.severity === 'major').length;

    const minorIssues =
      overlapIssues.filter(i => i.severity === 'minor').length +
      boundaryIssues.filter(i => i.severity === 'minor').length;

    const layoutDensity = this.calculateLayoutDensity(textElements);

    const recommendations = this.generateRecommendations(
      overlapIssues,
      boundaryIssues,
      layoutDensity
    );

    console.log(`   ⚠️  Critical issues: ${criticalIssues}`);
    console.log(`   ⚠️  Major issues: ${majorIssues}`);
    console.log(`   ⚠️  Minor issues: ${minorIssues}`);
    console.log(`   📊 Layout density: ${(layoutDensity * 100).toFixed(1)}%`);

    return {
      totalElements: elements.length,
      textElements: textElements.length,
      overlapIssues,
      boundaryIssues,
      hasIssues: criticalIssues > 0 || majorIssues > 0 || minorIssues > 0,
      criticalIssues,
      majorIssues,
      minorIssues,
      layoutDensity,
      recommendations
    };
  }

  /**
   * Detect overlaps between text elements
   */
  private detectOverlaps(elements: TextElement[]): OverlapIssue[] {
    const issues: OverlapIssue[] = [];

    // Check every pair of elements
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const el1 = elements[i];
        const el2 = elements[j];

        const box1 = this.getBoundingBox(el1);
        const box2 = this.getBoundingBox(el2);

        if (this.boxesOverlap(box1, box2)) {
          const overlapBox = this.getOverlapBox(box1, box2);
          const overlapArea = this.getBoxArea(overlapBox);

          const area1 = this.getBoxArea(box1);
          const area2 = this.getBoxArea(box2);

          // Calculate overlap percentage relative to smaller element
          const minArea = Math.min(area1, area2);
          const overlapPercentage = (overlapArea / minArea) * 100;

          // Only report if overlap is significant
          if (overlapArea >= this.minOverlapThreshold) {
            let severity: 'critical' | 'major' | 'minor';

            if (overlapPercentage >= this.criticalOverlapPercent) {
              severity = 'critical';
            } else if (overlapPercentage >= this.majorOverlapPercent) {
              severity = 'major';
            } else {
              severity = 'minor';
            }

            issues.push({
              severity,
              element1: el1,
              element2: el2,
              overlapArea,
              overlapPercentage,
              overlapBox,
              description: `Text elements overlap by ${overlapPercentage.toFixed(1)}% (${Math.round(overlapArea)}px²)`,
              suggestedFix: this.generateOverlapFix(el1, el2, overlapBox, severity)
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Detect text that exceeds element boundaries
   */
  private detectBoundaryViolations(elements: TextElement[]): BoundaryIssue[] {
    const issues: BoundaryIssue[] = [];

    for (const el of elements) {
      // Estimate text height based on content and font size
      const estimatedHeight = this.estimateTextHeight(el);
      const availableHeight = el.height;
      const overflow = estimatedHeight - availableHeight;

      if (overflow > 10) { // More than 10px overflow
        let severity: 'critical' | 'major' | 'minor';
        const overflowPercentage = (overflow / availableHeight) * 100;

        if (overflowPercentage > 50) {
          severity = 'critical';
        } else if (overflowPercentage > 25) {
          severity = 'major';
        } else {
          severity = 'minor';
        }

        issues.push({
          severity,
          element: el,
          estimatedTextHeight: estimatedHeight,
          availableHeight,
          overflow,
          description: `Text exceeds element height by ${Math.round(overflow)}px (${overflowPercentage.toFixed(1)}% overflow)`,
          suggestedFix: this.generateBoundaryFix(el, overflow, severity)
        });
      }
    }

    return issues;
  }

  /**
   * Calculate bounding box for an element
   */
  private getBoundingBox(element: TextElement): BoundingBox {
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
   * Check if two bounding boxes overlap
   */
  private boxesOverlap(box1: BoundingBox, box2: BoundingBox): boolean {
    return !(
      box1.right <= box2.left ||
      box1.left >= box2.right ||
      box1.bottom <= box2.top ||
      box1.top >= box2.bottom
    );
  }

  /**
   * Get the overlapping region between two boxes
   */
  private getOverlapBox(box1: BoundingBox, box2: BoundingBox): BoundingBox {
    const left = Math.max(box1.left, box2.left);
    const top = Math.max(box1.top, box2.top);
    const right = Math.min(box1.right, box2.right);
    const bottom = Math.min(box1.bottom, box2.bottom);

    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top
    };
  }

  /**
   * Calculate area of a bounding box
   */
  private getBoxArea(box: BoundingBox): number {
    return box.width * box.height;
  }

  /**
   * Estimate required height for text content
   */
  private estimateTextHeight(element: TextElement): number {
    const fontSize = element.fontSize || 18;
    const lineHeight = 1.5; // Standard line height
    const padding = 20; // Top and bottom padding

    // Remove HTML tags and count text
    const plainText = element.content.replace(/<[^>]*>/g, '');
    const charCount = plainText.length;

    // Estimate characters per line based on width and font size
    const avgCharWidth = fontSize * 0.6; // Approximate character width
    const charsPerLine = Math.floor((element.width - padding * 2) / avgCharWidth);

    // Calculate number of lines
    const lineCount = Math.max(1, Math.ceil(charCount / Math.max(1, charsPerLine)));

    // Add extra lines for explicit line breaks
    const explicitBreaks = (plainText.match(/\n/g) || []).length;
    const totalLines = lineCount + explicitBreaks;

    // Calculate total height
    const textHeight = totalLines * fontSize * lineHeight;
    const totalHeight = textHeight + padding * 2;

    return totalHeight;
  }

  /**
   * Calculate layout density (how much of the slide is covered)
   */
  private calculateLayoutDensity(elements: TextElement[]): number {
    const slideArea = this.slideWidth * this.slideHeight;
    const totalElementArea = elements.reduce((sum, el) => {
      return sum + (el.width * el.height);
    }, 0);

    return totalElementArea / slideArea;
  }

  /**
   * Generate fix suggestion for overlapping elements
   */
  private generateOverlapFix(
    el1: TextElement,
    el2: TextElement,
    overlapBox: BoundingBox,
    severity: 'critical' | 'major' | 'minor'
  ): string {
    const box1 = this.getBoundingBox(el1);
    const box2 = this.getBoundingBox(el2);

    // Determine relative positions
    const el1CenterX = box1.left + box1.width / 2;
    const el2CenterX = box2.left + box2.width / 2;
    const el1CenterY = box1.top + box1.height / 2;
    const el2CenterY = box2.top + box2.height / 2;

    const horizontalDistance = Math.abs(el2CenterX - el1CenterX);
    const verticalDistance = Math.abs(el2CenterY - el1CenterY);

    if (verticalDistance > horizontalDistance) {
      // Elements are more vertically aligned - move vertically
      if (el2CenterY > el1CenterY) {
        return `Move element ${el2.elementIndex} down by ${Math.ceil(overlapBox.height + 10)}px`;
      } else {
        return `Move element ${el2.elementIndex} up by ${Math.ceil(overlapBox.height + 10)}px`;
      }
    } else {
      // Elements are more horizontally aligned - move horizontally
      if (el2CenterX > el1CenterX) {
        return `Move element ${el2.elementIndex} right by ${Math.ceil(overlapBox.width + 10)}px`;
      } else {
        return `Move element ${el2.elementIndex} left by ${Math.ceil(overlapBox.width + 10)}px`;
      }
    }
  }

  /**
   * Generate fix suggestion for boundary violations
   */
  private generateBoundaryFix(
    element: TextElement,
    overflow: number,
    severity: 'critical' | 'major' | 'minor'
  ): string {
    const fixes: string[] = [];

    // Option 1: Increase element height
    fixes.push(`Increase element ${element.elementIndex} height by ${Math.ceil(overflow + 20)}px`);

    // Option 2: Reduce font size
    const currentFontSize = element.fontSize || 18;
    const reductionPercent = Math.min(30, Math.ceil((overflow / element.height) * 100));
    const newFontSize = Math.floor(currentFontSize * (1 - reductionPercent / 100));
    fixes.push(`Reduce font size to ${newFontSize}px`);

    // Option 3: Shorten text
    const targetLength = Math.floor(element.content.length * (element.height / (element.height + overflow)));
    fixes.push(`Shorten text to approximately ${targetLength} characters`);

    return fixes.join(' OR ');
  }

  /**
   * Generate overall recommendations
   */
  private generateRecommendations(
    overlapIssues: OverlapIssue[],
    boundaryIssues: BoundaryIssue[],
    layoutDensity: number
  ): string[] {
    const recommendations: string[] = [];

    if (overlapIssues.length > 0) {
      recommendations.push(
        `Found ${overlapIssues.length} overlapping text element(s) - use AI layout optimizer to reposition`
      );
    }

    if (boundaryIssues.length > 0) {
      recommendations.push(
        `Found ${boundaryIssues.length} text element(s) with content overflow - resize or reduce font size`
      );
    }

    if (layoutDensity > 0.6) {
      recommendations.push(
        'Layout density is high (>60%) - consider simplifying content or using multiple slides'
      );
    } else if (layoutDensity < 0.2) {
      recommendations.push(
        'Layout density is low (<20%) - content could be distributed more efficiently'
      );
    }

    const criticalCount =
      overlapIssues.filter(i => i.severity === 'critical').length +
      boundaryIssues.filter(i => i.severity === 'critical').length;

    if (criticalCount > 0) {
      recommendations.push(
        `⚠️ ${criticalCount} CRITICAL issue(s) require immediate attention`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Layout is optimal - no issues detected');
    }

    return recommendations;
  }

  /**
   * Print detailed analysis report
   */
  printAnalysisReport(analysis: SpatialAnalysis): void {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║          Text Overlap & Boundary Analysis                ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log(`📊 Elements Analyzed: ${analysis.totalElements} total, ${analysis.textElements} text elements`);
    console.log(`📈 Layout Density: ${(analysis.layoutDensity * 100).toFixed(1)}%`);
    console.log(`\n⚠️  Issues Found:`);
    console.log(`   Critical: ${analysis.criticalIssues}`);
    console.log(`   Major: ${analysis.majorIssues}`);
    console.log(`   Minor: ${analysis.minorIssues}`);

    if (analysis.overlapIssues.length > 0) {
      console.log(`\n🔴 OVERLAP ISSUES (${analysis.overlapIssues.length}):`);
      analysis.overlapIssues.forEach((issue, i) => {
        console.log(`\n   ${i + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`);
        console.log(`      Elements: ${issue.element1.elementIndex} ↔ ${issue.element2.elementIndex}`);
        console.log(`      Overlap area: ${Math.round(issue.overlapArea)}px²`);
        console.log(`      Fix: ${issue.suggestedFix}`);
      });
    }

    if (analysis.boundaryIssues.length > 0) {
      console.log(`\n📏 BOUNDARY ISSUES (${analysis.boundaryIssues.length}):`);
      analysis.boundaryIssues.forEach((issue, i) => {
        console.log(`\n   ${i + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`);
        console.log(`      Element: ${issue.element.elementIndex}`);
        console.log(`      Available: ${Math.round(issue.availableHeight)}px, Needed: ${Math.round(issue.estimatedTextHeight)}px`);
        console.log(`      Fix: ${issue.suggestedFix}`);
      });
    }

    if (analysis.recommendations.length > 0) {
      console.log(`\n💡 RECOMMENDATIONS:`);
      analysis.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }

    console.log('\n' + '='.repeat(63) + '\n');
  }
}

export default TextOverlapDetector;
