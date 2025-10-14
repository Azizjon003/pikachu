import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { ApiError } from './error-handler';

/**
 * Middleware to handle validation results
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.type === 'field' ? err.path : 'unknown',
      message: err.msg,
    }));

    throw new ApiError(400, 'Validation failed', true);
  }

  next();
};

/**
 * Validation rules for slide generation
 */
export const validateSlideGeneration = [
  body('template')
    .notEmpty()
    .withMessage('Template is required')
    .isString()
    .withMessage('Template must be a string'),

  body('language')
    .notEmpty()
    .withMessage('Language is required')
    .isString()
    .withMessage('Language must be a string')
    .isLength({ min: 2, max: 50 })
    .withMessage('Language must be between 2 and 50 characters'),

  body('page')
    .notEmpty()
    .withMessage('Page count is required')
    .isInt({ min: 1, max: 100 })
    .withMessage('Page must be between 1 and 100'),

  body('topic')
    .notEmpty()
    .withMessage('Topic is required')
    .isString()
    .withMessage('Topic must be a string')
    .isLength({ min: 3, max: 200 })
    .withMessage('Topic must be between 3 and 200 characters'),

  body('author')
    .optional()
    .isString()
    .withMessage('Author must be a string')
    .isLength({ max: 100 })
    .withMessage('Author must not exceed 100 characters'),

  handleValidationErrors,
];

/**
 * Validation rules for file downloads
 */
export const validateFileDownload = [
  param('filename')
    .notEmpty()
    .withMessage('Filename is required')
    .matches(/^[\w-]+\.(pptx|json)$/)
    .withMessage('Invalid filename format'),

  handleValidationErrors,
];

/**
 * Validation rules for file deletion
 */
export const validateFileDeletion = [
  param('filename')
    .notEmpty()
    .withMessage('Filename is required')
    .matches(/^[\w-]+\.(pptx|json)$/)
    .withMessage('Invalid filename format'),

  handleValidationErrors,
];
