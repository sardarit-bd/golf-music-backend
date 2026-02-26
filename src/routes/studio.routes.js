import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
    getStudioProfile,
    updateStudioProfile,
    updateServices,
    uploadPhotos,
    uploadAudioFile,
    deletePhoto,
    deleteAudioFile,
    getStudiosByLocation,
    getAllStudios,
    getStudioById,
    updateStudioStatus,
    deleteStudio,
    getStudioPublic,
} from "../controllers/controllers.studio.js";
import { uploadStudioPhotos, uploadStudioAudio } from "../middleware/upload.js";
import multer from "multer";

const router = express.Router();

// ========== PUBLIC ROUTES ==========
router.get("/location", getStudiosByLocation);
router.get("/public/:id", getStudioPublic);

// ========== PROTECTED ROUTES (Studio Owner) ==========
router.use(protect);

// Profile routes
router.get("/profile", getStudioProfile);
router.put("/profile", updateStudioProfile);
router.put("/services", updateServices);

// 🔥 FIXED: Photo upload with better error handling
router.post("/photos", (req, res, next) => {
    uploadStudioPhotos(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({
                success: false,
                message: err.code === 'LIMIT_FILE_SIZE' 
                    ? 'File too large. Maximum 10MB per photo.' 
                    : err.code === 'LIMIT_FILE_COUNT'
                    ? 'Too many files. Maximum 5 photos allowed.'
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

// Audio upload with better error handling
router.post("/audio", (req, res, next) => {
    uploadStudioAudio(req, res, (err) => {
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

// Delete routes
router.delete("/photos/:photoId", deletePhoto);
router.delete("/audio", deleteAudioFile);

// ========== ADMIN ROUTES ==========
router.get("/admin/all", authorize("admin"), getAllStudios);
router.get("/admin/:id", authorize("admin"), getStudioById);
router.put("/admin/status/:id", authorize("admin"), updateStudioStatus);
router.delete("/admin/:id", authorize("admin"), deleteStudio);

export default router;