import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';


dotenv.config();
// === Cloudinary Configuration ===
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// === Dynamic Cloudinary Storage ===
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = 'gulf-music/uploads';
    let resource_type = 'image';
    let allowed_formats = ['jpg', 'jpeg', 'png', 'webp'];

    //  If audio file (e.g. mp3, wav)
    if (file.mimetype.startsWith('audio/')) {
      resource_type = 'video'; // Cloudinary treats audio as video
      folder = 'gulf-music/audio';
      allowed_formats = ['mp3', 'wav', 'ogg'];
    }

    //  If video file (e.g. mp4, mov)
    else if (file.mimetype.startsWith('video/')) {
      resource_type = 'video';
      folder = 'gulf-music/video';
      allowed_formats = ['mp4', 'mov', 'avi', 'mkv'];
    }

    //  If image file
    else if (file.mimetype.startsWith('image/')) {
      resource_type = 'image';
      folder = 'gulf-music/images';
      allowed_formats = ['jpg', 'jpeg', 'png', 'webp'];
    }

    return {
      folder,
      resource_type,
      allowed_formats,
      public_id: file.originalname.split('.')[0] + '-' + Date.now(),
    };
  },
});

export { cloudinary, storage };
