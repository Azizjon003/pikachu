/**
 * Parallel Optimization Configuration
 *
 * Configurable settings for parallel slide optimization
 */

export interface ParallelOptimizationConfig {
  /** Number of slides to process simultaneously in each batch */
  batchSize: number;

  /** Delay in milliseconds between batches (to avoid rate limiting) */
  delayBetweenBatches: number;

  /** Maximum number of retry attempts for failed optimizations */
  maxRetries: number;

  /** Timeout for each slide optimization in milliseconds */
  optimizationTimeout: number;

  /** Whether to continue processing if one slide fails */
  continueOnError: boolean;
}

/**
 * Default configuration optimized for OpenAI API rate limits
 */
export const DEFAULT_PARALLEL_CONFIG: ParallelOptimizationConfig = {
  batchSize: 3,                    // 3 slides at once (safe for GPT-4)
  delayBetweenBatches: 1500,       // 1.5 second delay between batches
  maxRetries: 2,                   // Retry failed slides twice
  optimizationTimeout: 30000,      // 30 second timeout per slide
  continueOnError: true            // Don't stop if one slide fails
};

/**
 * Aggressive configuration for higher throughput (requires higher rate limits)
 */
export const AGGRESSIVE_PARALLEL_CONFIG: ParallelOptimizationConfig = {
  batchSize: 5,                    // 5 slides at once
  delayBetweenBatches: 1000,       // 1 second delay
  maxRetries: 1,                   // Only retry once
  optimizationTimeout: 20000,      // 20 second timeout
  continueOnError: true
};

/**
 * Conservative configuration for lower rate limits
 */
export const CONSERVATIVE_PARALLEL_CONFIG: ParallelOptimizationConfig = {
  batchSize: 2,                    // Only 2 slides at once
  delayBetweenBatches: 2000,       // 2 second delay
  maxRetries: 3,                   // Retry up to 3 times
  optimizationTimeout: 45000,      // 45 second timeout
  continueOnError: true
};

/**
 * Calculate optimal batch size based on total slides
 */
export function calculateOptimalBatchSize(totalSlides: number): number {
  if (totalSlides <= 3) return 1;          // Small presentations: sequential
  if (totalSlides <= 8) return 2;          // Medium: 2 at a time
  if (totalSlides <= 15) return 3;         // Large: 3 at a time
  return 4;                                // Very large: 4 at a time
}

/**
 * Get recommended configuration based on presentation size
 */
export function getRecommendedConfig(totalSlides: number): ParallelOptimizationConfig {
  const batchSize = calculateOptimalBatchSize(totalSlides);

  return {
    ...DEFAULT_PARALLEL_CONFIG,
    batchSize
  };
}

export default DEFAULT_PARALLEL_CONFIG;
