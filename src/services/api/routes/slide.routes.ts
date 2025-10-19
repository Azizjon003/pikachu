import { Router } from "express";
import {
  generateSlide,
  startSlideGeneration,
  getSlideGenerationStatus,
} from "../controller/slide.controller";
import { validateSlideGeneration } from "../middleware/validation";
import { asyncHandler } from "../middleware/error-handler";

const router = Router();

// POST /api/slide/generate - Start asynchronous slide generation
router.post(
  "/generate",
  validateSlideGeneration, // Validate input
  asyncHandler(startSlideGeneration) // Use async handler
);

// GET /api/slide/generate/status/:taskId - Check generation status
router.get("/generate/status/:taskId", asyncHandler(getSlideGenerationStatus));

// POST /api/slide/generate-sync - (Legacy) Generate presentation slides synchronously
router.post(
  "/generate-sync",
  validateSlideGeneration, // Validate input
  asyncHandler(generateSlide) // Wrap async handler for error catching
);

export default router;
