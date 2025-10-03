/**
 * Resilient Slide Generator
 * Implements retry mechanism, circuit breaker, caching, and fallback generation
 */

import OpenAI from 'openai';
import { EnhancedLogger } from './enhanced-logger';

export interface GenerationMetrics {
  attempts: number;
  totalLatency: number;
  cacheHits: number;
  cacheMisses: number;
  failures: number;
  successes: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN',     // Too many failures, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenAttempts: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttlMs: number;
  maxSize: number;
}

export class ResilientSlideGenerator {
  private client: OpenAI;
  private logger: EnhancedLogger;

  // Retry configuration
  private retryConfig: RetryConfig;

  // Circuit breaker state
  private circuitConfig: CircuitBreakerConfig;
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenAttempts: number = 0;

  // Caching system
  private cacheConfig: CacheConfig;
  private cache: Map<string, CacheEntry<any>> = new Map();

  // Metrics
  private metrics: GenerationMetrics = {
    attempts: 0,
    totalLatency: 0,
    cacheHits: 0,
    cacheMisses: 0,
    failures: 0,
    successes: 0,
  };

  constructor(
    client: OpenAI,
    retryConfig?: Partial<RetryConfig>,
    circuitConfig?: Partial<CircuitBreakerConfig>,
    cacheConfig?: Partial<CacheConfig>,
    logger?: EnhancedLogger
  ) {
    this.client = client;
    this.logger = logger || new EnhancedLogger();

    // Default retry configuration
    this.retryConfig = {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      ...retryConfig,
    };

    // Default circuit breaker configuration
    this.circuitConfig = {
      enabled: true,
      failureThreshold: 5,
      resetTimeoutMs: 60000, // 1 minute
      halfOpenAttempts: 1,
      ...circuitConfig,
    };

    // Default cache configuration
    this.cacheConfig = {
      enabled: true,
      ttlMs: 3600000, // 1 hour
      maxSize: 100,
      ...cacheConfig,
    };
  }

  /**
   * Generate cache key from request parameters
   */
  private generateCacheKey(params: any): string {
    return JSON.stringify(params);
  }

  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): T | null {
    if (!this.cacheConfig.enabled) return null;

    const entry = this.cache.get(key);
    if (!entry) {
      this.metrics.cacheMisses++;
      return null;
    }

    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > this.cacheConfig.ttlMs) {
      this.cache.delete(key);
      this.metrics.cacheMisses++;
      return null;
    }

    // Update hit count
    entry.hits++;
    this.metrics.cacheHits++;
    this.logger.debug('Cache hit', { key: key.substring(0, 50) });

    return entry.data as T;
  }

  /**
   * Save to cache
   */
  private saveToCache<T>(key: string, data: T): void {
    if (!this.cacheConfig.enabled) return;

    // Check cache size limit
    if (this.cache.size >= this.cacheConfig.maxSize) {
      // Remove oldest entry
      const oldestKey = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0];

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0,
    });

    this.logger.debug('Cached result', { key: key.substring(0, 50) });
  }

  /**
   * Check circuit breaker state
   */
  private checkCircuitBreaker(): void {
    if (!this.circuitConfig.enabled) return;

    const now = Date.now();

    if (this.circuitState === CircuitState.OPEN) {
      // Check if enough time has passed to try half-open
      if (now - this.lastFailureTime >= this.circuitConfig.resetTimeoutMs) {
        this.circuitState = CircuitState.HALF_OPEN;
        this.halfOpenAttempts = 0;
        this.logger.info('Circuit breaker entering HALF_OPEN state');
      } else {
        throw new Error('Circuit breaker is OPEN. Service unavailable.');
      }
    }
  }

  /**
   * Record success
   */
  private recordSuccess(): void {
    this.metrics.successes++;

    if (!this.circuitConfig.enabled) return;

    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.circuitConfig.halfOpenAttempts) {
        this.circuitState = CircuitState.CLOSED;
        this.failureCount = 0;
        this.logger.info('Circuit breaker closed after successful recovery');
      }
    } else if (this.circuitState === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Record failure
   */
  private recordFailure(error: Error): void {
    this.metrics.failures++;

    if (!this.circuitConfig.enabled) return;

    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.circuitState = CircuitState.OPEN;
      this.logger.warn('Circuit breaker opened after failed recovery attempt');
    } else if (this.failureCount >= this.circuitConfig.failureThreshold) {
      this.circuitState = CircuitState.OPEN;
      this.logger.error('Circuit breaker opened due to too many failures', error, {
        failureCount: this.failureCount,
        threshold: this.circuitConfig.failureThreshold,
      });
    }
  }

  /**
   * Calculate delay for retry with exponential backoff
   */
  private calculateDelay(attempt: number): number {
    const delay = Math.min(
      this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt),
      this.retryConfig.maxDelayMs
    );

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * delay * 0.1;
    return delay + jitter;
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate generated result
   */
  private validateResult(result: any, expectedFields: string[]): boolean {
    if (!result || typeof result !== 'object') {
      return false;
    }

    for (const field of expectedFields) {
      if (!(field in result)) {
        this.logger.warn('Validation failed: missing field', { field });
        return false;
      }
    }

    return true;
  }

  /**
   * Generate fallback content
   */
  private generateFallbackContent(type: 'outline' | 'content' | 'special', params: any): any {
    this.logger.warn('Generating fallback content', { type, params });

    switch (type) {
      case 'outline':
        return {
          outline: [
            { title: 'Introduction', title_eng: 'Introduction' },
            { title: 'Main Content', title_eng: 'Main Content' },
            { title: 'Conclusion', title_eng: 'Conclusion' },
          ],
          slides: [],
        };

      case 'content':
        return {
          slideId: params.slideId || 'unknown',
          elements: (params.elements || []).map((el: any, idx: number) => ({
            elementIndex: idx,
            content: `[Content placeholder for element ${idx}]`,
            tableData: el.type === 'table' ? { data: [['Data', 'Placeholder']] } : null,
          })),
        };

      case 'special':
        return {
          slideId: params.slideId || 'unknown',
          elements: [
            {
              elementIndex: 0,
              content: params.specialType === 'thankYou' ? 'Thank you' : 'Content placeholder',
            },
          ],
        };

      default:
        return { error: 'Unknown fallback type' };
    }
  }

  /**
   * Generate with resilience (retry + circuit breaker + cache + fallback)
   */
  async generateWithResilience<T>(
    requestFn: () => Promise<T>,
    cacheKey: string,
    expectedFields: string[],
    fallbackType?: 'outline' | 'content' | 'special',
    fallbackParams?: any
  ): Promise<T> {
    // Check cache first
    const cached = this.getFromCache<T>(cacheKey);
    if (cached) {
      return cached;
    }

    // Check circuit breaker
    this.checkCircuitBreaker();

    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryConfig.maxAttempts; attempt++) {
      this.metrics.attempts++;

      try {
        this.logger.debug('Generation attempt', { attempt: attempt + 1, maxAttempts: this.retryConfig.maxAttempts });

        const result = await requestFn();

        // Validate result
        if (!this.validateResult(result, expectedFields)) {
          throw new Error('Generated result failed validation');
        }

        // Record success
        const latency = Date.now() - startTime;
        this.metrics.totalLatency += latency;
        this.recordSuccess();

        // Cache result
        this.saveToCache(cacheKey, result);

        this.logger.info('Generation successful', {
          attempt: attempt + 1,
          latency: `${latency}ms`,
        });

        return result;
      } catch (error: any) {
        lastError = error;
        this.logger.warn('Generation attempt failed', {
          attempt: attempt + 1,
          error: error.message,
        });

        // Don't retry on validation errors or circuit breaker errors
        if (
          error.message.includes('Circuit breaker') ||
          error.message.includes('validation')
        ) {
          break;
        }

        // Calculate delay for next retry
        if (attempt < this.retryConfig.maxAttempts - 1) {
          const delay = this.calculateDelay(attempt);
          this.logger.debug('Retrying after delay', { delayMs: delay });
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    this.recordFailure(lastError!);

    // Try fallback if available
    if (fallbackType) {
      this.logger.warn('Using fallback content', { type: fallbackType });
      const fallback = this.generateFallbackContent(fallbackType, fallbackParams || {});
      return fallback as T;
    }

    // No fallback available, throw error
    throw new Error(
      `Generation failed after ${this.retryConfig.maxAttempts} attempts: ${lastError?.message}`
    );
  }

  /**
   * Generate outline with resilience
   */
  async generateOutline(
    slides: any[],
    language: string,
    pageCount: number,
    topic: string,
    jsonSchema: any
  ): Promise<any> {
    const cacheKey = this.generateCacheKey({ type: 'outline', slides, language, pageCount, topic });

    return this.generateWithResilience(
      async () => {
        const completion = await this.client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a professional presentation assistant. Create a structured outline.`,
            },
            {
              role: 'user',
              content: `Topic: "${topic}", Language: ${language}, Slides: ${pageCount}`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'outline',
              strict: true,
              schema: jsonSchema,
            },
          },
          temperature: 0.7,
        });

        const raw = completion.choices[0].message.content ?? '{}';
        return JSON.parse(raw);
      },
      cacheKey,
      ['outline', 'slides'],
      'outline',
      { topic, language }
    );
  }

  /**
   * Generate content with resilience
   */
  async generateContent(
    slide: any,
    outline: any,
    language: string,
    elements: any[],
    contentSchema: any
  ): Promise<any> {
    const cacheKey = this.generateCacheKey({
      type: 'content',
      slideId: slide.id,
      outline,
      language,
    });

    return this.generateWithResilience(
      async () => {
        const completion = await this.client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Professional content writer. Generate content for ALL elements in ${language}.`,
            },
            {
              role: 'user',
              content: `Slide: ${slide.id}, Topic: ${outline.title || outline.title_eng}, Elements: ${elements.length}`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'slide_content',
              strict: true,
              schema: contentSchema,
            },
          },
          temperature: 0.7,
        });

        const raw = completion.choices[0].message.content ?? '{}';
        return JSON.parse(raw);
      },
      cacheKey,
      ['slideId', 'elements'],
      'content',
      { slideId: slide.id, elements }
    );
  }

  /**
   * Get metrics
   */
  getMetrics(): GenerationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): CircuitState {
    return this.circuitState;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    entries: number;
  } {
    const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    const hitRate = totalRequests > 0 ? this.metrics.cacheHits / totalRequests : 0;

    return {
      size: this.cache.size,
      hitRate,
      entries: this.cache.size,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('Cache cleared');
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      attempts: 0,
      totalLatency: 0,
      cacheHits: 0,
      cacheMisses: 0,
      failures: 0,
      successes: 0,
    };
    this.logger.info('Metrics reset');
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitState = CircuitState.CLOSED;
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
    this.logger.info('Circuit breaker reset');
  }
}
