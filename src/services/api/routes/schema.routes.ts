import { Router } from "express";
import {
  getSchema,
  updateSchema,
  toggleImageEdited,
  updateElement,
} from "../controller/schema.controller";

const router = Router();

// GET /schema/:template - Get schema by template name
router.get("/:template", getSchema);

// PUT /schema - Update entire schema
router.put("/", updateSchema);

// PATCH /schema/image/toggle - Toggle isEdited flag for image
router.patch("/image/toggle", toggleImageEdited);

// PATCH /schema/element - Update element content
router.patch("/element", updateElement);

export default router;
