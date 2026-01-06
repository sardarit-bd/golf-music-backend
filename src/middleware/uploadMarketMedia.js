import multer from "multer";
import { storage } from "../config/cloudinary.js";

// 20MB image, 200MB video (Cloudinary handles it)
const uploadMarketMedia = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed"), false);
    }
  },
}).fields([
  { name: "photos", maxCount: 5 },
  { name: "video", maxCount: 1 },
]);

export default uploadMarketMedia;
