/**
 * Type definitions for Image Replacer Service
 */

export interface ImageElement {
  type: 'image';
  src: string;
  hasImage: boolean;
  isEdited?: boolean;
  elementIndex: number;
}

export interface ShapeElement {
  type: 'shape';
  content: string;
  elementIndex: number;
  [key: string]: any;
}

export interface TableElement {
  type: 'table';
  data: string[][];
  elementIndex: number;
}

export type SlideElement = ImageElement | ShapeElement | TableElement;

export interface Slide {
  id: string;
  index: number;
  slide: number;
  elements: SlideElement[];
  note: string;
}

export type Schema = Slide[];

export interface ReplacementResults {
  total: number;
  successful: number;
  failed: number;
  errors: string[];
}

export default class ImageReplacerService {
  constructor(
    schemaPath?: string,
    imageBaseDir?: string,
    verbose?: boolean
  );

  /**
   * Replaces all images marked with isEdited: true in the schema
   * @returns Statistics about the replacement operation
   */
  replaceEditedImages(): Promise<ReplacementResults>;

  /**
   * Replaces a single image by its slide number and element index
   * @param slideNumber - The slide number (1-based)
   * @param elementIndex - The element index on the slide
   * @param customKeyword - Optional custom search keyword
   * @returns True if replacement was successful
   */
  replaceImageByIndex(
    slideNumber: number,
    elementIndex: number,
    customKeyword?: string
  ): Promise<boolean>;
}
