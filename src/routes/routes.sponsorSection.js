import express from "express";
import { authorize, protect } from "../middleware/auth.js";
import { createSponsorSectionText, getSponsorSectionText, updateSponsorSectionText } from "../controllers/controller.sponsorSection.js";

const router = express.Router();

// ========== PUBLIC ROUTES ==========
router.get("/", getSponsorSectionText);

// ========== ADMIN ROUTES ==========
router.post("/", protect, authorize("admin"), createSponsorSectionText);
router.put("/update", protect, authorize("admin"), updateSponsorSectionText);

export default router;