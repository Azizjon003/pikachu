import { Router } from "express";
import {
  getTemplates,
  uploadAndCreateTemplate,
} from "../controller/template.controller";
import upload from "../utils/upload";
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

export default router;
