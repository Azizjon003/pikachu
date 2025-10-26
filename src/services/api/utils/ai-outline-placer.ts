import dotenv from "dotenv";
import { getOpenAIService } from "../../openai";
dotenv.config();

const openaiService = getOpenAIService();

/**
 * Represents the placement information for outline elements on a slide
 */
interface OutlinePlacement {
  /** Index of the element to use as the outline header */
  headerElementIndex: number | null;
  /** Indices of elements to use for outline items */
  outlineItemIndices: number[];
  /** Confidence score of the placement decision (0-1) */
  confidence: number;
  /** Explanation of the placement reasoning */
  reasoning: string;
}

/**
 * Represents a simplified slide element for AI analysis
 */
interface SlideElement {
  type: string;
  content: string;
  fontSize: number;
  elementIndex: number;
  top: number;
  left: number;
}

/**
 * Represents a slide with elements
 */
interface Slide {
  elements: SlideElement[];
  [key: string]: any;
}

/**
 * Analyzes a slide structure using OpenAI to determine optimal outline placement
 *
 * @param slide - The slide object containing elements to analyze
 * @returns Promise resolving to placement information
 */
export async function analyzeSlideStructure(slide: Slide): Promise<OutlinePlacement> {
  try {
    // Extract relevant element information for AI analysis
    const elementsForAnalysis = slide.elements
      .filter((el: any) => el.type === 'shape' && el.content)
      .map((el: any) => ({
        index: el.elementIndex,
        content: el.content?.substring(0, 60) || '',
        fontSize: el.fontSize,
        top: Math.round(el.top),
        left: Math.round(el.left),
      }));

    if (elementsForAnalysis.length === 0) {
      return fallbackHeuristicPlacement(slide);
    }

    // Create a concise prompt for GPT-4
    const prompt = `Analyze this PowerPoint slide and find where to place outline items.

Elements:
${JSON.stringify(elementsForAnalysis, null, 2)}

Find:
1. Header element: Text with "Reja", "Plan", or "Outline" (large font 40-50)
2. Outline item elements: 3 numbered/bulleted items (font 18-24, similar spacing)

Return JSON:
{
  "headerElementIndex": <number or null>,
  "outlineItemIndices": [<3 numbers in vertical order>],
  "confidence": <0.0-1.0>,
  "reasoning": "<brief>"
}`;

    const result = await openaiService.createJsonCompletion({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You analyze PowerPoint structures. Return only valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      maxTokens: 300,
    });

    // Validate the response
    const placement: OutlinePlacement = {
      headerElementIndex: result.headerElementIndex ?? null,
      outlineItemIndices: Array.isArray(result.outlineItemIndices) ? result.outlineItemIndices : [],
      confidence: typeof result.confidence === 'number' ? result.confidence : 0,
      reasoning: result.reasoning || 'AI analysis completed',
    };

    console.log('✨ AI outline analysis:', {
      headerFound: placement.headerElementIndex !== null,
      itemsFound: placement.outlineItemIndices.length,
      confidence: placement.confidence.toFixed(2),
      reasoning: placement.reasoning,
    });

    return placement;
  } catch (error) {
    console.error('⚠️ AI analysis failed, using heuristics:', error);
    return fallbackHeuristicPlacement(slide);
  }
}

/**
 * Fallback heuristic-based placement when AI fails
 */
function fallbackHeuristicPlacement(slide: Slide): OutlinePlacement {
  const elements = slide.elements.filter((el: any) => el.type === 'shape' && el.content);

  // Find header by keywords and large font
  let headerIndex: number | null = null;
  let maxHeaderFontSize = 0;

  const headerKeywords = ['reja', 'plan', 'outline', 'mavzu'];

  for (const el of elements) {
    const content = (el.content || '').toLowerCase();
    const hasKeyword = headerKeywords.some(kw => content.includes(kw));

    if (hasKeyword && el.fontSize > maxHeaderFontSize && el.fontSize > 35) {
      maxHeaderFontSize = el.fontSize;
      headerIndex = el.elementIndex;
    }
  }

  // Find outline items: numbered elements with reasonable font
  const numberedPattern = /^[0-9]+[.)]\s+/;
  const outlineIndices: number[] = [];

  const sortedElements = [...elements]
    .filter((el: any) => {
      const content = (el.content || '').trim();
      return numberedPattern.test(content) &&
             el.fontSize >= 16 &&
             el.fontSize <= 28 &&
             el.fontSize < 50 && // Exclude decorative numbers
             content.length > 10; // Has actual content
    })
    .sort((a: any, b: any) => a.top - b.top);

  for (const el of sortedElements.slice(0, 3)) {
    outlineIndices.push(el.elementIndex);
  }

  return {
    headerElementIndex: headerIndex,
    outlineItemIndices: outlineIndices,
    confidence: outlineIndices.length >= 3 ? 0.7 : 0.4,
    reasoning: 'Heuristic: keyword + numbered pattern detection',
  };
}

/**
 * Places outline content on a slide using AI-powered analysis
 *
 * @param slide - The slide object to modify
 * @param outlineItems - Array of outline titles to place
 * @returns Promise resolving to the updated slide
 */
export async function placeOutlineWithAI(
  slide: Slide,
  outlineItems: string[]
): Promise<Slide> {
  console.log(`\n🤖 AI Outline Placement: ${outlineItems.length} items to place`);

  // Analyze the slide structure
  const placement = await analyzeSlideStructure(slide);

  // Update the slide elements
  const updatedSlide = { ...slide };
  const updatedElements = [...slide.elements];

  // Place header if found
  if (placement.headerElementIndex !== null) {
    const headerIdx = updatedElements.findIndex(
      (el: any) => el.elementIndex === placement.headerElementIndex
    );
    if (headerIdx !== -1) {
      console.log(`  ✅ Header at element ${placement.headerElementIndex}`);
      // Header typically already correct ("Reja:")
    }
  }

  // Place outline items
  const itemsToPlace = Math.min(outlineItems.length, placement.outlineItemIndices.length);

  if (itemsToPlace === 0) {
    console.warn('  ⚠️ No outline positions found!');
    return updatedSlide;
  }

  for (let i = 0; i < itemsToPlace; i++) {
    const targetIndex = placement.outlineItemIndices[i];
    const elementIdx = updatedElements.findIndex((el: any) => el.elementIndex === targetIndex);

    if (elementIdx !== -1) {
      updatedElements[elementIdx].content = `${i + 1}. ${outlineItems[i]}`;
      console.log(`  ✅ Item ${i + 1} at element ${targetIndex}: "${outlineItems[i]}"`);
    }
  }

  if (outlineItems.length > itemsToPlace) {
    console.warn(`  ⚠️ ${outlineItems.length - itemsToPlace} items couldn't be placed`);
  }

  updatedSlide.elements = updatedElements;

  console.log(`✨ Placed ${itemsToPlace}/${outlineItems.length} items (confidence: ${placement.confidence.toFixed(2)})\n`);

  return updatedSlide;
}
