import express from "express";
import {
  getWavePageSettings,
  updateWavePageSettings,
} from "../controllers/controller.wavePageSettings.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public Route
router.get("/", getWavePageSettings);

// Admin Route
router.put("/", protect, authorize("admin"), updateWavePageSettings);

export default router;