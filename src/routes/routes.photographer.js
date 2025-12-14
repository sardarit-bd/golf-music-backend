import express from "express";
import {
  addPhoto,
  addService,
  addVideo,
  changePhotographerPlanByAdmin,
  deletePhoto,
  deletePhotographerAdmin,
  deleteService,
  deleteVideo,
  getAllPhotographers,
  getPhotographerById,
  getPhotographerForAdmin,
  getPhotographerProfile,
  getPhotographersForAdmin,
  togglePhotographerStatusAdmin,
  updatePhotographerProfile,
  updateService,
} from "../controllers/controller.photographer.js";

import { protect, authorize } from "../middleware/auth.js";
import { uploadPhotographers } from "../middleware/upload.js";

const router = express.Router();

// ===================
// PUBLIC ROUTES
// ===================
router.get("/", getAllPhotographers);

// profile route must be BEFORE :id
router.get("/profile", protect, authorize("photographer"), getPhotographerProfile);

// dynamic ID route
router.get("/:id", getPhotographerById);

// ===================
// PHOTOGRAPHER ROUTES
// ===================
router.put("/profile", protect, authorize("photographer"), updatePhotographerProfile);

// Service management
router.post("/services", protect, authorize("photographer"), addService);
router.put("/services/:serviceId", protect, authorize("photographer"), updateService);
router.delete("/services/:serviceId", protect, authorize("photographer"), deleteService);

// Photo management
router.post(
  "/photos",
  protect,
  authorize("photographer"),
  uploadPhotographers,
  addPhoto
);

router.delete("/photos/:photoId", protect, authorize("photographer"), deletePhoto);

// Video management
router.post("/videos", protect, authorize("photographer"), addVideo);
router.delete("/videos/:videoId", protect, authorize("photographer"), deleteVideo);

// ===================
// ADMIN ROUTES
// ===================
router.put(
  "/admin/:id/plan",
  protect,
  authorize("admin"),
  changePhotographerPlanByAdmin
);

// Photographer management routes
router.get('/admin/photographers',protect, authorize("admin"), getPhotographersForAdmin);
router.get('/photographers/:id', protect, authorize("admin"), getPhotographerForAdmin);
router.put('/photographers/:id/toggle', protect, authorize("admin"), togglePhotographerStatusAdmin);
router.delete('/photographers/:id', protect, authorize("admin"), deletePhotographerAdmin);




export default router;
