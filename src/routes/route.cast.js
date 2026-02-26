import express from "express";
import {
  getAllCasts,
  getCastById,
  createCast,
  updateCast,
  deleteCast,
  searchCasts
} from "../controllers/controller.cast.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// ========== PUBLIC ROUTES ==========
router.get("/", getAllCasts);
router.get("/search", searchCasts);
router.get("/:id", getCastById);

// ========== ADMIN ROUTES ==========
router.post(
  "/",
  protect,
  authorize("admin"),
  createCast
);

router.put(
  "/:id",
  protect,
  authorize("admin"),
  updateCast
);

router.delete(
  "/:id",
  protect,
  authorize("admin"),
  deleteCast
);

export default router;