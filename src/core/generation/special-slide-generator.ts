/**
 * Special Slide Generator
 *
 * Generates conclusion, references, and thank-you slides.
 * Unifies logic from structured-generator.ts and ai-slide-placer.ts.
 */

import { AIClient } from '../ai/ai-client';
import { EnhancedLogger, LogLevel } from '../../lib/logger';
import { createLayoutVisualization, getPositionDescription } from '../utils/layout-helpers';
import { AISlideElement } from '../types/generation';
import { createSpecialSlideSchema } from '../schemas/ai-response-schemas';

interface SpecialSlideParams {
  slide: { id: string; elements: any[] };
  topic: string;
  language: string;
}

interface ReferencesParams extends SpecialSlideParams {
  count?: number;
}

export class SpecialSlideGenerator {
  private aiClient: AIClient;
  private logger: EnhancedLogger;

  constructor(aiClient: AIClient, logger?: EnhancedLogger) {
    this.aiClient = aiClient;
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
  }

  async generateConclusion(params: SpecialSlideParams): Promise<any> {
    const { slide, topic, language } = params;
    const textElements = this.extractTextElements(slide);
    const layoutVisualization = createLayoutVisualization(textElements as AISlideElement[]);
    const elementGuide = this.buildElementGuide(textElements, 'conclusion', language);
    const schema = createSpecialSlideSchema(textElements.length);

    const result = await this.aiClient.call<{ slideId: string; elements: any[] }>({
      operationName: 'generateConclusion',
      temperature: 0.7,
      responseFormat: 'json_schema',
      responseSchema: schema,
      messages: [
        {
          role: 'system',
          content: `You are a world-class presentation writer. Generate a powerful CONCLUSION slide for: "${topic}".

YOUR TASK: Write a compelling summary that reinforces the most important takeaways. The conclusion should leave the audience with clear, memorable insights.

LANGUAGE: ALL content in ${language}. Do NOT mix languages.

CONTENT STRATEGY:
- TITLE element (largest font/area): Write "${topic}" translated into ${language}, or a concluding phrase like "Xulosa" / "Yakuniy xulosalar"
- BODY elements: Write 4-6 KEY TAKEAWAYS as bullet points using "• " prefix:
  * Each takeaway = one complete, specific insight about "${topic}"
  * Include the most impactful facts, statistics, or conclusions
  * Example: "• Sun'iy intellekt 2030-yilga kelib global IYaMga 15.7 trillion dollar qo'shishi prognoz qilinmoqda"
  * NOT generic: "• Bu mavzu juda muhim" ❌
- LABEL elements: Short conclusive phrases like "Asosiy xulosalar" or "Natijalar"
- Each element MUST have UNIQUE content
- Fill 80-95% of maxCharacters

OUTPUT: Generate content for ALL ${textElements.length} elements. Use elementIndex values EXACTLY as shown. slideId = "${slide.id}".

${layoutVisualization}

${elementGuide}`,
        },
      ],
      fallback: () => this.buildFallback(slide.id, textElements, this.translate('conclusion', language), language),
    });

    this.logger.info('Conclusion slide generated', {
      slideId: slide.id,
      tokenUsage: result.usage.totalTokens,
    });

    return this.applyPlacements(slide, result.data);
  }

  async generateReferences(params: ReferencesParams): Promise<any> {
    const { slide, topic, language, count = 5 } = params;
    const textElements = this.extractTextElements(slide);
    const layoutVisualization = createLayoutVisualization(textElements as AISlideElement[]);
    const elementGuide = this.buildElementGuide(textElements, 'references', language);
    const schema = createSpecialSlideSchema(textElements.length);

    const result = await this.aiClient.call<{ slideId: string; elements: any[] }>({
      operationName: 'generateReferences',
      temperature: 0.7,
      responseFormat: 'json_schema',
      responseSchema: schema,
      messages: [
        {
          role: 'system',
          content: `You are an expert academic researcher. Generate ${count} REALISTIC academic references for: "${topic}".

LANGUAGE: ALL content in ${language}. Do NOT mix languages.

CONTENT STRATEGY:
- TITLE element (largest font/area): Translate "References" into ${language} (Uzbek: "Foydalanilgan adabiyotlar", Russian: "Список литературы", English: "References")
- MAIN BODY element (largest area): Place ALL ${count} references as a numbered list
- LABEL elements: Short markers like "Adabiyotlar ro'yxati" in ${language}

REFERENCE QUALITY — Generate REALISTIC, plausible references:
- Use real-sounding author names appropriate for the field of "${topic}"
- Titles must be specific to "${topic}" (not generic academic titles)
- Mix of: 2 books, 2 journal articles, 1 conference paper or web source
- Use years between 2018-2024 for relevance
- Alphabetical order by first author's last name

FORMAT (numbered list):
1. Surname I.I. Book Title. — City: Publisher, Year. — Pages p.
2. Surname I.I., Surname I.I. Article title // Journal Name. — Year. — Vol. X, № Y. — P. XX-YY.
3. Surname I.I. Conference paper title // Conference Name. — City, Year. — P. XX-YY.
4. Surname I.I. Web resource title. — URL: https://... (accessed: DD.MM.YYYY).

OUTPUT: Generate content for ALL ${textElements.length} elements. Use elementIndex values EXACTLY as shown. slideId = "${slide.id}".

${layoutVisualization}

${elementGuide}`,
        },
      ],
      fallback: () => this.buildFallback(slide.id, textElements, this.translate('references', language), language),
    });

    this.logger.info('References slide generated', {
      slideId: slide.id,
      referenceCount: count,
      tokenUsage: result.usage.totalTokens,
    });

    return this.applyPlacements(slide, result.data);
  }

  async generateThankYou(params: SpecialSlideParams): Promise<any> {
    const { slide, topic, language } = params;
    const textElements = this.extractTextElements(slide);
    const layoutVisualization = createLayoutVisualization(textElements as AISlideElement[]);
    const elementGuide = this.buildElementGuide(textElements, 'thankyou', language);
    const schema = createSpecialSlideSchema(textElements.length);

    const result = await this.aiClient.call<{ slideId: string; elements: any[] }>({
      operationName: 'generateThankYou',
      temperature: 0.5,
      responseFormat: 'json_schema',
      responseSchema: schema,
      messages: [
        {
          role: 'system',
          content: `Generate a professional "Thank You" closing slide for a presentation about: "${topic}".

LANGUAGE: ALL content in ${language}. Do NOT mix languages.

CONTENT:
- MAIN element (largest font/area): The thank you phrase in ${language}:
  * Uzbek: "E'tiboringiz uchun rahmat!"
  * Russian: "Спасибо за внимание!"
  * English: "Thank you for your attention!"
- Other elements — use DIFFERENT content for each:
  * Q&A invitation: "Savollar va muhokama" / "Вопросы?" / "Questions & Discussion"
  * Topic summary: A brief one-line summary of "${topic}"
  * Contact placeholder: "Aloqa: [email/phone]"
  * Presentation date or occasion marker
- Each element MUST have UNIQUE content

OUTPUT: Generate content for ALL ${textElements.length} elements. Use elementIndex values EXACTLY as shown. slideId = "${slide.id}".

${layoutVisualization}

${elementGuide}`,
        },
      ],
      fallback: () => this.buildFallback(slide.id, textElements, this.translate('thankyou', language), language),
    });

    this.logger.info('Thank you slide generated', {
      slideId: slide.id,
      tokenUsage: result.usage.totalTokens,
    });

    return this.applyPlacements(slide, result.data);
  }

  // ===== Private Helpers =====

  private extractTextElements(slide: { elements: any[] }): any[] {
    return slide.elements
      .map((el: any, idx: number) => ({
        index: idx,
        type: el.type,
        width: el.width || 0,
        height: el.height || 0,
        left: el.left || 0,
        top: el.top || 0,
        currentContent: el.content || '',
        fontSize: el.fontSize || 14,
        maxCharacters: el.maxCharacters || 100,
        tableData: el.tableData || null,
      }))
      .filter(
        (el: any) => el.type === 'text' || el.type === 'shape' || el.type === 'table'
      );
  }

  private buildElementGuide(textElements: any[], slideType: string, language: string): string {
    return `ELEMENT GUIDE (${textElements.length} elements):
${textElements
  .map((el: any, i: number) => {
    const positionDesc = getPositionDescription(el as AISlideElement, textElements as AISlideElement[]);
    const area = el.width * el.height;
    const isLargestFont = el.fontSize >= Math.max(...textElements.map((e: any) => e.fontSize));
    const isLargestArea = area >= Math.max(...textElements.map((e: any) => (e.width || 0) * (e.height || 0)));

    let contentRole: string;
    if (isLargestFont || (el.top < 100 && el.width > 500)) {
      if (slideType === 'references') {
        contentRole = `TITLE — translate "References" into ${language}`;
      } else if (slideType === 'thankyou') {
        contentRole = `MAIN — translate "Thank you for your attention!" into ${language}`;
      } else {
        contentRole = `TITLE — write the topic name in ${language}`;
      }
    } else if (isLargestArea || el.height > 300) {
      if (slideType === 'references') {
        contentRole = 'BODY — place ALL numbered references here';
      } else {
        contentRole = 'BODY — main content text';
      }
    } else if (el.width < 200 && el.height < 100) {
      contentRole = `LABEL — short label in ${language}`;
    } else {
      contentRole = `CONTENT — supporting text in ${language}`;
    }

    return `  Element [${el.index}] (elementIndex: ${el.index}) — ${el.type.toUpperCase()}
    Location: ${positionDesc}
    Size: ${el.width}px × ${el.height}px | Font: ${el.fontSize}px | Max chars: ${el.maxCharacters}
    Role: ${contentRole}`;
  })
  .join('\n\n')}`;
  }

  private applyPlacements(slide: { id: string; elements: any[] }, generatedData: any): any {
    return {
      ...slide,
      elements: slide.elements.map((el: any, idx: number) => {
        const generatedElement = generatedData.elements?.find(
          (ge: any) => ge.elementIndex === idx
        );

        if (
          generatedElement &&
          (el.type === 'text' || el.type === 'shape' || el.type === 'table')
        ) {
          return { ...el, content: generatedElement.content };
        }

        return el;
      }),
    };
  }

  /**
   * Translate default slide titles based on language
   */
  private translate(key: 'conclusion' | 'references' | 'thankyou', language: string): string {
    const lang = language.toLowerCase();
    const translations: Record<string, Record<string, string>> = {
      conclusion: {
        uzbek: 'Xulosa', uz: 'Xulosa',
        russian: 'Заключение', ru: 'Заключение',
        english: 'Conclusion', en: 'Conclusion',
        kazakh: 'Қорытынды', kk: 'Қорытынды',
        turkish: 'Sonuç', tr: 'Sonuç',
        korean: '결론', ko: '결론',
        chinese: '结论', zh: '结论',
        japanese: '結論', ja: '結論',
        german: 'Fazit', de: 'Fazit',
        french: 'Conclusion', fr: 'Conclusion',
        spanish: 'Conclusión', es: 'Conclusión',
        arabic: 'الخلاصة', ar: 'الخلاصة',
      },
      references: {
        uzbek: 'Foydalanilgan adabiyotlar', uz: 'Foydalanilgan adabiyotlar',
        russian: 'Список литературы', ru: 'Список литературы',
        english: 'References', en: 'References',
        kazakh: 'Әдебиеттер тізімі', kk: 'Әдебиеттер тізімі',
        turkish: 'Kaynakça', tr: 'Kaynakça',
        korean: '참고문헌', ko: '참고문헌',
        chinese: '参考文献', zh: '参考文献',
        japanese: '参考文献', ja: '参考文献',
        german: 'Literaturverzeichnis', de: 'Literaturverzeichnis',
        french: 'Références', fr: 'Références',
        spanish: 'Referencias', es: 'Referencias',
        arabic: 'المراجع', ar: 'المراجع',
      },
      thankyou: {
        uzbek: "E'tiboringiz uchun rahmat!", uz: "E'tiboringiz uchun rahmat!",
        russian: 'Спасибо за внимание!', ru: 'Спасибо за внимание!',
        english: 'Thank you for your attention!', en: 'Thank you for your attention!',
        kazakh: 'Назарларыңызға рахмет!', kk: 'Назарларыңызға рахмет!',
        turkish: 'İlginiz için teşekkürler!', tr: 'İlginiz için teşekkürler!',
        korean: '경청해 주셔서 감사합니다!', ko: '경청해 주셔서 감사합니다!',
        chinese: '感谢您的关注！', zh: '感谢您的关注！',
        japanese: 'ご清聴ありがとうございました！', ja: 'ご清聴ありがとうございました！',
        german: 'Vielen Dank für Ihre Aufmerksamkeit!', de: 'Vielen Dank für Ihre Aufmerksamkeit!',
        french: "Merci pour votre attention\u00A0!", fr: "Merci pour votre attention\u00A0!",
        spanish: '¡Gracias por su atención!', es: '¡Gracias por su atención!',
        arabic: 'شكراً لاهتمامكم!', ar: 'شكراً لاهتمامكم!',
      },
    };

    return translations[key]?.[lang] || translations[key]?.['english'] || key;
  }

  private buildFallback(slideId: string, textElements: any[], defaultTitle: string, language: string): any {
    return {
      slideId,
      elements: textElements.map((el, i) => ({
        elementIndex: el.index,
        content: i === 0 ? defaultTitle : `[${language} content ${i}]`,
      })),
    };
  }
}
