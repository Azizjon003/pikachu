/**
 * Creative Layout Analyzer
 *
 * AI-powered schema analysis system that understands:
 * - Visual hierarchy and importance
 * - Content density and readability
 * - Aesthetic principles (golden ratio, rule of thirds, etc.)
 * - Modern design trends
 * - Cultural and contextual considerations
 */

import * as dotenv from "dotenv";
import { getOpenAIService, OpenAIService } from "../openai";

dotenv.config();

export interface SchemaElement {
  type: string;
  elementIndex: number;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize?: number;
  content?: string;
  src?: string;
  placeholder?: string;
  [key: string]: any;
}

export interface LayoutAnalysis {
  visualHierarchy: {
    primaryElements: number[];
    secondaryElements: number[];
    tertiaryElements: number[];
  };
  densityMap: {
    crowdedAreas: { x: number; y: number; width: number; height: number }[];
    emptyAreas: { x: number; y: number; width: number; height: number }[];
  };
  aestheticScore: number;
  improvementOpportunities: {
    area: string;
    suggestion: string;
    priority: "high" | "medium" | "low";
  }[];
  designPrinciples: {
    balance: number; // 0-100
    alignment: number;
    contrast: number;
    whitespace: number;
    harmony: number;
  };
}

export interface CreativeInsights {
  mood: string;
  style: "modern" | "classic" | "minimal" | "bold" | "elegant";
  targetAudience: string;
  contentType: "title" | "content" | "data" | "media";
  suggestedChanges: {
    element: number;
    reason: string;
    changes: Partial<SchemaElement>;
  }[];
}

export class CreativeLayoutAnalyzer {
  private openaiService: OpenAIService;
  private slideWidth: number;
  private slideHeight: number;

  constructor(slideWidth: number = 1920, slideHeight: number = 1080) {
    this.openaiService = getOpenAIService();
    this.slideWidth = slideWidth;
    this.slideHeight = slideHeight;
  }

  /**
   * Analyze slide layout with AI for creative insights
   */
  async analyzeWithAI(elements: SchemaElement[]): Promise<CreativeInsights> {
    console.log("\n🎨 AI Creative Analysis: Understanding layout...");

    const prompt = this.buildAnalysisPrompt(elements);

    try {
      const insights = await this.openaiService.createJsonCompletion<CreativeInsights>({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert presentation designer with deep knowledge of:
- Visual hierarchy and information architecture
- Typography and font psychology
- Color theory and contrast
- Modern design trends (2024-2025)
- Cultural design considerations
- Cognitive psychology and attention

Analyze layouts and provide creative, professional suggestions that make presentations visually stunning and effective.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.8 // More creative!
      });
      console.log(`   ✓ AI Analysis: ${insights.style} style, ${insights.mood} mood`);
      console.log(`   ✓ Suggested ${insights.suggestedChanges.length} creative improvements`);

      return insights;
    } catch (error) {
      console.error("AI analysis failed:", error);
      return this.getFallbackInsights(elements);
    }
  }

  /**
   * Analyze layout using computational methods
   */
  analyzeLayout(elements: SchemaElement[]): LayoutAnalysis {
    console.log("\n📊 Computational Analysis: Measuring layout quality...");

    const visualHierarchy = this.analyzeVisualHierarchy(elements);
    const densityMap = this.analyzeDensity(elements);
    const designPrinciples = this.analyzeDesignPrinciples(elements);
    const improvementOpportunities = this.findImprovementOpportunities(
      elements,
      densityMap,
      designPrinciples
    );

    const aestheticScore = this.calculateAestheticScore(designPrinciples);

    console.log(`   ✓ Aesthetic Score: ${aestheticScore}/100`);
    console.log(`   ✓ Balance: ${designPrinciples.balance}/100`);
    console.log(`   ✓ Found ${improvementOpportunities.length} improvement opportunities`);

    return {
      visualHierarchy,
      densityMap,
      aestheticScore,
      improvementOpportunities,
      designPrinciples
    };
  }

  /**
   * Analyze visual hierarchy
   */
  private analyzeVisualHierarchy(elements: SchemaElement[]) {
    const scored = elements.map((el, idx) => {
      let score = 0;

      // Size importance
      const area = (el.width || 0) * (el.height || 0);
      score += area / 10000;

      // Font size importance
      if (el.fontSize) {
        score += el.fontSize / 10;
      }

      // Position importance (top and left are more important)
      const normalizedTop = 1 - (el.top / this.slideHeight);
      score += normalizedTop * 20;

      return { index: idx, score };
    }).sort((a, b) => b.score - a.score);

    const third = Math.ceil(scored.length / 3);

    return {
      primaryElements: scored.slice(0, third).map(s => s.index),
      secondaryElements: scored.slice(third, third * 2).map(s => s.index),
      tertiaryElements: scored.slice(third * 2).map(s => s.index)
    };
  }

  /**
   * Analyze content density
   */
  private analyzeDensity(elements: SchemaElement[]) {
    const gridSize = 6;
    const cellWidth = this.slideWidth / gridSize;
    const cellHeight = this.slideHeight / gridSize;

    const grid: number[][] = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));

    // Map elements to grid
    elements.forEach(el => {
      const startX = Math.floor(el.left / cellWidth);
      const startY = Math.floor(el.top / cellHeight);
      const endX = Math.min(gridSize - 1, Math.floor((el.left + el.width) / cellWidth));
      const endY = Math.min(gridSize - 1, Math.floor((el.top + el.height) / cellHeight));

      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
            grid[y][x]++;
          }
        }
      }
    });

    const crowdedAreas: { x: number; y: number; width: number; height: number }[] = [];
    const emptyAreas: { x: number; y: number; width: number; height: number }[] = [];

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (grid[y][x] >= 3) {
          crowdedAreas.push({
            x: x * cellWidth,
            y: y * cellHeight,
            width: cellWidth,
            height: cellHeight
          });
        } else if (grid[y][x] === 0) {
          emptyAreas.push({
            x: x * cellWidth,
            y: y * cellHeight,
            width: cellWidth,
            height: cellHeight
          });
        }
      }
    }

    return { crowdedAreas, emptyAreas };
  }

  /**
   * Analyze design principles
   */
  private analyzeDesignPrinciples(elements: SchemaElement[]) {
    return {
      balance: this.calculateBalance(elements),
      alignment: this.calculateAlignment(elements),
      contrast: this.calculateContrast(elements),
      whitespace: this.calculateWhitespace(elements),
      harmony: this.calculateHarmony(elements)
    };
  }

  private calculateBalance(elements: SchemaElement[]): number {
    const centerX = this.slideWidth / 2;
    let leftWeight = 0;
    let rightWeight = 0;

    elements.forEach(el => {
      const elCenterX = el.left + el.width / 2;
      const weight = (el.width * el.height) / 1000;

      if (elCenterX < centerX) {
        leftWeight += weight * (centerX - elCenterX);
      } else {
        rightWeight += weight * (elCenterX - centerX);
      }
    });

    const balanceRatio = Math.min(leftWeight, rightWeight) / Math.max(leftWeight, rightWeight);
    return Math.round(balanceRatio * 100);
  }

  private calculateAlignment(elements: SchemaElement[]): number {
    const tolerance = 10;
    let alignedCount = 0;
    let totalComparisons = 0;

    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        totalComparisons++;
        const el1 = elements[i];
        const el2 = elements[j];

        if (
          Math.abs(el1.left - el2.left) < tolerance ||
          Math.abs(el1.top - el2.top) < tolerance ||
          Math.abs((el1.left + el1.width) - (el2.left + el2.width)) < tolerance
        ) {
          alignedCount++;
        }
      }
    }

    return totalComparisons > 0 ? Math.round((alignedCount / totalComparisons) * 100) : 50;
  }

  private calculateContrast(elements: SchemaElement[]): number {
    const fontSizes = elements
      .filter(el => el.fontSize)
      .map(el => el.fontSize!);

    if (fontSizes.length < 2) return 50;

    const maxFont = Math.max(...fontSizes);
    const minFont = Math.min(...fontSizes);
    const contrastRatio = maxFont / minFont;

    return Math.min(100, Math.round(contrastRatio * 20));
  }

  private calculateWhitespace(elements: SchemaElement[]): number {
    let totalElementArea = 0;
    elements.forEach(el => {
      totalElementArea += el.width * el.height;
    });

    const slideArea = this.slideWidth * this.slideHeight;
    const whitespaceRatio = 1 - (totalElementArea / slideArea);

    return Math.round(whitespaceRatio * 100);
  }

  private calculateHarmony(elements: SchemaElement[]): number {
    const goldenRatio = 1.618;
    let harmonyScore = 0;
    let count = 0;

    elements.forEach(el => {
      const ratio = el.width / el.height;
      const goldenDiff = Math.abs(ratio - goldenRatio);

      if (goldenDiff < 0.5) {
        harmonyScore += (0.5 - goldenDiff) * 200;
        count++;
      }
    });

    return count > 0 ? Math.round(harmonyScore / count) : 50;
  }

  private calculateAestheticScore(principles: LayoutAnalysis['designPrinciples']): number {
    const weights = {
      balance: 0.25,
      alignment: 0.2,
      contrast: 0.2,
      whitespace: 0.2,
      harmony: 0.15
    };

    return Math.round(
      principles.balance * weights.balance +
      principles.alignment * weights.alignment +
      principles.contrast * weights.contrast +
      principles.whitespace * weights.whitespace +
      principles.harmony * weights.harmony
    );
  }

  private findImprovementOpportunities(
    elements: SchemaElement[],
    densityMap: LayoutAnalysis['densityMap'],
    principles: LayoutAnalysis['designPrinciples']
  ): LayoutAnalysis['improvementOpportunities'] {
    const opportunities: LayoutAnalysis['improvementOpportunities'] = [];

    if (densityMap.crowdedAreas.length > 2) {
      opportunities.push({
        area: "Content Density",
        suggestion: "Reduce crowding by redistributing elements",
        priority: "high"
      });
    }

    if (principles.balance < 60) {
      opportunities.push({
        area: "Visual Balance",
        suggestion: "Improve left-right balance of elements",
        priority: "high"
      });
    }

    if (principles.whitespace < 30) {
      opportunities.push({
        area: "Whitespace",
        suggestion: "Add more breathing room between elements",
        priority: "medium"
      });
    }

    if (principles.alignment < 50) {
      opportunities.push({
        area: "Alignment",
        suggestion: "Align elements to create visual flow",
        priority: "medium"
      });
    }

    return opportunities;
  }

  private buildAnalysisPrompt(elements: SchemaElement[]): string {
    const elementsSummary = elements.map((el, idx) => ({
      index: idx,
      type: el.type,
      position: `(${el.left}, ${el.top})`,
      size: `${el.width}x${el.height}`,
      fontSize: el.fontSize,
      hasContent: !!el.content,
      hasImage: !!el.src
    }));

    return `Analyze this presentation slide layout and provide creative design insights.

SLIDE DIMENSIONS: ${this.slideWidth}x${this.slideHeight}

ELEMENTS:
${JSON.stringify(elementsSummary, null, 2)}

Provide a JSON response with this structure:
{
  "mood": "professional/energetic/calm/bold/elegant",
  "style": "modern/classic/minimal/bold/elegant",
  "targetAudience": "who this design appeals to",
  "contentType": "title/content/data/media",
  "suggestedChanges": [
    {
      "element": 0,
      "reason": "why this change improves the design",
      "changes": {
        "left": 100,
        "top": 200,
        "width": 800,
        "height": 100,
        "fontSize": 48
      }
    }
  ]
}

Be creative and bold! Suggest changes that make the layout:
1. More visually striking
2. Better hierarchy
3. More professional
4. Easier to read
5. More memorable

Focus on the 2-3 most impactful changes.`;
  }

  private getFallbackInsights(elements: SchemaElement[]): CreativeInsights {
    return {
      mood: "professional",
      style: "modern",
      targetAudience: "general",
      contentType: "content",
      suggestedChanges: []
    };
  }
}
