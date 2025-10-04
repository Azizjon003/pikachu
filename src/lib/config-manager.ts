/**
 * Configuration Manager
 * Handles loading, merging, validation, and persistence of configuration
 */

import * as fs from 'fs';
import * as path from 'path';

export interface GenerationConfig {
  // Model configuration
  model: {
    name: string;
    temperature: number;
    maxTokens: number;
    topP?: number;
  };

  // Retry configuration
  retry: {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };

  // Circuit breaker configuration
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    resetTimeoutMs: number;
    halfOpenAttempts: number;
  };

  // Caching configuration
  cache: {
    enabled: boolean;
    ttlMs: number;
    maxSize: number;
  };

  // Quality validation configuration
  quality: {
    minScore: number;
    checkGrammar: boolean;
    checkReadability: boolean;
    checkCoherence: boolean;
    minWordCount?: number;
    maxWordCount?: number;
  };

  // Cost tracking
  costs: {
    trackUsage: boolean;
    costPerInputToken: number;
    costPerOutputToken: number;
    warningThreshold?: number;
  };

  // Language configuration
  language: {
    default: string;
    supported: string[];
  };
}

const DEFAULT_CONFIG: GenerationConfig = {
  model: {
    name: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1.0,
  },
  retry: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    resetTimeoutMs: 60000,
    halfOpenAttempts: 1,
  },
  cache: {
    enabled: true,
    ttlMs: 3600000, // 1 hour
    maxSize: 100,
  },
  quality: {
    minScore: 60,
    checkGrammar: true,
    checkReadability: true,
    checkCoherence: true,
    minWordCount: 10,
    maxWordCount: 1000,
  },
  costs: {
    trackUsage: true,
    costPerInputToken: 0.00015 / 1000, // $0.15 per 1M tokens
    costPerOutputToken: 0.0006 / 1000,  // $0.60 per 1M tokens
    warningThreshold: 5.0, // $5 warning
  },
  language: {
    default: 'English',
    supported: ['English', 'Uzbek', 'Russian', 'Turkish'],
  },
};

export class ConfigManager {
  private config: GenerationConfig;
  private configPath?: string;

  constructor(configPath?: string) {
    this.configPath = configPath;
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from file or use defaults
   */
  private loadConfig(): GenerationConfig {
    if (!this.configPath || !fs.existsSync(this.configPath)) {
      return { ...DEFAULT_CONFIG };
    }

    try {
      const fileContent = fs.readFileSync(this.configPath, 'utf-8');
      const userConfig = JSON.parse(fileContent);
      return this.mergeConfig(DEFAULT_CONFIG, userConfig);
    } catch (error) {
      console.warn(`Failed to load config from ${this.configPath}, using defaults:`, error);
      return { ...DEFAULT_CONFIG };
    }
  }

  /**
   * Deep merge configuration objects
   */
  private mergeConfig(
    defaults: GenerationConfig,
    overrides: Partial<GenerationConfig>
  ): GenerationConfig {
    const merged: any = { ...defaults };

    for (const key in overrides) {
      const overrideValue = (overrides as any)[key];
      if (overrideValue && typeof overrideValue === 'object' && !Array.isArray(overrideValue)) {
        merged[key] = this.mergeConfig(merged[key], overrideValue);
      } else {
        merged[key] = overrideValue;
      }
    }

    return merged;
  }

  /**
   * Get the full configuration
   */
  getConfig(): GenerationConfig {
    return { ...this.config };
  }

  /**
   * Get a specific configuration value by path
   */
  get<K extends keyof GenerationConfig>(key: K): GenerationConfig[K] {
    return this.config[key];
  }

  /**
   * Set a specific configuration value
   */
  set<K extends keyof GenerationConfig>(key: K, value: GenerationConfig[K]): void {
    this.config[key] = value;
  }

  /**
   * Update configuration with partial values
   */
  update(updates: Partial<GenerationConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate model config
    if (this.config.model.temperature < 0 || this.config.model.temperature > 2) {
      errors.push('Model temperature must be between 0 and 2');
    }
    if (this.config.model.maxTokens < 1) {
      errors.push('Model maxTokens must be positive');
    }

    // Validate retry config
    if (this.config.retry.maxAttempts < 1) {
      errors.push('Retry maxAttempts must be at least 1');
    }
    if (this.config.retry.initialDelayMs < 0) {
      errors.push('Retry initialDelayMs must be non-negative');
    }

    // Validate circuit breaker config
    if (this.config.circuitBreaker.failureThreshold < 1) {
      errors.push('Circuit breaker failureThreshold must be at least 1');
    }
    if (this.config.circuitBreaker.resetTimeoutMs < 0) {
      errors.push('Circuit breaker resetTimeoutMs must be non-negative');
    }

    // Validate quality config
    if (this.config.quality.minScore < 0 || this.config.quality.minScore > 100) {
      errors.push('Quality minScore must be between 0 and 100');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Save configuration to file
   */
  saveToFile(filePath?: string): void {
    const targetPath = filePath || this.configPath;
    if (!targetPath) {
      throw new Error('No file path specified for saving configuration');
    }

    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    fs.writeFileSync(targetPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  /**
   * Load configuration from environment variables
   */
  loadFromEnv(prefix: string = 'SLIDE_GEN_'): void {
    const env = process.env;

    // Model configuration
    if (env[`${prefix}MODEL_NAME`]) {
      this.config.model.name = env[`${prefix}MODEL_NAME`];
    }
    if (env[`${prefix}MODEL_TEMPERATURE`]) {
      this.config.model.temperature = parseFloat(env[`${prefix}MODEL_TEMPERATURE`]);
    }
    if (env[`${prefix}MODEL_MAX_TOKENS`]) {
      this.config.model.maxTokens = parseInt(env[`${prefix}MODEL_MAX_TOKENS`]);
    }

    // Retry configuration
    if (env[`${prefix}RETRY_MAX_ATTEMPTS`]) {
      this.config.retry.maxAttempts = parseInt(env[`${prefix}RETRY_MAX_ATTEMPTS`]);
    }

    // Circuit breaker configuration
    if (env[`${prefix}CIRCUIT_BREAKER_ENABLED`]) {
      this.config.circuitBreaker.enabled = env[`${prefix}CIRCUIT_BREAKER_ENABLED`] === 'true';
    }

    // Cache configuration
    if (env[`${prefix}CACHE_ENABLED`]) {
      this.config.cache.enabled = env[`${prefix}CACHE_ENABLED`] === 'true';
    }

    // Quality configuration
    if (env[`${prefix}QUALITY_MIN_SCORE`]) {
      this.config.quality.minScore = parseInt(env[`${prefix}QUALITY_MIN_SCORE`]);
    }
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Get configuration as JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }
}

// Export default configuration instance
export const configManager = new ConfigManager();
