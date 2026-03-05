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
          content: `You are a professional presentation content writer. Generate a conclusion slide for the topic: "${topic}".

TASK: Write a concise summary (100-150 words) covering the key takeaways of "${topic}".

LANGUAGE: Write ALL content in ${language}. Do NOT mix languages.

CONTENT RULES:
- The LARGEST element (biggest font size or biggest area) = slide title. Write the topic name "${topic}" as the title, translated into ${language}.
- Other elements = body content. Write clear, complete declarative sentences summarizing the main points.
- Each element MUST have UNIQUE content — NO DUPLICATES or similar text.
- Stay within maxCharacters limits for each element (slight overflow OK — font will auto-adjust).
- Use terminology specific to "${topic}" — avoid generic filler text.

OUTPUT RULES:
- You MUST generate content for ALL ${textElements.length} elements listed below.
- Use the elementIndex values EXACTLY as shown in the element guide.
- slideId must be "${slide.id}".

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
          content: `You are a professional academic reference generator. Generate ${count} realistic academic literature references for the topic: "${topic}".

LANGUAGE: Write ALL content in ${language}. Do NOT mix languages.

CONTENT RULES:
- The LARGEST element (biggest font size or biggest area) = slide title. Translate "References" into ${language} (e.g., Uzbek: "Foydalanilgan adabiyotlar", Russian: "Список литературы", English: "References").
- The LARGEST body element = place ALL ${count} references here as a numbered list.
- Other smaller elements = relevant labels or section markers in ${language}.
- Each element MUST have UNIQUE content.
- Stay within maxCharacters limits (slight overflow OK).

REFERENCE FORMAT:
- Generate ${count} realistic references about "${topic}"
- Include: author(s), title, date, publisher/journal
- Mix of books, journal articles, and conference papers
- Alphabetical order by author's last name
- Numbered list format: 1. Author A.A. Title. Publisher, Year.
- Example formats:
  * Book: "Author A.A. Title. Publisher, Year."
  * Article: "Author A.A. Article title // Journal. Year. Vol. Pages."
  * Web: "Author A.A. Title. URL (access date)"

OUTPUT RULES:
- Generate content for ALL ${textElements.length} elements.
- Use the elementIndex values EXACTLY as shown.
- slideId must be "${slide.id}".

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
          content: `You are a professional presentation content writer. Generate a "Thank You" slide for: "${topic}".

LANGUAGE: Write ALL content in ${language}. Do NOT mix languages.

CONTENT RULES:
- The LARGEST element (biggest font size or biggest area) = main thank you phrase. Translate "Thank you for your attention!" into ${language} (e.g., Uzbek: "E'tiboringiz uchun rahmat!", Russian: "Спасибо за внимание!", English: "Thank you for your attention!").
- Other elements = supportive text: contact info placeholders, Q&A invitation, topic summary phrase, etc.
- Each element MUST have UNIQUE content.
- Stay within maxCharacters limits.

OUTPUT RULES:
- Generate content for ALL ${textElements.length} elements.
- Use the elementIndex values EXACTLY as shown.
- slideId must be "${slide.id}".

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
