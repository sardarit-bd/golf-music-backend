import express from "express";
import { getFeaturedSection, updateFeaturedSection } from "../controllers/controller.featuredSection.js";
import { authorize, protect } from "../middleware/auth.js";
import { uploadFeaturedImage } from "../middleware/upload.js";

const router = express.Router();

router.get("/", getFeaturedSection);

router.put(
  "/update",
  protect,
  authorize("admin"),
  uploadFeaturedImage,
  updateFeaturedSection
);

export default router;
