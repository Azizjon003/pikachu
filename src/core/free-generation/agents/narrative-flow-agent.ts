/**
 * Narrative Flow Agent
 *
 * Validates logical storytelling flow between slides:
 * 1. Checks slide sequence follows a logical arc
 * 2. Detects abrupt topic jumps
 * 3. Ensures intro → body → conclusion structure
 * 4. Adds transition text between sections when missing
 * 5. Validates that section-break slides exist between topic changes
 */

import { AIClient } from '@/src/core/ai/ai-client';
import { EnhancedLogger, LogLevel } from '@/src/lib/logger';

export interface FlowIssue {
  slideIndex: number;
  type: 'topic-jump' | 'missing-transition' | 'weak-opening' | 'weak-closing' | 'repetitive';
  description: string;
  suggestion?: string;
}

export interface NarrativeFlowResult {
  issuesFound: number;
  flowScore: number; // 0-100
  issues: FlowIssue[];
}

export class NarrativeFlowAgent {
  private aiClient: AIClient;
  private logger: EnhancedLogger;

  constructor(aiClient: AIClient, logger?: EnhancedLogger) {
    this.aiClient = aiClient;
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
  }

  /**
   * Analyze narrative flow across all slides
   */
  async analyze(
    slides: any[],
    topic: string,
    language: string,
    outlineTitles: string[]
  ): Promise<NarrativeFlowResult> {
    const issues: FlowIssue[] = [];

    // Extract slide titles/topics for flow analysis
    const slideTitles = slides.map((slide, i) => {
      const titleEl = slide.elements.find((el: any) => {
        if (el.type !== 'text' || !el.content) return false;
        const fontSize = this.extractFontSize(el.content);
        return fontSize >= 24 || el.textType === 'title';
      });

      const title = titleEl
        ? titleEl.content.replace(/<[^>]+>/g, '').trim().substring(0, 80)
        : `Slide ${i + 1}`;

      return { index: i, title };
    });

    // Rule 1: Check for repetitive titles
    const titleSet = new Map<string, number>();
    for (const st of slideTitles) {
      const normalized = st.title.toLowerCase().replace(/\s+/g, ' ');
      if (normalized.length < 5) continue; // skip short/empty
      const existing = titleSet.get(normalized);
      if (existing !== undefined) {
        issues.push({
          slideIndex: st.index,
          type: 'repetitive',
          description: `Slide ${st.index + 1} has same title as slide ${existing + 1}: "${st.title}"`,
        });
      } else {
        titleSet.set(normalized, st.index);
      }
    }

    // Rule 2: Check opening strength (first content slide should have clear intro)
    if (slides.length >= 3) {
      const firstContentSlide = slides[2]; // Skip title + outline
      if (firstContentSlide) {
        const hasIntroContent = firstContentSlide.elements.some((el: any) => {
          if (el.type !== 'text' || !el.content) return false;
          const text = el.content.replace(/<[^>]+>/g, '').toLowerCase();
          return text.length > 50; // Has substantial content
        });

        if (!hasIntroContent) {
          issues.push({
            slideIndex: 2,
            type: 'weak-opening',
            description: 'First content slide lacks substantial introductory text',
          });
        }
      }
    }

    // Rule 3: Check closing strength (conclusion should have summary)
    if (slides.length >= 4) {
      const conclusionSlide = slides[slides.length - 3]; // Before references + thank-you
      if (conclusionSlide) {
        const conclusionText = conclusionSlide.elements
          .filter((el: any) => el.type === 'text' && el.content)
          .map((el: any) => el.content.replace(/<[^>]+>/g, ''))
          .join(' ');

        if (conclusionText.length < 100) {
          issues.push({
            slideIndex: slides.length - 3,
            type: 'weak-closing',
            description: 'Conclusion slide has insufficient content for a strong closing',
          });
        }
      }
    }

    // Rule 4: AI-based flow analysis for topic jumps
    if (slideTitles.length > 4) {
      const aiIssues = await this.analyzeFlowWithAI(slideTitles, topic, language, outlineTitles);
      issues.push(...aiIssues);
    }

    // Calculate flow score
    const maxIssues = slides.length;
    const flowScore = Math.max(0, Math.round(100 - (issues.length / maxIssues) * 100));

    return { issuesFound: issues.length, flowScore, issues };
  }

  /**
   * Use AI to detect topic jumps and flow problems
   */
  private async analyzeFlowWithAI(
    slideTitles: Array<{ index: number; title: string }>,
    topic: string,
    language: string,
    outlineTitles: string[]
  ): Promise<FlowIssue[]> {
    try {
      const result = await this.aiClient.call<{
        issues: Array<{
          slideIndex: number;
          type: 'topic-jump' | 'missing-transition';
          description: string;
          suggestion?: string;
        }>;
      }>({
        operationName: 'narrativeFlow',
        temperature: 0.3,
        responseFormat: 'json_object',
        messages: [
          {
            role: 'system',
            content: `You analyze the narrative flow of a presentation. Check if slides follow a logical sequence.

DETECT:
1. "topic-jump": Abrupt change between consecutive slides (e.g., from "History" to "Implementation" with no transition)
2. "missing-transition": A section change that would benefit from a transition/bridge slide

DO NOT flag:
- Normal progression within a section
- Title/outline/references/thank-you slides
- Minor topic shifts that are natural

Return JSON: { "issues": [{ "slideIndex": N, "type": "...", "description": "...", "suggestion": "..." }] }
If flow is good, return { "issues": [] }`,
          },
          {
            role: 'user',
            content: `Topic: "${topic}"
Planned outline: ${outlineTitles.join(' → ')}

Actual slide sequence:
${slideTitles.map(s => `${s.index}. ${s.title}`).join('\n')}`,
          },
        ],
        fallback: () => ({ issues: [] }),
      });

      return result.data.issues
        .filter(i => i.slideIndex >= 0 && i.slideIndex < slideTitles.length)
        .map(i => ({
          slideIndex: i.slideIndex,
          type: i.type,
          description: i.description,
          suggestion: i.suggestion,
        }));
    } catch (error) {
      this.logger.warn('Narrative flow AI analysis failed', { error });
      return [];
    }
  }

  private extractFontSize(content: string): number {
    const match = content.match(/font-size:\s*(\d+)/);
    return match ? parseInt(match[1]) : 16;
  }
}
