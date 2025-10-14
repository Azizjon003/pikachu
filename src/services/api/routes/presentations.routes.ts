import { Router } from 'express';
import {
  listPresentations,
  downloadPresentation,
  deletePresentation,
  getStats
} from '../controller/presentations.controller';
import { validateFileDownload, validateFileDeletion } from '../middleware/validation';
import { asyncHandler } from '../middleware/error-handler';

const router = Router();

// GET /api/presentations/list - List all presentations
router.get('/list', asyncHandler(listPresentations));

// GET /api/presentations/download/:filename - Download a presentation
router.get(
  '/download/:filename',
  validateFileDownload,
  asyncHandler(downloadPresentation)
);

// DELETE /api/presentations/:filename - Delete a presentation
router.delete(
  '/:filename',
  validateFileDeletion,
  asyncHandler(deletePresentation)
);

// GET /api/presentations/stats - Get presentation statistics
router.get('/stats', asyncHandler(getStats));

export default router;
