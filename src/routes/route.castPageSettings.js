import express from "express";
import {
  getCastPageSettings,
  updateCastPageSettings,
} from "../controllers/controller.castPageSettings.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public
router.get("/", getCastPageSettings);

// Admin
router.put(
  "/",
  protect,
  authorize("admin"),
  updateCastPageSettings
);

export default router;