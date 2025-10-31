import multer from "multer";
import { storage } from "../config/cloudinary.js"; 

// === Multer with Cloudinary Storage ===
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
});


//  ARTIST UPLOADS

export const uploadArtistFiles = upload.fields([
  { name: "photos", maxCount: 5 },
  { name: "mp3File", maxCount: 1 }, 
]);


//  VENUE UPLOADS

export const uploadVenuePhotos = upload.array("photos", 5);

//  NEWS UPLOADS

export const uploadNewsPhotos = upload.array("photos", 5);


//  JOURNALIST UPLOAD

export const uploadJournalistPhoto = upload.single("profilePhoto");


//  ERROR HANDLER

export const handleUploadErrors = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    // Multer-specific errors
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 10MB.",
      });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files uploaded.",
      });
    }
  }

  // Generic upload error
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Upload failed.",
    });
  }

  next();
};
