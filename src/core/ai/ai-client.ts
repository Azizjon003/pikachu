/**
 * Unified AI Client
 *
 * Every AI call in the generation pipeline goes through this client.
 * Provides: retry with exponential backoff, circuit breaker, caching,
 * token tracking, and fallback support.
 *
 * Absorbs the good patterns from resilient-generator.ts into a generic wrapper.
 */

import { getOpenAIService, OpenAIService } from '../../services/openai';
import { EnhancedLogger, LogLevel } from '../../lib/logger';
import prisma from '../../lib/prisma';
import { safeParseJSON } from '../utils/json-parser';
import {
  AICallOptions,
  AICallResult,
  TokenUsage,
  GenerationConfig,
  DEFAULT_GENERATION_CONFIG,
} from '../types/generation';

// ===== Circuit Breaker =====

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

export class AIClient {
  private openaiService: OpenAIService;
  private logger: EnhancedLogger;
  private config: GenerationConfig;

  // Circuit breaker
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;

  // Cache
  private cache = new Map<string, CacheEntry<unknown>>();

  // Cumulative token usage
  private totalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
  };

  constructor(config?: Partial<GenerationConfig>, logger?: EnhancedLogger) {
    this.config = { ...DEFAULT_GENERATION_CONFIG, ...config };
    this.logger = logger ?? new EnhancedLogger(LogLevel.INFO);
    this.openaiService = getOpenAIService();
  }

  /**
   * Make an AI call with retry, circuit breaker, cache, and fallback.
   */
  async call<T>(options: AICallOptions): Promise<AICallResult<T>> {
    const { operationName, fallback } = options;
    const startTime = Date.now();

    // 1. Check cache
    const cacheKey = this.buildCacheKey(options);
    if (this.config.cacheEnabled) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for ${operationName}`);
        return {
          data: cached,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
          latencyMs: Date.now() - startTime,
          retryCount: 0,
          fromCache: true,
          fromFallback: false,
        };
      }
    }

    // 2. Check circuit breaker
    this.checkCircuitBreaker(operationName);

    // 3. Retry loop
    const maxRetries = options.maxRetries ?? this.config.maxRetries;
    let lastError: Error | null = null;
    let retryCount = 0;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        this.logger.debug(`${operationName}: attempt ${attempt + 1}/${maxRetries}`);

        const result = await this.executeCall<T>(options);

        // Success
        this.recordSuccess();

        if (this.config.cacheEnabled) {
          this.saveToCache(cacheKey, result.data);
        }

        const latencyMs = Date.now() - startTime;

        // Log to DB (fire-and-forget)
        this.logAiCall(operationName, options.model ?? this.config.model,
          result.usage, latencyMs, retryCount, false, false, 'success');

        return {
          ...result,
          latencyMs,
          retryCount,
          fromCache: false,
          fromFallback: false,
        };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;
        retryCount = attempt + 1;

        this.logger.warn(`${operationName}: attempt ${attempt + 1} failed`, {
          error: err.message,
        });

        // Don't retry on circuit breaker or validation errors
        if (err.message.includes('Circuit breaker') || err.message.includes('validation')) {
          break;
        }

        // Wait before retry (exponential backoff with jitter)
        if (attempt < maxRetries - 1) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    // 4. All retries failed
    this.recordFailure(lastError!);

    // 5. Try fallback
    if (fallback) {
      this.logger.warn(`${operationName}: using fallback content`);
      const fallbackData = fallback() as T;
      const latencyMs = Date.now() - startTime;

      this.logAiCall(operationName, options.model ?? this.config.model,
        { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
        latencyMs, retryCount, false, true, 'success');

      return {
        data: fallbackData,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
        latencyMs,
        retryCount,
        fromCache: false,
        fromFallback: true,
      };
    }

    // Log failure
    this.logAiCall(operationName, options.model ?? this.config.model,
      { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
      Date.now() - startTime, retryCount, false, false, 'error', lastError?.message);

    throw new Error(
      `${operationName} failed after ${maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Execute a single AI call (no retry).
   */
  private async executeCall<T>(options: AICallOptions): Promise<{ data: T; usage: TokenUsage }> {
    const model = options.model ?? this.config.model;
    const client = this.openaiService.getClient();

    let response;

    if (options.responseFormat === 'json_schema' && options.responseSchema) {
      // Structured output with JSON schema
      response = await client.chat.completions.create({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: options.operationName.replace(/[^a-zA-Z0-9_-]/g, '_'),
            strict: true,
            schema: options.responseSchema,
          },
        },
      });
    } else if (options.responseFormat === 'json_object') {
      // JSON mode
      response = await client.chat.completions.create({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        response_format: { type: 'json_object' },
      });
    } else {
      // Text mode
      response = await client.chat.completions.create({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
      });
    }

    const rawContent = response.choices[0]?.message?.content ?? '{}';
    const apiUsage = response.usage;

    // Parse response
    const parsed = safeParseJSON<T>(rawContent);
    if (parsed === null) {
      throw new Error(`${options.operationName}: failed to parse AI response`);
    }

    // Track token usage
    const usage: TokenUsage = {
      promptTokens: apiUsage?.prompt_tokens ?? 0,
      completionTokens: apiUsage?.completion_tokens ?? 0,
      totalTokens: apiUsage?.total_tokens ?? 0,
      estimatedCost: this.estimateCost(
        apiUsage?.prompt_tokens ?? 0,
        apiUsage?.completion_tokens ?? 0,
        model
      ),
    };

    this.totalUsage.promptTokens += usage.promptTokens;
    this.totalUsage.completionTokens += usage.completionTokens;
    this.totalUsage.totalTokens += usage.totalTokens;
    this.totalUsage.estimatedCost += usage.estimatedCost;

    return { data: parsed, usage };
  }

  // ===== Circuit Breaker =====

  private checkCircuitBreaker(operationName: string): void {
    if (!this.config.circuitBreakerEnabled) return;

    if (this.circuitState === CircuitState.OPEN) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.config.circuitBreakerResetMs) {
        this.circuitState = CircuitState.HALF_OPEN;
        this.halfOpenAttempts = 0;
        this.logger.info('Circuit breaker entering HALF_OPEN state');
      } else {
        throw new Error(`Circuit breaker is OPEN for ${operationName}. Service unavailable.`);
      }
    }
  }

  private recordSuccess(): void {
    if (!this.config.circuitBreakerEnabled) return;

    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= 1) {
        this.circuitState = CircuitState.CLOSED;
        this.failureCount = 0;
        this.logger.info('Circuit breaker closed after successful recovery');
      }
    } else if (this.circuitState === CircuitState.CLOSED) {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  private recordFailure(error: Error): void {
    if (!this.config.circuitBreakerEnabled) return;

    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.circuitState = CircuitState.OPEN;
      this.logger.warn('Circuit breaker opened after failed recovery attempt');
    } else if (this.failureCount >= this.config.circuitBreakerThreshold) {
      this.circuitState = CircuitState.OPEN;
      this.logger.error('Circuit breaker opened due to too many failures', error, {
        failureCount: this.failureCount,
        threshold: this.config.circuitBreakerThreshold,
      });
    }
  }

  // ===== Cache =====

  private buildCacheKey(options: AICallOptions): string {
    return JSON.stringify({
      op: options.operationName,
      msgs: options.messages.map((m) => m.content.substring(0, 200)),
      schema: options.responseSchema ? 'yes' : 'no',
    });
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.config.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.data as T;
  }

  private saveToCache<T>(key: string, data: T): void {
    if (this.cache.size >= this.config.cacheMaxSize) {
      // Evict oldest entry
      const oldestKey = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0];
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, { data, timestamp: Date.now(), hits: 0 });
  }

  // ===== Helpers =====

  private calculateDelay(attempt: number): number {
    const delay = Math.min(
      this.config.retryDelayMs * Math.pow(this.config.backoffMultiplier, attempt),
      this.config.maxRetryDelayMs
    );
    const jitter = Math.random() * delay * 0.1;
    return delay + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private estimateCost(promptTokens: number, completionTokens: number, model: string): number {
    // GPT-4o pricing (approximate)
    if (model.includes('gpt-4o-mini')) {
      return (promptTokens * 0.00015 + completionTokens * 0.0006) / 1000;
    }
    // GPT-4o
    return (promptTokens * 0.0025 + completionTokens * 0.01) / 1000;
  }

  // ===== DB Logging =====

  private logAiCall(
    operationName: string,
    model: string,
    usage: TokenUsage,
    latencyMs: number,
    retryCount: number,
    fromCache: boolean,
    fromFallback: boolean,
    status: string,
    error?: string
  ): void {
    // Fire-and-forget — don't block the pipeline
    prisma.aiCallLog.create({
      data: {
        operationName,
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        estimatedCost: usage.estimatedCost,
        latencyMs,
        retryCount,
        fromCache,
        fromFallback,
        status,
        error: error || null,
      },
    }).catch(() => {
      // Silently ignore DB errors — logging should never break the pipeline
    });
  }

  // ===== Public Getters =====

  getTotalUsage(): TokenUsage {
    return { ...this.totalUsage };
  }

  getCircuitState(): string {
    return this.circuitState;
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  clearCache(): void {
    this.cache.clear();
  }

  resetCircuitBreaker(): void {
    this.circuitState = CircuitState.CLOSED;
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
  }
}
