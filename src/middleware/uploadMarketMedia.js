import multer from 'multer';
import { storage } from '../config/cloudinary.js';
import { ErrorResponse } from './errorHandler.js';

// File size limits
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB

// Allowed file types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 
  'image/jpg', 
  'image/png', 
  'image/webp'
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/mov', 
  'video/avi',
  'video/webm',
  'video/mkv'
];

const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/aac',
  'audio/flac'
];

// File validation function
const validateFile = (file, allowedTypes, maxSize, fieldName) => {
  if (!allowedTypes.includes(file.mimetype)) {
    const types = allowedTypes.map(t => t.split('/')[1]).join(', ');
    throw new ErrorResponse(
      `Invalid ${fieldName} format. Allowed: ${types}`,
      400
    );
  }
  
  if (file.size > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024);
    throw new ErrorResponse(
      `${fieldName} too large. Maximum: ${maxSizeMB}MB`,
      400
    );
  }
  
  return true;
};

// Multer configuration for market
const uploadMarketMedia = multer({
  storage: storage, // Use the existing Cloudinary storage
  fileFilter: (req, file, cb) => {
    try {
      // Validate based on field name
      switch (file.fieldname) {
        case 'photos':
          validateFile(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE, 'image');
          break;
          
        case 'video':
          validateFile(file, ALLOWED_VIDEO_TYPES, MAX_VIDEO_SIZE, 'video');
          break;
          
        case 'audio':
        case 'audioFile':
          validateFile(file, ALLOWED_AUDIO_TYPES, MAX_AUDIO_SIZE, 'audio');
          break;
          
        default:
          // For unknown fields, allow images and videos
          if (file.mimetype.startsWith('image/')) {
            validateFile(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE, 'file');
          } else if (file.mimetype.startsWith('video/')) {
            validateFile(file, ALLOWED_VIDEO_TYPES, MAX_VIDEO_SIZE, 'file');
          } else if (file.mimetype.startsWith('audio/')) {
            validateFile(file, ALLOWED_AUDIO_TYPES, MAX_AUDIO_SIZE, 'file');
          } else {
            throw new ErrorResponse(
              'Invalid file type. Only images, videos, and audio files are allowed',
              400
            );
          }
      }
      
      cb(null, true);
      
    } catch (error) {
      cb(error, false);
    }
  },
  limits: {
    fileSize: MAX_VIDEO_SIZE, // Global limit (video size)
    files: 10 // Maximum 10 files total
  }
}).fields([
  { name: 'photos', maxCount: 5 },      // Max 5 photos
  { name: 'video', maxCount: 1 },       // Max 1 video
  { name: 'audio', maxCount: 1 },       // Max 1 audio (for studio)
  { name: 'audioFile', maxCount: 1 }    // Max 1 audio file
]);

export default uploadMarketMedia;