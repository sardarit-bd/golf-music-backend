import express from "express";
import {
  getAllWaves,
  createWave,
  updateWave,
  deleteWave,
} from "../controllers/controller.wave.js";
import { protect, authorize } from "../middleware/auth.js";
import { validateWave } from "../middleware/validation.js";
import { uploadWaveThumbnail } from "../middleware/upload.js";

const router = express.Router();

// Public
router.get("/", getAllWaves);

// Admin only
router.post("/", protect, authorize("admin"), uploadWaveThumbnail, validateWave, createWave);
router.put("/:id", protect, authorize("admin"), uploadWaveThumbnail, validateWave, updateWave);
router.delete("/:id", protect, authorize("admin"), deleteWave);

export default router;
