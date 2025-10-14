import { Router } from "express";
import { generateSlide } from "../controller/slide.controller";
import { validateSlideGeneration } from "../middleware/validation";
import { strictLimiter } from "../middleware/rate-limiter";
import { asyncHandler } from "../middleware/error-handler";

const router = Router();

// POST /api/slide/generate - Generate presentation slides
router.post(
  "/generate",
  strictLimiter, // Apply strict rate limiting for resource-intensive operations
  validateSlideGeneration, // Validate input
  asyncHandler(generateSlide) // Wrap async handler for error catching
);

export default router;
