/**
 * Quality Validator
 * Comprehensive content quality validation with grammar, readability, coherence checks
 */

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
  suggestions: string[];
  metrics: QualityMetrics;
}

export interface ValidationIssue {
  type: 'grammar' | 'spelling' | 'length' | 'readability' | 'coherence' | 'consistency' | 'whitespace';
  severity: 'low' | 'medium' | 'high';
  message: string;
  location?: string;
}

export interface QualityMetrics {
  wordCount: number;
  characterCount: number;
  sentenceCount: number;
  averageWordLength: number;
  averageSentenceLength: number;
  readabilityScore: number; // Flesch Reading Ease
  grammarScore: number;
  coherenceScore: number;
  consistencyScore: number;
}

export class QualityValidator {
  private minWordCount: number;
  private maxWordCount: number;
  private minScore: number;

  // Common spelling mistakes patterns
  private commonMistakes: [RegExp, string][] = [
    [/\bthier\b/gi, 'their'],
    [/\brecieve\b/gi, 'receive'],
    [/\boccured\b/gi, 'occurred'],
    [/\bseperate\b/gi, 'separate'],
    [/\bdefinately\b/gi, 'definitely'],
    [/\baccommodate\b/gi, 'accommodate'],
  ];

  // Grammar check patterns
  private grammarPatterns: [RegExp, string][] = [
    [/\ba\s+([aeiou])/gi, 'Should use "an" before vowel'],
    [/\ban\s+([^aeiou])/gi, 'Should use "a" before consonant'],
    [/\s{2,}/g, 'Multiple consecutive spaces'],
    [/[a-z][A-Z]/g, 'Missing space between words'],
    [/\.\s*\./g, 'Multiple consecutive periods'],
    [/[,;:]\S/g, 'Missing space after punctuation'],
  ];

  constructor(minWordCount: number = 10, maxWordCount: number = 1000, minScore: number = 60) {
    this.minWordCount = minWordCount;
    this.maxWordCount = maxWordCount;
    this.minScore = minScore;
  }

  /**
   * Calculate metrics for given text
   */
  private calculateMetrics(text: string): QualityMetrics {
    // Remove HTML tags for analysis
    const cleanText = text.replace(/<[^>]*>/g, '');

    // Word count
    const words = cleanText.split(/\s+/).filter((w) => w.length > 0);
    const wordCount = words.length;

    // Character count
    const characterCount = cleanText.length;

    // Sentence count (approximate)
    const sentences = cleanText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const sentenceCount = sentences.length || 1;

    // Average word length
    const totalWordLength = words.reduce((sum, word) => sum + word.length, 0);
    const averageWordLength = wordCount > 0 ? totalWordLength / wordCount : 0;

    // Average sentence length
    const averageSentenceLength = wordCount / sentenceCount;

    // Flesch Reading Ease (simplified)
    // Score = 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
    // We approximate syllables as word length / 3
    const approximateSyllables = words.reduce((sum, word) => sum + Math.max(1, Math.ceil(word.length / 3)), 0);
    const syllablesPerWord = wordCount > 0 ? approximateSyllables / wordCount : 0;
    const readabilityScore = Math.max(
      0,
      Math.min(100, 206.835 - 1.015 * averageSentenceLength - 84.6 * syllablesPerWord)
    );

    return {
      wordCount,
      characterCount,
      sentenceCount,
      averageWordLength,
      averageSentenceLength,
      readabilityScore,
      grammarScore: 0, // Will be calculated separately
      coherenceScore: 0, // Will be calculated separately
      consistencyScore: 0, // Will be calculated separately
    };
  }

  /**
   * Check grammar and common mistakes
   */
  private checkGrammar(text: string): { score: number; issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];
    let score = 100;

    // Check grammar patterns
    this.grammarPatterns.forEach(([pattern, message]) => {
      const matches = text.match(pattern);
      if (matches) {
        issues.push({
          type: 'grammar',
          severity: 'medium',
          message,
          location: matches[0],
        });
        score -= 10;
      }
    });

    // Check common spelling mistakes
    this.commonMistakes.forEach(([pattern, correction]) => {
      const matches = text.match(pattern);
      if (matches) {
        issues.push({
          type: 'spelling',
          severity: 'medium',
          message: `Possible spelling mistake: "${matches[0]}" should be "${correction}"`,
          location: matches[0],
        });
        score -= 5;
      }
    });

    // Check for all caps (usually not ideal)
    if (text === text.toUpperCase() && text.length > 20) {
      issues.push({
        type: 'consistency',
        severity: 'low',
        message: 'Text is all uppercase, which may reduce readability',
      });
      score -= 5;
    }

    return { score: Math.max(0, score), issues };
  }

  /**
   * Check content length
   */
  private checkLength(metrics: QualityMetrics): { score: number; issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];
    let score = 100;

    if (metrics.wordCount < this.minWordCount) {
      issues.push({
        type: 'length',
        severity: 'medium',
        message: `Content too short: ${metrics.wordCount} words (minimum: ${this.minWordCount})`,
      });
      score -= 20;
    }

    if (metrics.wordCount > this.maxWordCount) {
      issues.push({
        type: 'length',
        severity: 'medium',
        message: `Content too long: ${metrics.wordCount} words (maximum: ${this.maxWordCount})`,
      });
      score -= 15;
    }

    return { score: Math.max(0, score), issues };
  }

  /**
   * Check readability
   */
  private checkReadability(metrics: QualityMetrics): { score: number; issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];
    let score = metrics.readabilityScore;

    if (metrics.readabilityScore < 30) {
      issues.push({
        type: 'readability',
        severity: 'high',
        message: 'Content is very difficult to read. Consider simplifying.',
      });
    } else if (metrics.readabilityScore < 50) {
      issues.push({
        type: 'readability',
        severity: 'medium',
        message: 'Content is fairly difficult to read. Consider shorter sentences.',
      });
    }

    if (metrics.averageSentenceLength > 25) {
      issues.push({
        type: 'readability',
        severity: 'low',
        message: 'Sentences are quite long. Consider breaking them up.',
      });
      score -= 10;
    }

    return { score: Math.max(0, score), issues };
  }

  /**
   * Check coherence (keyword overlap and topic consistency)
   */
  checkCoherence(contents: string[]): { score: number; issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];
    let score = 100;

    if (contents.length < 2) {
      return { score: 100, issues: [] }; // Can't check coherence with single content
    }

    // Extract keywords from each content
    const keywordSets = contents.map((content) => {
      const words = content
        .toLowerCase()
        .replace(/<[^>]*>/g, '')
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 3);
      return new Set(words);
    });

    // Check for keyword overlap between consecutive contents
    let totalOverlap = 0;
    for (let i = 0; i < keywordSets.length - 1; i++) {
      const set1 = keywordSets[i];
      const set2 = keywordSets[i + 1];

      const overlap = new Set([...set1].filter((x) => set2.has(x)));
      const overlapRatio = overlap.size / Math.min(set1.size, set2.size);
      totalOverlap += overlapRatio;
    }

    const averageOverlap = totalOverlap / (keywordSets.length - 1);

    if (averageOverlap < 0.1) {
      issues.push({
        type: 'coherence',
        severity: 'medium',
        message: 'Contents have low keyword overlap. May lack coherence.',
      });
      score -= 20;
    } else if (averageOverlap < 0.2) {
      issues.push({
        type: 'coherence',
        severity: 'low',
        message: 'Contents have moderate keyword overlap. Consider improving topic consistency.',
      });
      score -= 10;
    }

    return { score: Math.max(0, score), issues };
  }

  /**
   * Check consistency (formatting, style)
   */
  checkConsistency(contents: string[]): { score: number; issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];
    let score = 100;

    if (contents.length < 2) {
      return { score: 100, issues: [] };
    }

    // Check for duplicate content
    const uniqueContents = new Set(contents.map((c) => c.trim().toLowerCase()));
    if (uniqueContents.size < contents.length) {
      issues.push({
        type: 'consistency',
        severity: 'high',
        message: 'Duplicate content detected. Each element should be unique.',
      });
      score -= 30;
    }

    // Check for very similar content (simplified)
    for (let i = 0; i < contents.length; i++) {
      for (let j = i + 1; j < contents.length; j++) {
        const similarity = this.calculateSimilarity(contents[i], contents[j]);
        if (similarity > 0.8) {
          issues.push({
            type: 'consistency',
            severity: 'medium',
            message: `Content ${i + 1} and ${j + 1} are very similar (${(similarity * 100).toFixed(0)}% match)`,
          });
          score -= 15;
        }
      }
    }

    return { score: Math.max(0, score), issues };
  }

  /**
   * Calculate similarity between two texts (Jaccard similarity)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(
      text1
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
    );
    const words2 = new Set(
      text2
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
    );

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Check visual balance (whitespace ratio)
   */
  checkVisualBalance(content: string, maxCharacters: number): { score: number; issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];
    let score = 100;

    const actualLength = content.length;
    const usage = actualLength / maxCharacters;

    if (usage < 0.2) {
      issues.push({
        type: 'whitespace',
        severity: 'low',
        message: `Content uses only ${(usage * 100).toFixed(0)}% of available space. Consider adding more detail.`,
      });
      score -= 10;
    } else if (usage > 1.2) {
      issues.push({
        type: 'whitespace',
        severity: 'medium',
        message: `Content exceeds available space by ${((usage - 1) * 100).toFixed(0)}%. May require font adjustment.`,
      });
      score -= 15;
    }

    return { score: Math.max(0, score), issues };
  }

  /**
   * Validate single content
   */
  validateContent(content: string, maxCharacters?: number): ValidationResult {
    const metrics = this.calculateMetrics(content);
    const issues: ValidationIssue[] = [];
    const suggestions: string[] = [];

    // Check grammar
    const grammarCheck = this.checkGrammar(content);
    metrics.grammarScore = grammarCheck.score;
    issues.push(...grammarCheck.issues);

    // Check length
    const lengthCheck = this.checkLength(metrics);
    issues.push(...lengthCheck.issues);

    // Check readability
    const readabilityCheck = this.checkReadability(metrics);
    issues.push(...readabilityCheck.issues);

    // Check visual balance if maxCharacters provided
    if (maxCharacters) {
      const balanceCheck = this.checkVisualBalance(content, maxCharacters);
      issues.push(...balanceCheck.issues);
    }

    // Calculate overall score
    const score = Math.round(
      (grammarCheck.score * 0.3 +
        lengthCheck.score * 0.2 +
        readabilityCheck.score * 0.3 +
        (maxCharacters ? this.checkVisualBalance(content, maxCharacters).score : 100) * 0.2)
    );

    // Generate suggestions
    if (metrics.readabilityScore < 50) {
      suggestions.push('Use shorter sentences and simpler words');
    }
    if (metrics.wordCount < this.minWordCount) {
      suggestions.push('Add more detail to improve content quality');
    }
    if (metrics.averageSentenceLength > 25) {
      suggestions.push('Break long sentences into shorter ones');
    }
    if (grammarCheck.issues.length > 0) {
      suggestions.push('Review grammar and spelling');
    }

    metrics.coherenceScore = 100; // Default for single content
    metrics.consistencyScore = 100; // Default for single content

    return {
      isValid: score >= this.minScore && issues.filter((i) => i.severity === 'high').length === 0,
      score,
      issues,
      suggestions,
      metrics,
    };
  }

  /**
   * Validate multiple contents (e.g., all elements in a slide)
   */
  validateMultipleContents(
    contents: Array<{ content: string; maxCharacters?: number }>
  ): ValidationResult {
    const allIssues: ValidationIssue[] = [];
    const allSuggestions: string[] = [];
    let totalScore = 0;

    const contentTexts = contents.map((c) => c.content);

    // Validate each content individually
    const individualResults = contents.map((c) => this.validateContent(c.content, c.maxCharacters));

    individualResults.forEach((result, index) => {
      totalScore += result.score;
      result.issues.forEach((issue) => {
        allIssues.push({
          ...issue,
          location: `Element ${index + 1}`,
        });
      });
      allSuggestions.push(...result.suggestions);
    });

    // Check coherence across all contents
    const coherenceCheck = this.checkCoherence(contentTexts);
    allIssues.push(...coherenceCheck.issues);
    totalScore += coherenceCheck.score;

    // Check consistency across all contents
    const consistencyCheck = this.checkConsistency(contentTexts);
    allIssues.push(...consistencyCheck.issues);
    totalScore += consistencyCheck.score;

    // Calculate average metrics
    const avgScore = Math.round(totalScore / (contents.length + 2)); // +2 for coherence and consistency

    // Aggregate metrics
    const aggregateMetrics: QualityMetrics = {
      wordCount: individualResults.reduce((sum, r) => sum + r.metrics.wordCount, 0),
      characterCount: individualResults.reduce((sum, r) => sum + r.metrics.characterCount, 0),
      sentenceCount: individualResults.reduce((sum, r) => sum + r.metrics.sentenceCount, 0),
      averageWordLength:
        individualResults.reduce((sum, r) => sum + r.metrics.averageWordLength, 0) / contents.length,
      averageSentenceLength:
        individualResults.reduce((sum, r) => sum + r.metrics.averageSentenceLength, 0) / contents.length,
      readabilityScore:
        individualResults.reduce((sum, r) => sum + r.metrics.readabilityScore, 0) / contents.length,
      grammarScore:
        individualResults.reduce((sum, r) => sum + r.metrics.grammarScore, 0) / contents.length,
      coherenceScore: coherenceCheck.score,
      consistencyScore: consistencyCheck.score,
    };

    // Add cross-content suggestions
    if (coherenceCheck.issues.length > 0) {
      allSuggestions.push('Improve keyword overlap between elements');
    }
    if (consistencyCheck.issues.length > 0) {
      allSuggestions.push('Ensure each element has unique, distinct content');
    }

    return {
      isValid: avgScore >= this.minScore && allIssues.filter((i) => i.severity === 'high').length === 0,
      score: avgScore,
      issues: allIssues,
      suggestions: [...new Set(allSuggestions)], // Remove duplicates
      metrics: aggregateMetrics,
    };
  }

  /**
   * Get quality rating label
   */
  getQualityRating(score: number): string {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Fair';
    if (score >= 40) return 'Poor';
    return 'Very Poor';
  }
}
