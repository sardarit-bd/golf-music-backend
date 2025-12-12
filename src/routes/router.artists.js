import express from "express";
import { authorize, protect } from "../middleware/auth.js";
import { validateArtistProfile } from "../middleware/validation.js";
import {
  changeArtistPlanByAdmin,
  createOrUpdateProfile,
  deleteArtistByAdmin,
  deleteArtistProfile,
  getArtist,
  getArtistsByGenre,
  getArtistsForAdmin,
  getMyArtistProfile,
  updateArtistByAdmin,
} from "../controllers/controllers.artist.js";
import {
  handleUploadErrors,
  uploadArtistFiles,
} from "../middleware/upload.js";

const router = express.Router();

/* =========================
   ARTIST SELF ROUTES
   ========================= */

// Get my artist profile
router.get(
  "/profile/me",
  protect,
  authorize("artist"),
  getMyArtistProfile
);

// Create OR Update artist profile (ONLY write endpoint)
router.post(
  "/profile",
  protect,
  authorize("artist"),
  uploadArtistFiles,
  handleUploadErrors,
  validateArtistProfile,
  createOrUpdateProfile
);

// Delete my artist profile
router.delete(
  "/profile",
  protect,
  authorize("artist"),
  deleteArtistProfile
);

/* =========================
   PUBLIC ROUTES
   ========================= */

// Get all artists (by genre)
router.get("/", getArtistsByGenre);

// Get single artist by ID
router.get("/:id", getArtist);

/* =========================
   ADMIN ROUTES
   ========================= */

// Get artists for admin (filters + pagination)
router.get(
  "/admin/artists",
  protect,
  authorize("admin"),
  getArtistsForAdmin
);

// Update artist by admin
router.put(
  "/admin/:id",
  protect,
  authorize("admin"),
  updateArtistByAdmin
);

// Change artist plan by admin
router.put(
  "/admin/:id/plan",
  protect,
  authorize("admin"),
  changeArtistPlanByAdmin
);

// Delete artist by admin
router.delete(
  "/admin/:id",
  protect,
  authorize("admin"),
  deleteArtistByAdmin
);

export default router;
