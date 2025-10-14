import { Request, Response, NextFunction } from 'express';
import { ApiError } from './error-handler';

/**
 * API Key Authentication Middleware
 * Validates API key from request header
 */
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const validApiKey = process.env.API_KEY;

  // Skip authentication if no API key is configured
  if (!validApiKey || validApiKey === '') {
    return next();
  }

  // Check if API key is provided
  if (!apiKey) {
    throw new ApiError(401, 'API key is required. Please provide X-API-Key header.');
  }

  // Validate API key
  if (apiKey !== validApiKey) {
    throw new ApiError(403, 'Invalid API key. Access denied.');
  }

  next();
};

/**
 * Optional API Key Authentication
 * Doesn't throw error if no key is provided, but validates if present
 */
export const optionalApiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const validApiKey = process.env.API_KEY;

  // Skip if no API key configured or provided
  if (!validApiKey || !apiKey) {
    return next();
  }

  // Validate if API key is provided
  if (apiKey !== validApiKey) {
    throw new ApiError(403, 'Invalid API key. Access denied.');
  }

  next();
};
