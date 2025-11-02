import express from "express";
import { 
  getAllCasts, 
  createCast, 
  updateCast, 
  deleteCast 
} from "../controllers/controller.cast.js";
import { protect, authorize } from "../middleware/auth.js";
import { validateCast } from "../middleware/validation.js";

const router = express.Router();

// Public route
router.get("/", getAllCasts);

// Admin routes
router.post("/", protect, authorize("admin"), validateCast, createCast);
router.put("/:id", protect, authorize("admin"), validateCast, updateCast);
router.delete("/:id", protect, authorize("admin"), deleteCast);

export default router;
