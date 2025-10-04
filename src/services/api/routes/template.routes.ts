import { Router } from "express";
import {
  getTemplates,
  uploadAndCreateTemplate,
} from "../controller/template.controller";
import upload from "../utils/upload";

const router = Router();

router.post("/import", upload.single("file"), uploadAndCreateTemplate);
router.get("/templates", getTemplates);

export default router;
