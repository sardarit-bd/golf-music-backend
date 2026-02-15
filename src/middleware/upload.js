import multer from "multer";
import { storage } from "../config/cloudinary.js";
import { ErrorResponse } from "./errorHandler.js";

// === COMMON FILE FILTER ===
const commonFileFilter = (allowedTypes, errorMessage) => {
  return (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ErrorResponse(errorMessage, 400), false);
    }
  };
};

// === IMAGE VALIDATION ===
const validateImage = (file) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.mimetype)) {
    throw new ErrorResponse(
      'Invalid image format. Only JPG, PNG, WebP allowed',
      400
    );
  }

  if (file.size > maxSize) {
    throw new ErrorResponse(
      'Image size too large. Maximum 5MB per image',
      400
    );
  }

  return true;
};

// === VIDEO VALIDATION ===
const validateVideo = (file) => {
  const allowedTypes = ["video/mp4", "video/mov", "video/avi", "video/webm", "video/mkv"];
  const maxSize = 200 * 1024 * 1024; // 200MB

  if (!allowedTypes.includes(file.mimetype)) {
    throw new ErrorResponse(
      'Invalid video format. Use MP4, MOV, AVI, MKV, or WebM',
      400
    );
  }

  if (file.size > maxSize) {
    throw new ErrorResponse(
      'Video size too large. Maximum 200MB per video',
      400
    );
  }

  return true;
};

// === AUDIO VALIDATION ===
const validateAudio = (file) => {
  const allowedTypes = ["audio/mpeg", "audio/wav", "audio/mp3", "audio/m4a"];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.mimetype)) {
    throw new ErrorResponse(
      'Invalid audio format. Use MP3, WAV, or M4A',
      400
    );
  }

  if (file.size > maxSize) {
    throw new ErrorResponse(
      'Audio size too large. Maximum 10MB per audio file',
      400
    );
  }

  return true;
};

// === MULTER INSTANCES ===

// 1. CAST (Video + Thumbnail) - Updated with Cloudinary storage
export const uploadCastFiles = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB max per file
  },
  fileFilter: (req, file, cb) => {
    try {
      if (file.fieldname === "video") {
        validateVideo(file);
      } else if (file.fieldname === "thumbnail") {
        validateImage(file);
      }
      cb(null, true);
    } catch (error) {
      cb(error, false);
    }
  }
}).fields([
  { name: "video", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 }
]);

// 2. CAST VIDEO ONLY
export const uploadCastVideo = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
  fileFilter: commonFileFilter(
    ["video/mp4", "video/mov", "video/avi", "video/webm", "video/mkv"],
    "Invalid video format. Use MP4, MOV, AVI, MKV, or WebM"
  )
}).single("video");

// 3. ADMIN PROFILE PHOTO
export const uploadAdminProfilePhoto = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: commonFileFilter(
    ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    "Invalid image format. Only JPG, PNG, WebP allowed for profile"
  )
}).single("profilePhoto");

// 4. EVENT IMAGE
export const uploadEventImage = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: commonFileFilter(
    ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"],
    "Invalid image format. Only JPG, PNG, WebP, GIF allowed"
  )
}).single("image");

// 5. FOOTER LOGO
export const uploadFooterLogo = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: commonFileFilter(
    ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/svg+xml"],
    "Invalid logo format. Only JPG, PNG, WebP, SVG allowed"
  )
}).single("logo");

// 6. ARTIST FILES (Photos + MP3)
export const uploadArtistFiles = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
  },
  fileFilter: (req, file, cb) => {
    try {
      if (file.fieldname === "photos") {
        validateImage(file);
      } else if (file.fieldname === "mp3Files") {
        validateAudio(file);
      }
      cb(null, true);
    } catch (error) {
      cb(error, false);
    }
  }
}).fields([
  { name: "photos", maxCount: 5 },
  { name: "mp3Files", maxCount: 5 }
]);

// 7. HERO VIDEO
export const uploadHeroVideo = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
  fileFilter: commonFileFilter(
    ["video/mp4", "video/mov", "video/avi", "video/webm", "video/mkv"],
    "Invalid video format. Use MP4, MOV, AVI, MKV, or WebM"
  )
}).single("video");

// 8. FEATURED IMAGE
export const uploadFeaturedImage = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
  fileFilter: commonFileFilter(
    ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    "Invalid image format. Only JPG, PNG, WebP allowed"
  )
}).single("image");

// 9. MERCH IMAGE
export const uploadMerchImage = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: commonFileFilter(
    ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    "Invalid image format. Only JPG, PNG, WebP allowed for merch"
  )
}).single("image");

// 10. WAVE (PODCAST) THUMBNAIL
export const uploadWaveThumbnail = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: commonFileFilter(
    ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    "Invalid thumbnail format. Only JPG, PNG, WebP allowed"
  )
}).single("thumbnail");

// 11. CAST (PODCAST) THUMBNAIL
export const uploadCastThumbnail = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: commonFileFilter(
    ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    "Invalid thumbnail format. Only JPG, PNG, WebP allowed"
  )
}).single("thumbnail");

// 12. VENUE PHOTOS
export const uploadVenuePhotos = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
  },
  fileFilter: commonFileFilter(
    ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    "Invalid image format. Only JPG, PNG, WebP allowed for venue photos"
  )
}).array("photos", 5); // Max 5 photos

// 13. NEWS PHOTOS
export const uploadNewsPhotos = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
  },
  fileFilter: (req, file, cb) => {
    try {
      validateImage(file);
      cb(null, true);
    } catch (error) {
      cb(error, false);
    }
  }
}).array("photos", 5); // Max 5 photos for news

// 14. JOURNALIST PROFILE PHOTO
export const uploadJournalistPhoto = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: commonFileFilter(
    ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    "Invalid profile photo format. Only JPG, PNG, WebP allowed"
  )
}).single("profilePhoto");

// 15. SPONSOR LOGO
export const uploadSingleSponsorLogo = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: commonFileFilter(
    ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/svg+xml"],
    "Invalid logo format. Only JPG, PNG, WebP, SVG allowed"
  )
}).single("logo");

// 16. STUDIO PHOTOS
export const uploadStudioPhotos = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ErrorResponse("Invalid image format. Only JPG, PNG, WebP allowed", 400), false);
    }
  }
}).array("photos", 5);

// 17. STUDIO AUDIO
export const uploadStudioAudio = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["audio/mpeg", "audio/wav", "audio/mp3", "audio/m4a"];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ErrorResponse("Invalid audio format. Use MP3, WAV, or M4A", 400), false);
    }
  }
}).single("audio");

// 18. PHOTOGRAPHER PHOTOS
export const uploadPhotographers = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
  },
  fileFilter: commonFileFilter(
    ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    "Invalid image format. Only JPG, PNG, WebP allowed"
  )
}).array("photos", 5);

// 19. USER PROFILE PHOTO (Generic)
export const uploadUserProfilePhoto = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: commonFileFilter(
    ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    "Invalid profile photo format. Only JPG, PNG, WebP allowed"
  )
}).single("profilePhoto");

// 20. BULK UPLOAD (CSV/Excel)
export const uploadBulkFile = multer({
  storage: storage, // ✅ Cloudinary storage
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: commonFileFilter(
    ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    "Invalid file format. Only CSV, XLS, XLSX allowed"
  )
}).single("file");

// === ERROR HANDLING MIDDLEWARE ===
export const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    let message = "File upload error";

    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        message = "File too large. Please check maximum file size limits.";
        break;
      case "LIMIT_FILE_COUNT":
        message = "Too many files uploaded. Please check maximum file count.";
        break;
      case "LIMIT_UNEXPECTED_FILE":
        message = "Unexpected file field. Please check field names.";
        break;
      default:
        message = err.message;
    }

    return next(new ErrorResponse(message, 400));
  }

  if (err instanceof ErrorResponse) {
    return next(err);
  }

  if (err) {
    return next(new ErrorResponse(err.message || "Upload error occurred", 400));
  }

  next();
};

// === HELPER FUNCTION TO VALIDATE FILE TYPE ===
export const validateFileType = (file, allowedTypes) => {
  if (!file) return true;

  if (Array.isArray(file)) {
    return file.every(f => allowedTypes.includes(f.mimetype));
  }

  return allowedTypes.includes(file.mimetype);
};

// === HELPER FUNCTION TO VALIDATE FILE SIZE ===
export const validateFileSize = (file, maxSizeMB) => {
  if (!file) return true;

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (Array.isArray(file)) {
    return file.every(f => f.size <= maxSizeBytes);
  }

  return file.size <= maxSizeBytes;
};

// === MIDDLEWARE TO CHECK IF FILES WERE UPLOADED ===
export const checkFilesUploaded = (fieldNames) => {
  return (req, res, next) => {
    const missingFiles = [];

    fieldNames.forEach(field => {
      if (!req.files || !req.files[field] || req.files[field].length === 0) {
        missingFiles.push(field);
      }
    });

    if (missingFiles.length > 0) {
      return next(new ErrorResponse(
        `Required file(s) missing: ${missingFiles.join(', ')}`,
        400
      ));
    }

    next();
  };
};

// === MIDDLEWARE TO VALIDATE SPECIFIC FILE ===
export const validateSpecificFile = (fieldName, allowedTypes, maxSizeMB) => {
  return (req, res, next) => {
    const file = req.file || (req.files && req.files[fieldName]);

    if (!file) {
      return next();
    }

    // Check file type
    if (!validateFileType(file, allowedTypes)) {
      return next(new ErrorResponse(
        `Invalid file type for ${fieldName}. Allowed: ${allowedTypes.join(', ')}`,
        400
      ));
    }

    // Check file size
    if (!validateFileSize(file, maxSizeMB)) {
      return next(new ErrorResponse(
        `File too large for ${fieldName}. Maximum: ${maxSizeMB}MB`,
        400
      ));
    }

    next();
  };
};

// === EXPORT ALL UPLOAD MIDDLEWARE ===
export default {
  uploadCastFiles,
  uploadCastVideo,
  uploadAdminProfilePhoto,
  uploadEventImage,
  uploadFooterLogo,
  uploadArtistFiles,
  uploadHeroVideo,
  uploadFeaturedImage,
  uploadMerchImage,
  uploadWaveThumbnail,
  uploadCastThumbnail,
  uploadVenuePhotos,
  uploadNewsPhotos,
  uploadJournalistPhoto,
  uploadSingleSponsorLogo,
  uploadStudioPhotos,
  uploadStudioAudio,
  uploadPhotographers,
  uploadUserProfilePhoto,
  uploadBulkFile,
  handleUploadErrors,
  validateFileType,
  validateFileSize,
  checkFilesUploaded,
  validateSpecificFile
};