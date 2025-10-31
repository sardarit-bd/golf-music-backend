import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import { validateVenueProfile } from "../middleware/validation.js";
import { uploadVenuePhotos, handleUploadErrors } from "../middleware/upload.js";
import {
  addShow,
  createOrUpdateProfile,
  deleteVenueProfile,
  getCalendarByCity,
  getMyVenueProfile,
  getVenue,
  getVenuesByCity,
  updateVenueProfile,
} from "../controllers/controllers.venue.js";

const router = express.Router();

router.get("/profile", protect, authorize("venue"), getMyVenueProfile);

router.get("/calendar", getCalendarByCity);

router.post("/add-show", protect, authorize("venue"), addShow);
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

export default router;
