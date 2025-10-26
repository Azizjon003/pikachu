/**
 * Intelligent AI Transformer
 *
 * AQLLI VA EHTIYOTKOR AI TIZIMI:
 * ✅ Mavzuni tushunadi (context-aware)
 * ✅ Slayd strukturasini buzmas (safety guards)
 * ✅ Professional ko'rinishni saqlaydi
 * ✅ Har bir o'zgarishni validate qiladi
 * ✅ Noto'g'ri o'zgarishlarni qaytaradi (rollback)
 * ✅ Slide type ni hisobga oladi
 * ✅ Content importance ni tushunadi
 *
 * Bu tizim GANDONCHA ishqilib, chiroyli natija beradi!
 */

import OpenAI from "openai";
import * as dotenv from "dotenv";
import {
  CreativeLayoutAnalyzer,
  type SchemaElement,
  type LayoutAnalysis
} from "./creative-layout-analyzer";
import { PrecisionLayoutFixer } from "../layout/precision-layout-fixer";

dotenv.config();

export interface SlideContext {
  slideNumber: number;
  totalSlides: number;
  slideType: "title" | "content" | "data" | "conclusion" | "reference";
  topic: string;
  language: string;
  hasTitle: boolean;
  hasImages: boolean;
  contentDensity: "low" | "medium" | "high";
}

export interface SafetyRules {
  preserveTitles: boolean;
  preserveImages: boolean;
  minElements: number;
  maxElements: number;
  minFontSize: number;
  maxFontSize: number;
  allowDelete: boolean;
  allowCreate: boolean;
  requiresValidation: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number; // 0-100
  recommendation: "accept" | "accept_with_warnings" | "reject";
}

export interface IntelligentOperation {
  type: "create" | "delete" | "modify" | "merge";
  elementIndex?: number;
  newElement?: Partial<SchemaElement>;
  targetIndices?: number[];
  reasoning: string;
  safetyScore: number; // 0-100
  contextRelevance: number; // 0-100
  visualImpact: "minimal" | "moderate" | "significant" | "major";
  validated: boolean;
}

export interface IntelligentTransformResult {
  originalSchema: SchemaElement[];
  transformedSchema: SchemaElement[];
  context: SlideContext;
  operations: IntelligentOperation[];
  validation: ValidationResult;
  safetyReport: {
    rulesApplied: string[];
    operationsRejected: number;
    operationsAccepted: number;
    overallSafety: number; // 0-100
  };
  improvementScore: number;
  rollbackAvailable: boolean;
}

export class IntelligentAITransformer {
  private openai: OpenAI;
  private analyzer: CreativeLayoutAnalyzer;
  private precisionFixer: PrecisionLayoutFixer;
  private slideWidth: number;
  private slideHeight: number;

  constructor(slideWidth: number = 1920, slideHeight: number = 1080) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required");
    }

    this.openai = new OpenAI({ apiKey });
    this.analyzer = new CreativeLayoutAnalyzer(slideWidth, slideHeight);
    this.precisionFixer = new PrecisionLayoutFixer(slideWidth, slideHeight);
    this.slideWidth = slideWidth;
    this.slideHeight = slideHeight;
  }

  /**
   * AQLLI TRANSFORMATION - mavzuga mos, ehtiyotkor, professional
   */
  async intelligentTransform(
    elements: SchemaElement[],
    context: SlideContext,
    safetyRules?: Partial<SafetyRules>
  ): Promise<IntelligentTransformResult> {
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║         INTELLIGENT AI TRANSFORMATION                        ║");
    console.log("║         Aqlli, Ehtiyotkor, Professional                      ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    // Step 1: Context analysis
    console.log(`🎯 Context: ${context.slideType} slide (${context.slideNumber}/${context.totalSlides})`);
    console.log(`📚 Topic: ${context.topic}`);
    console.log(`🌐 Language: ${context.language}\n`);

    // Step 2: Setup safety rules
    const rules = this.setupSafetyRules(context, safetyRules);
    console.log(`🛡️  Safety Rules:`);
    this.printSafetyRules(rules);

    // Step 3: Initial analysis
    const beforeAnalysis = this.analyzer.analyzeLayout(elements);
    console.log(`\n📊 Current State:`);
    console.log(`   Elements: ${elements.length}`);
    console.log(`   Aesthetic: ${beforeAnalysis.aestheticScore}/100`);
    console.log(`   Issues: ${beforeAnalysis.improvementOpportunities.length}\n`);

    // Step 4: Generate context-aware operations
    console.log(`🤖 Generating intelligent operations...`);
    const operations = await this.generateIntelligentOperations(
      elements,
      context,
      beforeAnalysis,
      rules
    );

    // Step 5: Validate each operation
    console.log(`\n✓ Validating operations...`);
    const validatedOps = this.validateOperations(operations, elements, rules);

    // Step 6: Apply safe operations
    console.log(`\n⚡ Applying safe operations...`);
    const transformedSchema = this.applySafeOperations(
      elements,
      validatedOps,
      rules
    );

    // Step 7: Precision layout fixing
    console.log(`\n🔧 Precision layout fixing...`);
    let finalSchema = transformedSchema;
    const fixResult = this.precisionFixer.fixLayout(transformedSchema);

    if (fixResult.success && fixResult.issuesFixed > 0) {
      console.log(`   ✓ Fixed ${fixResult.issuesFixed} precision issues!`);
      finalSchema = fixResult.fixedElements;
    } else if (fixResult.issuesFound.totalIssues > 0) {
      console.log(`   ⚠️  Some precision issues remain (${fixResult.issuesFound.totalIssues})`);
    } else {
      console.log(`   ✓ No precision issues found!`);
    }

    // Step 8: Final validation
    console.log(`\n🔍 Final validation...`);
    const validation = this.validateResult(
      elements,
      finalSchema,
      context,
      rules
    );

    // Step 9: Analysis and safety report
    const afterAnalysis = this.analyzer.analyzeLayout(finalSchema);
    const safetyReport = this.generateSafetyReport(operations, validatedOps, rules);

    // Always use finalSchema if recommendation is accept or accept_with_warnings
    // Only rollback to original if explicitly rejected
    const shouldUseTransformed = validation.recommendation !== 'reject';

    const result: IntelligentTransformResult = {
      originalSchema: elements,
      transformedSchema: shouldUseTransformed ? finalSchema : elements,
      context,
      operations: validatedOps,
      validation,
      safetyReport,
      improvementScore: afterAnalysis.aestheticScore - beforeAnalysis.aestheticScore,
      rollbackAvailable: true
    };

    this.printResults(result);

    return result;
  }

  /**
   * Setup safety rules based on context
   */
  private setupSafetyRules(
    context: SlideContext,
    custom?: Partial<SafetyRules>
  ): SafetyRules {
    const baseRules: SafetyRules = {
      preserveTitles: context.slideType === "title" || context.slideNumber === 1,
      preserveImages: context.hasImages,
      minElements: context.slideType === "title" ? 2 : 3,
      maxElements: context.contentDensity === "high" ? 12 : 10,
      minFontSize: 14,
      maxFontSize: context.slideType === "title" ? 72 : 48,
      allowDelete: context.contentDensity === "high",
      allowCreate: true,
      requiresValidation: true
    };

    return { ...baseRules, ...custom };
  }

  /**
   * Generate intelligent, context-aware operations
   */
  private async generateIntelligentOperations(
    elements: SchemaElement[],
    context: SlideContext,
    analysis: LayoutAnalysis,
    rules: SafetyRules
  ): Promise<IntelligentOperation[]> {
    const prompt = this.buildIntelligentPrompt(elements, context, analysis, rules);

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an INTELLIGENT presentation designer with these CRITICAL RULES:

🎯 CONTEXT AWARENESS:
- Always respect the topic and content
- Understand slide type (title/content/data/conclusion)
- Maintain professional appearance
- Consider audience and purpose

🛡️ SAFETY FIRST:
- NEVER delete important content (titles, key data, images)
- NEVER make changes that break the layout structure
- ALWAYS preserve readability and clarity
- ONLY make improvements, not experiments

✅ QUALITY STANDARDS:
- Every change must have clear reasoning
- Maintain visual hierarchy
- Keep consistent styling
- Ensure professional appearance

❌ FORBIDDEN ACTIONS:
- Deleting titles on title slides
- Removing all images
- Creating too many elements (clutter)
- Making text unreadable (too small/large)
- Breaking alignment and structure

You are SMART and CAREFUL. Think before every action!`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7, // Lower for more careful decisions
        max_tokens: 4000
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      const result = JSON.parse(content);
      return this.parseIntelligentOperations(result.operations || []);
    } catch (error) {
      console.error("   ❌ AI generation failed:", error);
      return [];
    }
  }

  /**
   * Build intelligent prompt with context and safety rules
   */
  private buildIntelligentPrompt(
    elements: SchemaElement[],
    context: SlideContext,
    analysis: LayoutAnalysis,
    rules: SafetyRules
  ): string {
    const elementsSummary = elements.map((el, idx) => ({
      index: idx,
      type: el.type,
      content: el.content?.substring(0, 50) || "N/A",
      fontSize: el.fontSize,
      position: `(${el.left}, ${el.top})`,
      size: `${el.width}x${el.height}`,
      isTitle: el.fontSize && el.fontSize > 36,
      isImage: el.type === 'image' || el.src
    }));

    return `ANALYZE AND IMPROVE THIS SLIDE - BE CAREFUL AND SMART!

═══════════════════════════════════════════════════════════
SLIDE CONTEXT (VERY IMPORTANT!)
═══════════════════════════════════════════════════════════

Topic: ${context.topic}
Language: ${context.language}
Slide Type: ${context.slideType}
Slide Number: ${context.slideNumber} of ${context.totalSlides}
Content Density: ${context.contentDensity}

═══════════════════════════════════════════════════════════
CURRENT ELEMENTS
═══════════════════════════════════════════════════════════

${JSON.stringify(elementsSummary, null, 2)}

═══════════════════════════════════════════════════════════
CURRENT ANALYSIS
═══════════════════════════════════════════════════════════

Aesthetic Score: ${analysis.aestheticScore}/100
Balance: ${analysis.designPrinciples.balance}/100
Whitespace: ${analysis.designPrinciples.whitespace}/100
Alignment: ${analysis.designPrinciples.alignment}/100

Issues Found: ${analysis.improvementOpportunities.length}
${analysis.improvementOpportunities.map(opp => `- ${opp.suggestion}`).join('\n')}

═══════════════════════════════════════════════════════════
SAFETY RULES (MUST FOLLOW!)
═══════════════════════════════════════════════════════════

${rules.preserveTitles ? '⚠️  PRESERVE TITLES - DO NOT delete or significantly modify titles!' : ''}
${rules.preserveImages ? '⚠️  PRESERVE IMAGES - DO NOT delete images!' : ''}
Minimum Elements: ${rules.minElements} (DO NOT go below!)
Maximum Elements: ${rules.maxElements} (DO NOT exceed!)
Font Size Range: ${rules.minFontSize}-${rules.maxFontSize}px
Can Delete: ${rules.allowDelete ? 'Yes (only if redundant)' : 'NO!'}
Can Create: ${rules.allowCreate ? 'Yes (if needed)' : 'NO!'}

═══════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════

Analyze this ${context.slideType} slide about "${context.topic}" and suggest CAREFUL improvements.

THINK ABOUT:
1. Does this change respect the topic and content?
2. Will this change maintain or improve readability?
3. Is this change necessary or just experimental?
4. Will the slide still look professional?
5. Am I following all safety rules?

ONLY SUGGEST CHANGES IF:
✓ They clearly improve the slide
✓ They respect the context and topic
✓ They maintain professional appearance
✓ They follow all safety rules
✓ You can explain the reasoning clearly

RETURN JSON FORMAT:
{
  "analysis": "Brief analysis of what works and what doesn't",
  "approach": "Your careful strategy for improvement",
  "operations": [
    {
      "type": "modify",
      "elementIndex": 0,
      "changes": {
        "fontSize": 48,    // Change font size
        "left": 150,       // Change horizontal position
        "top": 200,        // Change vertical position (IMPORTANT for fixing overlaps!)
        "width": 800       // Change width if needed
      },
      "reasoning": "Clear explanation why this improves the slide",
      "safetyScore": 95,
      "contextRelevance": 90,
      "visualImpact": "moderate"
    },
    {
      "type": "delete",
      "elementIndex": 2,
      "reasoning": "Element is redundant",
      "safetyScore": 80,
      "contextRelevance": 75,
      "visualImpact": "minor"
    },
    {
      "type": "create",
      "changes": {
        "type": "shape",
        "left": 100,
        "top": 500,
        "width": 200,
        "height": 5,
        "backgroundColor": "#000000"
      },
      "reasoning": "Adding visual separator",
      "safetyScore": 85,
      "contextRelevance": 80,
      "visualImpact": "minor"
    }
  ],
  "expectedImprovement": "What will be better after these changes"
}

⚠️  CRITICAL REMINDERS:
- To fix overlaps: ALWAYS include "top" in changes to move element vertically
- To fix positioning: Include "left" and/or "top" in changes
- To resize: Include "width" and/or "height" in changes
- Only include properties you want to change!

BE SMART. BE CAREFUL. MAKE IT BEAUTIFUL! 🎨`;
  }

  /**
   * Parse operations with safety scores
   */
  private parseIntelligentOperations(rawOps: any[]): IntelligentOperation[] {
    return rawOps.map(op => ({
      type: op.type,
      elementIndex: op.elementIndex,
      newElement: op.changes || op.newElement,
      targetIndices: op.targetIndices,
      reasoning: op.reasoning || "No reasoning provided",
      safetyScore: op.safetyScore || 70,
      contextRelevance: op.contextRelevance || 70,
      visualImpact: op.visualImpact || "moderate",
      validated: false
    }));
  }

  /**
   * Validate each operation against safety rules
   */
  private validateOperations(
    operations: IntelligentOperation[],
    elements: SchemaElement[],
    rules: SafetyRules
  ): IntelligentOperation[] {
    const validated: IntelligentOperation[] = [];

    for (const op of operations) {
      let isValid = true;
      const errors: string[] = [];

      // Check delete operations
      if (op.type === 'delete') {
        if (!rules.allowDelete) {
          errors.push("Delete operations not allowed by safety rules");
          isValid = false;
        }

        if (op.elementIndex !== undefined) {
          const element = elements[op.elementIndex];

          // Check if it's a title
          if (rules.preserveTitles && element?.fontSize && element.fontSize > 36) {
            errors.push("Cannot delete title element");
            isValid = false;
          }

          // Check if it's an image
          if (rules.preserveImages && (element?.type === 'image' || element?.src)) {
            errors.push("Cannot delete image element");
            isValid = false;
          }

          // Check minimum elements
          if (elements.length - 1 < rules.minElements) {
            errors.push(`Would violate minimum elements rule (${rules.minElements})`);
            isValid = false;
          }
        }
      }

      // Check create operations
      if (op.type === 'create') {
        if (!rules.allowCreate) {
          errors.push("Create operations not allowed");
          isValid = false;
        }

        if (elements.length + 1 > rules.maxElements) {
          errors.push(`Would exceed maximum elements (${rules.maxElements})`);
          isValid = false;
        }
      }

      // Check modify operations
      if (op.type === 'modify' && op.newElement?.fontSize) {
        if (op.newElement.fontSize < rules.minFontSize) {
          errors.push(`Font size too small (min: ${rules.minFontSize})`);
          isValid = false;
        }
        if (op.newElement.fontSize > rules.maxFontSize) {
          errors.push(`Font size too large (max: ${rules.maxFontSize})`);
          isValid = false;
        }
      }

      // Check safety score
      if (op.safetyScore < 60) {
        errors.push("Safety score too low (<60)");
        isValid = false;
      }

      // Check context relevance
      if (op.contextRelevance < 50) {
        errors.push("Context relevance too low (<50)");
        isValid = false;
      }

      if (isValid) {
        op.validated = true;
        validated.push(op);
        console.log(`   ✓ ${op.type.toUpperCase()}: ${op.reasoning}`);
      } else {
        console.log(`   ✗ ${op.type.toUpperCase()} rejected: ${errors.join(', ')}`);
      }
    }

    return validated;
  }

  /**
   * Apply only validated, safe operations
   */
  private applySafeOperations(
    elements: SchemaElement[],
    operations: IntelligentOperation[],
    rules: SafetyRules
  ): SchemaElement[] {
    let schema = elements.map(el => ({ ...el }));
    const deletedIndices = new Set<number>();

    for (const op of operations) {
      if (!op.validated) continue;

      try {
        switch (op.type) {
          case 'create':
            if (schema.length < rules.maxElements && op.newElement) {
              schema.push({
                type: op.newElement.type || 'shape',
                elementIndex: schema.length,
                left: op.newElement.left || 0,
                top: op.newElement.top || 0,
                width: op.newElement.width || 100,
                height: op.newElement.height || 100,
                ...op.newElement
              } as SchemaElement);
            }
            break;

          case 'delete':
            if (op.elementIndex !== undefined && schema.length > rules.minElements) {
              deletedIndices.add(op.elementIndex);
            }
            break;

          case 'modify':
            if (op.elementIndex !== undefined && !deletedIndices.has(op.elementIndex)) {
              const element = schema[op.elementIndex];
              if (element && op.newElement) {
                Object.assign(element, op.newElement);
              }
            }
            break;

          case 'merge':
            if (op.targetIndices && op.newElement) {
              op.targetIndices.forEach(idx => deletedIndices.add(idx));
              schema.push({
                type: op.newElement.type || 'text',
                elementIndex: schema.length,
                ...op.newElement
              } as SchemaElement);
            }
            break;
        }
      } catch (error) {
        console.error(`   ⚠️  Failed to apply ${op.type}:`, error);
      }
    }

    // Apply deletions
    schema = schema.filter((_, idx) => !deletedIndices.has(idx));

    // Reassign indices
    schema.forEach((el, idx) => {
      el.elementIndex = idx;
    });

    return schema;
  }

  /**
   * Validate final result
   */
  private validateResult(
    original: SchemaElement[],
    transformed: SchemaElement[],
    context: SlideContext,
    rules: SafetyRules
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check element count
    if (transformed.length < rules.minElements) {
      // Element count is a minor issue - warn instead of error
      const diff = rules.minElements - transformed.length;
      if (diff > 2) {
        errors.push(`Too few elements (${transformed.length} < ${rules.minElements})`);
        score -= 30;
      } else {
        warnings.push(`Fewer elements than recommended (${transformed.length} < ${rules.minElements})`);
        score -= 15;
      }
    }

    if (transformed.length > rules.maxElements) {
      errors.push(`Too many elements (${transformed.length} > ${rules.maxElements})`);
      score -= 20;
    }

    // Check for titles
    if (rules.preserveTitles) {
      const hasTitle = transformed.some(el => el.fontSize && el.fontSize > 36);
      if (!hasTitle) {
        errors.push("Title element missing");
        score -= 40;
      }
    }

    // Check for images
    if (rules.preserveImages) {
      const originalImages = original.filter(el => el.type === 'image' || el.src).length;
      const transformedImages = transformed.filter(el => el.type === 'image' || el.src).length;

      if (transformedImages < originalImages) {
        warnings.push("Some images were removed");
        score -= 10;
      }
    }

    // Check font sizes
    for (const el of transformed) {
      if (el.fontSize) {
        if (el.fontSize < rules.minFontSize) {
          errors.push(`Font too small: ${el.fontSize}px`);
          score -= 15;
        }
        if (el.fontSize > rules.maxFontSize) {
          errors.push(`Font too large: ${el.fontSize}px`);
          score -= 10;
        }
      }
    }

    const isValid = errors.length === 0;

    // More forgiving recommendation logic:
    // - accept: no errors, no warnings, score >= 90
    // - accept_with_warnings: no critical errors, score >= 60
    // - reject: critical errors or score < 60
    let recommendation: ValidationResult['recommendation'];

    if (isValid && warnings.length === 0 && score >= 90) {
      recommendation = 'accept';
    } else if (isValid && score >= 70) {
      recommendation = 'accept_with_warnings';
    } else if (score >= 60 && errors.length <= 1) {
      // Minor errors but still acceptable
      recommendation = 'accept_with_warnings';
    } else {
      recommendation = 'reject';
    }

    return {
      isValid,
      errors,
      warnings,
      score: Math.max(0, score),
      recommendation
    };
  }

  /**
   * Generate safety report
   */
  private generateSafetyReport(
    allOps: IntelligentOperation[],
    validatedOps: IntelligentOperation[],
    rules: SafetyRules
  ) {
    const rulesApplied: string[] = [];

    if (rules.preserveTitles) rulesApplied.push("Title preservation");
    if (rules.preserveImages) rulesApplied.push("Image preservation");
    if (!rules.allowDelete) rulesApplied.push("No deletion allowed");
    rulesApplied.push(`Element count: ${rules.minElements}-${rules.maxElements}`);
    rulesApplied.push(`Font size: ${rules.minFontSize}-${rules.maxFontSize}px`);

    const operationsRejected = allOps.length - validatedOps.length;
    const operationsAccepted = validatedOps.length;
    const overallSafety = allOps.length > 0
      ? Math.round((operationsAccepted / allOps.length) * 100)
      : 100;

    return {
      rulesApplied,
      operationsRejected,
      operationsAccepted,
      overallSafety
    };
  }

  /**
   * Print safety rules
   */
  private printSafetyRules(rules: SafetyRules): void {
    console.log(`   ${rules.preserveTitles ? '✓' : '✗'} Preserve titles`);
    console.log(`   ${rules.preserveImages ? '✓' : '✗'} Preserve images`);
    console.log(`   ↔ Elements: ${rules.minElements}-${rules.maxElements}`);
    console.log(`   ↔ Font size: ${rules.minFontSize}-${rules.maxFontSize}px`);
    console.log(`   ${rules.allowDelete ? '✓' : '✗'} Allow delete`);
    console.log(`   ${rules.allowCreate ? '✓' : '✗'} Allow create`);
  }

  /**
   * Print results
   */
  private printResults(result: IntelligentTransformResult): void {
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║              TRANSFORMATION COMPLETE                         ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");

    console.log(`\n📊 Results:`);
    console.log(`   Elements: ${result.originalSchema.length} → ${result.transformedSchema.length}`);
    console.log(`   Operations: ${result.operations.length}`);
    console.log(`   Rejected: ${result.safetyReport.operationsRejected}`);
    console.log(`   Improvement: ${result.improvementScore > 0 ? '+' : ''}${result.improvementScore} points`);

    console.log(`\n🛡️  Safety:`);
    console.log(`   Overall: ${result.safetyReport.overallSafety}%`);
    console.log(`   Validation: ${result.validation.score}/100`);
    console.log(`   Status: ${result.validation.recommendation.toUpperCase()}`);

    if (result.validation.errors.length > 0) {
      console.log(`\n❌ Errors: ${result.validation.errors.length}`);
      result.validation.errors.forEach(err => console.log(`   - ${err}`));
    }

    if (result.validation.warnings.length > 0) {
      console.log(`\n⚠️  Warnings: ${result.validation.warnings.length}`);
      result.validation.warnings.forEach(warn => console.log(`   - ${warn}`));
    }

    console.log("");
  }
}
