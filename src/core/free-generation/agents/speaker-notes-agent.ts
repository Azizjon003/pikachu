/**
 * Speaker Notes Agent
 *
 * Generates presenter notes for each slide:
 * 1. Title slide — introduction script
 * 2. Content slides — talking points with timing hints
 * 3. Data slides — key numbers to emphasize
 * 4. Conclusion — summary wrap-up
 * 5. Thank you — closing remarks
 */

import { AIClient } from '@/src/core/ai/ai-client';
import { EnhancedLogger, LogLevel } from '@/src/lib/logger';

export interface SpeakerNotesResult {
  slidesProcessed: number;
  notesGenerated: number;
}

export class SpeakerNotesAgent {
  private aiClient: AIClient;
  private logger: EnhancedLogger;

  constructor(aiClient: AIClient, logger?: EnhancedLogger) {
    this.aiClient = aiClient;
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
  }

  /**
   * Generate speaker notes for all slides
   */
  async generate(
    slides: any[],
    topic: string,
    language: string,
    outlineTitles: string[]
  ): Promise<SpeakerNotesResult> {
    // Extract slide summaries for AI context
    const slideSummaries = slides.map((slide, i) => {
      const texts = slide.elements
        .filter((el: any) => el.type === 'text' && el.content)
        .map((el: any) => this.stripHTML(el.content).substring(0, 100))
        .filter((t: string) => t.length > 3);

      let role = 'content';
      if (i === 0) role = 'title';
      else if (i === 1) role = 'outline';
      else if (i === slides.length - 1) role = 'thank-you';
      else if (i === slides.length - 2) role = 'references';
      else if (i === slides.length - 3) role = 'conclusion';

      return { index: i, role, texts: texts.slice(0, 4) };
    });

    try {
      const result = await this.aiClient.call<{
        notes: Array<{ index: number; note: string }>;
      }>({
        operationName: 'speakerNotes',
        temperature: 0.7,
        responseFormat: 'json_object',
        messages: [
          {
            role: 'system',
            content: `You generate concise speaker notes for presentation slides.

RULES:
- Write in ${language}
- Each note: 2-4 sentences, natural speaking style
- Title slide: brief introduction of the topic and presenter
- Content slides: key talking points, emphasize important data
- Conclusion: summarize main takeaways
- Thank you: closing remarks, invite questions
- Do NOT repeat slide text verbatim — add context, transitions, emphasis
- Include transition phrases between slides: "Let's move on to...", "Now let's look at..."
- Return JSON: { "notes": [{ "index": 0, "note": "..." }, ...] }`,
          },
          {
            role: 'user',
            content: `Topic: "${topic}"
Outline: ${outlineTitles.join(', ')}

Slides:
${slideSummaries.map(s =>
  `[${s.index}] Role=${s.role}, Content: ${s.texts.join(' | ') || '(visual slide)'}`
).join('\n')}`,
          },
        ],
        fallback: () => ({ notes: [] }),
      });

      let notesGenerated = 0;
      for (const note of result.data.notes) {
        if (note.index >= 0 && note.index < slides.length && note.note) {
          slides[note.index].remark = note.note;
          notesGenerated++;
        }
      }

      return { slidesProcessed: slides.length, notesGenerated };
    } catch (error) {
      this.logger.warn('Speaker notes generation failed', { error });
      return { slidesProcessed: slides.length, notesGenerated: 0 };
    }
  }

  private stripHTML(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
  }
}
