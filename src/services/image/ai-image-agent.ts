import OpenAI from "openai";
import axios from "axios";
import * as crypto from "crypto";

/**
 * Advanced AI Image Agent
 *
 * Intelligent agent for autonomous image selection and management
 * Uses GPT-4o for content analysis and decision making
 */

export interface ImageSearchContext {
  slideTitle: string;
  slideContent: string;
  slideIndex: number;
  totalSlides: number;
  presentationTitle: string;
  presentationTheme?: string;
  targetLanguage: string;
  elementType: "background" | "content" | "icon" | "illustration";
  desiredStyle?: string;
  colorScheme?: string;
  previousSearches?: string[];
}

export interface ImageCandidate {
  url: string;
  thumbnailUrl: string;
  title: string;
  source: string;
  width: number;
  height: number;
  relevanceScore: number;
  qualityScore: number;
  contextScore: number;
  overallScore: number;
  searchQuery: string;
  aiReasoning: string;
}

export interface SearchStrategy {
  query: string;
  language: string;
  reasoning: string;
  priority: number;
  keywords: string[];
}

export interface AgentDecision {
  selectedImage: ImageCandidate | null;
  alternativeImages: ImageCandidate[];
  searchStrategies: SearchStrategy[];
  confidence: number;
  reasoning: string;
  suggestions: string[];
  shouldRetry: boolean;
  retryStrategy?: string;
}

export interface ImageUsageRecord {
  url: string;
  usedAt: Date;
  context: string;
  slideIndex: number;
  templateName: string;
}

export class AIImageAgent {
  private openai: OpenAI;
  private bingApiKey: string;
  private imageUsageHistory: Map<string, ImageUsageRecord[]>;
  private sessionContext: Map<string, any>;
  private maxRetries: number = 3;
  private minQualityThreshold: number = 0.6;
  private minRelevanceThreshold: number = 0.7;

  constructor(openaiApiKey: string, bingApiKey: string) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.bingApiKey = bingApiKey;
    this.imageUsageHistory = new Map();
    this.sessionContext = new Map();
  }

  /**
   * Main autonomous image selection method
   * Makes intelligent decisions without human intervention
   */
  async selectOptimalImage(
    context: ImageSearchContext,
    templateName: string
  ): Promise<AgentDecision> {
    console.log(
      `🤖 AI Agent: Starting autonomous image selection for slide ${
        context.slideIndex + 1
      }`
    );

    try {
      // Phase 1: Content Analysis & Strategy Generation
      const searchStrategies = await this.generateSearchStrategies(context);
      console.log(`📋 Generated ${searchStrategies.length} search strategies`);

      // Phase 2: Execute Searches & Collect Candidates
      const allCandidates: ImageCandidate[] = [];

      for (const strategy of searchStrategies) {
        console.log(
          `🔍 Executing strategy: "${strategy.query}" (Priority: ${strategy.priority})`
        );

        const candidates = await this.executeSearchStrategy(strategy, context);

        if (candidates.length > 0) {
          allCandidates.push(...candidates);
          console.log(`✓ Found ${candidates.length} candidates`);
        }

        // Stop if we have enough high-quality candidates
        if (allCandidates.filter((c) => c.overallScore > 0.8).length >= 3) {
          console.log(
            "✓ Found sufficient high-quality candidates, stopping search"
          );
          break;
        }
      }

      if (allCandidates.length === 0) {
        console.log(
          "⚠️  No candidates found, will retry with alternative strategies"
        );
        return {
          selectedImage: null,
          alternativeImages: [],
          searchStrategies,
          confidence: 0,
          reasoning: "No suitable images found with current strategies",
          suggestions: await this.generateAlternativeStrategies(context),
          shouldRetry: true,
          retryStrategy: "broaden_search_terms",
        };
      }

      // Phase 3: Intelligent Ranking & Scoring
      const rankedCandidates = await this.rankCandidates(
        allCandidates,
        context,
        templateName
      );

      // Phase 4: Final Decision Making
      const decision = await this.makeIntelligentDecision(
        rankedCandidates,
        context,
        templateName
      );

      // Phase 5: Learn from Selection
      if (decision.selectedImage) {
        await this.recordImageUsage(
          decision.selectedImage,
          context,
          templateName
        );
      }

      return decision;
    } catch (error) {
      console.error("❌ AI Agent error:", error);
      throw new Error(
        `AI Agent failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Generate multiple search strategies using AI
   */
  private async generateSearchStrategies(
    context: ImageSearchContext
  ): Promise<SearchStrategy[]> {
    const prompt = `You are an expert at finding the perfect images for presentations. Analyze this slide and generate optimal search strategies.

Presentation Context:
- Title: "${context.presentationTitle}"
- Theme: ${context.presentationTheme || "Professional"}
- Slide ${context.slideIndex + 1} of ${context.totalSlides}

Slide Content:
- Title: "${context.slideTitle}"
- Content: "${context.slideContent}"

Image Requirements:
- Type: ${context.elementType}
- Style: ${context.desiredStyle || "Professional, modern"}
- Color Scheme: ${context.colorScheme || "Any"}
- Language Context: ${context.targetLanguage}

Previous Searches (avoid duplicating): ${
      context.previousSearches?.join(", ") || "None"
    }

Generate 5 diverse search strategies with:
1. Primary direct search (most obvious)
2. Conceptual/metaphorical search
3. Emotional/mood-based search
4. Industry/domain-specific search
5. Alternative perspective search

For each strategy, provide:
- query: The exact search query string (in English for broader results)
- language: Target language code
- reasoning: Why this strategy would work
- priority: 1-5 (5 being highest)
- keywords: Key terms to emphasize

Return as JSON array.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an expert image search strategist. Return only valid JSON arrays.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("No JSON array found in response");
      }

      const strategies: SearchStrategy[] = JSON.parse(jsonMatch[0]);

      // Sort by priority
      return strategies.sort((a, b) => b.priority - a.priority);
    } catch (error) {
      console.error("Error generating search strategies:", error);

      // Fallback to basic strategies
      return this.generateFallbackStrategies(context);
    }
  }

  /**
   * Fallback strategies if AI fails
   */
  private generateFallbackStrategies(
    context: ImageSearchContext
  ): SearchStrategy[] {
    const baseQuery =
      context.slideTitle || context.slideContent.substring(0, 50);

    return [
      {
        query: baseQuery,
        language: "en",
        reasoning: "Direct search based on slide title",
        priority: 5,
        keywords: baseQuery.split(" ").filter((w) => w.length > 3),
      },
      {
        query: `${context.elementType} ${baseQuery}`,
        language: "en",
        reasoning: "Element-type specific search",
        priority: 4,
        keywords: [context.elementType, ...baseQuery.split(" ")],
      },
      {
        query: `${context.presentationTheme || "professional"} ${baseQuery}`,
        language: "en",
        reasoning: "Theme-based search",
        priority: 3,
        keywords: [context.presentationTheme || "professional", baseQuery],
      },
    ];
  }

  /**
   * Execute a single search strategy
   */
  private async executeSearchStrategy(
    strategy: SearchStrategy,
    context: ImageSearchContext
  ): Promise<ImageCandidate[]> {
    try {
      const bingResults = await this.searchBingImages(strategy.query, 10);

      if (!bingResults || bingResults.length === 0) {
        return [];
      }

      // Convert to candidates and score them
      const candidates: ImageCandidate[] = [];

      for (const result of bingResults) {
        try {
          const candidate: ImageCandidate = {
            url: result.contentUrl,
            thumbnailUrl: result.thumbnailUrl,
            title: result.name,
            source: result.hostPageDisplayUrl || "Unknown",
            width: result.width || 0,
            height: result.height || 0,
            relevanceScore: 0,
            qualityScore: 0,
            contextScore: 0,
            overallScore: 0,
            searchQuery: strategy.query,
            aiReasoning: "",
          };

          // Quick technical scoring
          candidate.qualityScore = this.calculateTechnicalQuality(candidate);

          candidates.push(candidate);
        } catch (err) {
          console.warn("Error processing search result:", err);
        }
      }

      return candidates;
    } catch (error) {
      console.error(`Search strategy failed for "${strategy.query}":`, error);
      return [];
    }
  }

  /**
   * Search Bing for images
   */
  private async searchBingImages(
    query: string,
    count: number = 10
  ): Promise<any[]> {
    try {
      const response = await axios.get(
        "https://api.bing.microsoft.com/v7.0/images/search",
        {
          headers: {
            "Ocp-Apim-Subscription-Key": this.bingApiKey,
          },
          params: {
            q: query,
            count: count,
            imageType: "Photo",
            license: "Any",
            safeSearch: "Moderate",
            minWidth: 800,
            minHeight: 600,
          },
        }
      );

      return response.data.value || [];
    } catch (error) {
      console.error("Bing search error:", error);
      return [];
    }
  }

  /**
   * Calculate technical quality score
   */
  private calculateTechnicalQuality(candidate: ImageCandidate): number {
    let score = 0;

    // Dimension scoring (prefer HD and above)
    const pixels = candidate.width * candidate.height;
    if (pixels >= 1920 * 1080) score += 0.4;
    else if (pixels >= 1280 * 720) score += 0.3;
    else if (pixels >= 800 * 600) score += 0.2;
    else score += 0.1;

    // Aspect ratio scoring (prefer 16:9 or 4:3)
    const aspectRatio = candidate.width / candidate.height;
    if (
      Math.abs(aspectRatio - 16 / 9) < 0.1 ||
      Math.abs(aspectRatio - 4 / 3) < 0.1
    ) {
      score += 0.3;
    } else if (Math.abs(aspectRatio - 1) < 0.1) {
      score += 0.2; // Square is okay
    } else {
      score += 0.1;
    }

    // Source credibility (basic heuristic)
    if (
      candidate.source.includes("unsplash") ||
      candidate.source.includes("pexels") ||
      candidate.source.includes("pixabay")
    ) {
      score += 0.3;
    } else {
      score += 0.15;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Rank candidates using AI
   */
  private async rankCandidates(
    candidates: ImageCandidate[],
    context: ImageSearchContext,
    templateName: string
  ): Promise<ImageCandidate[]> {
    console.log(`🎯 AI Ranking ${candidates.length} candidates...`);

    // Batch process candidates for efficiency
    const batchSize = 5;
    const rankedCandidates: ImageCandidate[] = [];

    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);

      try {
        const scoredBatch = await this.scoreCandidateBatch(batch, context);
        rankedCandidates.push(...scoredBatch);
      } catch (error) {
        console.warn("Batch scoring failed, using technical scores:", error);
        rankedCandidates.push(...batch);
      }
    }

    // Calculate overall scores
    rankedCandidates.forEach((candidate) => {
      candidate.overallScore =
        candidate.relevanceScore * 0.5 +
        candidate.qualityScore * 0.3 +
        candidate.contextScore * 0.2;
    });

    // Sort by overall score
    return rankedCandidates.sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * Score a batch of candidates using AI
   */
  private async scoreCandidateBatch(
    candidates: ImageCandidate[],
    context: ImageSearchContext
  ): Promise<ImageCandidate[]> {
    const prompt = `Rate these images for a presentation slide. Score each on relevance (0-1) and context fit (0-1).

Slide Context:
- Title: "${context.slideTitle}"
- Content: "${context.slideContent}"
- Element Type: ${context.elementType}
- Desired Style: ${context.desiredStyle || "Professional"}

Images to rate:
${candidates
  .map(
    (c, i) =>
      `${i + 1}. "${c.title}" - ${c.searchQuery} (${c.width}x${c.height})`
  )
  .join("\n")}

For each image, provide:
- relevanceScore: How well it matches the content (0-1)
- contextScore: How well it fits the presentation style (0-1)
- reasoning: Brief explanation

Return as JSON array with indices matching input.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an expert at evaluating images for presentations. Return only valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const scores = JSON.parse(jsonMatch[0]);

      // Apply scores to candidates
      candidates.forEach((candidate, index) => {
        if (scores[index]) {
          candidate.relevanceScore = scores[index].relevanceScore || 0.5;
          candidate.contextScore = scores[index].contextScore || 0.5;
          candidate.aiReasoning =
            scores[index].reasoning || "No reasoning provided";
        }
      });

      return candidates;
    } catch (error) {
      console.warn("AI scoring failed, using defaults:", error);

      // Use default scores based on technical quality
      candidates.forEach((candidate) => {
        candidate.relevanceScore = 0.5;
        candidate.contextScore = 0.5;
        candidate.aiReasoning = "Scored using technical metrics only";
      });

      return candidates;
    }
  }

  /**
   * Make final intelligent decision
   */
  private async makeIntelligentDecision(
    rankedCandidates: ImageCandidate[],
    context: ImageSearchContext,
    templateName: string
  ): Promise<AgentDecision> {
    // Filter candidates by thresholds
    const qualifiedCandidates = rankedCandidates.filter(
      (c) =>
        c.qualityScore >= this.minQualityThreshold &&
        c.relevanceScore >= this.minRelevanceThreshold
    );

    if (qualifiedCandidates.length === 0) {
      return {
        selectedImage: null,
        alternativeImages: rankedCandidates.slice(0, 3),
        searchStrategies: [],
        confidence: 0,
        reasoning: "No candidates met quality and relevance thresholds",
        suggestions: [
          "Try broader search terms",
          "Adjust quality thresholds",
          "Use different image sources",
          "Consider alternative visual representations",
        ],
        shouldRetry: true,
        retryStrategy: "lower_thresholds_or_broaden_search",
      };
    }

    // Check for duplicate usage
    const unusedCandidates = qualifiedCandidates.filter(
      (c) => !this.hasImageBeenUsed(c.url, templateName)
    );

    const finalCandidates =
      unusedCandidates.length > 0 ? unusedCandidates : qualifiedCandidates;

    // Select top candidate
    const selectedImage = finalCandidates[0];
    const alternatives = finalCandidates.slice(1, 4);

    // Calculate confidence based on score distribution
    const topScore = selectedImage.overallScore;
    const secondScore = alternatives[0]?.overallScore || 0;
    const scoreDiff = topScore - secondScore;
    const confidence = Math.min(topScore + scoreDiff * 0.5, 1.0);

    return {
      selectedImage,
      alternativeImages: alternatives,
      searchStrategies: [],
      confidence,
      reasoning: this.generateDecisionReasoning(
        selectedImage,
        alternatives,
        context
      ),
      suggestions: this.generateImprovementSuggestions(selectedImage, context),
      shouldRetry: false,
    };
  }

  /**
   * Generate decision reasoning
   */
  private generateDecisionReasoning(
    selected: ImageCandidate,
    alternatives: ImageCandidate[],
    context: ImageSearchContext
  ): string {
    const reasons: string[] = [];

    reasons.push(
      `Selected image scores: Quality ${(selected.qualityScore * 100).toFixed(
        0
      )}%, Relevance ${(selected.relevanceScore * 100).toFixed(0)}%, Context ${(
        selected.contextScore * 100
      ).toFixed(0)}%`
    );

    if (selected.aiReasoning) {
      reasons.push(`AI Analysis: ${selected.aiReasoning}`);
    }

    reasons.push(
      `Dimensions: ${selected.width}x${selected.height} (${this.getQualityLabel(
        selected.width,
        selected.height
      )})`
    );

    if (alternatives.length > 0) {
      const scoreDiff = selected.overallScore - alternatives[0].overallScore;
      reasons.push(
        `Selected over ${alternatives.length} alternatives (${(
          scoreDiff * 100
        ).toFixed(1)}% score advantage)`
      );
    }

    return reasons.join(". ");
  }

  /**
   * Get quality label for dimensions
   */
  private getQualityLabel(width: number, height: number): string {
    const pixels = width * height;
    if (pixels >= 1920 * 1080) return "Full HD+";
    if (pixels >= 1280 * 720) return "HD";
    if (pixels >= 800 * 600) return "Standard";
    return "Low";
  }

  /**
   * Generate improvement suggestions
   */
  private generateImprovementSuggestions(
    selected: ImageCandidate,
    context: ImageSearchContext
  ): string[] {
    const suggestions: string[] = [];

    if (selected.qualityScore < 0.8) {
      suggestions.push("Consider higher resolution images for better quality");
    }

    if (selected.relevanceScore < 0.8) {
      suggestions.push(
        "Image relevance could be improved with more specific search terms"
      );
    }

    if (selected.contextScore < 0.8) {
      suggestions.push(
        "Consider images that better match the presentation style"
      );
    }

    if (suggestions.length === 0) {
      suggestions.push("Image selection is optimal for current context");
    }

    return suggestions;
  }

  /**
   * Record image usage to prevent duplicates
   */
  private async recordImageUsage(
    image: ImageCandidate,
    context: ImageSearchContext,
    templateName: string
  ): Promise<void> {
    const key = `${templateName}:${image.url}`;

    const record: ImageUsageRecord = {
      url: image.url,
      usedAt: new Date(),
      context: `${context.slideTitle} - ${context.elementType}`,
      slideIndex: context.slideIndex,
      templateName,
    };

    if (!this.imageUsageHistory.has(key)) {
      this.imageUsageHistory.set(key, []);
    }

    this.imageUsageHistory.get(key)!.push(record);

    console.log(`📝 Recorded image usage: ${key}`);
  }

  /**
   * Check if image has been used
   */
  private hasImageBeenUsed(url: string, templateName: string): boolean {
    const key = `${templateName}:${url}`;
    return this.imageUsageHistory.has(key);
  }

  /**
   * Generate alternative strategies when main search fails
   */
  private async generateAlternativeStrategies(
    context: ImageSearchContext
  ): Promise<string[]> {
    return [
      "Try using more general/abstract search terms",
      "Search for metaphorical representations instead of literal",
      "Use industry-specific terminology",
      "Try searching in different languages",
      "Consider using icons or illustrations instead of photos",
      "Break down complex concepts into simpler visual elements",
    ];
  }

  /**
   * Clear usage history for a template
   */
  clearTemplateHistory(templateName: string): void {
    const keysToDelete: string[] = [];

    this.imageUsageHistory.forEach((records, key) => {
      if (key.startsWith(`${templateName}:`)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.imageUsageHistory.delete(key));

    console.log(
      `🧹 Cleared ${keysToDelete.length} usage records for template: ${templateName}`
    );
  }
}

export default AIImageAgent;
