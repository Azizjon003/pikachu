/**
 * Safe JSON parser for AI responses
 * Handles markdown-wrapped JSON and provides proper error signaling
 */

import { EnhancedLogger, LogLevel } from '../../lib/logger';

const logger = new EnhancedLogger(LogLevel.INFO);

/**
 * Safely parse JSON response that may be wrapped in markdown code blocks.
 * Returns null on failure (NOT empty object) so callers must handle errors explicitly.
 */
export function safeParseJSON<T = unknown>(content: string): T | null {
  if (!content) return null;

  let jsonString = content.trim();

  // Remove markdown code block wrappers
  jsonString = jsonString.replace(/^```(?:json)?\s*/, '');
  jsonString = jsonString.replace(/\s*```$/, '');
  jsonString = jsonString.trim();

  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    logger.error('Failed to parse JSON', error as Error, {
      preview: jsonString.substring(0, 200),
    });
    return null;
  }
}

/**
 * Parse JSON with a required fallback value.
 * Use when you need a guaranteed non-null result.
 */
export function safeParseJSONWithFallback<T>(content: string, fallback: T): T {
  const result = safeParseJSON<T>(content);
  return result ?? fallback;
}
