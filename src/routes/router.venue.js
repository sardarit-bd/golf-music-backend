import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import { validateVenueProfile } from "../middleware/validation.js";
import { handleUploadErrors, uploadEventImage, uploadVenuePhotos } from "../middleware/upload.js";
import {
  addShow,
  changeVenuePlanByAdmin,
  createOrUpdateProfile,
  deleteVenueByAdmin,
  deleteVenueProfile,
  getCalendarByCity,
  getMyVenueProfile,
  getVenue,
  getVenuesByCity,
  getVenuesForAdmin,
  updateVenueByAdmin,
  updateVenueProfile,
} from "../controllers/controllers.venue.js";
import { withEntitlements } from "../middleware/withEntitlements.js";

const router = express.Router();

// Venue Self Routes
router.get("/profile", protect, authorize("venue"), withEntitlements("venue"), getMyVenueProfile);

router.get("/calendar", getCalendarByCity);

router.post(
  "/add-show",
  protect,
  authorize("venue"),
  uploadEventImage,
  handleUploadErrors,
  addShow
);

// Create or Update Venue
router.post(
  "/profile",
  protect,
  authorize("venue"),
  withEntitlements("venue"),
  uploadVenuePhotos,
  handleUploadErrors,
  validateVenueProfile,
  createOrUpdateProfile
);

// Explicit Update
router.put(
  "/profile",
  protect,
  authorize("venue"),
  withEntitlements("venue"),
  uploadVenuePhotos,
  handleUploadErrors,
  validateVenueProfile,
  updateVenueProfile
);

// Delete My Venue
router.delete("/profile", protect, authorize("venue"), withEntitlements("venue"),  deleteVenueProfile);

// PUBLIC GET all venues
router.get("/", getVenuesByCity);

// ================================
// ADMIN ROUTES (MUST COME BEFORE /:id)
// ================================
router.get("/admin/venues", protect, authorize("admin"), getVenuesForAdmin);

router.put("/admin/:id", protect, authorize("admin"), updateVenueByAdmin);

router.put("/admin/:id/plan", protect, authorize("admin"), changeVenuePlanByAdmin);

router.delete("/admin/:id", protect, authorize("admin"), deleteVenueByAdmin);

// ================================
// Dynamic route MUST be last
// ================================
router.get("/:id", getVenue);

export default router;
