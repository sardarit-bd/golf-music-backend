import express from "express";
import { getHeroSection, updateHeroSection } from "../controllers/controller.heroVideo.js";
import { authorize, protect } from "../middleware/auth.js";
import { uploadHeroVideo } from "../middleware/upload.js";

const router = express.Router();

router.get("/", getHeroSection);

router.put(
  "/update",
  protect,
  authorize("admin"),
  uploadHeroVideo,
  updateHeroSection
);

export default router;
