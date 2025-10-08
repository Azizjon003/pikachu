import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Text Placement Validator
 *
 * Validates and fixes text placement in generated slides
 * Ensures topic, author, and outline are correctly placed
 */

export interface SlideElement {
  type: string;
  content: string;
  fontSize?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  elementIndex: number;
  [key: string]: any;
}

export interface Slide {
  id: string;
  index: number;
  slide: number;
  elements: SlideElement[];
  note?: string;
}

export interface ValidationResult {
  isValid: boolean;
  slide: Slide;
  issues: ValidationIssue[];
  fixes: ValidationFix[];
  confidence: number;
}

export interface ValidationIssue {
  severity: 'critical' | 'major' | 'minor';
  elementIndex: number;
  issue: string;
  expectedContent: string;
  actualContent: string;
}

export interface ValidationFix {
  elementIndex: number;
  field: string;
  oldValue: any;
  newValue: any;
  reason: string;
}

export interface BatchValidationResult {
  totalSlides: number;
  validSlides: number;
  fixedSlides: number;
  issues: ValidationIssue[];
  fixes: ValidationFix[];
  validatedSlides: Slide[];
}

export class TextPlacementValidator {
  private openai: OpenAI;

  constructor(openaiApiKey?: string) {
    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Validate first slide (title page)
   */
  async validateTitleSlide(
    slide: Slide,
    expectedTopic: string,
    expectedAuthor: string
  ): Promise<ValidationResult> {
    console.log('\n🔍 Validating title slide...');

    const issues: ValidationIssue[] = [];
    const fixes: ValidationFix[] = [];
    let fixedSlide = JSON.parse(JSON.stringify(slide)); // Deep copy

    // Find title and author elements
    const textElements = slide.elements.filter(
      el => el.type === 'shape' && el.content && el.content.trim().length > 0
    );

    // Sort by font size (descending)
    const sortedByFontSize = [...textElements].sort((a, b) =>
      (b.fontSize || 0) - (a.fontSize || 0)
    );

    // Title should be the largest text
    const titleElement = sortedByFontSize[0];

    // Author should be medium-sized text, positioned lower
    const authorElement = sortedByFontSize.find((el, idx) =>
      idx > 0 &&
      el.elementIndex !== titleElement?.elementIndex &&
      (el.fontSize || 0) >= 18 &&
      (el.fontSize || 0) <= 26 &&
      (el.top || 0) > (titleElement?.top || 0)
    );

    // Validate title
    if (titleElement) {
      const actualTitle = titleElement.content.trim();
      const similarity = this.calculateSimilarity(actualTitle, expectedTopic);

      if (similarity < 0.8) {
        issues.push({
          severity: 'critical',
          elementIndex: titleElement.elementIndex,
          issue: 'Title does not match expected topic',
          expectedContent: expectedTopic,
          actualContent: actualTitle
        });

        // Fix: Replace with expected topic
        const elementIdx = fixedSlide.elements.findIndex(
          el => el.elementIndex === titleElement.elementIndex
        );
        if (elementIdx !== -1) {
          fixes.push({
            elementIndex: titleElement.elementIndex,
            field: 'content',
            oldValue: actualTitle,
            newValue: expectedTopic,
            reason: 'Title did not match expected topic'
          });
          fixedSlide.elements[elementIdx].content = expectedTopic;
        }
      }
    } else {
      issues.push({
        severity: 'critical',
        elementIndex: -1,
        issue: 'Title element not found',
        expectedContent: expectedTopic,
        actualContent: 'N/A'
      });
    }

    // Validate author
    if (authorElement) {
      const actualAuthor = authorElement.content.trim();
      const similarity = this.calculateSimilarity(actualAuthor, expectedAuthor);

      if (similarity < 0.8) {
        issues.push({
          severity: 'major',
          elementIndex: authorElement.elementIndex,
          issue: 'Author does not match expected value',
          expectedContent: expectedAuthor,
          actualContent: actualAuthor
        });

        // Fix: Replace with expected author
        const elementIdx = fixedSlide.elements.findIndex(
          el => el.elementIndex === authorElement.elementIndex
        );
        if (elementIdx !== -1) {
          fixes.push({
            elementIndex: authorElement.elementIndex,
            field: 'content',
            oldValue: actualAuthor,
            newValue: expectedAuthor,
            reason: 'Author did not match expected value'
          });
          fixedSlide.elements[elementIdx].content = expectedAuthor;
        }
      }
    } else {
      issues.push({
        severity: 'major',
        elementIndex: -1,
        issue: 'Author element not found',
        expectedContent: expectedAuthor,
        actualContent: 'N/A'
      });
    }

    const confidence = 1 - (issues.length / 5); // Max 5 issues

    console.log(`   Issues found: ${issues.length}`);
    console.log(`   Fixes applied: ${fixes.length}`);
    console.log(`   Confidence: ${(confidence * 100).toFixed(1)}%`);

    return {
      isValid: issues.filter(i => i.severity === 'critical').length === 0,
      slide: fixedSlide,
      issues,
      fixes,
      confidence
    };
  }

  /**
   * Validate outline slide (second slide)
   */
  async validateOutlineSlide(
    slide: Slide,
    expectedOutline: string[]
  ): Promise<ValidationResult> {
    console.log('\n🔍 Validating outline slide...');

    const issues: ValidationIssue[] = [];
    const fixes: ValidationFix[] = [];
    let fixedSlide = JSON.parse(JSON.stringify(slide));

    // Find outline elements
    const textElements = slide.elements.filter(
      el => el.type === 'shape' && el.content && el.content.trim().length > 0
    );

    // Find header (e.g., "Reja:")
    const headerElement = textElements.find(el => {
      const content = el.content.toLowerCase().trim();
      return content.length < 15 &&
             (content.includes('reja') ||
              content.includes('plan') ||
              content.includes('outline'));
    });

    // Find numbered items
    const numberedPattern = /^(\d+)[.)]\s+(.+)/;
    const numberedElements = textElements
      .filter(el => {
        const trimmed = el.content.trim();
        return numberedPattern.test(trimmed) &&
               (el.fontSize || 0) < 50 &&
               trimmed.length >= 10;
      })
      .sort((a, b) => {
        const numA = parseInt(a.content.match(numberedPattern)?.[1] || '0');
        const numB = parseInt(b.content.match(numberedPattern)?.[1] || '0');
        return numA - numB;
      });

    console.log(`   Header found: ${headerElement ? 'Yes' : 'No'}`);
    console.log(`   Numbered items found: ${numberedElements.length}`);
    console.log(`   Expected items: ${expectedOutline.length}`);

    // Validate header
    if (!headerElement) {
      issues.push({
        severity: 'minor',
        elementIndex: -1,
        issue: 'Outline header not found',
        expectedContent: 'Reja:',
        actualContent: 'N/A'
      });
    }

    // Validate outline items
    for (let i = 0; i < expectedOutline.length; i++) {
      const expectedItem = expectedOutline[i];
      const actualElement = numberedElements[i];

      if (!actualElement) {
        issues.push({
          severity: 'critical',
          elementIndex: -1,
          issue: `Outline item ${i + 1} not found`,
          expectedContent: `${i + 1}. ${expectedItem}`,
          actualContent: 'N/A'
        });
        continue;
      }

      const actualContent = actualElement.content.replace(numberedPattern, '$2').trim();
      const similarity = this.calculateSimilarity(actualContent, expectedItem);

      if (similarity < 0.7) {
        issues.push({
          severity: 'major',
          elementIndex: actualElement.elementIndex,
          issue: `Outline item ${i + 1} content mismatch`,
          expectedContent: `${i + 1}. ${expectedItem}`,
          actualContent: actualElement.content
        });

        // Fix: Replace with expected content
        const elementIdx = fixedSlide.elements.findIndex(
          el => el.elementIndex === actualElement.elementIndex
        );
        if (elementIdx !== -1) {
          const newContent = `${i + 1}. ${expectedItem}`;
          fixes.push({
            elementIndex: actualElement.elementIndex,
            field: 'content',
            oldValue: actualElement.content,
            newValue: newContent,
            reason: `Outline item ${i + 1} did not match expected value`
          });
          fixedSlide.elements[elementIdx].content = newContent;
        }
      }
    }

    const confidence = 1 - (issues.length / (expectedOutline.length + 2));

    console.log(`   Issues found: ${issues.length}`);
    console.log(`   Fixes applied: ${fixes.length}`);
    console.log(`   Confidence: ${(confidence * 100).toFixed(1)}%`);

    return {
      isValid: issues.filter(i => i.severity === 'critical').length === 0,
      slide: fixedSlide,
      issues,
      fixes,
      confidence
    };
  }

  /**
   * Validate content slide using AI
   */
  async validateContentSlide(
    slide: Slide,
    expectedTopic: string,
    slideIndex: number
  ): Promise<ValidationResult> {
    console.log(`\n🔍 Validating content slide ${slideIndex}...`);

    const issues: ValidationIssue[] = [];
    const fixes: ValidationFix[] = [];
    let fixedSlide = JSON.parse(JSON.stringify(slide));

    // Extract all text content
    const allText = slide.elements
      .filter(el => el.type === 'shape' && el.content)
      .map(el => el.content)
      .join('\n');

    if (allText.trim().length === 0) {
      issues.push({
        severity: 'critical',
        elementIndex: -1,
        issue: 'No text content found in slide',
        expectedContent: 'Slide should have text content',
        actualContent: 'Empty'
      });

      return {
        isValid: false,
        slide: fixedSlide,
        issues,
        fixes,
        confidence: 0
      };
    }

    try {
      // Use AI to validate content relevance
      const prompt = `Analyze this slide content and determine if it's relevant to the topic.

Topic: "${expectedTopic}"

Slide Content:
${allText}

Provide a JSON response with:
- isRelevant: boolean (true if content matches topic)
- confidence: number (0-1)
- issues: array of strings describing any problems
- suggestions: array of strings for improvements

Return only valid JSON.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a presentation content validator. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      if (!analysis.isRelevant) {
        issues.push({
          severity: 'major',
          elementIndex: -1,
          issue: 'Content not relevant to topic',
          expectedContent: `Content related to "${expectedTopic}"`,
          actualContent: allText.substring(0, 100) + '...'
        });
      }

      if (analysis.issues && analysis.issues.length > 0) {
        analysis.issues.forEach((issue: string) => {
          issues.push({
            severity: 'minor',
            elementIndex: -1,
            issue: issue,
            expectedContent: '',
            actualContent: ''
          });
        });
      }

      console.log(`   AI Relevance: ${analysis.isRelevant ? 'Yes' : 'No'}`);
      console.log(`   AI Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
      console.log(`   Issues found: ${issues.length}`);

      return {
        isValid: analysis.isRelevant && issues.filter(i => i.severity === 'critical').length === 0,
        slide: fixedSlide,
        issues,
        fixes,
        confidence: analysis.confidence || 0.5
      };

    } catch (error) {
      console.warn('   AI validation failed, using basic validation:', error);

      // Basic validation: check if topic keyword is mentioned
      const topicKeywords = expectedTopic.toLowerCase().split(' ').filter(w => w.length > 3);
      const contentLower = allText.toLowerCase();
      const mentionedKeywords = topicKeywords.filter(kw => contentLower.includes(kw));

      const confidence = mentionedKeywords.length / Math.max(topicKeywords.length, 1);

      if (confidence < 0.3) {
        issues.push({
          severity: 'major',
          elementIndex: -1,
          issue: 'Topic keywords not found in content',
          expectedContent: `Keywords: ${topicKeywords.join(', ')}`,
          actualContent: `Found: ${mentionedKeywords.join(', ')}`
        });
      }

      return {
        isValid: confidence >= 0.3,
        slide: fixedSlide,
        issues,
        fixes,
        confidence
      };
    }
  }

  /**
   * Validate all slides in a presentation
   */
  async validatePresentation(
    slides: Slide[],
    topic: string,
    author: string,
    outline: string[]
  ): Promise<BatchValidationResult> {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║          Presentation Validation Started                 ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log(`\nTopic: ${topic}`);
    console.log(`Author: ${author}`);
    console.log(`Total Slides: ${slides.length}`);
    console.log(`Outline Items: ${outline.length}\n`);

    const allIssues: ValidationIssue[] = [];
    const allFixes: ValidationFix[] = [];
    const validatedSlides: Slide[] = [];
    let validCount = 0;
    let fixedCount = 0;

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      console.log(`\n--- Slide ${i + 1}/${slides.length} (Index: ${slide.index}) ---`);

      let result: ValidationResult;

      if (i === 0) {
        // First slide: title page
        result = await this.validateTitleSlide(slide, topic, author);
      } else if (i === 1) {
        // Second slide: outline
        result = await this.validateOutlineSlide(slide, outline);
      } else {
        // Content slides
        result = await this.validateContentSlide(slide, topic, i);
      }

      if (result.isValid) {
        validCount++;
        console.log(`   ✅ Slide is valid (confidence: ${(result.confidence * 100).toFixed(1)}%)`);
      } else {
        console.log(`   ⚠️  Slide has issues`);
      }

      if (result.fixes.length > 0) {
        fixedCount++;
        console.log(`   🔧 Applied ${result.fixes.length} fixes`);
      }

      allIssues.push(...result.issues);
      allFixes.push(...result.fixes);
      validatedSlides.push(result.slide);

      // Small delay to avoid rate limiting
      if (i < slides.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║          Validation Summary                               ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log(`\n   Total Slides: ${slides.length}`);
    console.log(`   ✅ Valid: ${validCount}`);
    console.log(`   🔧 Fixed: ${fixedCount}`);
    console.log(`   ⚠️  Issues Found: ${allIssues.length}`);
    console.log(`   🔨 Fixes Applied: ${allFixes.length}\n`);

    if (allIssues.length > 0) {
      console.log('   Issue Breakdown:');
      const critical = allIssues.filter(i => i.severity === 'critical').length;
      const major = allIssues.filter(i => i.severity === 'major').length;
      const minor = allIssues.filter(i => i.severity === 'minor').length;

      console.log(`     Critical: ${critical}`);
      console.log(`     Major: ${major}`);
      console.log(`     Minor: ${minor}\n`);
    }

    return {
      totalSlides: slides.length,
      validSlides: validCount,
      fixedSlides: fixedCount,
      issues: allIssues,
      fixes: allFixes,
      validatedSlides
    };
  }

  /**
   * Calculate similarity between two strings (simple approach)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1.0;

    // Levenshtein distance approximation
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    // Check if one contains the other
    if (longer.includes(shorter)) {
      return shorter.length / longer.length;
    }

    // Count matching characters
    let matches = 0;
    for (const char of shorter) {
      if (longer.includes(char)) matches++;
    }

    return matches / longer.length;
  }

  /**
   * Print validation report
   */
  printValidationReport(result: BatchValidationResult): void {
    console.log('\n' + '='.repeat(60));
    console.log('VALIDATION REPORT');
    console.log('='.repeat(60));
    console.log(`\nSlides: ${result.totalSlides}`);
    console.log(`Valid: ${result.validSlides} (${(result.validSlides / result.totalSlides * 100).toFixed(1)}%)`);
    console.log(`Fixed: ${result.fixedSlides}`);
    console.log(`\nIssues: ${result.issues.length}`);
    console.log(`Fixes Applied: ${result.fixes.length}`);

    if (result.issues.length > 0) {
      console.log('\n--- Issues ---');
      result.issues.forEach((issue, i) => {
        console.log(`\n${i + 1}. [${issue.severity.toUpperCase()}] ${issue.issue}`);
        console.log(`   Element Index: ${issue.elementIndex}`);
        console.log(`   Expected: "${issue.expectedContent}"`);
        console.log(`   Actual: "${issue.actualContent}"`);
      });
    }

    if (result.fixes.length > 0) {
      console.log('\n--- Fixes Applied ---');
      result.fixes.forEach((fix, i) => {
        console.log(`\n${i + 1}. Element ${fix.elementIndex}: ${fix.field}`);
        console.log(`   Old: "${fix.oldValue}"`);
        console.log(`   New: "${fix.newValue}"`);
        console.log(`   Reason: ${fix.reason}`);
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }
}

export default TextPlacementValidator;