import { Router } from 'express';
import {
  listPresentations,
  downloadPresentation,
  deletePresentation,
  getStats
} from '../controller/presentations.controller';

const router = Router();

router.get('/list', listPresentations);
router.get('/download/:filename', downloadPresentation);
router.delete('/:filename', deletePresentation);
router.get('/stats', getStats);

export default router;
