/**
 * Advanced AI Schema Transformer
 *
 * Revolutionary AI system with FULL CREATIVE FREEDOM:
 * ✅ Create new elements
 * ✅ Delete unnecessary elements
 * ✅ Merge similar elements
 * ✅ Duplicate important elements
 * ✅ Reorder elements
 * ✅ Change element types
 * ✅ Add decorative elements
 * ✅ Apply design patterns
 *
 * This is the ULTIMATE presentation design AI!
 */

import * as dotenv from "dotenv";
import {
  CreativeLayoutAnalyzer,
  type SchemaElement,
  type LayoutAnalysis,
  type CreativeInsights
} from "./creative-layout-analyzer";
import { getOpenAIService, OpenAIService } from "../openai";

dotenv.config();

export interface ElementOperation {
  type: "create" | "delete" | "modify" | "merge" | "duplicate" | "reorder";
  elementIndex?: number;
  newElement?: Partial<SchemaElement>;
  targetIndices?: number[];
  reasoning: string;
  priority: "critical" | "high" | "medium" | "low";
  designPrinciple: string;
}

export interface AdvancedTransformationResult {
  originalSchema: SchemaElement[];
  transformedSchema: SchemaElement[];
  operations: ElementOperation[];
  analysis: {
    before: LayoutAnalysis;
    after: LayoutAnalysis;
  };
  insights: CreativeInsights;
  statistics: {
    elementsCreated: number;
    elementsDeleted: number;
    elementsModified: number;
    elementsMerged: number;
    elementsDuplicated: number;
    totalOperations: number;
  };
  improvementScore: number;
  transformationSummary: string;
}

export interface AdvancedTransformOptions {
  allowCreate: boolean;
  allowDelete: boolean;
  allowMerge: boolean;
  allowDuplicate: boolean;
  creativityLevel: number; // 0-1
  targetAesthetic: "modern" | "classic" | "minimal" | "bold" | "elegant";
  preserveTitles: boolean;
  maxOperations: number;
  aggressiveness: "conservative" | "moderate" | "bold" | "radical";
}

export class AdvancedAITransformer {
  private openaiService: OpenAIService;
  private analyzer: CreativeLayoutAnalyzer;
  private slideWidth: number;
  private slideHeight: number;

  constructor(slideWidth: number = 1920, slideHeight: number = 1080) {
    this.openaiService = getOpenAIService();
    this.analyzer = new CreativeLayoutAnalyzer(slideWidth, slideHeight);
    this.slideWidth = slideWidth;
    this.slideHeight = slideHeight;
  }

  /**
   * Transform schema with FULL AI POWER - create, delete, modify everything!
   */
  async advancedTransform(
    elements: SchemaElement[],
    options: Partial<AdvancedTransformOptions> = {}
  ): Promise<AdvancedTransformationResult> {
    const opts: AdvancedTransformOptions = {
      allowCreate: true,
      allowDelete: true,
      allowMerge: true,
      allowDuplicate: true,
      creativityLevel: 0.85,
      targetAesthetic: "modern",
      preserveTitles: true,
      maxOperations: 15,
      aggressiveness: "bold",
      ...options
    };

    console.log("\n╔═══════════════════════════════════════════════════════════════╗");
    console.log("║     ADVANCED AI TRANSFORMATION - FULL CREATIVE FREEDOM        ║");
    console.log("╚═══════════════════════════════════════════════════════════════╝\n");

    console.log(`🎨 Permissions:`);
    console.log(`   ✓ Create Elements: ${opts.allowCreate ? '✅' : '❌'}`);
    console.log(`   ✓ Delete Elements: ${opts.allowDelete ? '✅' : '❌'}`);
    console.log(`   ✓ Merge Elements: ${opts.allowMerge ? '✅' : '❌'}`);
    console.log(`   ✓ Duplicate Elements: ${opts.allowDuplicate ? '✅' : '❌'}`);
    console.log(`   ✓ Creativity Level: ${(opts.creativityLevel * 100).toFixed(0)}%`);
    console.log(`   ✓ Aggressiveness: ${opts.aggressiveness}\n`);

    // Step 1: Initial analysis
    perfMonitor.startStage('Initial Analysis');
    console.log("🔍 Step 1: Analyzing current layout...");
    const beforeAnalysis = this.analyzer.analyzeLayout(elements);
    const insights = await this.analyzer.analyzeWithAI(elements);
    perfMonitor.endStage('Initial Analysis');

    // Step 2: Get AI operations
    perfMonitor.startStage('AI Operations Generation');
    console.log("\n🤖 Step 2: AI generating creative operations...");
    const operations = await this.generateOperations(elements, beforeAnalysis, insights, opts);
    perfMonitor.endStage('AI Operations Generation');

    // Step 3: Apply operations
    perfMonitor.startStage('Operations Application');
    console.log("\n⚡ Step 3: Applying transformations...");
    const transformedSchema = this.applyOperations(elements, operations, opts);
    perfMonitor.endStage('Operations Application');

    // Step 4: Final analysis
    console.log("\n📊 Step 4: Analyzing results...");
    const afterAnalysis = this.analyzer.analyzeLayout(transformedSchema);

    // Calculate statistics
    const stats = this.calculateStatistics(operations);
    const improvementScore = afterAnalysis.aestheticScore - beforeAnalysis.aestheticScore;

    console.log("\n╔═══════════════════════════════════════════════════════════════╗");
    console.log("║              TRANSFORMATION COMPLETE                          ║");
    console.log("╚═══════════════════════════════════════════════════════════════╝");
    console.log(`\n✨ Results:`);
    console.log(`   Elements: ${elements.length} → ${transformedSchema.length}`);
    console.log(`   Created: ${stats.elementsCreated} | Deleted: ${stats.elementsDeleted}`);
    console.log(`   Modified: ${stats.elementsModified} | Merged: ${stats.elementsMerged}`);
    console.log(`   Aesthetic: ${beforeAnalysis.aestheticScore} → ${afterAnalysis.aestheticScore} (${improvementScore > 0 ? '+' : ''}${improvementScore})`);
    console.log(`   Total Operations: ${stats.totalOperations}\n`);

    return {
      originalSchema: elements,
      transformedSchema,
      operations,
      analysis: {
        before: beforeAnalysis,
        after: afterAnalysis
      },
      insights,
      statistics: stats,
      improvementScore,
      transformationSummary: this.generateSummary(operations, stats, improvementScore)
    };
  }

  /**
   * Generate AI operations with full creative freedom
   */
  private async generateOperations(
    elements: SchemaElement[],
    analysis: LayoutAnalysis,
    insights: CreativeInsights,
    options: AdvancedTransformOptions
  ): Promise<ElementOperation[]> {
    const prompt = this.buildAdvancedPrompt(elements, analysis, insights, options);

    try {
      const result = await this.openaiService.createJsonCompletion({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an ELITE presentation designer with FULL CREATIVE FREEDOM.

Your powers:
✅ CREATE new elements (shapes, text, images, icons)
✅ DELETE unnecessary/redundant elements
✅ MODIFY any element property
✅ MERGE similar elements into cohesive units
✅ DUPLICATE important elements for emphasis
✅ REORDER elements for better flow

Your expertise:
- Visual storytelling and narrative flow
- Color theory and contrast
- Typography and readability
- Modern design trends (2024-2025)
- Information hierarchy
- Cognitive psychology
- International design standards

Be BOLD. Be CREATIVE. Make designs that WOW!`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.8 + (options.creativityLevel * 0.2), // 0.8-1.0
        maxTokens: 6000
      });
      const operations = this.parseOperations(result.operations || [], options);

      console.log(`   ✓ AI generated ${operations.length} operations`);
      this.printOperationsSummary(operations);

      return operations.slice(0, options.maxOperations);
    } catch (error) {
      console.error("   ❌ AI operation generation failed:", error);
      return this.generateFallbackOperations(elements, analysis);
    }
  }

  /**
   * Build advanced prompt for AI
   */
  private buildAdvancedPrompt(
    elements: SchemaElement[],
    analysis: LayoutAnalysis,
    insights: CreativeInsights,
    options: AdvancedTransformOptions
  ): string {
    const elementsSummary = elements.map((el, idx) => ({
      index: idx,
      type: el.type,
      left: el.left,
      top: el.top,
      width: el.width,
      height: el.height,
      fontSize: el.fontSize,
      content: el.content?.substring(0, 40)
    }));

    return `Transform this slide with FULL CREATIVE FREEDOM!

CANVAS: ${this.slideWidth}x${this.slideHeight}px

CURRENT ELEMENTS:
${JSON.stringify(elementsSummary, null, 2)}

ANALYSIS:
- Aesthetic Score: ${analysis.aestheticScore}/100
- Balance: ${analysis.designPrinciples.balance}/100
- Whitespace: ${analysis.designPrinciples.whitespace}/100
- Crowded Areas: ${analysis.densityMap.crowdedAreas.length}
- Empty Areas: ${analysis.densityMap.emptyAreas.length}

AI INSIGHTS:
- Style: ${insights.style}
- Mood: ${insights.mood}
- Target: ${insights.targetAudience}

YOUR POWERS:
${options.allowCreate ? '✅ CREATE new elements' : '❌ No creation'}
${options.allowDelete ? '✅ DELETE elements' : '❌ No deletion'}
${options.allowMerge ? '✅ MERGE elements' : '❌ No merging'}
${options.allowDuplicate ? '✅ DUPLICATE elements' : '❌ No duplication'}

TARGET: ${options.targetAesthetic} aesthetic
AGGRESSIVENESS: ${options.aggressiveness}
PRESERVE TITLES: ${options.preserveTitles}

INSTRUCTIONS:
1. Analyze what's working and what's not
2. ${this.getAggressivenessInstructions(options.aggressiveness)}
3. CREATE new elements when needed (backgrounds, accents, dividers, icons)
4. DELETE redundant or distracting elements
5. MERGE similar elements to reduce clutter
6. DUPLICATE important content for emphasis
7. Apply modern design principles (golden ratio, rule of thirds)
8. Make it MEMORABLE and IMPACTFUL!

Return JSON with this structure:
{
  "vision": "Overall design direction and goals",
  "operations": [
    {
      "type": "create",
      "newElement": {
        "type": "shape",
        "elementIndex": -1,
        "left": 0,
        "top": 0,
        "width": 100,
        "height": 5,
        "backgroundColor": "#007AFF"
      },
      "reasoning": "Add accent line for visual interest",
      "priority": "high",
      "designPrinciple": "visual interest"
    },
    {
      "type": "delete",
      "elementIndex": 3,
      "reasoning": "Redundant element cluttering layout",
      "priority": "medium",
      "designPrinciple": "simplicity"
    },
    {
      "type": "modify",
      "elementIndex": 0,
      "changes": {
        "fontSize": 64,
        "left": 150,
        "width": 1200
      },
      "reasoning": "Increase prominence",
      "priority": "critical",
      "designPrinciple": "hierarchy"
    },
    {
      "type": "merge",
      "targetIndices": [2, 4],
      "newElement": {
        "type": "text",
        "content": "merged content",
        "left": 100,
        "top": 200,
        "width": 800,
        "height": 150
      },
      "reasoning": "Combine related content",
      "priority": "medium",
      "designPrinciple": "cohesion"
    },
    {
      "type": "duplicate",
      "elementIndex": 1,
      "newElement": {
        "left": 500,
        "top": 600
      },
      "reasoning": "Emphasize important content",
      "priority": "low",
      "designPrinciple": "emphasis"
    }
  ]
}

Be CREATIVE! This is your chance to create a MASTERPIECE!`;
  }

  /**
   * Get instructions based on aggressiveness
   */
  private getAggressivenessInstructions(aggressiveness: AdvancedTransformOptions['aggressiveness']): string {
    const instructions = {
      conservative: "Make subtle improvements while preserving the overall structure",
      moderate: "Apply significant improvements with noticeable but balanced changes",
      bold: "Make dramatic changes that transform the visual impact",
      radical: "Complete creative redesign - reimagine everything!"
    };
    return instructions[aggressiveness];
  }

  /**
   * Parse and validate operations from AI
   */
  private parseOperations(
    rawOps: any[],
    options: AdvancedTransformOptions
  ): ElementOperation[] {
    const operations: ElementOperation[] = [];

    for (const op of rawOps) {
      // Validate operation type
      if (!op.type || !['create', 'delete', 'modify', 'merge', 'duplicate', 'reorder'].includes(op.type)) {
        continue;
      }

      // Check permissions
      if (op.type === 'create' && !options.allowCreate) continue;
      if (op.type === 'delete' && !options.allowDelete) continue;
      if (op.type === 'merge' && !options.allowMerge) continue;
      if (op.type === 'duplicate' && !options.allowDuplicate) continue;

      operations.push({
        type: op.type,
        elementIndex: op.elementIndex,
        newElement: op.newElement,
        targetIndices: op.targetIndices,
        reasoning: op.reasoning || 'No reason provided',
        priority: op.priority || 'medium',
        designPrinciple: op.designPrinciple || 'improvement'
      });
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return operations.sort((a, b) =>
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }

  /**
   * Apply all operations to schema
   */
  private applyOperations(
    elements: SchemaElement[],
    operations: ElementOperation[],
    options: AdvancedTransformOptions
  ): SchemaElement[] {
    let schema = elements.map(el => ({ ...el }));
    const deletedIndices = new Set<number>();

    for (const op of operations) {
      console.log(`   → ${op.type.toUpperCase()}: ${op.reasoning}`);

      switch (op.type) {
        case 'create':
          schema = this.applyCreate(schema, op);
          break;

        case 'delete':
          if (op.elementIndex !== undefined) {
            deletedIndices.add(op.elementIndex);
          }
          break;

        case 'modify':
          schema = this.applyModify(schema, op, deletedIndices);
          break;

        case 'merge':
          schema = this.applyMerge(schema, op, deletedIndices);
          break;

        case 'duplicate':
          schema = this.applyDuplicate(schema, op, deletedIndices);
          break;
      }
    }

    // Apply deletions
    schema = schema.filter((_, idx) => !deletedIndices.has(idx));

    // Reassign element indices
    schema.forEach((el, idx) => {
      el.elementIndex = idx;
    });

    return schema;
  }

  /**
   * Create new element
   */
  private applyCreate(schema: SchemaElement[], op: ElementOperation): SchemaElement[] {
    if (!op.newElement) return schema;

    const newEl: SchemaElement = {
      type: op.newElement.type || 'shape',
      elementIndex: schema.length,
      left: Math.max(0, Math.min(this.slideWidth - 100, op.newElement.left || 0)),
      top: Math.max(0, Math.min(this.slideHeight - 100, op.newElement.top || 0)),
      width: Math.max(10, Math.min(this.slideWidth, op.newElement.width || 100)),
      height: Math.max(10, Math.min(this.slideHeight, op.newElement.height || 100)),
      ...op.newElement
    };

    return [...schema, newEl];
  }

  /**
   * Modify existing element
   */
  private applyModify(
    schema: SchemaElement[],
    op: ElementOperation,
    deletedIndices: Set<number>
  ): SchemaElement[] {
    if (op.elementIndex === undefined || deletedIndices.has(op.elementIndex)) {
      return schema;
    }

    const element = schema[op.elementIndex];
    if (!element || !op.newElement) return schema;

    const changes = op.newElement;

    if (changes.left !== undefined) {
      element.left = Math.max(0, Math.min(this.slideWidth - element.width, changes.left));
    }
    if (changes.top !== undefined) {
      element.top = Math.max(0, Math.min(this.slideHeight - element.height, changes.top));
    }
    if (changes.width !== undefined) {
      element.width = Math.max(10, Math.min(this.slideWidth, changes.width));
    }
    if (changes.height !== undefined) {
      element.height = Math.max(10, Math.min(this.slideHeight, changes.height));
    }
    if (changes.fontSize !== undefined && element.type === 'text') {
      element.fontSize = Math.max(8, Math.min(200, changes.fontSize));
    }

    return schema;
  }

  /**
   * Merge multiple elements
   */
  private applyMerge(
    schema: SchemaElement[],
    op: ElementOperation,
    deletedIndices: Set<number>
  ): SchemaElement[] {
    if (!op.targetIndices || !op.newElement) return schema;

    const validIndices = op.targetIndices.filter(idx => !deletedIndices.has(idx));
    if (validIndices.length < 2) return schema;

    // Mark targets for deletion
    validIndices.forEach(idx => deletedIndices.add(idx));

    // Create merged element
    const merged: SchemaElement = {
      type: op.newElement.type || 'text',
      elementIndex: schema.length,
      left: op.newElement.left || 0,
      top: op.newElement.top || 0,
      width: op.newElement.width || 100,
      height: op.newElement.height || 100,
      ...op.newElement
    };

    return [...schema, merged];
  }

  /**
   * Duplicate element
   */
  private applyDuplicate(
    schema: SchemaElement[],
    op: ElementOperation,
    deletedIndices: Set<number>
  ): SchemaElement[] {
    if (op.elementIndex === undefined || deletedIndices.has(op.elementIndex)) {
      return schema;
    }

    const original = schema[op.elementIndex];
    if (!original) return schema;

    const duplicate: SchemaElement = {
      ...original,
      elementIndex: schema.length,
      left: op.newElement?.left ?? original.left + 50,
      top: op.newElement?.top ?? original.top + 50
    };

    return [...schema, duplicate];
  }

  /**
   * Generate fallback operations if AI fails
   */
  private generateFallbackOperations(
    elements: SchemaElement[],
    analysis: LayoutAnalysis
  ): ElementOperation[] {
    const operations: ElementOperation[] = [];

    // Add whitespace if too crowded
    if (analysis.designPrinciples.whitespace < 30) {
      operations.push({
        type: 'modify',
        elementIndex: 0,
        newElement: { width: elements[0].width * 0.9 },
        reasoning: 'Increase whitespace',
        priority: 'medium',
        designPrinciple: 'whitespace'
      });
    }

    return operations;
  }

  /**
   * Calculate statistics
   */
  private calculateStatistics(operations: ElementOperation[]) {
    return {
      elementsCreated: operations.filter(op => op.type === 'create').length,
      elementsDeleted: operations.filter(op => op.type === 'delete').length,
      elementsModified: operations.filter(op => op.type === 'modify').length,
      elementsMerged: operations.filter(op => op.type === 'merge').length,
      elementsDuplicated: operations.filter(op => op.type === 'duplicate').length,
      totalOperations: operations.length
    };
  }

  /**
   * Print operations summary
   */
  private printOperationsSummary(operations: ElementOperation[]): void {
    const counts = this.calculateStatistics(operations);
    console.log(`   → Create: ${counts.elementsCreated}`);
    console.log(`   → Delete: ${counts.elementsDeleted}`);
    console.log(`   → Modify: ${counts.elementsModified}`);
    console.log(`   → Merge: ${counts.elementsMerged}`);
    console.log(`   → Duplicate: ${counts.elementsDuplicated}`);
  }

  /**
   * Generate transformation summary
   */
  private generateSummary(
    operations: ElementOperation[],
    stats: AdvancedTransformationResult['statistics'],
    improvementScore: number
  ): string {
    return `Advanced AI transformation applied ${stats.totalOperations} operations: ` +
           `created ${stats.elementsCreated}, deleted ${stats.elementsDeleted}, ` +
           `modified ${stats.elementsModified}, merged ${stats.elementsMerged}, ` +
           `duplicated ${stats.elementsDuplicated}. ` +
           `Aesthetic improvement: ${improvementScore > 0 ? '+' : ''}${improvementScore} points.`;
  }
}

// Helper for performance monitoring
const perfMonitor = {
  startStage: (name: string) => console.log(`🔄 ${name}...`),
  endStage: (name: string) => console.log(`✓ ${name} complete`)
};
