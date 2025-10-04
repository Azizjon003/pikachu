/**
 * Prompt Optimizer
 * Optimizes prompts with templates, few-shot examples, and token management
 */

export interface PromptTemplate {
  system: string;
  user: string;
  examples?: FewShotExample[];
}

export interface FewShotExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface OptimizedPrompt {
  systemPrompt: string;
  userPrompt: string;
  estimatedTokens: number;
}

export class PromptOptimizer {
  private tokenCostPerInput: number;
  private tokenCostPerOutput: number;
  private totalUsage: TokenUsage;

  constructor(costPerInputToken: number = 0.00015 / 1000, costPerOutputToken: number = 0.0006 / 1000) {
    this.tokenCostPerInput = costPerInputToken;
    this.tokenCostPerOutput = costPerOutputToken;
    this.totalUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    };
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  estimateTokens(text: string): number {
    // More accurate estimation: consider words, punctuation, and special tokens
    const words = text.split(/\s+/).length;
    const chars = text.length;

    // Average: 1 token ≈ 0.75 words or 4 characters
    const wordBasedEstimate = words / 0.75;
    const charBasedEstimate = chars / 4;

    // Use the higher estimate to be safe
    return Math.ceil(Math.max(wordBasedEstimate, charBasedEstimate));
  }

  /**
   * Calculate token budget based on constraints
   */
  calculateTokenBudget(maxTokens: number, systemPrompt: string, examples?: FewShotExample[]): number {
    let usedTokens = this.estimateTokens(systemPrompt);

    if (examples && examples.length > 0) {
      examples.forEach((example) => {
        usedTokens += this.estimateTokens(example.input);
        usedTokens += this.estimateTokens(example.output);
      });
    }

    // Reserve space for response (typically 30-40% of max tokens)
    const responseReserve = Math.floor(maxTokens * 0.35);
    const availableBudget = maxTokens - usedTokens - responseReserve;

    return Math.max(0, availableBudget);
  }

  /**
   * Compress prompt by removing redundant information
   */
  compressPrompt(prompt: string, targetReduction: number = 0.2): string {
    // Remove extra whitespace
    let compressed = prompt.replace(/\s+/g, ' ').trim();

    // Remove redundant phrases
    const redundantPhrases = [
      /please note that /gi,
      /it is important to /gi,
      /you should /gi,
      /make sure to /gi,
      /be sure to /gi,
    ];

    redundantPhrases.forEach((phrase) => {
      compressed = compressed.replace(phrase, '');
    });

    // Shorten common instructions
    compressed = compressed
      .replace(/very important/gi, 'critical')
      .replace(/it is necessary to/gi, 'must')
      .replace(/you must ensure/gi, 'ensure')
      .replace(/do not forget to/gi, 'remember to');

    return compressed;
  }

  /**
   * Build optimized prompt for slide title generation
   */
  buildTitlePrompt(language: string, topic: string, slideCount: number): OptimizedPrompt {
    const examples: FewShotExample[] = [
      {
        input: 'Topic: "Artificial Intelligence", Language: English, Slides: 5',
        output: JSON.stringify({
          outline: [
            { title: 'Introduction to AI', title_eng: 'Introduction to AI' },
            { title: 'Machine Learning Fundamentals', title_eng: 'Machine Learning Fundamentals' },
            { title: 'AI Applications', title_eng: 'AI Applications' },
          ],
          slides: [
            { slideIndex: 0, title: 'What is AI?', title_eng: 'What is AI?', outlineIndex: 0 },
            { slideIndex: 1, title: 'History of AI', title_eng: 'History of AI', outlineIndex: 0 },
          ],
        }),
        explanation: 'Clear outline structure with logical progression',
      },
      {
        input: 'Topic: "Sun\'iy intellekt", Language: Uzbek, Slides: 4',
        output: JSON.stringify({
          outline: [
            { title: 'Sun\'iy intellekt asoslari', title_eng: 'AI Fundamentals' },
            { title: 'Mashinani o\'rgatish', title_eng: 'Machine Learning' },
            { title: 'AI qo\'llanmalari', title_eng: 'AI Applications' },
          ],
          slides: [
            { slideIndex: 0, title: 'AI nima?', title_eng: 'What is AI?', outlineIndex: 0 },
            { slideIndex: 2, title: 'ML algoritmlari', title_eng: 'ML Algorithms', outlineIndex: 1 },
          ],
        }),
        explanation: 'Proper Uzbek language with English translations',
      },
    ];

    const systemPrompt = `You are a professional presentation assistant. Create a structured outline and select slides.

RULES:
1. Generate EXACTLY 3 outlines
2. Each outline: "title" (${language}), "title_eng" (English)
3. Select slides using valid slideIndex (0 to ${slideCount - 1})
4. Each slide: slideIndex, title (${language}), title_eng (English), outlineIndex (0-2)
5. Outlines must relate to: "${topic}"

EXAMPLES:
${examples.map((ex, i) => `Example ${i + 1}:\nInput: ${ex.input}\nOutput: ${ex.output}`).join('\n\n')}`;

    const userPrompt = `Topic: "${topic}"
Language: ${language}
Slides Available: ${slideCount}
Valid Indexes: 0 to ${slideCount - 1}

Generate outline and slide selection as JSON.`;

    return {
      systemPrompt,
      userPrompt,
      estimatedTokens: this.estimateTokens(systemPrompt + userPrompt),
    };
  }

  /**
   * Build optimized prompt for slide content generation
   */
  buildContentPrompt(
    language: string,
    outlineTitle: string,
    elements: any[],
    diversityContext?: string
  ): OptimizedPrompt {
    const examples: FewShotExample[] = [
      {
        input: 'Element: Large title (500x100), Position: top-center',
        output: 'Introduction to Machine Learning',
        explanation: 'Short, clear title for main heading',
      },
      {
        input: 'Element: Body text (600x400), Position: center',
        output: 'Machine Learning is a subset of artificial intelligence that enables systems to learn and improve from experience without explicit programming. Key concepts include supervised learning, unsupervised learning, and reinforcement learning.',
        explanation: 'Detailed, informative content for body text',
      },
      {
        input: 'Element: Small label (150x50), Position: bottom-left',
        output: 'Key Concepts',
        explanation: 'Brief label for small element',
      },
    ];

    const systemPrompt = `Professional presentation content writer. Generate content for ALL elements.

CRITICAL RULES:
1. Content in ${language} language
2. Each element MUST have UNIQUE content (NO DUPLICATES!)
3. Match content to topic: "${outlineTitle}"
4. Consider element size/position for content style:
   - Large + top = Main title (3-8 words)
   - Medium + center = Body text (detailed)
   - Small = Labels (1-3 words)
5. Stay within maxCharacters (font auto-adjusts if slightly exceeded)
6. Add spaces between words
7. For similar-sized elements: provide DIFFERENT topics/aspects

${diversityContext || ''}

EXAMPLES:
${examples.map((ex, i) => `${i + 1}. Input: ${ex.input}\n   Output: "${ex.output}"\n   Note: ${ex.explanation}`).join('\n')}`;

    const elementsDescription = elements
      .map((el, i) =>
        `${i + 1}. [${el.index}] ${el.type} - ${el.width}x${el.height} at (${el.left},${el.top}) - Max: ${el.maxCharacters} chars`
      )
      .join('\n');

    const userPrompt = `Topic: "${outlineTitle}"
Language: ${language}
Elements (${elements.length} total):
${elementsDescription}

Generate content for ALL ${elements.length} elements. Each MUST be unique!`;

    return {
      systemPrompt,
      userPrompt,
      estimatedTokens: this.estimateTokens(systemPrompt + userPrompt),
    };
  }

  /**
   * Build optimized prompt for special slides (conclusion, references, etc.)
   */
  buildSpecialSlidePrompt(
    type: 'conclusion' | 'references' | 'thankYou',
    language: string,
    topic: string,
    elements: any[],
    options?: { referenceCount?: number }
  ): OptimizedPrompt {
    let systemPrompt = '';
    let userPrompt = '';

    switch (type) {
      case 'conclusion':
        systemPrompt = `Generate conclusion slide for topic: "${topic}".
Content in ${language}, 100-150 words summary.
Each element MUST have UNIQUE content.`;

        userPrompt = `Topic: "${topic}"
Language: ${language}
Elements: ${elements.length}
Generate concise conclusion covering key points.`;
        break;

      case 'references':
        const refCount = options?.referenceCount || 5;
        systemPrompt = `Generate ${refCount} academic references for topic: "${topic}".
All content in ${language}.
Main title: Translate "References" to ${language}
Body: List ${refCount} sources with author, title, date, publisher.`;

        userPrompt = `Topic: "${topic}"
Language: ${language}
References: ${refCount}
Format as numbered list (1., 2., 3...).`;
        break;

      case 'thankYou':
        systemPrompt = `Generate thank you slide for topic: "${topic}".
All content in ${language}.
Main element: "Thank you for your attention" in ${language}.`;

        userPrompt = `Topic: "${topic}"
Language: ${language}
Create professional thank you slide.`;
        break;
    }

    return {
      systemPrompt,
      userPrompt,
      estimatedTokens: this.estimateTokens(systemPrompt + userPrompt),
    };
  }

  /**
   * Track token usage
   */
  trackUsage(inputTokens: number, outputTokens: number): void {
    this.totalUsage.inputTokens += inputTokens;
    this.totalUsage.outputTokens += outputTokens;
    this.totalUsage.totalTokens += inputTokens + outputTokens;

    const cost =
      inputTokens * this.tokenCostPerInput +
      outputTokens * this.tokenCostPerOutput;

    this.totalUsage.estimatedCost += cost;
  }

  /**
   * Get total usage statistics
   */
  getTotalUsage(): TokenUsage {
    return { ...this.totalUsage };
  }

  /**
   * Calculate cost for token usage
   */
  calculateCost(inputTokens: number, outputTokens: number): number {
    return (
      inputTokens * this.tokenCostPerInput +
      outputTokens * this.tokenCostPerOutput
    );
  }

  /**
   * Get usage summary
   */
  getUsageSummary(): string {
    const usage = this.totalUsage;
    return `
Token Usage Summary:
  Input Tokens:  ${usage.inputTokens.toLocaleString()}
  Output Tokens: ${usage.outputTokens.toLocaleString()}
  Total Tokens:  ${usage.totalTokens.toLocaleString()}
  Estimated Cost: $${usage.estimatedCost.toFixed(4)}
`;
  }

  /**
   * Reset usage tracking
   */
  resetUsage(): void {
    this.totalUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    };
  }
}
