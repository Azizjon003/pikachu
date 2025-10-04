import { Router } from "express";
import templateRoutes from "./template.routes";
import slideRoutes from "./slide.routes";
import schemaRoutes from "./schema.routes";

const router = Router();

router.use("/template", templateRoutes);
router.use("/slide", slideRoutes);
router.use("/schema", schemaRoutes);

export default router;
