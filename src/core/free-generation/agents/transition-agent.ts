/**
 * Transition Agent
 *
 * Assigns slide transitions based on slide type/pattern:
 * 1. Title/cover slides: fade
 * 2. Section breaks: slideX3D
 * 3. Content slides: slideX
 * 4. Data/stats slides: fade
 * 5. Closing/thank-you: scaleY
 *
 * Also adds turningMode to pptxgenjs export.
 */

import type { TurningMode, Slide } from '../../../../types/slides';

export interface TransitionConfig {
  mode: TurningMode;
  reason: string;
}

// Pattern → transition mapping
const PATTERN_TRANSITIONS: Record<string, TurningMode> = {
  'title-center': 'fade',
  'title-subtitle': 'fade',
  'section-break': 'slideX3D',
  'thank-you': 'scaleY',
  'quote': 'fade',
  'image-full': 'fade',
  // Data slides — subtle
  'stats-grid': 'fade',
  'chart-bar': 'fade',
  'chart-pie': 'fade',
  'chart-line': 'fade',
  'chart-combo': 'fade',
  'data-dashboard': 'fade',
  'table-slide': 'fade',
  // Content slides — slide motion
  'bullet-list': 'slideX',
  'two-column': 'slideX',
  'image-right': 'slideX',
  'image-left': 'slideX',
  'three-cards': 'slideX',
  'comparison': 'slideX',
  'timeline': 'slideX',
  'process-flow': 'slideX',
  'pyramid': 'slideX',
  'icon-grid': 'slideX',
  'infographic-row': 'slideX',
  'split-image-stats': 'slideX',
};

export class TransitionAgent {
  /**
   * Assign transitions to all slides based on their position and pattern
   */
  assignTransitions(
    slides: Slide[],
    patterns: string[]
  ): { slidesProcessed: number } {
    // patterns array maps to content slides (index offset by fixed slides)
    // Fixed slide order: title(0), outline(1), content..., conclusion, references, thank-you

    for (let i = 0; i < slides.length; i++) {
      let transition: TurningMode;

      if (i === 0) {
        // Title slide — no transition (first slide)
        transition = 'no';
      } else if (i === 1) {
        // Outline slide
        transition = 'fade';
      } else if (i === slides.length - 1) {
        // Thank you (last)
        transition = 'scaleY';
      } else if (i === slides.length - 2) {
        // References
        transition = 'fade';
      } else if (i === slides.length - 3) {
        // Conclusion
        transition = 'fade';
      } else {
        // Content slides — use pattern-based transition
        const contentIdx = i - 2; // offset for title + outline
        const pattern = patterns[contentIdx];
        transition = (pattern && PATTERN_TRANSITIONS[pattern]) || 'slideX';
      }

      slides[i].turningMode = transition;
    }

    return { slidesProcessed: slides.length };
  }
}
