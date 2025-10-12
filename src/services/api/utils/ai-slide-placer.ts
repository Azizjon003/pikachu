/**
 * AI-Powered Slide Content Placer
 *
 * Intelligently places content in slide elements using OpenAI
 * Handles title page, outline page, conclusion, references, and thank you slides
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

interface SlideElement {
  type: string;
  width: number;
  height: number;
  left: number;
  top: number;
  content: string;
  fontSize: number;
  maxCharacters: number;
  elementIndex: number;
  [key: string]: any;
}

interface Slide {
  elements: SlideElement[];
  [key: string]: any;
}

interface PlacementResult {
  elementIndex: number;
  content: string;
  confidence: number;
  reasoning: string;
}

export class AISlidePlacer {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OPENAI_API_KEY is required');
    }
    this.openai = new OpenAI({ apiKey: key });
  }

  /**
   * Place title and author on first slide
   */
  async placeTitlePage(
    slide: Slide,
    topic: string,
    author: string
  ): Promise<Slide> {
    console.log('\n🎯 AI: Placing title and author on first slide...');
    console.log(`   Topic: "${topic}"`);
    console.log(`   Author: "${author}"`);

    const textElements = slide.elements
      .filter(el => el.type === 'shape' && el.content)
      .map((el, idx) => ({
        index: el.elementIndex,
        content: el.content,
        fontSize: el.fontSize,
        top: el.top,
        left: el.left,
        width: el.width,
        height: el.height,
        maxCharacters: el.maxCharacters
      }));

    console.log(`   Found ${textElements.length} text elements`);

    const prompt = `You are a PowerPoint slide layout analyzer. Your task is to identify which text placeholders should contain the TITLE and which should contain the AUTHOR NAME on a title slide.

Content to place:
- TITLE: "${topic}"
- AUTHOR: "${author}"

Available text elements on this slide:
${textElements.map((el, i) => `
Element #${i} (elementIndex: ${el.index}):
  • Current content: "${el.content}"
  • Font size: ${el.fontSize}px
  • Position: top=${el.top}, left=${el.left}
  • Size: ${el.width}x${el.height}
  • Max characters: ${el.maxCharacters}
`).join('\n')}

CRITICAL RULES FOR IDENTIFICATION:

1. TITLE element characteristics:
   ✓ Has the LARGEST font size among all elements (typically 36-60px)
   ✓ Positioned in upper-center or center of slide
   ✓ Has larger maxCharacters (typically > 50)
   ✓ Usually positioned higher (smaller top value) or centered
   ✓ Current content might say "Title", "Mavzu", "Topic", or be placeholder text

2. AUTHOR element characteristics:
   ✓ Has SMALLER font size than title (typically 20-32px)
   ✓ Positioned BELOW the title (larger top value)
   ✓ Has smaller maxCharacters (typically 30-60)
   ✓ Current content might say "Author", "Muallif", or be placeholder text
   ✓ Usually in lower portion of slide

IMPORTANT:
- Compare ALL elements by font size - the LARGEST is almost always the title
- The author should be positioned BELOW (higher top value) the title
- These MUST be two DIFFERENT elements

Return ONLY this JSON structure (no markdown, no explanations):
{
  "title": {
    "elementIndex": <number>,
    "confidence": <0.0-1.0>,
    "reasoning": "<brief explanation why this is the title>"
  },
  "author": {
    "elementIndex": <number>,
    "confidence": <0.0-1.0>,
    "reasoning": "<brief explanation why this is the author>"
  }
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a PowerPoint slide analyzer. Return ONLY valid JSON, no markdown, no explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      console.log(`  ✅ AI detected title element: ${result.title.elementIndex} (confidence: ${(result.title.confidence * 100).toFixed(0)}%)`);
      console.log(`  ✅ AI detected author element: ${result.author.elementIndex} (confidence: ${(result.author.confidence * 100).toFixed(0)}%)`);

      // Apply content to slide
      const updatedSlide = {
        ...slide,
        elements: slide.elements.map(el => {
          if (el.elementIndex === result.title.elementIndex) {
            return { ...el, content: topic };
          }
          if (el.elementIndex === result.author.elementIndex) {
            return { ...el, content: author };
          }
          return el;
        })
      };

      return updatedSlide;
    } catch (error) {
      console.error('❌ AI placement failed:', error);
      throw error;
    }
  }

  /**
   * Place outline items on second slide
   */
  async placeOutline(
    slide: Slide,
    outlineItems: string[]
  ): Promise<Slide> {
    console.log('\n🎯 AI: Placing outline items on second slide...');
    console.log(`   Outline items to place: ${outlineItems.length}`);
    outlineItems.forEach((item, i) => console.log(`   ${i + 1}. ${item}`));

    const textElements = slide.elements
      .filter(el => el.type === 'shape' && el.content)
      .map(el => ({
        index: el.elementIndex,
        content: el.content,
        fontSize: el.fontSize,
        top: el.top,
        left: el.left,
        maxCharacters: el.maxCharacters
      }));

    console.log(`   Found ${textElements.length} text elements`);

    const prompt = `You are a PowerPoint outline slide analyzer. Your task is to identify which element should be the HEADER and which ${outlineItems.length} elements should contain the OUTLINE ITEMS.

Outline items to place:
${outlineItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

Available text elements on this slide:
${textElements.map((el, i) => `
Element #${i} (elementIndex: ${el.index}):
  • Current content: "${el.content}"
  • Font size: ${el.fontSize}px
  • Position: top=${el.top}, left=${el.left}
  • Max characters: ${el.maxCharacters}
`).join('\n')}

CRITICAL RULES FOR IDENTIFICATION:

1. HEADER element (the title "Reja:"):
   ✓ SHORTEST text among all (< 15 characters)
   ✓ LARGE font size (> 32px, often 40-50px)
   ✓ Positioned at TOP of slide (smallest top value)
   ✓ Current content might say "Reja", "Plan", "Outline", "Режа" or similar
   ✓ Should only contain the word "Reja:" and nothing else

2. OUTLINE ITEMS (${outlineItems.length} elements):
   ✓ MEDIUM font size (18-28px) - smaller than header but readable
   ✓ Positioned VERTICALLY below header in order from top to bottom
   ✓ Should accommodate numbered text like "1. Item text"
   ✓ MUST have sufficient maxCharacters to fit the items
   ✓ Current content might have numbers "1.", "2.", "3." or be placeholder text
   ✓ IMPORTANT: Order by 'top' position (smallest to largest top value = first to last item)

IMPORTANT:
- The HEADER is the element with the LARGEST font AND positioned at top
- The ${outlineItems.length} OUTLINE ITEMS should be sorted by their 'top' position
- First item has smallest 'top' value, last item has largest 'top' value
- All items must be DIFFERENT elements (no duplicates)
- If you see elements starting with "1.", "2.", "3." those are likely the outline items

Return ONLY this JSON structure (no markdown, no explanations):
{
  "header": {
    "elementIndex": <number>,
    "confidence": <0.0-1.0>,
    "reasoning": "<why this is the header>"
  },
  "items": [
    {"elementIndex": <number>, "order": 1, "confidence": <0.0-1.0>, "reasoning": "<why this is item 1>"},
    {"elementIndex": <number>, "order": 2, "confidence": <0.0-1.0>, "reasoning": "<why this is item 2>"},
    {"elementIndex": <number>, "order": 3, "confidence": <0.0-1.0>, "reasoning": "<why this is item 3>"}
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a PowerPoint slide analyzer. Return ONLY valid JSON, no markdown, no explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      console.log(`  ✅ AI detected header element: ${result.header.elementIndex} (${result.header.reasoning})`);
      result.items.forEach((item: any, i: number) => {
        console.log(`  ✅ AI detected outline item ${i + 1}: element ${item.elementIndex} - ${item.reasoning} (confidence: ${(item.confidence * 100).toFixed(0)}%)`);
      });

      // Apply content to slide
      const updatedSlide = {
        ...slide,
        elements: slide.elements.map(el => {
          // Header
          if (el.elementIndex === result.header.elementIndex) {
            return { ...el, content: 'Reja:' };
          }
          // Outline items
          const itemMatch = result.items.find((item: any) => item.elementIndex === el.elementIndex);
          if (itemMatch) {
            const itemIndex = itemMatch.order - 1;
            return { ...el, content: `${itemIndex + 1}. ${outlineItems[itemIndex]}` };
          }
          return el;
        })
      };

      return updatedSlide;
    } catch (error) {
      console.error('❌ AI outline placement failed:', error);
      throw error;
    }
  }

  /**
   * Place conclusion content
   */
  async placeConclusion(
    slide: Slide,
    topic: string,
    language: string = 'Uzbek'
  ): Promise<Slide> {
    console.log('\n🎯 AI: Generating and placing conclusion...');

    const textElements = slide.elements
      .filter(el => el.type === 'shape' && el.content)
      .map(el => ({
        index: el.elementIndex,
        content: el.content,
        fontSize: el.fontSize,
        top: el.top,
        maxCharacters: el.maxCharacters
      }));

    const prompt = `You are a PowerPoint content generator. Create a CONCLUSION slide for a presentation about "${topic}".

Available text elements:
${textElements.map((el, i) => `Element ${i} (elementIndex: ${el.index}):
  - Font size: ${el.fontSize}
  - Position: top=${el.top}
  - Max characters: ${el.maxCharacters}
`).join('\n')}

Task:
1. Identify which element should be the TITLE (largest font, top position)
2. Identify which elements should contain CONCLUSION CONTENT (smaller fonts, below title)
3. Generate appropriate content in ${language} for each element

Title should be: "Xulosa" or "Conclusion" or similar
Content should summarize key points about ${topic}

Return JSON with this EXACT structure:
{
  "placements": [
    {
      "elementIndex": <number>,
      "content": "<text in ${language}>",
      "type": "title|content",
      "confidence": <0-1>
    }
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a PowerPoint content generator. Generate concise, professional content in ${language}. Return ONLY valid JSON.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      result.placements.forEach((placement: any) => {
        console.log(`  ✅ AI placed ${placement.type} at element ${placement.elementIndex}: "${placement.content.substring(0, 50)}..."`);
      });

      // Apply content to slide
      const updatedSlide = {
        ...slide,
        elements: slide.elements.map(el => {
          const placement = result.placements.find((p: any) => p.elementIndex === el.elementIndex);
          if (placement) {
            return { ...el, content: placement.content };
          }
          return el;
        })
      };

      return updatedSlide;
    } catch (error) {
      console.error('❌ AI conclusion placement failed:', error);
      throw error;
    }
  }

  /**
   * Place references/bibliography
   */
  async placeReferences(
    slide: Slide,
    topic: string,
    count: number = 5,
    language: string = 'Uzbek'
  ): Promise<Slide> {
    console.log('\n🎯 AI: Generating and placing references...');
    console.log(`   Topic: "${topic}"`);
    console.log(`   Reference count: ${count}`);
    console.log(`   Language: ${language}`);

    const textElements = slide.elements
      .filter(el => el.type === 'shape' && el.content)
      .map(el => ({
        index: el.elementIndex,
        content: el.content,
        fontSize: el.fontSize,
        top: el.top,
        left: el.left,
        maxCharacters: el.maxCharacters
      }));

    console.log(`   Found ${textElements.length} text elements`);

    const prompt = `You are an academic bibliography generator for PowerPoint slides. Create a REFERENCES slide for a presentation about "${topic}".

Available text elements on this slide:
${textElements.map((el, i) => `
Element #${i} (elementIndex: ${el.index}):
  • Current content: "${el.content}"
  • Font size: ${el.fontSize}px
  • Position: top=${el.top}, left=${el.left}
  • Max characters: ${el.maxCharacters}
`).join('\n')}

YOUR TASK:
1. Identify the TITLE element (should display "Foydalanilgan adabiyotlar" in ${language})
2. Identify ${count} elements for REFERENCE ENTRIES (numbered 1-${count})
3. Generate realistic, properly formatted academic references about ${topic}

CRITICAL RULES:

1. TITLE element:
   ✓ LARGEST font size (typically 36-50px)
   ✓ Positioned at TOP (smallest top value)
   ✓ Should contain: "Foydalanilgan adabiyotlar" (in ${language})
   ✓ Short text (< 50 chars)

2. REFERENCE elements (${count} total):
   ✓ SMALLER font size than title (16-24px)
   ✓ Positioned BELOW title, ordered from top to bottom
   ✓ Each should fit a full reference citation
   ✓ Must have adequate maxCharacters (> 80)
   ✓ Format each reference properly:
      - For books: "Author A.A. Title. Publisher, Year."
      - For articles: "Author A.A. Article title // Journal. Year. Vol. № Pages."
      - For web: "Author A.A. Title. URL (access date)"

3. REFERENCE FORMATTING RULES:
   ✓ Generate ${count} unique, realistic academic references related to "${topic}"
   ✓ Use proper academic citation format
   ✓ Include author names (use realistic Uzbek or international names)
   ✓ Include realistic publication years (2015-2024)
   ✓ Mix different reference types (books, journals, websites)
   ✓ Write in ${language} language
   ✓ Make references topic-relevant and credible

IMPORTANT:
- The TITLE is the element with LARGEST font size at the top
- References should be ordered from top to bottom by 'top' position
- Each reference must be COMPLETE and PROPERLY FORMATTED
- Use academic citation standards
- Make sure references are REALISTIC and topic-relevant

Return ONLY this JSON structure (no markdown, no explanations):
{
  "placements": [
    {
      "elementIndex": <number>,
      "content": "<exact text in ${language}>",
      "type": "title|reference",
      "confidence": <0.0-1.0>,
      "reasoning": "<why this element>"
    }
  ]
}

Example reference formats:
- Book: "Karimov I.A. O'zbekiston taraqqiyoti. Toshkent: O'zbekiston, 2020."
- Article: "Alimov S.B. Zamonaviy texnologiyalar // Fan va texnologiya. 2022. №3. 45-52-betlar."
- Web: "Veb sayt manzili. https://example.uz (Murojaat sanasi: 15.01.2024)"`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an academic reference generator. Generate realistic references in ${language}. Return ONLY valid JSON.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.6,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      result.placements.forEach((placement: any) => {
        const preview = placement.type === 'title'
          ? placement.content
          : placement.content.substring(0, 60) + '...';
        console.log(`  ✅ AI placed ${placement.type} at element ${placement.elementIndex}: "${preview}"`);
      });

      // Apply content to slide
      const updatedSlide = {
        ...slide,
        elements: slide.elements.map(el => {
          const placement = result.placements.find((p: any) => p.elementIndex === el.elementIndex);
          if (placement) {
            return { ...el, content: placement.content };
          }
          return el;
        })
      };

      return updatedSlide;
    } catch (error) {
      console.error('❌ AI references placement failed:', error);
      throw error;
    }
  }

  /**
   * Place thank you slide
   */
  async placeThankYou(
    slide: Slide,
    language: string = 'Uzbek'
  ): Promise<Slide> {
    console.log('\n🎯 AI: Generating and placing thank you message...');

    const textElements = slide.elements
      .filter(el => el.type === 'shape' && el.content)
      .map(el => ({
        index: el.elementIndex,
        content: el.content,
        fontSize: el.fontSize,
        top: el.top,
        maxCharacters: el.maxCharacters
      }));

    const prompt = `You are a PowerPoint content generator. Create a THANK YOU slide for a presentation.

Available text elements:
${textElements.map((el, i) => `Element ${i} (elementIndex: ${el.index}):
  - Font size: ${el.fontSize}
  - Position: top=${el.top}
  - Max characters: ${el.maxCharacters}
`).join('\n')}

Task:
1. Identify MAIN MESSAGE element (largest font, central) - should say "E'tiboringiz uchun rahmat!" or "Thank you for your attention!"
2. If there are additional elements, add supportive text (contact, Q&A invitation, etc.)

Generate content in ${language}.

Return JSON with this EXACT structure:
{
  "placements": [
    {
      "elementIndex": <number>,
      "content": "<text in ${language}>",
      "type": "main|additional",
      "confidence": <0-1>
    }
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a PowerPoint content generator. Generate polite, professional thank you messages in ${language}. Return ONLY valid JSON.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      result.placements.forEach((placement: any) => {
        console.log(`  ✅ AI placed ${placement.type} message at element ${placement.elementIndex}: "${placement.content}"`);
      });

      // Apply content to slide
      const updatedSlide = {
        ...slide,
        elements: slide.elements.map(el => {
          const placement = result.placements.find((p: any) => p.elementIndex === el.elementIndex);
          if (placement) {
            return { ...el, content: placement.content };
          }
          return el;
        })
      };

      return updatedSlide;
    } catch (error) {
      console.error('❌ AI thank you placement failed:', error);
      throw error;
    }
  }
}

export default AISlidePlacer;
