import express from "express";
import {
  getAllWaves,
  createWave,
  updateWave,
  deleteWave,
  getWaveSectionText,
  updateWaveSectionText,
} from "../controllers/controller.wave.js";
import { protect, authorize } from "../middleware/auth.js";
import { validateWave } from "../middleware/validation.js";
import { uploadWaveThumbnail } from "../middleware/upload.js";

const router = express.Router();

// Public Routes
router.get("/", getAllWaves);
router.get("/section-text", getWaveSectionText);

// Admin Routes (Protected)
router.post("/", protect, authorize("admin"), uploadWaveThumbnail, validateWave, createWave);
router.put("/:id", protect, authorize("admin"), uploadWaveThumbnail, validateWave, updateWave);
router.delete("/:id", protect, authorize("admin"), deleteWave);
router.put("/section-text/update", protect, authorize("admin"), updateWaveSectionText);

export default router;