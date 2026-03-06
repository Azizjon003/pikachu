/**
 * Type definitions for the slide generation pipeline
 */

// ===== Element Types =====

export type ElementType = 'text' | 'shape' | 'table' | 'image' | 'chart';

export interface AISlideElement {
  index: number;
  type: ElementType;
  width: number;
  height: number;
  left: number;
  top: number;
  content: string;
  fontSize: number;
  maxCharacters: number;
  elementIndex: number;
  tableData?: string[][];
}

export interface AISlide {
  id: string;
  index: number;
  slide: number;
  elements: AISlideElement[];
  note: string;
}

// ===== Content Validation =====

export interface ContentValidationResult {
  isValid: boolean;
  content: string;
  fontSize?: number;
  warnings: string[];
}

// ===== AI Call Types =====

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface AICallOptions {
  operationName: string;
  model?: string;
  temperature?: number;
  messages: ChatMessage[];
  responseSchema?: Record<string, unknown>;
  responseFormat?: 'json_object' | 'json_schema';
  maxRetries?: number;
  fallback?: () => unknown;
}

export interface AICallResult<T> {
  data: T;
  usage: TokenUsage;
  latencyMs: number;
  retryCount: number;
  fromCache: boolean;
  fromFallback: boolean;
}

// ===== Generator Types =====

export interface OutlineItem {
  title: string;
  title_eng: string;
}

export interface OutlineSlide {
  slideIndex: number;
  title: string;
  title_eng: string;
  outlineIndex: number;
}

export interface OutlineResult {
  outline: OutlineItem[];
  slides: OutlineSlide[];
}

export interface GeneratedContent {
  slideId: string;
  elements: GeneratedElement[];
}

export interface GeneratedElement {
  elementIndex: number;
  content: string;
  tableData?: { data: string[][] } | null;
}

export interface SpecialSlidePlacement {
  elementIndex: number;
  content: string;
  type: 'title' | 'content' | 'reference' | 'main' | 'additional';
  confidence: number;
  reasoning?: string;
}

// ===== Pipeline Types =====

export interface PipelineOptions {
  template: string;
  language: string;
  page: number;
  topic: string;
  author: string;
}

export interface ValidationSummary {
  totalSlides: number;
  validSlides: number;
  fixedSlides: number;
  issuesFound: number;
  fixesApplied: number;
}

export interface CollisionSummary {
  slidesFixed: number;
  collisionsResolved: number;
  validationErrors: number;
}

export interface FailedSlideInfo {
  slideIndex: number;
  error: string;
  usedFallback: boolean;
}

export interface QualityReviewSummary {
  overallScore: number;
  imagesRemoved: number;
  imagesReplaced: number;
  textIssuesFixed: number;
}

export interface LayoutDesignSummary {
  slidesProcessed: number;
  fontAdjustments: number;
  positionAdjustments: number;
  spacingFixes: number;
  hierarchyFixes: number;
}

export interface PipelineResult {
  success: boolean;
  slidePath: string;
  slideName: string;
  sessionId: number;
  jsonFilePath: string;
  jsonFileName: string;
  validation: ValidationSummary;
  collisionPrevention: CollisionSummary;
  qualityReview: QualityReviewSummary;
  layoutDesign: LayoutDesignSummary;
  agents?: Record<string, unknown>;
  failedSlides: FailedSlideInfo[];
  tokenUsage: TokenUsage;
}

// ===== Free Generation Types =====

export type PatternName =
  | 'title-center'
  | 'title-subtitle'
  | 'bullet-list'
  | 'two-column'
  | 'image-right'
  | 'image-left'
  | 'image-full'
  | 'three-cards'
  | 'stats-grid'
  | 'comparison'
  | 'timeline'
  | 'table-slide'
  | 'quote'
  | 'section-break'
  | 'thank-you'
  | 'process-flow'
  | 'pyramid'
  | 'icon-grid'
  | 'chart-bar'
  | 'chart-pie'
  | 'chart-line'
  | 'data-dashboard'
  | 'chart-combo'
  | 'split-image-stats'
  | 'infographic-row'
  | 'custom';

export type ThemeName = 'professional' | 'modern' | 'warm' | 'cool' | 'bold' | 'minimal' | 'custom';

export type FontPairName = 'classic' | 'modern' | 'elegant' | 'playful' | 'technical' | 'minimal';

export interface CustomColorPalette {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  gradientStart: string;
  gradientEnd: string;
}

export type ElementRole = 'title' | 'subtitle' | 'body' | 'label' | 'image' | 'accent' | 'stat-number' | 'stat-label';

export interface FreeSlideOptions {
  language: string;
  page: number;
  topic: string;
  author?: string;
  theme?: ThemeName;
  fontPair?: FontPairName;
  /** Optional user prompt for custom instructions (e.g., "make it more visual", "focus on statistics") */
  prompt?: string;
}

export interface SlideModifyOptions {
  /** Path to the JSON file of the presentation to modify */
  jsonFilePath: string;
  /** User instruction for what to change */
  prompt: string;
  /** Language of the presentation */
  language: string;
  /** Original topic */
  topic: string;
}

export interface SlideModifyResult {
  success: boolean;
  slidePath: string;
  slideName: string;
  jsonFilePath: string;
  jsonFileName: string;
  changesApplied: number;
  changesSummary: string[];
}

/** AI-designed custom layout element (used when pattern='custom') */
export interface CustomLayoutElement {
  type: 'text' | 'image' | 'shape' | 'table' | 'chart' | 'line';
  role: ElementRole;
  col: [number, number];    // 1-12 grid columns
  row: [number, number];    // 1-8 grid rows
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  align?: 'left' | 'center' | 'right';
  color?: 'primary' | 'text' | 'muted' | 'white' | 'accent';
  background?: 'primary' | 'accent' | 'light' | 'white' | 'none' | 'gradient' | 'gradient-accent' | 'glass';
  borderRadius?: number;
  shapeVariant?: 'rect' | 'circle' | 'rounded-lg' | 'line-h' | 'line-v' | 'blob';
  shadow?: 'sm' | 'md' | 'lg';
  opacity?: number;
  maxCharacters?: number;
  /** Chart type (only for type='chart') */
  chartType?: 'bar' | 'pie' | 'line' | 'ring' | 'area' | 'radar';
  /** Line style (only for type='line') */
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  /** Line endpoint styles (only for type='line') */
  linePoints?: ['arrow' | 'dot' | '', 'arrow' | 'dot' | ''];
}

export interface FreeOutlineSlide {
  slideIndex: number;
  title: string;
  title_eng: string;
  outlineIndex: number;
  keyPoints: string[];
  pattern: PatternName;
  imageKeyword?: string;
  /** Custom layout elements (only when pattern='custom') */
  customElements?: CustomLayoutElement[];
  /** Background for custom layout slides */
  customBackground?: 'white' | 'light' | 'dark' | 'gradient' | 'primary';
}

export interface FreeOutlineResult {
  outline: OutlineItem[];
  slides: FreeOutlineSlide[];
  theme: ThemeName;
  customColors?: CustomColorPalette;
  fontPair?: FontPairName;
}

// ===== Configuration =====

export interface GenerationConfig {
  model: string;
  maxRetries: number;
  retryDelayMs: number;
  maxRetryDelayMs: number;
  backoffMultiplier: number;
  circuitBreakerEnabled: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;
  cacheEnabled: boolean;
  cacheTtlMs: number;
  cacheMaxSize: number;
  minFontSize: number;
  outlineCount: number;
}

export const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  model: 'gpt-4o',
  maxRetries: 3,
  retryDelayMs: 1000,
  maxRetryDelayMs: 10000,
  backoffMultiplier: 2,
  circuitBreakerEnabled: true,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 60000,
  cacheEnabled: true,
  cacheTtlMs: 3600000,
  cacheMaxSize: 100,
  minFontSize: 8,
  outlineCount: 3,
};
