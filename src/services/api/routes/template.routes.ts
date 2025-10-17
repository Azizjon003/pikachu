import { Router } from "express";
import {
  getTemplates,
  uploadAndCreateTemplate,
  uploadTemplatePreview,
  getTemplatePreview,
} from "../controller/template.controller";
import upload, { uploadPreview } from "../utils/upload";
import { uploadLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../middleware/error-handler";

const router = Router();

// POST /api/template/import - Upload and import a template
router.post(
  "/import",
  uploadLimiter, // Apply upload rate limiting
  upload.single("file"),
  asyncHandler(uploadAndCreateTemplate)
);

// GET /api/template/templates - Get all available templates
router.get("/templates", asyncHandler(getTemplates));

// POST /api/template/:templateName/preview - Upload preview image for a template
router.post(
  "/:templateName/preview",
  uploadLimiter, // Apply upload rate limiting
  uploadPreview.single("preview"),
  asyncHandler(uploadTemplatePreview)
);

// GET /api/template/:templateName/preview - Get preview image for a template
router.get(
  "/:templateName/preview",
  asyncHandler(getTemplatePreview)
);

export default router;
