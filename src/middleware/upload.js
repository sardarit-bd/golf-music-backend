import multer from "multer";
import { storage } from "../config/cloudinary.js";

// === Multer with Cloudinary Storage ===
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (req, file, cb) => {
    // Accept video files for "video" field
    if (file.fieldname === "video") {
      const allowedTypes = ["video/mp4", "video/mov", "video/avi", "video/webm", "video/mkv"];
      if (!allowedTypes.includes(file.mimetype)) {
        return cb(new Error("Invalid video format. Use MP4, MOV, AVI, MKV, or WebM"), false);
      }
    }

    // Accept image files for "thumbnail" field
    if (file.fieldname === "thumbnail") {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(file.mimetype)) {
        return cb(new Error("Invalid image format. Use JPG, PNG, WebP or GIF"), false);
      }
    }

    cb(null, true);
  }
});


export const uploadCastFiles = (req, res, next) => {
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 }
  ])(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      console.error("Multer Error:", err);
      return res.status(400).json({
        success: false,
        message: err.code === "LIMIT_FILE_SIZE" 
          ? "File too large. Maximum 200MB allowed." 
          : err.message
      });
    } else if (err) {
      console.error("Upload Error:", err);
      return res.status(400).json({
        success: false,
        message: err.message || "File upload error"
      });
    }
    next();
  });
};

export const uploadCastVideo = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
}).single("video");


// === ADMIN PROFILE PHOTO UPLOAD ===
export const uploadAdminProfilePhoto = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single("profilePhoto");

const memoryStorage = multer.memoryStorage();

export const uploadPhotographers = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
}).array("photos", 5);

// EVENT image upload
export const uploadEventImage = upload.single("image");

// uploadFooterLogo

export const uploadFooterLogo = multer({
  storage,
}).single("logo");

//  ARTIST UPLOADS

export const uploadArtistFiles = upload.fields([
  { name: "photos", maxCount: 5 },
  { name: "mp3Files", maxCount: 5 },
]);


// Only allow video uploads
export const uploadHeroVideo = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
}).single("video");


// uploadFeaturedImage
export const uploadFeaturedImage = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
}).single("image");

// === MERCH (PRODUCT) UPLOAD ===
export const uploadMerchImage = upload.single("image");

// === Wave (PODCAST) UPLOAD ===

export const uploadWaveThumbnail = upload.single("thumbnail");

// === CAST (PODCAST) UPLOAD ===

export const uploadCastThumbnail = upload.single("thumbnail");


//  VENUE UPLOADS

export const uploadVenuePhotos = upload.array("photos", 5);

//  NEWS UPLOADS



export const uploadNewsPhotos = upload.array("photos", 5);


//  JOURNALIST UPLOAD

export const uploadJournalistPhoto = upload.single("profilePhoto");


export const uploadSingleSponsorLogo = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}).single("logo");


//  ERROR HANDLER

export const handleUploadErrors = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 10MB.",
      });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files uploaded. Maximum 5 photos allowed.",
      });
    }
  }

  console.log('Upload Error:', error);
  next(error);
};
