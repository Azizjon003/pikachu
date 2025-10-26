/**
 * AI Text Layout Optimizer
 *
 * Intelligent agent that analyzes and fixes text overlap and boundary issues
 * Uses AI to make smart decisions about repositioning, resizing, and reformatting
 */

import dotenv from "dotenv";
import {
  TextOverlapDetector,
  type TextElement,
  type SpatialAnalysis,
  type OverlapIssue,
  type BoundaryIssue,
  type BoundingBox,
} from "./text-overlap-detector";
import { getOpenAIService, OpenAIService } from "../openai";

dotenv.config();

interface LayoutFix {
  elementIndex: number;
  action: "move" | "resize" | "reduce-font" | "reformat" | "split";
  originalElement: TextElement;
  modifiedElement: TextElement;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  confidence: number;
  reasoning: string;
}

interface OptimizationResult {
  success: boolean;
  originalAnalysis: SpatialAnalysis;
  optimizedElements: TextElement[];
  appliedFixes: LayoutFix[];
  newAnalysis: SpatialAnalysis;
  iterationsUsed: number;
  improvementScore: number;
  summary: string;
}

interface AILayoutDecision {
  fixes: {
    elementIndex: number;
    action: string;
    newLeft?: number;
    newTop?: number;
    newWidth?: number;
    newHeight?: number;
    newFontSize?: number;
    reasoning: string;
    confidence: number;
  }[];
  strategy: string;
  expectedImprovement: number;
}

export class AITextLayoutOptimizer {
  private openaiService: OpenAIService;
  private detector: TextOverlapDetector;
  private maxIterations: number = 3;
  private slideWidth: number;
  private slideHeight: number;

  constructor(
    slideWidth: number = 1920,
    slideHeight: number = 1080,
    openaiApiKey?: string
  ) {
    this.openaiService = getOpenAIService();
    this.detector = new TextOverlapDetector(slideWidth, slideHeight);
    this.slideWidth = slideWidth;
    this.slideHeight = slideHeight;
  }

  /**
   * Main optimization method - analyzes and fixes all layout issues
   */
  async optimizeLayout(elements: TextElement[]): Promise<OptimizationResult> {
    console.log(
      "\n╔═══════════════════════════════════════════════════════════╗"
    );
    console.log("║          AI Layout Optimization Started                  ║");
    console.log(
      "╚═══════════════════════════════════════════════════════════╝\n"
    );

    // Initial analysis
    const originalAnalysis = this.detector.analyzeSlide(elements);
    this.detector.printAnalysisReport(originalAnalysis);

    if (!originalAnalysis.hasIssues) {
      console.log("✅ No issues found - layout is already optimal!\n");
      return {
        success: true,
        originalAnalysis,
        optimizedElements: elements,
        appliedFixes: [],
        newAnalysis: originalAnalysis,
        iterationsUsed: 0,
        improvementScore: 100,
        summary: "Layout is already optimal - no changes needed",
      };
    }

    // Iterative optimization
    let currentElements = [...elements];
    let allFixes: LayoutFix[] = [];
    let iteration = 0;

    while (iteration < this.maxIterations) {
      iteration++;
      console.log(
        `\n🔄 Optimization Iteration ${iteration}/${this.maxIterations}...`
      );

      // Analyze current state
      const currentAnalysis = this.detector.analyzeSlide(currentElements);

      // Check if we're done
      if (!currentAnalysis.hasIssues) {
        console.log("✅ All issues resolved!");
        break;
      }

      if (
        currentAnalysis.criticalIssues === 0 &&
        currentAnalysis.majorIssues === 0
      ) {
        console.log(
          "✅ All critical and major issues resolved, minor issues acceptable"
        );
        break;
      }

      // Get AI-powered fixes
      const fixes = await this.generateAIFixes(
        currentElements,
        currentAnalysis
      );

      if (fixes.length === 0) {
        console.log("⚠️  No more fixes can be applied");
        break;
      }

      // Apply fixes
      const { elements: newElements, appliedFixes } = this.applyFixes(
        currentElements,
        fixes
      );

      currentElements = newElements;
      allFixes.push(...appliedFixes);

      console.log(`   ✅ Applied ${appliedFixes.length} fixes`);
    }

    // Final analysis
    const newAnalysis = this.detector.analyzeSlide(currentElements);

    console.log(
      "\n╔═══════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║          Optimization Results                             ║"
    );
    console.log(
      "╚═══════════════════════════════════════════════════════════╝\n"
    );

    this.detector.printAnalysisReport(newAnalysis);

    const improvementScore = this.calculateImprovementScore(
      originalAnalysis,
      newAnalysis
    );

    const summary = this.generateSummary(
      originalAnalysis,
      newAnalysis,
      allFixes,
      improvementScore
    );

    console.log(summary);

    return {
      success: newAnalysis.criticalIssues === 0,
      originalAnalysis,
      optimizedElements: currentElements,
      appliedFixes: allFixes,
      newAnalysis,
      iterationsUsed: iteration,
      improvementScore,
      summary,
    };
  }

  /**
   * Generate AI-powered fixes for layout issues
   */
  private async generateAIFixes(
    elements: TextElement[],
    analysis: SpatialAnalysis
  ): Promise<LayoutFix[]> {
    console.log("\n🤖 AI: Analyzing layout and generating fixes...");

    // Prepare data for AI
    const elementsData = elements
      .filter((el) => (el.type === "shape" || el.type === "text") && el.content)
      .map((el) => ({
        elementIndex: el.elementIndex,
        left: Math.round(el.left),
        top: Math.round(el.top),
        width: Math.round(el.width),
        height: Math.round(el.height),
        fontSize: el.fontSize || 18,
        contentLength: el.content.replace(/<[^>]*>/g, "").length,
        contentPreview: el.content.replace(/<[^>]*>/g, "").substring(0, 50),
      }));

    const overlapsData = analysis.overlapIssues.map((issue) => ({
      element1: issue.element1.elementIndex,
      element2: issue.element2.elementIndex,
      overlapPercentage: Math.round(issue.overlapPercentage),
      severity: issue.severity,
    }));

    const boundaryData = analysis.boundaryIssues.map((issue) => ({
      element: issue.element.elementIndex,
      overflow: Math.round(issue.overflow),
      severity: issue.severity,
    }));

    const prompt = `You are an expert PowerPoint layout optimizer. Analyze this slide layout and provide specific fixes to resolve overlaps and boundary issues.

SLIDE DIMENSIONS: ${this.slideWidth}x${this.slideHeight}px

ELEMENTS:
${JSON.stringify(elementsData, null, 2)}

OVERLAP ISSUES:
${overlapsData.length > 0 ? JSON.stringify(overlapsData, null, 2) : "None"}

BOUNDARY ISSUES (text overflow):
${boundaryData.length > 0 ? JSON.stringify(boundaryData, null, 2) : "None"}

CRITICAL ISSUES: ${analysis.criticalIssues}
MAJOR ISSUES: ${analysis.majorIssues}

YOUR TASK:
Provide specific fixes to resolve these issues. Prioritize critical issues first.

AVAILABLE ACTIONS:
1. "move" - Change element position (newLeft, newTop)
2. "resize" - Change element size (newWidth, newHeight)
3. "reduce-font" - Reduce font size (newFontSize)
4. "reformat" - Combination of resize + move

CONSTRAINTS:
- Elements must stay within slide boundaries (0,0 to ${this.slideWidth},${
      this.slideHeight
    })
- Minimum 10px spacing between elements
- Font size must be >= 10px and <= 72px
- Maintain visual hierarchy (don't move titles below content)
- Prefer moving smaller/lower-priority elements
- Prefer vertical repositioning for vertically-stacked layouts

STRATEGY GUIDELINES:
- For OVERLAP issues: Move one element away from the other, or resize both
- For BOUNDARY issues: Either reduce font size OR increase element height
- Try to maintain original layout structure as much as possible
- Keep related content grouped together

Return JSON with this EXACT structure:
{
  "fixes": [
    {
      "elementIndex": <number>,
      "action": "move|resize|reduce-font|reformat",
      "newLeft": <number, if moving>,
      "newTop": <number, if moving>,
      "newWidth": <number, if resizing>,
      "newHeight": <number, if resizing>,
      "newFontSize": <number, if reducing font>,
      "reasoning": "<why this fix>",
      "confidence": <0.0-1.0>
    }
  ],
  "strategy": "<overall strategy description>",
  "expectedImprovement": <0-100, % improvement expected>
}

IMPORTANT: Provide AT LEAST one fix for each critical issue. Return valid JSON only.`;

    try {
      const result: AILayoutDecision = await this.openaiService.createJsonCompletion({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are an expert PowerPoint layout optimizer. Analyze spatial relationships and provide precise numerical fixes. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        maxTokens: 2000,
      });

      console.log(`   🎯 AI Strategy: ${result.strategy}`);
      console.log(`   📊 Expected Improvement: ${result.expectedImprovement}%`);
      console.log(`   🔧 Generated ${result.fixes.length} fixes`);

      // Convert AI decisions to LayoutFix objects
      const fixes: LayoutFix[] = [];

      for (const aiFix of result.fixes) {
        const element = elements.find(
          (el) => el.elementIndex === aiFix.elementIndex
        );
        if (!element) continue;

        const modifiedElement = { ...element };
        const changes: { field: string; oldValue: any; newValue: any }[] = [];

        if (aiFix.newLeft !== undefined && aiFix.newLeft !== element.left) {
          changes.push({
            field: "left",
            oldValue: element.left,
            newValue: aiFix.newLeft,
          });
          modifiedElement.left = aiFix.newLeft;
        }

        if (aiFix.newTop !== undefined && aiFix.newTop !== element.top) {
          changes.push({
            field: "top",
            oldValue: element.top,
            newValue: aiFix.newTop,
          });
          modifiedElement.top = aiFix.newTop;
        }

        if (aiFix.newWidth !== undefined && aiFix.newWidth !== element.width) {
          changes.push({
            field: "width",
            oldValue: element.width,
            newValue: aiFix.newWidth,
          });
          modifiedElement.width = aiFix.newWidth;
        }

        if (
          aiFix.newHeight !== undefined &&
          aiFix.newHeight !== element.height
        ) {
          changes.push({
            field: "height",
            oldValue: element.height,
            newValue: aiFix.newHeight,
          });
          modifiedElement.height = aiFix.newHeight;
        }

        if (
          aiFix.newFontSize !== undefined &&
          aiFix.newFontSize !== element.fontSize
        ) {
          changes.push({
            field: "fontSize",
            oldValue: element.fontSize,
            newValue: aiFix.newFontSize,
          });
          modifiedElement.fontSize = aiFix.newFontSize;
        }

        if (changes.length > 0) {
          fixes.push({
            elementIndex: aiFix.elementIndex,
            action: aiFix.action as any,
            originalElement: element,
            modifiedElement,
            changes,
            confidence: aiFix.confidence,
            reasoning: aiFix.reasoning,
          });

          console.log(
            `   ✅ Fix for element ${aiFix.elementIndex}: ${aiFix.action} - ${aiFix.reasoning}`
          );
        }
      }

      return fixes;
    } catch (error) {
      console.error("❌ AI fix generation failed:", error);

      // Fallback to heuristic fixes
      return this.generateHeuristicFixes(elements, analysis);
    }
  }

  /**
   * Fallback heuristic-based fixes when AI fails
   */
  private generateHeuristicFixes(
    elements: TextElement[],
    analysis: SpatialAnalysis
  ): LayoutFix[] {
    console.log("   ⚠️  Using heuristic fallback fixes...");

    const fixes: LayoutFix[] = [];

    // Fix overlaps by moving elements
    for (const issue of analysis.overlapIssues) {
      if (issue.severity === "critical" || issue.severity === "major") {
        const el2 = issue.element2;
        const moveDistance = Math.ceil(issue.overlapBox.height + 20);

        const modifiedElement = { ...el2 };
        modifiedElement.top = el2.top + moveDistance;

        fixes.push({
          elementIndex: el2.elementIndex,
          action: "move",
          originalElement: el2,
          modifiedElement,
          changes: [
            {
              field: "top",
              oldValue: el2.top,
              newValue: modifiedElement.top,
            },
          ],
          confidence: 0.7,
          reasoning: `Heuristic: Move element down to resolve ${issue.severity} overlap`,
        });
      }
    }

    // Fix boundary issues by reducing font size
    for (const issue of analysis.boundaryIssues) {
      if (issue.severity === "critical" || issue.severity === "major") {
        const el = issue.element;
        const currentFontSize = el.fontSize || 18;
        const reductionFactor = 0.85; // Reduce by 15%
        const newFontSize = Math.max(
          10,
          Math.floor(currentFontSize * reductionFactor)
        );

        const modifiedElement = { ...el };
        modifiedElement.fontSize = newFontSize;

        fixes.push({
          elementIndex: el.elementIndex,
          action: "reduce-font",
          originalElement: el,
          modifiedElement,
          changes: [
            {
              field: "fontSize",
              oldValue: currentFontSize,
              newValue: newFontSize,
            },
          ],
          confidence: 0.6,
          reasoning: `Heuristic: Reduce font size to fit content within boundaries`,
        });
      }
    }

    return fixes;
  }

  /**
   * Apply fixes to elements
   */
  private applyFixes(
    elements: TextElement[],
    fixes: LayoutFix[]
  ): { elements: TextElement[]; appliedFixes: LayoutFix[] } {
    const newElements = [...elements];
    const appliedFixes: LayoutFix[] = [];

    for (const fix of fixes) {
      const index = newElements.findIndex(
        (el) => el.elementIndex === fix.elementIndex
      );

      if (index !== -1) {
        // Validate fix before applying
        if (this.validateFix(fix.modifiedElement)) {
          newElements[index] = { ...fix.modifiedElement };
          appliedFixes.push(fix);
        } else {
          console.log(
            `   ⚠️  Skipped invalid fix for element ${fix.elementIndex}`
          );
        }
      }
    }

    return { elements: newElements, appliedFixes };
  }

  /**
   * Validate that a fix doesn't create new problems
   */
  private validateFix(element: TextElement): boolean {
    // Check boundaries
    if (element.left < 0 || element.top < 0) return false;
    if (element.left + element.width > this.slideWidth) return false;
    if (element.top + element.height > this.slideHeight) return false;

    // Check minimum sizes
    if (element.width < 50 || element.height < 30) return false;

    // Check font size
    if (element.fontSize && (element.fontSize < 10 || element.fontSize > 72)) {
      return false;
    }

    return true;
  }

  /**
   * Calculate improvement score
   */
  private calculateImprovementScore(
    before: SpatialAnalysis,
    after: SpatialAnalysis
  ): number {
    const beforeScore =
      before.criticalIssues * 10 +
      before.majorIssues * 5 +
      before.minorIssues * 1;

    const afterScore =
      after.criticalIssues * 10 + after.majorIssues * 5 + after.minorIssues * 1;

    const maxScore = beforeScore;

    if (maxScore === 0) return 100;

    const improvement = ((maxScore - afterScore) / maxScore) * 100;
    return Math.max(0, Math.min(100, improvement));
  }

  /**
   * Generate summary report
   */
  private generateSummary(
    before: SpatialAnalysis,
    after: SpatialAnalysis,
    fixes: LayoutFix[],
    improvement: number
  ): string {
    const lines: string[] = [];

    lines.push("\n" + "═".repeat(63));
    lines.push("OPTIMIZATION SUMMARY");
    lines.push("═".repeat(63) + "\n");

    lines.push(`📊 Improvement Score: ${improvement.toFixed(1)}%\n`);

    lines.push("BEFORE → AFTER:");
    lines.push(
      `   Critical Issues: ${before.criticalIssues} → ${after.criticalIssues}`
    );
    lines.push(`   Major Issues: ${before.majorIssues} → ${after.majorIssues}`);
    lines.push(`   Minor Issues: ${before.minorIssues} → ${after.minorIssues}`);
    lines.push(
      `   Overlap Issues: ${before.overlapIssues.length} → ${after.overlapIssues.length}`
    );
    lines.push(
      `   Boundary Issues: ${before.boundaryIssues.length} → ${after.boundaryIssues.length}\n`
    );

    lines.push(`🔧 Fixes Applied: ${fixes.length}`);
    const moveCount = fixes.filter((f) => f.action === "move").length;
    const resizeCount = fixes.filter((f) => f.action === "resize").length;
    const fontCount = fixes.filter((f) => f.action === "reduce-font").length;
    const reformatCount = fixes.filter((f) => f.action === "reformat").length;

    if (moveCount > 0) lines.push(`   Repositioned: ${moveCount} elements`);
    if (resizeCount > 0) lines.push(`   Resized: ${resizeCount} elements`);
    if (fontCount > 0) lines.push(`   Font adjustments: ${fontCount} elements`);
    if (reformatCount > 0)
      lines.push(`   Reformatted: ${reformatCount} elements`);

    lines.push("\n" + "═".repeat(63) + "\n");

    if (after.criticalIssues === 0 && after.majorIssues === 0) {
      lines.push("✅ SUCCESS: All critical and major issues resolved!");
    } else if (improvement >= 80) {
      lines.push("✅ GOOD: Significant improvement achieved");
    } else if (improvement >= 50) {
      lines.push("⚠️  PARTIAL: Some issues remain");
    } else {
      lines.push("❌ LIMITED: Minimal improvement - manual review recommended");
    }

    return lines.join("\n");
  }
}

export default AITextLayoutOptimizer;
