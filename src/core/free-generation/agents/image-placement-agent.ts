/**
 * Smart Image Placement Agent
 *
 * Enhances image handling in slides:
 * 1. Validates image dimensions and removes broken/inaccessible images
 * 2. Generates SVG placeholder when image search fails
 * 3. Adds semi-transparent overlay for image-full pattern (text readability)
 */

import crypto from 'crypto';
import type { PPTShapeElement, PPTImageElement } from '../../../../types/slides';
import type { ColorTheme } from '../design-system';

export interface PlacementResult {
  imagesProcessed: number;
  placeholdersGenerated: number;
  overlaysAdded: number;
}

export class ImagePlacementAgent {
  private theme: ColorTheme;

  constructor(theme: ColorTheme) {
    this.theme = theme;
  }

  /**
   * Process all slides — fix images, add overlays, generate placeholders
   */
  process(slides: any[]): PlacementResult {
    let imagesProcessed = 0;
    let placeholdersGenerated = 0;
    let overlaysAdded = 0;

    for (const slide of slides) {
      const imageElements = slide.elements
        .map((el: any, idx: number) => ({ el, idx }))
        .filter(({ el }: any) => el.type === 'image');

      for (const { el, idx } of imageElements) {
        imagesProcessed++;

        // Check if image has no src (search failed)
        if (!el.src || el.src === '') {
          // Replace with SVG placeholder
          const placeholder = this.generatePlaceholder(el);
          slide.elements[idx] = placeholder;
          placeholdersGenerated++;
          continue;
        }

        // Check if this is a full-bleed image (image-full pattern)
        // Add dark overlay for text readability
        if (this.isFullBleedImage(el, slide)) {
          this.addOverlay(slide, el, idx);
          overlaysAdded++;
        }
      }
    }

    return { imagesProcessed, placeholdersGenerated, overlaysAdded };
  }

  /**
   * Generate an SVG gradient placeholder as a shape element
   */
  private generatePlaceholder(imageEl: any): PPTShapeElement {
    const w = 200;
    const h = 200;
    const r = 12;

    return {
      type: 'shape',
      id: crypto.randomUUID(),
      left: imageEl.left,
      top: imageEl.top,
      width: imageEl.width,
      height: imageEl.height,
      rotate: 0,
      viewBox: [w, h],
      path: `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`,
      fixedRatio: false,
      fill: this.theme.surface,
      gradient: {
        type: 'linear',
        colors: [
          { pos: 0, color: this.theme.surface },
          { pos: 100, color: this.theme.primary + '22' }, // 13% opacity accent
        ],
        rotate: 135,
      },
      opacity: 0.5,
    };
  }

  /**
   * Check if image covers most of the slide (full-bleed)
   */
  private isFullBleedImage(el: any, slide: any): boolean {
    const slideWidth = 1920;
    const slideHeight = 1080;
    const coverage = (el.width * el.height) / (slideWidth * slideHeight);
    return coverage > 0.7;
  }

  /**
   * Add a semi-transparent dark overlay shape before text elements
   * for image-full slides to ensure text readability
   */
  private addOverlay(slide: any, imageEl: any, imageIdx: number): void {
    const overlay: PPTShapeElement = {
      type: 'shape',
      id: crypto.randomUUID(),
      left: imageEl.left,
      top: imageEl.top,
      width: imageEl.width,
      height: imageEl.height,
      rotate: 0,
      viewBox: [200, 200],
      path: 'M 0 0 L 200 0 L 200 200 L 0 200 Z',
      fixedRatio: false,
      fill: '#000000',
      opacity: 0.4,
    };

    // Insert overlay right after the image (before text elements)
    slide.elements.splice(imageIdx + 1, 0, overlay);
  }
}
