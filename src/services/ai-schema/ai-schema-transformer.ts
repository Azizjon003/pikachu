/**
 * AI Schema Transformer
 *
 * Revolutionary AI-powered system that transforms slide schemas with:
 * - Creative layout redesign
 * - Intelligent element repositioning
 * - Dynamic sizing based on content importance
 * - Modern design trends application
 * - Multi-strategy optimization
 *
 * This transforms boring templates into visually stunning presentations!
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

export interface TransformationStrategy {
  name: string;
  description: string;
  aggressiveness: "conservative" | "moderate" | "bold" | "radical";
  applyTo: "all" | "primary" | "secondary" | "problematic";
}

export interface TransformationResult {
  originalSchema: SchemaElement[];
  transformedSchema: SchemaElement[];
  analysis: LayoutAnalysis;
  insights: CreativeInsights;
  strategy: TransformationStrategy;
  changes: {
    element: number;
    oldValues: Partial<SchemaElement>;
    newValues: Partial<SchemaElement>;
    reason: string;
  }[];
  improvementScore: number;
}

export interface TransformOptions {
  strategy?: TransformationStrategy;
  preserveTitles?: boolean;
  maxChanges?: number;
  creativityLevel?: number; // 0-1, higher = more creative
  targetAesthetic?: "modern" | "classic" | "minimal" | "bold" | "elegant";
}

export class AISchemaTransformer {
  private openaiService: OpenAIService;
  private analyzer: CreativeLayoutAnalyzer;
  private slideWidth: number;
  private slideHeight: number;

  // Predefined transformation strategies
  public readonly strategies: TransformationStrategy[] = [
    {
      name: "Modern Refresh",
      description: "Apply modern design principles with clean lines and whitespace",
      aggressiveness: "moderate",
      applyTo: "all"
    },
    {
      name: "Bold Impact",
      description: "Create striking visual impact with dramatic sizing and positioning",
      aggressiveness: "bold",
      applyTo: "primary"
    },
    {
      name: "Minimal Elegance",
      description: "Simplify and refine for elegant, minimalist aesthetic",
      aggressiveness: "moderate",
      applyTo: "all"
    },
    {
      name: "Problem Solver",
      description: "Fix layout issues while maintaining original design intent",
      aggressiveness: "conservative",
      applyTo: "problematic"
    },
    {
      name: "Creative Revolution",
      description: "Completely reimagine the layout with bold creative choices",
      aggressiveness: "radical",
      applyTo: "all"
    }
  ];

  constructor(slideWidth: number = 1920, slideHeight: number = 1080) {
    this.openaiService = getOpenAIService();
    this.analyzer = new CreativeLayoutAnalyzer(slideWidth, slideHeight);
    this.slideWidth = slideWidth;
    this.slideHeight = slideHeight;
  }

  /**
   * Transform schema with AI creativity
   */
  async transformSchema(
    elements: SchemaElement[],
    options: TransformOptions = {}
  ): Promise<TransformationResult> {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║         AI SCHEMA TRANSFORMATION STARTED                   ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    // Step 1: Analyze current layout
    console.log("🔍 Step 1: Analyzing current layout...");
    const analysis = this.analyzer.analyzeLayout(elements);

    // Step 2: Get AI creative insights
    console.log("\n🎨 Step 2: Getting AI creative insights...");
    const insights = await this.analyzer.analyzeWithAI(elements);

    // Step 3: Select or use provided strategy
    const strategy = options.strategy || this.selectBestStrategy(analysis, insights);
    console.log(`\n🎯 Step 3: Using strategy: "${strategy.name}"`);
    console.log(`   Aggressiveness: ${strategy.aggressiveness}`);

    // Step 4: Generate transformations with AI
    console.log("\n🚀 Step 4: Generating AI-powered transformations...");
    const transformedSchema = await this.generateTransformations(
      elements,
      analysis,
      insights,
      strategy,
      options
    );

    // Step 5: Calculate improvement
    const newAnalysis = this.analyzer.analyzeLayout(transformedSchema);
    const improvementScore = newAnalysis.aestheticScore - analysis.aestheticScore;

    // Track changes
    const changes = this.trackChanges(elements, transformedSchema, insights);

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║         TRANSFORMATION COMPLETE                            ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log(`\n✨ Aesthetic Score: ${analysis.aestheticScore} → ${newAnalysis.aestheticScore}`);
    console.log(`   Improvement: ${improvementScore > 0 ? '+' : ''}${improvementScore} points`);
    console.log(`   Changes Applied: ${changes.length}`);
    console.log(`   Strategy: ${strategy.name}\n`);

    return {
      originalSchema: elements,
      transformedSchema,
      analysis,
      insights,
      strategy,
      changes,
      improvementScore
    };
  }

  /**
   * Generate transformations using AI
   */
  private async generateTransformations(
    elements: SchemaElement[],
    analysis: LayoutAnalysis,
    insights: CreativeInsights,
    strategy: TransformationStrategy,
    options: TransformOptions
  ): Promise<SchemaElement[]> {
    const creativityLevel = options.creativityLevel ?? 0.7;
    const maxChanges = options.maxChanges ?? elements.length;

    const prompt = this.buildTransformationPrompt(
      elements,
      analysis,
      insights,
      strategy,
      options
    );

    try {
      const result = await this.openaiService.createJsonCompletion({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a master presentation designer who transforms layouts into visually stunning slides.

Your expertise:
- Modern design trends (2024-2025)
- Typography and visual hierarchy
- Color psychology and contrast
- Information architecture
- User attention and cognition
- International design standards

You make bold, creative decisions that dramatically improve visual impact while maintaining professionalism.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7 + (creativityLevel * 0.3), // 0.7-1.0 range
        maxTokens: 4000
      });
      const transformed = this.applyAITransformations(elements, result.transformations, maxChanges);

      console.log(`   ✓ AI generated ${result.transformations.length} transformations`);
      console.log(`   ✓ Applied ${Math.min(result.transformations.length, maxChanges)} changes`);

      return transformed;
    } catch (error) {
      console.error("   ❌ AI transformation failed, using fallback:", error);
      return this.applyFallbackTransformations(elements, analysis, strategy);
    }
  }

  /**
   * Build transformation prompt for AI
   */
  private buildTransformationPrompt(
    elements: SchemaElement[],
    analysis: LayoutAnalysis,
    insights: CreativeInsights,
    strategy: TransformationStrategy,
    options: TransformOptions
  ): string {
    const elementsSummary = elements.map((el, idx) => ({
      index: idx,
      type: el.type,
      left: el.left,
      top: el.top,
      width: el.width,
      height: el.height,
      fontSize: el.fontSize,
      content: el.content?.substring(0, 50),
      isTitle: el.type === 'text' && (el.fontSize || 0) > 36
    }));

    return `Transform this slide layout to make it visually stunning!

SLIDE: ${this.slideWidth}x${this.slideHeight}px

CURRENT LAYOUT:
${JSON.stringify(elementsSummary, null, 2)}

CURRENT ANALYSIS:
- Aesthetic Score: ${analysis.aestheticScore}/100
- Balance: ${analysis.designPrinciples.balance}/100
- Whitespace: ${analysis.designPrinciples.whitespace}/100
- Alignment: ${analysis.designPrinciples.alignment}/100

AI INSIGHTS:
- Style: ${insights.style}
- Mood: ${insights.mood}
- Target: ${insights.targetAudience}

STRATEGY: ${strategy.name} (${strategy.aggressiveness})
${strategy.description}

TARGET AESTHETIC: ${options.targetAesthetic || insights.style}

PRESERVE TITLES: ${options.preserveTitles ? 'Yes' : 'No'}

INSTRUCTIONS:
1. ${this.getStrategyInstructions(strategy)}
2. Improve visual hierarchy - make important elements STAND OUT
3. Add breathing room - increase whitespace where needed
4. Perfect alignment - create visual flow
5. Modern proportions - use golden ratio (1.618) when possible
6. Be BOLD and CREATIVE - this is your chance to shine!

Return JSON:
{
  "transformations": [
    {
      "element": 0,
      "reasoning": "Why this change makes the design better",
      "changes": {
        "left": 150,
        "top": 100,
        "width": 1200,
        "height": 120,
        "fontSize": 64
      },
      "impact": "high/medium/low",
      "designPrinciple": "hierarchy/balance/whitespace/alignment"
    }
  ],
  "overallVision": "Brief description of the new design direction"
}

Be creative! Make transformations that will WOW the audience!`;
  }

  /**
   * Get strategy-specific instructions
   */
  private getStrategyInstructions(strategy: TransformationStrategy): string {
    switch (strategy.aggressiveness) {
      case "conservative":
        return "Make subtle improvements that fix issues while preserving the original design";
      case "moderate":
        return "Apply modern design principles with noticeable but tasteful changes";
      case "bold":
        return "Make dramatic changes that create strong visual impact";
      case "radical":
        return "Completely reimagine the layout with revolutionary design choices";
      default:
        return "Apply balanced improvements";
    }
  }

  /**
   * Apply AI-generated transformations
   */
  private applyAITransformations(
    elements: SchemaElement[],
    transformations: any[],
    maxChanges: number
  ): SchemaElement[] {
    const transformed = elements.map(el => ({ ...el }));

    // Sort by impact and apply top changes
    const sorted = transformations
      .filter(t => t.element >= 0 && t.element < elements.length)
      .sort((a, b) => {
        const impactOrder = { high: 0, medium: 1, low: 2 };
        return impactOrder[a.impact as keyof typeof impactOrder] -
               impactOrder[b.impact as keyof typeof impactOrder];
      })
      .slice(0, maxChanges);

    sorted.forEach(t => {
      const element = transformed[t.element];
      if (element && t.changes) {
        // Apply changes with validation
        if (t.changes.left !== undefined) {
          element.left = Math.max(0, Math.min(this.slideWidth - element.width, t.changes.left));
        }
        if (t.changes.top !== undefined) {
          element.top = Math.max(0, Math.min(this.slideHeight - element.height, t.changes.top));
        }
        if (t.changes.width !== undefined) {
          element.width = Math.max(50, Math.min(this.slideWidth, t.changes.width));
        }
        if (t.changes.height !== undefined) {
          element.height = Math.max(20, Math.min(this.slideHeight, t.changes.height));
        }
        if (t.changes.fontSize !== undefined && element.type === 'text') {
          element.fontSize = Math.max(12, Math.min(120, t.changes.fontSize));
        }

        console.log(`   → Element ${t.element}: ${t.reasoning}`);
      }
    });

    return transformed;
  }

  /**
   * Apply fallback transformations if AI fails
   */
  private applyFallbackTransformations(
    elements: SchemaElement[],
    analysis: LayoutAnalysis,
    strategy: TransformationStrategy
  ): SchemaElement[] {
    const transformed = elements.map(el => ({ ...el }));

    // Apply rule-based improvements
    if (analysis.designPrinciples.whitespace < 30) {
      // Increase spacing
      transformed.forEach(el => {
        el.width = Math.max(50, el.width * 0.9);
        el.height = Math.max(20, el.height * 0.9);
      });
    }

    if (analysis.designPrinciples.balance < 60) {
      // Improve balance
      const centerX = this.slideWidth / 2;
      transformed.forEach(el => {
        const elCenter = el.left + el.width / 2;
        if (Math.abs(elCenter - centerX) > 200) {
          el.left += (centerX - elCenter) * 0.2;
        }
      });
    }

    return transformed;
  }

  /**
   * Select best strategy based on analysis
   */
  private selectBestStrategy(
    analysis: LayoutAnalysis,
    insights: CreativeInsights
  ): TransformationStrategy {
    if (analysis.aestheticScore < 50) {
      return this.strategies[4]; // Creative Revolution
    } else if (analysis.improvementOpportunities.length > 3) {
      return this.strategies[3]; // Problem Solver
    } else if (insights.style === "modern") {
      return this.strategies[0]; // Modern Refresh
    } else if (insights.style === "bold") {
      return this.strategies[1]; // Bold Impact
    } else {
      return this.strategies[2]; // Minimal Elegance
    }
  }

  /**
   * Track changes between original and transformed
   */
  private trackChanges(
    original: SchemaElement[],
    transformed: SchemaElement[],
    insights: CreativeInsights
  ) {
    const changes: TransformationResult['changes'] = [];

    original.forEach((orig, idx) => {
      const trans = transformed[idx];
      if (!trans) return;

      const oldValues: Partial<SchemaElement> = {};
      const newValues: Partial<SchemaElement> = {};
      let hasChanges = false;

      if (orig.left !== trans.left) {
        oldValues.left = orig.left;
        newValues.left = trans.left;
        hasChanges = true;
      }
      if (orig.top !== trans.top) {
        oldValues.top = orig.top;
        newValues.top = trans.top;
        hasChanges = true;
      }
      if (orig.width !== trans.width) {
        oldValues.width = orig.width;
        newValues.width = trans.width;
        hasChanges = true;
      }
      if (orig.height !== trans.height) {
        oldValues.height = orig.height;
        newValues.height = trans.height;
        hasChanges = true;
      }
      if (orig.fontSize !== trans.fontSize) {
        oldValues.fontSize = orig.fontSize;
        newValues.fontSize = trans.fontSize;
        hasChanges = true;
      }

      if (hasChanges) {
        const suggestedChange = insights.suggestedChanges.find(c => c.element === idx);
        changes.push({
          element: idx,
          oldValues,
          newValues,
          reason: suggestedChange?.reason || "Layout optimization"
        });
      }
    });

    return changes;
  }
}
