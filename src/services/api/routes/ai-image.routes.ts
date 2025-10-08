import { Router } from 'express';
import {
  generateSlideImage,
  generateBatchImages,
  searchImageByKeyword,
  getTemplateImages,
  getTemplateStats,
  cleanupTemplateImages,
  deleteTemplateImages,
  validateImage,
  getServiceStats,
  exportTemplateMetadata
} from '../controller/ai-image.controller';

const router = Router();

// Image generation
router.post('/generate', generateSlideImage);
router.post('/generate-batch', generateBatchImages);
router.post('/search', searchImageByKeyword);

// Template management
router.get('/template/:templateName', getTemplateImages);
router.get('/stats/:templateName', getTemplateStats);
router.post('/cleanup/:templateName', cleanupTemplateImages);
router.delete('/template/:templateName', deleteTemplateImages);
router.get('/export/:templateName', exportTemplateMetadata);

// Image validation
router.post('/validate', validateImage);

// Service statistics
router.get('/service/stats', getServiceStats);

export default router;