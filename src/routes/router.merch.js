import express from "express";
import { createMerch, deleteMerch, getAllMerch, updateMerch } from "../controllers/controller.merch.js";
import { authorize, protect } from "../middleware/auth.js";
import { validateMerch } from "../middleware/validation.js";

const router = express.Router();

// Public route
router.get("/", getAllMerch);

// Admin routes
router.post("/", protect, authorize("admin"), validateMerch, createMerch);
router.put("/:id", protect, authorize("admin"), validateMerch, updateMerch);
router.delete("/:id", protect, authorize("admin"), deleteMerch);

export default router;
