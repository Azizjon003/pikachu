import { Router } from "express";
import templateRoutes from "./template.routes";
import slideRoutes from "./slide.routes";
import schemaRoutes from "./schema.routes";
import presentationsRoutes from "./presentations.routes";

const router = Router();

router.use("/template", templateRoutes);
router.use("/slide", slideRoutes);
router.use("/schema", schemaRoutes);
router.use("/presentations", presentationsRoutes);

export default router;
