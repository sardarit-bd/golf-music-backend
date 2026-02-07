import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// === Cloudinary Configuration ===
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME || process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Always use HTTPS
});

// === Helper Functions ===

// Get file extension from mimetype
const getFileExtension = (mimetype) => {
  const mimeToExt = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/mov': 'mov',
    'video/avi': 'avi',
    'video/webm': 'webm',
    'video/mkv': 'mkv',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/mp3': 'mp3',
    'audio/aac': 'aac',
    'audio/flac': 'flac',
    'audio/ogg': 'ogg',
    'text/csv': 'csv',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  };
  
  return mimeToExt[mimetype] || 'bin';
};

// Generate dynamic folder based on request and file type
const generateFolderPath = (req, file) => {
  let baseFolder = 'gulf-music';
  let subFolder = '';
  let typeFolder = '';
  
  // Determine sub-folder based on route
  if (req.baseUrl) {
    if (req.baseUrl.includes('/api/news')) {
      subFolder = '/news';
    } else if (req.baseUrl.includes('/api/artists')) {
      subFolder = '/artists';
    } else if (req.baseUrl.includes('/api/venues')) {
      subFolder = '/venues';
    } else if (req.baseUrl.includes('/api/journalists')) {
      subFolder = '/journalists';
    } else if (req.baseUrl.includes('/api/studios')) {
      subFolder = '/studios';
    } else if (req.baseUrl.includes('/api/cameras') || req.baseUrl.includes('/api/photographers')) {
      subFolder = '/photographers';
    } else if (req.baseUrl.includes('/api/casts')) {
      subFolder = '/casts';
    } else if (req.baseUrl.includes('/api/waves')) {
      subFolder = '/waves';
    } else if (req.baseUrl.includes('/api/merch')) {
      subFolder = '/merch';
    } else if (req.baseUrl.includes('/api/sponsors')) {
      subFolder = '/sponsors';
    } else if (req.baseUrl.includes('/api/admin')) {
      subFolder = '/admin';
    } else if (req.baseUrl.includes('/api/users')) {
      subFolder = '/users';
    } else if (req.baseUrl.includes('/api/events')) {
      subFolder = '/events';
    } else if (req.baseUrl.includes('/api/market')) {
      subFolder = '/market';
    }
  }
  
  // Determine type folder based on file type
  if (file.mimetype.startsWith('image/')) {
    typeFolder = '/images';
    
    // Further categorization for images
    if (file.fieldname === 'profilePhoto' || file.fieldname === 'thumbnail') {
      typeFolder += '/profile';
    } else if (file.fieldname === 'logo') {
      typeFolder += '/logos';
    } else if (file.fieldname === 'photos') {
      typeFolder += '/gallery';
    }
  } else if (file.mimetype.startsWith('video/')) {
    typeFolder = '/videos';
    
    if (file.fieldname === 'video') {
      typeFolder += '/main';
    } else if (file.fieldname === 'trailer') {
      typeFolder += '/trailers';
    }
  } else if (file.mimetype.startsWith('audio/')) {
    typeFolder = '/audio';
    
    if (file.fieldname === 'mp3Files') {
      typeFolder += '/tracks';
    } else if (file.fieldname === 'audio') {
      typeFolder += '/samples';
    }
  } else {
    typeFolder = '/documents';
  }
  
  // Clean up folder path
  const folderPath = `${baseFolder}${subFolder}${typeFolder}`.replace(/\/+/g, '/');
  return folderPath;
};

// Generate unique public ID
const generatePublicId = (req, file) => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const originalName = path.parse(file.originalname).name;
  
  // Clean filename
  const cleanName = originalName
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .substring(0, 50); // Limit length
  
  const fieldName = file.fieldname || 'file';
  
  return `${fieldName}-${cleanName}-${timestamp}-${randomString}`;
};

// === Dynamic Cloudinary Storage ===
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const folder = generateFolderPath(req, file);
    const publicId = generatePublicId(req, file);
    
    // Determine resource type
    let resource_type = 'auto';
    if (file.mimetype.startsWith('image/')) {
      resource_type = 'image';
    } else if (file.mimetype.startsWith('video/')) {
      resource_type = 'video';
    } else if (file.mimetype.startsWith('audio/')) {
      resource_type = 'video'; // Cloudinary treats audio as video resource
    } else {
      resource_type = 'raw';
    }
    
    // Set format based on file type
    let format = undefined;
    if (file.mimetype.startsWith('image/')) {
      // Convert all images to webp for better compression
      format = 'webp';
    }
    
    // Transformation options
    const transformation = [];
    
    if (resource_type === 'image') {
      transformation.push(
        { width: 1920, height: 1080, crop: 'limit' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      );
    }
    
    return {
      folder,
      public_id: publicId,
      resource_type,
      format,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'mp3', 'wav', 'pdf'],
      transformation,
      overwrite: false, // Prevent overwriting
      invalidate: true, // Invalidate CDN cache
      type: 'upload',
      access_mode: 'public',
      tags: ['gulf-music', file.fieldname || 'upload'],
      context: {
        upload_source: 'gulf-music-website',
        original_filename: file.originalname,
        upload_timestamp: Date.now().toString()
      }
    };
  },
});

// === Helper Functions for Cloudinary Operations ===

const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true
    });
    
    if (result.result !== 'ok') {
      console.warn(`Cloudinary deletion may have failed for ${publicId}:`, result);
    }
    
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    // Don't throw error for failed deletions in production
    if (process.env.NODE_ENV === 'production') {
      return { result: 'failed', error: error.message };
    }
    throw error;
  }
};


const uploadToCloudinary = async (filePath, options = {}) => {
  try {
    const defaultOptions = {
      folder: 'gulf-music/direct-uploads',
      resource_type: 'auto',
      overwrite: false,
      invalidate: true,
      ...options
    };
    
    const result = await cloudinary.uploader.upload(filePath, defaultOptions);
    return result;
  } catch (error) {
    console.error('Cloudinary direct upload error:', error);
    throw error;
  }
};

const getCloudinaryInfo = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType
    });
    return result;
  } catch (error) {
    console.error('Cloudinary get info error:', error);
    if (error.http_code === 404) {
      return null; // File not found
    }
    throw error;
  }
};

const bulkDeleteFromCloudinary = async (publicIds, resourceType = 'image') => {
  try {
    const result = await cloudinary.api.delete_resources(publicIds, {
      resource_type: resourceType,
      type: 'upload',
      invalidate: true
    });
    return result;
  } catch (error) {
    console.error('Cloudinary bulk delete error:', error);
    throw error;
  }
};

const generateUploadSignature = (options = {}) => {
  const timestamp = Math.round(Date.now() / 1000);
  
  const params = {
    timestamp,
    folder: options.folder || 'gulf-music/direct',
    resource_type: options.resourceType || 'auto',
    ...options
  };
  
  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);
  
  return {
    signature,
    timestamp,
    api_key: process.env.CLOUDINARY_API_KEY,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME,
    ...params
  };
};

const extractPublicIdFromUrl = (url) => {
  try {
    // Match pattern: https://res.cloudinary.com/cloudname/resource_type/upload/v1234567890/folder/public_id.extension
    const matches = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.(?:jpg|jpeg|png|webp|gif|mp4|mov|mp3|wav)/);
    if (matches && matches[1]) {
      return matches[1];
    }
    return null;
  } catch (error) {
    console.error('Error extracting public ID:', error);
    return null;
  }
};

const optimizeImageUrl = (url, transformations = {}) => {
  try {
    if (!url || !url.includes('cloudinary.com')) {
      return url;
    }
    
    const publicId = extractPublicIdFromUrl(url);
    if (!publicId) {
      return url;
    }
    
    const defaultTransformations = {
      width: transformations.width || 800,
      height: transformations.height || null,
      crop: transformations.crop || 'limit',
      quality: transformations.quality || 'auto',
      format: transformations.format || 'webp'
    };
    
    let transformString = `c_${defaultTransformations.crop},w_${defaultTransformations.width}`;
    
    if (defaultTransformations.height) {
      transformString += `,h_${defaultTransformations.height}`;
    }
    
    transformString += `,q_${defaultTransformations.quality},f_${defaultTransformations.format}`;
    
    // Replace the upload part with transformations
    return url.replace(/\/upload\//, `/upload/${transformString}/`);
  } catch (error) {
    console.error('Error optimizing image URL:', error);
    return url;
  }
};

// === Configuration Validation ===
const validateCloudinaryConfig = () => {
  const requiredEnvVars = [
  'CLOUDINARY_NAME',
  'CLOUDINARY_API_KEY', 
  'CLOUDINARY_API_SECRET'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(`⚠️ Missing Cloudinary environment variables: ${missingVars.join(', ')}`);
    console.warn('File uploads will fail without proper Cloudinary configuration.');
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required Cloudinary environment variables: ${missingVars.join(', ')}`);
    }
  } else {
    console.log('✅ Cloudinary configuration loaded successfully');
  }
};

// Validate configuration on startup
validateCloudinaryConfig();

// Export everything
export { 
  cloudinary, 
  storage,
  deleteFromCloudinary,
  uploadToCloudinary,
  getCloudinaryInfo,
  bulkDeleteFromCloudinary,
  generateUploadSignature,
  extractPublicIdFromUrl,
  optimizeImageUrl
};