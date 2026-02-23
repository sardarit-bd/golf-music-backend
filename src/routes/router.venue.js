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
  getVenuesByState,
  getVenuesStatesSummary,
  checkSubscriptionStatus,
  getSubscriptionStatus,
  getAvailableColorsForCity,
  getVenueShows,
  getVenueShowById,
  updateVenueShow,
  deleteVenueShow,
  getVenueShowsCount,
  bulkDeleteVenueShows
} from "../controllers/controllers.venue.js";
import { withEntitlements } from "../middleware/withEntitlements.js";

const router = express.Router();

// Public routes
router.get("/calendar", getCalendarByCity);

// Location-based categorization routes
router.get("/by-state", getVenuesByState);
router.get("/states-summary", getVenuesStatesSummary);

// Subscription status endpoint
router.get("/subscription/status", 
  protect, 
  authorize("venue", "artist", "photographer", "fan", "journalist"), 
  getSubscriptionStatus
);

// ============================================
// SHOW MANAGEMENT ROUTES (New)
// ============================================

// Get shows count for current month
router.get("/shows/count", 
  protect, 
  authorize("venue"), 
  getVenueShowsCount
);

// Get all shows for a venue
router.get("/shows", 
  protect, 
  authorize("venue"), 
  getVenueShows
);

// Get single show by ID
router.get("/shows/:showId", 
  protect, 
  authorize("venue"), 
  getVenueShowById
);

// Update show
router.put("/shows/:showId",
  protect,
  authorize("venue"),
  uploadEventImage,
  handleUploadErrors,
  updateVenueShow
);

// Delete show
router.delete("/shows/:showId",
  protect,
  authorize("venue"),
  deleteVenueShow
);

// Bulk delete shows
router.delete("/shows/bulk",
  protect,
  authorize("venue"),
  bulkDeleteVenueShows
);

// ============================================
// VENUE PROFILE ROUTES
// ============================================

// Venue Self Routes
router.get("/profile", 
  protect, 
  authorize("venue"), 
  withEntitlements("venue"), 
  getMyVenueProfile
);

router.get("/", getVenuesByCity);
router.get("/:id", getVenue);

router.post(
  "/add-show",
  protect,
  authorize("venue"),
  uploadEventImage,
  handleUploadErrors,
  addShow
);

// Create or Update Venue Profile
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
router.delete("/profile", 
  protect, 
  authorize("venue"), 
  withEntitlements("venue"),  
  deleteVenueProfile
);

// ================================
// ADMIN ROUTES
// ================================

// Color management routes (Admin only)
router.get(
  "/admin/colors/available",
  protect,
  authorize("admin"),
  getAvailableColorsForCity
);

router.get("/admin/venues", 
  protect, 
  authorize("admin"), 
  getVenuesForAdmin
);

// Venue update with manual color support
router.put("/admin/:id", 
  protect, 
  authorize("admin"), 
  updateVenueByAdmin
);

router.delete("/admin/:id", 
  protect, 
  authorize("admin"), 
  deleteVenueByAdmin
);

export default router;