/**
 * Content Intelligence System
 * Analyzes content type, visual weight, semantic role, and provides layout suggestions
 */

export type ContentType = 'title' | 'section-header' | 'body' | 'bullets' | 'quote' | 'code' | 'data' | 'unknown';

export interface SlideContext {
  contentType: ContentType;
  visualWeight: number; // 0-100
  semanticRole: string;
  complexity: number; // 0-100
  keyPhrases: string[];
  layoutSuggestions: string[];
  confidence: number; // 0-100
}

export interface ElementAnalysis {
  element: any;
  context: SlideContext;
}

export class ContentIntelligence {
  /**
   * Detect content type based on element properties
   */
  detectContentType(element: any): ContentType {
    const { width, height, left, top, type, maxCharacters } = element;

    // Title detection: Large width, small height, top position
    if (top < 100 && width > 500 && height < 150) {
      return 'title';
    }

    // Section header: Medium width, top-ish position
    if (top < 250 && width > 300 && height < 100) {
      return 'section-header';
    }

    // Bullets: Multiple small elements in vertical arrangement
    if (height < 80 && maxCharacters < 200) {
      return 'bullets';
    }

    // Data/Table: Table type
    if (type === 'table') {
      return 'data';
    }

    // Code: Specific formatting or small monospace areas
    if (width > 400 && height > 200 && maxCharacters > 500) {
      return 'code';
    }

    // Quote: Medium size, specific positioning
    if (width > 300 && width < 600 && height > 100 && height < 300) {
      return 'quote';
    }

    // Body text: Large content area
    if (width > 400 && height > 200) {
      return 'body';
    }

    return 'unknown';
  }

  /**
   * Calculate visual weight (prominence) of element
   * Based on size, position, and font size
   */
  calculateVisualWeight(element: any): number {
    const { width, height, left, top, fontSize } = element;

    // Size weight (0-40 points)
    const area = width * height;
    const maxArea = 1920 * 1080; // Assume Full HD slide
    const sizeWeight = Math.min(40, (area / maxArea) * 100);

    // Position weight (0-30 points): Top-left has highest weight
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const distanceFromTopLeft = Math.sqrt(centerX ** 2 + centerY ** 2);
    const maxDistance = Math.sqrt(1920 ** 2 + 1080 ** 2);
    const positionWeight = 30 * (1 - distanceFromTopLeft / maxDistance);

    // Font size weight (0-30 points)
    const fontWeight = Math.min(30, (fontSize / 72) * 30);

    const totalWeight = sizeWeight + positionWeight + fontWeight;

    return Math.min(100, Math.max(0, totalWeight));
  }

  /**
   * Infer semantic role of element
   */
  inferSemanticRole(element: any, contentType: ContentType): string {
    const roles: Record<ContentType, string[]> = {
      title: ['main-heading', 'presentation-title', 'slide-title'],
      'section-header': ['section-heading', 'subsection-title', 'topic-header'],
      body: ['main-content', 'description', 'explanation', 'narrative'],
      bullets: ['list-item', 'key-point', 'summary-point'],
      quote: ['citation', 'testimonial', 'highlighted-text'],
      code: ['code-snippet', 'technical-example', 'implementation'],
      data: ['table', 'chart', 'statistics', 'metrics'],
      unknown: ['miscellaneous', 'supplementary'],
    };

    const possibleRoles = roles[contentType];
    const { top, height } = element;

    // Refine based on position
    if (top < 100) {
      return possibleRoles[0] || 'main-heading';
    } else if (height > 300) {
      return 'main-content';
    } else {
      return possibleRoles[1] || 'supplementary';
    }
  }

  /**
   * Measure content complexity
   */
  measureComplexity(element: any): number {
    const { maxCharacters, type, tableData } = element;

    // Base complexity on character count
    let complexity = Math.min(50, (maxCharacters / 500) * 50);

    // Add complexity for tables
    if (type === 'table' && tableData) {
      const rows = tableData.data?.length || 0;
      const cols = tableData.data?.[0]?.length || 0;
      complexity += Math.min(30, (rows * cols) / 2);
    }

    // Add complexity for nested structures
    if (element.content && element.content.includes('<')) {
      complexity += 20; // HTML content
    }

    return Math.min(100, Math.max(0, complexity));
  }

  /**
   * Extract key phrases (simplified keyword extraction)
   */
  extractKeyPhrases(content: string, maxPhrases: number = 5): string[] {
    if (!content) return [];

    // Remove HTML tags
    const cleanContent = content.replace(/<[^>]*>/g, '');

    // Split into words
    const words = cleanContent
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 3); // Filter short words

    // Count frequency
    const frequency: Record<string, number> = {};
    words.forEach((word) => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    // Sort by frequency and return top phrases
    const sortedPhrases = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxPhrases)
      .map(([phrase]) => phrase);

    return sortedPhrases;
  }

  /**
   * Generate layout suggestions
   */
  generateLayoutSuggestions(element: any, contentType: ContentType): string[] {
    const suggestions: string[] = [];

    switch (contentType) {
      case 'title':
        suggestions.push('Use large, bold font');
        suggestions.push('Center align for impact');
        suggestions.push('Keep text concise (3-8 words)');
        break;

      case 'section-header':
        suggestions.push('Use medium-large font');
        suggestions.push('Left align for readability');
        suggestions.push('Add subtle separator line');
        break;

      case 'body':
        suggestions.push('Use readable font size (14-18px)');
        suggestions.push('Maintain comfortable line spacing');
        suggestions.push('Break into paragraphs if long');
        break;

      case 'bullets':
        suggestions.push('Use consistent bullet style');
        suggestions.push('Keep each point to 1-2 lines');
        suggestions.push('Maintain visual hierarchy');
        break;

      case 'quote':
        suggestions.push('Use italic or distinct styling');
        suggestions.push('Add quotation marks or border');
        suggestions.push('Attribute source if available');
        break;

      case 'code':
        suggestions.push('Use monospace font');
        suggestions.push('Apply syntax highlighting');
        suggestions.push('Add background color');
        break;

      case 'data':
        suggestions.push('Use clear headers');
        suggestions.push('Alternate row colors for readability');
        suggestions.push('Align numbers right, text left');
        break;

      default:
        suggestions.push('Ensure adequate whitespace');
        suggestions.push('Maintain consistency with slide theme');
        break;
    }

    // Add position-based suggestions
    if (element.top < 100) {
      suggestions.push('Positioned well for high visibility');
    }

    if (element.width > 800) {
      suggestions.push('Consider breaking into columns');
    }

    return suggestions;
  }

  /**
   * Calculate confidence score for analysis
   */
  calculateConfidence(element: any, contentType: ContentType): number {
    let confidence = 50; // Base confidence

    // Increase confidence for clear indicators
    if (contentType === 'title' && element.top < 100 && element.width > 500) {
      confidence += 40;
    } else if (contentType === 'body' && element.height > 300) {
      confidence += 30;
    } else if (contentType === 'data' && element.type === 'table') {
      confidence += 50;
    } else if (contentType === 'bullets' && element.height < 80) {
      confidence += 20;
    } else if (contentType === 'unknown') {
      confidence -= 20;
    }

    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Analyze a single element and return context
   */
  analyzeElement(element: any): SlideContext {
    const contentType = this.detectContentType(element);
    const visualWeight = this.calculateVisualWeight(element);
    const semanticRole = this.inferSemanticRole(element, contentType);
    const complexity = this.measureComplexity(element);
    const keyPhrases = this.extractKeyPhrases(element.content || '', 5);
    const layoutSuggestions = this.generateLayoutSuggestions(element, contentType);
    const confidence = this.calculateConfidence(element, contentType);

    return {
      contentType,
      visualWeight,
      semanticRole,
      complexity,
      keyPhrases,
      layoutSuggestions,
      confidence,
    };
  }

  /**
   * Analyze all elements in a slide
   */
  analyzeSlide(slide: any): ElementAnalysis[] {
    if (!slide.elements || !Array.isArray(slide.elements)) {
      return [];
    }

    return slide.elements.map((element: any) => ({
      element,
      context: this.analyzeElement(element),
    }));
  }

  /**
   * Get slide summary
   */
  getSlideSummary(slide: any): {
    totalElements: number;
    contentTypes: Record<ContentType, number>;
    averageComplexity: number;
    dominantRole: string;
  } {
    const analyses = this.analyzeSlide(slide);

    const contentTypes: Record<ContentType, number> = {
      title: 0,
      'section-header': 0,
      body: 0,
      bullets: 0,
      quote: 0,
      code: 0,
      data: 0,
      unknown: 0,
    };

    let totalComplexity = 0;
    const roles: Record<string, number> = {};

    analyses.forEach((analysis) => {
      contentTypes[analysis.context.contentType]++;
      totalComplexity += analysis.context.complexity;

      const role = analysis.context.semanticRole;
      roles[role] = (roles[role] || 0) + 1;
    });

    const averageComplexity = analyses.length > 0 ? totalComplexity / analyses.length : 0;
    const dominantRole =
      Object.entries(roles).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    return {
      totalElements: analyses.length,
      contentTypes,
      averageComplexity,
      dominantRole,
    };
  }

  /**
   * Check for visual balance
   */
  checkVisualBalance(slide: any): {
    balanced: boolean;
    suggestions: string[];
    score: number;
  } {
    const analyses = this.analyzeSlide(slide);
    const suggestions: string[] = [];
    let score = 100;

    if (analyses.length === 0) {
      return { balanced: true, suggestions: [], score: 100 };
    }

    // Check for dominant elements
    const highWeightElements = analyses.filter((a) => a.context.visualWeight > 70);
    if (highWeightElements.length > 2) {
      suggestions.push('Too many high-weight elements; consider simplifying');
      score -= 20;
    }

    // Check for whitespace (elements should not cover entire slide)
    const totalArea = analyses.reduce((sum, a) => {
      return sum + (a.element.width * a.element.height);
    }, 0);
    const slideArea = 1920 * 1080; // Assume Full HD
    const coverage = totalArea / slideArea;

    if (coverage > 0.8) {
      suggestions.push('Insufficient whitespace; reduce content density');
      score -= 15;
    } else if (coverage < 0.2) {
      suggestions.push('Too much whitespace; consider adding more content');
      score -= 10;
    }

    // Check for alignment issues (simplified)
    const leftPositions = analyses.map((a) => a.element.left);
    const uniqueLefts = new Set(leftPositions);
    if (uniqueLefts.size > analyses.length * 0.7) {
      suggestions.push('Elements may not be properly aligned');
      score -= 10;
    }

    return {
      balanced: score >= 70,
      suggestions,
      score: Math.max(0, score),
    };
  }
}
