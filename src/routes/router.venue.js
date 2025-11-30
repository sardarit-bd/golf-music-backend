import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import { validateVenueProfile } from "../middleware/validation.js";
import { handleUploadErrors, uploadEventImage, uploadVenuePhotos } from "../middleware/upload.js";
import {
  addShow,
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

const router = express.Router();

router.get("/profile", protect, authorize("venue"), getMyVenueProfile);

router.get("/calendar", getCalendarByCity);

router.post(
  "/add-show",
  protect,
  authorize("venue"),
  uploadEventImage,
  handleUploadErrors,
  addShow
);

// Create or Update
router.post(
  "/profile",
  protect,
  authorize("venue"),
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
  uploadVenuePhotos,
  handleUploadErrors,
  validateVenueProfile,
  updateVenueProfile
);

// Delete
router.delete("/profile", protect, authorize("venue"), deleteVenueProfile);

// Get all venues (filter)
router.get("/", getVenuesByCity);

// Get single venue by ID
router.get("/:id", getVenue);


//NEW: Admin routes for venue management
router.get("/admin/venues", protect, authorize("admin"), getVenuesForAdmin);
router.put("/admin/:id", protect, authorize("admin"), updateVenueByAdmin);
router.delete("/admin/:id", protect, authorize("admin"), deleteVenueByAdmin);

export default router;
