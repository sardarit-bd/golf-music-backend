import express from "express";
import { getFooter, updateFooter } from "../controllers/controller.footer.js";
import { authorize, protect } from './../middleware/auth.js';
import { uploadFooterLogo } from "../middleware/upload.js";

const router = express.Router();

router.get("/", getFooter);

router.put(
  "/update",
  protect,
  authorize("admin"),
  uploadFooterLogo,
  updateFooter
);

export default router;
