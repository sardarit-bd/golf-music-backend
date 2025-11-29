import express from "express";
import { addPhoto, addService, addVideo, deletePhoto, deleteService, deleteVideo, getAllPhotographers, getPhotographerById, getPhotographerProfile, updatePhotographerProfile, updateService } from "../controllers/controller.photographer.js";
import { protect } from "../middleware/auth.js";
import { uploadPhotographers } from "../middleware/upload.js";


const router = express.Router();

// Public routes
router.get("/", getAllPhotographers);

// profile route must be BEFORE :id
router.get("/profile", protect, getPhotographerProfile);

// Then dynamic ID route
router.get("/:id", getPhotographerById);

// Protected routes
router.put("/profile", protect, updatePhotographerProfile);

// Service management
router.post("/services", protect, addService);
router.put("/services/:serviceId", protect, updateService);
router.delete("/services/:serviceId", protect, deleteService);

// Photo management
router.post("/photos", protect, uploadPhotographers, addPhoto);

router.delete("/photos/:photoId", protect, deletePhoto);

// Video management
router.post("/videos", protect, addVideo);
router.delete("/videos/:videoId", protect, deleteVideo);

export default router;
