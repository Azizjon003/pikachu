import { Router } from "express";
import templateRoutes from "./template.routes";
import slideRoutes from "./slide.routes";

const router = Router();

router.use("/template", templateRoutes);
router.use("/slide", slideRoutes);

export default router;
