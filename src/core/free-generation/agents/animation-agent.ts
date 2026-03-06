/**
 * Animation Agent
 *
 * Assigns element-level entrance animations to slides:
 * 1. Titles — fadeIn (first, immediate)
 * 2. Body text / bullets — fadeInUp (sequential, auto-trigger)
 * 3. Images — zoomIn (auto after text)
 * 4. Shapes/cards — fadeIn (simultaneous with content)
 * 5. Stats numbers — bounceIn (attention-grabbing)
 * 6. Charts/tables — fadeInUp (auto)
 *
 * Uses PPTAnimation interface from types/slides.ts
 */

import crypto from 'crypto';
import type { PPTAnimation, AnimationTrigger, Slide } from '../../../../types/slides';

export interface AnimationResult {
  slidesProcessed: number;
  animationsAdded: number;
}

// Element role → animation mapping
interface AnimationPreset {
  effect: string;
  duration: number;
  trigger: AnimationTrigger;
}

const ROLE_ANIMATIONS: Record<string, AnimationPreset> = {
  title: { effect: 'fadeIn', duration: 500, trigger: 'click' },
  subtitle: { effect: 'fadeIn', duration: 400, trigger: 'auto' },
  body: { effect: 'fadeInUp', duration: 500, trigger: 'auto' },
  image: { effect: 'zoomIn', duration: 600, trigger: 'auto' },
  shape: { effect: 'fadeIn', duration: 300, trigger: 'meantime' },
  'stat-number': { effect: 'bounceIn', duration: 600, trigger: 'auto' },
  'stat-label': { effect: 'fadeIn', duration: 300, trigger: 'meantime' },
  chart: { effect: 'fadeInUp', duration: 700, trigger: 'auto' },
  table: { effect: 'fadeInUp', duration: 600, trigger: 'auto' },
};

export class AnimationAgent {
  /**
   * Assign entrance animations to all slide elements
   */
  assignAnimations(slides: Slide[]): AnimationResult {
    let animationsAdded = 0;

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];

      // Skip title slide (first slide) — no entrance animation
      if (i === 0) continue;

      const animations: PPTAnimation[] = [];

      for (const el of slide.elements) {
        const role = this.detectElementRole(el);
        const preset = ROLE_ANIMATIONS[role];
        if (!preset) continue;

        animations.push({
          id: crypto.randomUUID(),
          elId: el.id,
          effect: preset.effect,
          type: 'in',
          duration: preset.duration,
          trigger: animations.length === 0 ? 'click' : preset.trigger,
        });
        animationsAdded++;
      }

      if (animations.length > 0) {
        slide.animations = animations;
      }
    }

    return { slidesProcessed: slides.length, animationsAdded };
  }

  /**
   * Detect element role for animation assignment
   */
  private detectElementRole(el: any): string {
    if (el.type === 'image') return 'image';
    if (el.type === 'chart') return 'chart';
    if (el.type === 'table') return 'table';
    if (el.type === 'shape') return 'shape';

    if (el.type === 'text' && el.content) {
      const fontSize = this.extractFontSize(el.content);
      const isBold = el.content.includes('font-weight: bold') || el.content.includes('font-weight:bold');

      if (fontSize >= 32 || el.textType === 'title') return 'title';
      if (fontSize >= 24 || el.textType === 'subtitle') return 'subtitle';

      // Stat-number detection: short text with large font
      const plainText = el.content.replace(/<[^>]+>/g, '').trim();
      if (fontSize >= 36 && plainText.length < 10) return 'stat-number';
      if (fontSize <= 14 && plainText.length < 30) return 'stat-label';

      return 'body';
    }

    return 'body';
  }

  private extractFontSize(content: string): number {
    const match = content.match(/font-size:\s*(\d+)/);
    return match ? parseInt(match[1]) : 16;
  }
}
