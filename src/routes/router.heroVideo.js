import express from "express";
import { getHeroSection, updateHeroSection } from "../controllers/controller.heroVideo.js";
import { authorize, protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/", getHeroSection);

router.put(
  "/update",
  protect,
  authorize("admin"),
  updateHeroSection
);


export default router;
