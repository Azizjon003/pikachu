import { Router } from "express";
import {
  generateSlide,
  startSlideGeneration,
  getSlideGenerationStatus,
  startFreeSlideGeneration,
  editSlide,
  editSlideImages,
  reRenderSlide,
} from "../controller/slide.controller.new";
import { estimateCostHandler } from "../controller/cost-estimator";
import { validateSlideGeneration, validateFreeSlideGeneration, validateSlideEdit, validateImageEdit, validateReRender } from "../middleware/validation";
import { asyncHandler } from "../middleware/error-handler";

const router = Router();

// POST /api/slide/estimate-cost - Estimate generation cost before starting
router.post("/estimate-cost", asyncHandler(estimateCostHandler));

// POST /api/slide/generate - Start asynchronous slide generation
router.post(
  "/generate",
  validateSlideGeneration, // Validate input
  asyncHandler(startSlideGeneration) // Use async handler
);

// GET /api/slide/generate/status/:taskId - Check generation status
router.get("/generate/status/:taskId", asyncHandler(getSlideGenerationStatus));

// POST /api/slide/generate-free - Start template-free slide generation
router.post(
  "/generate-free",
  validateFreeSlideGeneration,
  asyncHandler(startFreeSlideGeneration)
);

// POST /api/slide/generate-sync - (Legacy) Generate presentation slides synchronously
router.post(
  "/generate-sync",
  validateSlideGeneration, // Validate input
  asyncHandler(generateSlide) // Wrap async handler for error catching
);

// POST /api/slide/edit - Edit existing slide content
router.post(
  "/edit",
  validateSlideEdit,
  asyncHandler(editSlide)
);

// POST /api/slide/edit-images - Replace images in an existing slide
router.post(
  "/edit-images",
  validateImageEdit,
  asyncHandler(editSlideImages)
);

// POST /api/slide/re-render - Re-render edited slides into PPTX
router.post(
  "/re-render",
  validateReRender,
  asyncHandler(reRenderSlide)
);

export default router;
