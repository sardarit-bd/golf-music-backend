// routes/venue.routes.js
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
  getVenuesByState, // ✅ নতুন API
  getVenuesStatesSummary, // ✅ নতুন API
  checkSubscriptionStatus, // ✅ Subscription status check
  getSubscriptionStatus, // ✅ Subscription status endpoint
} from "../controllers/controllers.venue.js";
import { withEntitlements } from "../middleware/withEntitlements.js";
import { subscriptionCheck, featureCheck } from "../middleware/subscriptionMiddleware.js";

const router = express.Router();

// ✅ Public routes
router.get("/calendar", getCalendarByCity);


// ✅ Location-based categorization routes
router.get("/by-state", getVenuesByState); // GET /api/venues/by-state?state=Louisiana
router.get("/states-summary", getVenuesStatesSummary); // GET /api/venues/states-summary

// ✅ Subscription middleware (optional for all protected routes)
// router.use(subscriptionCheck);

// ✅ Subscription status endpoint
router.get("/subscription/status", 
  protect, 
  authorize("venue", "artist", "photographer", "fan", "journalist"), 
  getSubscriptionStatus
);

// ✅ Venue Self Routes
router.get("/profile", 
  protect, 
  authorize("venue"), 
  withEntitlements("venue"), 
  getMyVenueProfile
);


router.get("/", getVenuesByCity);
router.get("/:id", getVenue);


// ✅ Add Show with subscription check
router.post(
  "/add-show",
  protect,
  authorize("venue"),
  uploadEventImage,
  handleUploadErrors,
  // subscriptionCheck, // Uncomment if needed
  // featureCheck('shows'), // Uncomment if needed
  addShow
);

// ✅ Create or Update Venue Profile
router.post(
  "/profile",
  protect,
  authorize("venue"),
  withEntitlements("venue"),
  uploadVenuePhotos,
  handleUploadErrors,
  validateVenueProfile,
  // subscriptionCheck, // Uncomment if needed
  createOrUpdateProfile
);

// ✅ Explicit Update
router.put(
  "/profile",
  protect,
  authorize("venue"),
  withEntitlements("venue"),
  uploadVenuePhotos,
  handleUploadErrors,
  validateVenueProfile,
  // subscriptionCheck, // Uncomment if needed
  updateVenueProfile
);

// ✅ Delete My Venue
router.delete("/profile", 
  protect, 
  authorize("venue"), 
  withEntitlements("venue"),  
  deleteVenueProfile
);

// ================================
// ADMIN ROUTES
// ================================
router.get("/admin/venues", 
  protect, 
  authorize("admin"), 
  getVenuesForAdmin
);

router.put("/admin/:id", 
  protect, 
  authorize("admin"), 
  updateVenueByAdmin
);

// ✅ Admin subscription control endpoints (if needed later)
// router.get("/admin/subscription/config", protect, authorize("admin"), getSubscriptionConfig);
// router.put("/admin/subscription/config", protect, authorize("admin"), updateSubscriptionConfig);
// router.put("/admin/:id/plan", protect, authorize("admin"), changeVenuePlanByAdmin);

router.delete("/admin/:id", 
  protect, 
  authorize("admin"), 
  deleteVenueByAdmin
);

export default router;