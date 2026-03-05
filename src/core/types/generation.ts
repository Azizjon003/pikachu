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

export interface PipelineResult {
  success: boolean;
  slidePath: string;
  slideName: string;
  sessionId: number;
  jsonFilePath: string;
  jsonFileName: string;
  validation: ValidationSummary;
  collisionPrevention: CollisionSummary;
  failedSlides: FailedSlideInfo[];
  tokenUsage: TokenUsage;
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
