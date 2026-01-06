import multer from "multer";
import { storage } from "../config/cloudinary.js"; 

// === Multer with Cloudinary Storage ===
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});



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
