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
 * Validation rules for template-free slide generation
 */
export const validateFreeSlideGeneration = [
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
    .isInt({ min: 6, max: 100 })
    .withMessage('Page must be between 6 and 100 (minimum: title + outline + 1 content + conclusion + references + thank-you)'),

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

  body('theme')
    .optional()
    .isString()
    .isIn(['professional', 'modern', 'warm', 'cool', 'bold', 'minimal', 'custom'])
    .withMessage('Theme must be one of: professional, modern, warm, cool, bold, minimal, custom'),

  body('fontPair')
    .optional()
    .isString()
    .isIn(['classic', 'modern', 'elegant', 'playful', 'technical', 'minimal'])
    .withMessage('Font pair must be one of: classic, modern, elegant, playful, technical, minimal'),

  handleValidationErrors,
];

/**
 * Validation rules for slide editing
 */
export const validateSlideEdit = [
  body('slide')
    .notEmpty()
    .withMessage('Slide is required')
    .isObject()
    .withMessage('Slide must be an object'),

  body('slide.id')
    .notEmpty()
    .withMessage('Slide id is required')
    .isString()
    .withMessage('Slide id must be a string'),

  body('slide.elements')
    .notEmpty()
    .withMessage('Slide elements are required')
    .isArray()
    .withMessage('Slide elements must be an array'),

  body('instructions')
    .notEmpty()
    .withMessage('Instructions are required')
    .isString()
    .withMessage('Instructions must be a string')
    .isLength({ min: 3, max: 500 })
    .withMessage('Instructions must be between 3 and 500 characters'),

  body('language')
    .notEmpty()
    .withMessage('Language is required')
    .isString()
    .withMessage('Language must be a string')
    .isLength({ min: 2, max: 50 })
    .withMessage('Language must be between 2 and 50 characters'),

  body('topic')
    .optional()
    .isString()
    .withMessage('Topic must be a string')
    .isLength({ max: 200 })
    .withMessage('Topic must not exceed 200 characters'),

  body('elementIndexes')
    .optional()
    .isArray()
    .withMessage('elementIndexes must be an array'),

  body('elementIndexes.*')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Each elementIndex must be a non-negative integer'),

  handleValidationErrors,
];

/**
 * Validation rules for image editing
 */
export const validateImageEdit = [
  body('slide')
    .notEmpty()
    .withMessage('Slide is required')
    .isObject()
    .withMessage('Slide must be an object'),

  body('slide.id')
    .notEmpty()
    .withMessage('Slide id is required')
    .isString()
    .withMessage('Slide id must be a string'),

  body('slide.elements')
    .notEmpty()
    .withMessage('Slide elements are required')
    .isArray()
    .withMessage('Slide elements must be an array'),

  body('elementIndexes')
    .notEmpty()
    .withMessage('elementIndexes is required')
    .isArray({ min: 1 })
    .withMessage('elementIndexes must be a non-empty array'),

  body('elementIndexes.*')
    .isInt({ min: 0 })
    .withMessage('Each elementIndex must be a non-negative integer'),

  body('language')
    .notEmpty()
    .withMessage('Language is required')
    .isString()
    .withMessage('Language must be a string')
    .isLength({ min: 2, max: 50 })
    .withMessage('Language must be between 2 and 50 characters'),

  body('topic')
    .optional()
    .isString()
    .withMessage('Topic must be a string')
    .isLength({ max: 200 })
    .withMessage('Topic must not exceed 200 characters'),

  body('keywords')
    .optional()
    .isObject()
    .withMessage('Keywords must be an object'),

  handleValidationErrors,
];

/**
 * Validation rules for slide re-rendering
 */
export const validateReRender = [
  body('slides')
    .notEmpty()
    .withMessage('Slides are required')
    .isArray({ min: 1 })
    .withMessage('Slides must be a non-empty array'),

  body('template')
    .notEmpty()
    .withMessage('Template is required')
    .isString()
    .withMessage('Template must be a string'),

  handleValidationErrors,
];

/**
 * Validation rules for file downloads
 */
export const validateFileDownload = [
  param('filename')
    .notEmpty()
    .withMessage('Filename is required')
    .matches(/^[\w.-]+\.(pptx|json)$/)
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
    .matches(/^[\w.-]+\.(pptx|json)$/)
    .withMessage('Invalid filename format'),

  handleValidationErrors,
];
