import { Router } from "express";
import { generateSlide } from "../controller/slide.controller";

const router = Router();

router.use("/generate", generateSlide);

export default router;
