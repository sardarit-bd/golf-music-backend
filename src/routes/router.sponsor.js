import express from "express";
import {
  createSponsor,
  getSponsors,
  updateSponsor,
  deleteSponsor,
} from "../controllers/controller.sponsor.js";
import { uploadSingleSponsorLogo } from "../middleware/upload.js";
import { authorize, protect } from "../middleware/auth.js";

const router = express.Router();

// Admin only
router.post("/", protect, authorize("admin"), uploadSingleSponsorLogo, createSponsor);
router.put("/:id", protect, authorize("admin"), uploadSingleSponsorLogo, updateSponsor);
router.delete("/:id", protect, authorize("admin"), deleteSponsor);

// Public Route
router.get("/", getSponsors);

export default router;
