import express from "express";
import {
  getAllCasts,
  getCastById,
  createCast,
  updateCast,
  deleteCast,
  getCastSectionText,
  updateCastSectionText,
  searchCasts,
  getCastsByTag
} from "../controllers/controller.cast.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// ========== PUBLIC ROUTES ==========
router.get("/", getAllCasts);
router.get("/search", searchCasts);
router.get("/tag/:tag", getCastsByTag);
router.get("/:id", getCastById);
router.get("/section/text", getCastSectionText);

// ========== ADMIN ROUTES ==========
router.post("/", 
  protect, 
  authorize("admin"), 
  createCast
);

router.put("/:id", 
  protect, 
  authorize("admin"), 
  updateCast
);

router.delete("/:id", 
  protect, 
  authorize("admin"), 
  deleteCast
);

// SECTION TEXT UPDATE - NO VALIDATION
router.put("/section/text/update", 
  protect, 
  authorize("admin"), 
  updateCastSectionText
);

export default router;