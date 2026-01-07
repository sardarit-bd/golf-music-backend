import express from "express";
import {
  getAllCasts,
  createCast,
  updateCast,
  deleteCast,
} from "../controllers/controller.cast.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", getAllCasts);

router.post("/", protect, authorize("admin"), createCast);
router.put("/:id", protect, authorize("admin"), updateCast);
router.delete("/:id", protect, authorize("admin"), deleteCast);

export default router;
