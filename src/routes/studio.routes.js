import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  // User routes
  getStudioProfile,
  updateStudioProfile,
  updateServices,
  uploadPhotos,
  uploadAudioFile,
  deletePhoto,
  deleteAudioFile,
  getStudiosByLocation,
  
  // Admin routes
  getAllStudios,
  getStudioById,
  updateStudioStatus,
  deleteStudio,
} from "../controllers/controllers.studio.js";
import { uploadStudioAudio, uploadStudioPhotos } from "../middleware/upload.js";
import multer from "multer";

const router = express.Router();

// Public routes
router.get("/location", getStudiosByLocation);

// Protected user routes (Studio owners only)
router.use(protect);

// Studio user routes
router.get("/profile", getStudioProfile);
router.put("/profile", updateStudioProfile);
router.put("/services", updateServices);

// Photos upload with error handling
router.post("/photos", (req, res, next) => {
  uploadStudioPhotos(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: err.code === 'LIMIT_FILE_SIZE' 
          ? 'File too large. Maximum 10MB per photo.' 
          : 'File upload error: ' + err.message
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error'
      });
    }
    next();
  });
}, uploadPhotos);

// Audio upload with error handling
router.post("/audio", (req, res, next) => {
  uploadStudioAudio(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: err.code === 'LIMIT_FILE_SIZE' 
          ? 'File too large. Maximum 50MB for audio.' 
          : 'File upload error: ' + err.message
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error'
      });
    }
    next();
  });
}, uploadAudioFile);

router.delete("/photos/:photoId", deletePhoto);
router.delete("/audio", deleteAudioFile);

// Admin routes
router.get("/admin/all", authorize("admin"), getAllStudios);
router.get("/admin/:id", authorize("admin"), getStudioById);
router.put("/admin/status/:id", authorize("admin"), updateStudioStatus);
router.delete("/admin/:id", authorize("admin"), deleteStudio);

export default router;