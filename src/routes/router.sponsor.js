import express from "express";
import {
  createSponsor,
  getSponsors,
  updateSponsor,
  deleteSponsor,
  getSponsorSectionText,
  updateSponsorSectionText,
} from "../controllers/controller.sponsor.js";
import { uploadSingleSponsorLogo } from "../middleware/upload.js";
import { authorize, protect } from "../middleware/auth.js";

const router = express.Router();

// ========== PUBLIC ROUTES ==========
router.get("/", getSponsors);
router.get("/section/text", getSponsorSectionText);

// ========== ADMIN ROUTES ==========
router.post("/", protect, authorize("admin"), uploadSingleSponsorLogo, createSponsor);
router.put("/:id", protect, authorize("admin"), uploadSingleSponsorLogo, updateSponsor);
router.delete("/:id", protect, authorize("admin"), deleteSponsor);
router.put("/section/text/update", protect, authorize("admin"), updateSponsorSectionText);

export default router;